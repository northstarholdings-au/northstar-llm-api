const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// === DEMO ROUTES ===
const DEMO_EMAILS_FILE = "C:\\northstar-verdact\\demo_emails.json";
const SERVICE_NAME = "Verdact";
function getDemoEmails() { try { return JSON.parse(fs.readFileSync(DEMO_EMAILS_FILE, "utf8")); } catch(e) { return []; } }
function addDemoEmail(email) { const e = getDemoEmails(); e.push(email.toLowerCase()); fs.writeFileSync(DEMO_EMAILS_FILE, JSON.stringify(e)); }
function buildDemoPrompt(data) {
  return `You are the Verdact NDIS Compliance Engine. Assess Standards 1 and 2 only (max 280 words). Provider: {provider_name}. Registration: {registration_type}. Supports: {support_types}. Produce: 1. STANDARD 1 ASSESSMENT. 2. STANDARD 2 ASSESSMENT. 3. PRIORITY GAP. 4. IMMEDIATE ACTION.`.replace(/\{(\w+)\}/g, (m, k) => data[k] || "");
}
function notifyDirectorDemo(data, runId) {
  const payload = JSON.stringify({from:"NorthStar Demo <onboarding@resend.dev>",to:["director@northstarholdings.com.au"],subject:"[DEMO] Verdact — "+(data.name||"Unknown")+" — "+(data.organisation||"Unknown"),html:"<div style='font-family:sans-serif;background:#0a1628;color:#e8edf5;padding:32px;'><h2 style='color:#4a7fc1;'>New Demo — Verdact</h2><p><b>Name:</b> "+(data.name||"N/A")+"</p><p><b>Email:</b> "+(data.email||"N/A")+"</p><p><b>Organisation:</b> "+(data.organisation||"N/A")+"</p><p><b>Role:</b> "+(data.role||"N/A")+"</p><p><b>Heard via:</b> "+(data.hear_about||"N/A")+"</p><p><b>Run ID:</b> "+runId+"</p></div>"});
  const opts = {hostname:"api.resend.com",path:"/emails",method:"POST",headers:{"Authorization":"Bearer "+RESEND_API_KEY,"Content-Type":"application/json","Content-Length":Buffer.byteLength(payload)}};
  const rq = https.request(opts,()=>{}); rq.on("error",()=>{}); rq.write(payload); rq.end();
}
// === END DEMO ROUTES ===

const PORT = 8085;
const BASE_DIR = "C:\\northstar-verdact";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.VERDACT_WEBHOOK_SECRET || "";
const STRIPE_PRICE_FOUNDATION = process.env.STRIPE_PRICE_VERDACT_FOUNDATION || "";
const STRIPE_PRICE_FULL = process.env.STRIPE_PRICE_VERDACT_FULL || "";
const STRIPE_PRICE_BUNDLE = process.env.STRIPE_PRICE_VERDACT_BUNDLE || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const LLM_API_KEY = "ns-tri-1dad2d0d2693";
const BASE_URL = "https://verdact.northstarholdings.com.au";
const OUTPUT_DIR = BASE_DIR + "\\outputs";

try { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); } catch(e) {}
function log(msg) { try { fs.appendFileSync(BASE_DIR + "\\verdact.log", new Date().toISOString() + " " + msg + "\n"); } catch(e) {} }

const SYSTEM_PROMPT = `You are the Verdact NDIS Compliance Engine v1.0.
You analyse NDIS provider submissions and produce two structured outputs aligned to the NDIS Practice Standards.

The eight NDIS Practice Standards:
1. Rights and Responsibilities
2. Governance and Operational Management
3. The Provision of Supports
4. Support Provision Environment
5. Participant Wellbeing
6. Feedback and Complaints Management
7. Human Resources
8. Incident Management

OUTPUT A: NDIS Evidence Pack (structured plain text, numbered sections):
1. PROVIDER PROFILE — Summary of organisation and support context
2. STANDARDS ASSESSMENT — For each relevant standard: current evidence status, gaps identified, quality indicators addressed
3. CRITICAL GAPS — Top priority compliance gaps requiring immediate remediation
4. REMEDIATION PRIORITIES — Ordered action list with specific guidance
5. VERDACT COMPLIANCE SCORE — Overall 0-100 with grade

OUTPUT B: Verdact Compliance Schema (valid JSON starting with open brace)

Rules:
- Base all outputs exclusively on submitted information
- Never fabricate policies, evidence, or compliance history
- Flag [NOT EVIDENCED] for any standard with insufficient submitted evidence
- Include specific, actionable remediation guidance
- Professional language throughout
- IMPORTANT: These are preparation aids only — do not make guarantees about audit outcomes`;

function buildPrompt(meta, tier) {
  const standards = tier === "foundation" ? "Standards 1-4 only" : "All eight standards";
  return `${SYSTEM_PROMPT}

COVERAGE: ${standards}

SUBMISSION:
Provider: ${meta.provider_name || ""} (NDIS: ${meta.provider_number || "Not provided"})
Registration Type: ${meta.registration_type || ""}
Participants Supported: ${meta.participant_count || ""}
Support Types: ${meta.support_types || ""}
Participant Cohort: ${meta.participant_cohort || ""}
Existing Policies: ${meta.existing_policies || ""}
Worker Screening: ${meta.worker_screening || ""}
Incident History: ${meta.incident_history || ""}
Known Gaps: ${meta.compliance_gaps || "None disclosed"}
Additional Context: ${meta.additional_context || "None"}

Produce OUTPUT A (numbered sections) then OUTPUT B (JSON starting with open brace).`;
}

function callLLM(prompt, callback) {
  const payload = JSON.stringify({ model: "gemma3:4b", prompt, stream: false, options: { temperature: 0.2, num_predict: 4000 } });
  const headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) };
  if (LLM_API_KEY) headers["x-api-key"] = LLM_API_KEY;
  const opts = { hostname: "127.0.0.1", port: 8080, path: "/api/generate", method: "POST", headers };
  const req = http.request(opts, (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { callback(null, JSON.parse(d).response || ""); } catch(e) { callback(e); } }); });
  req.on("error", callback); req.write(payload); req.end();
}

function stripeRequest(method, endpoint, data, callback) {
  const body = data ? new URLSearchParams(data).toString() : "";
  const opts = { hostname: "api.stripe.com", path: "/v1" + endpoint, method, headers: { "Authorization": "Bearer " + STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) } };
  const req = https.request(opts, (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { callback(null, JSON.parse(d)); } catch(e) { callback(e); } }); });
  req.on("error", callback); if (body) req.write(body); req.end();
}

function sendEmail(to, subject, html, packText, jsonStr, runId, callback) {
  const packB64 = Buffer.from(packText).toString("base64");
  const jsonB64 = Buffer.from(jsonStr).toString("base64");
  const payload = JSON.stringify({ from: "Verdact by NorthStar <onboarding@resend.dev>", to: [to], subject, html, attachments: [{ filename: `Verdact_Evidence_Pack_${runId}.txt`, content: packB64 }, { filename: `Verdact_Schema_${runId}.json`, content: jsonB64 }] });
  const opts = { hostname: "api.resend.com", path: "/emails", method: "POST", headers: { "Authorization": "Bearer " + RESEND_API_KEY, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } };
  const req = https.request(opts, (res) => { callback(res.statusCode === 200); }); req.on("error", () => callback(false)); req.write(payload); req.end();
}

function processOrder(meta, email, runId) {
  const tier = meta.tier || "full";
  log("Processing Verdact order " + runId + " tier=" + tier + " for " + email);
  callLLM(buildPrompt(meta, tier), (err, raw) => {
    if (err) { log("LLM error: " + err.message); return; }
    const jsonStart = raw.lastIndexOf("{");
    const packText = jsonStart > 0 ? raw.substring(0, jsonStart).trim() : raw;
    let schema = {}; try { schema = JSON.parse(raw.substring(jsonStart)); } catch(e) {}
    const jsonStr = JSON.stringify(schema, null, 2);
    fs.writeFileSync(path.join(OUTPUT_DIR, runId + "_pack.txt"), packText);
    fs.writeFileSync(path.join(OUTPUT_DIR, runId + "_schema.json"), jsonStr);
    const html = `<div style="font-family:sans-serif;background:#0a1628;color:#e8edf5;padding:40px;max-width:600px;margin:0 auto;"><h1 style="color:#1abc9c;">Your Verdact evidence pack is ready</h1><p style="color:#8898aa;">Run ID: ${runId} | Provider: ${meta.provider_name || "Submitted"}</p><p>Attached: NDIS Evidence Pack and Verdact Compliance Schema (JSON).</p><p style="color:#8898aa;font-size:12px;margin-top:32px;">Verdact outputs are structured preparation aids only. They do not constitute compliance or legal advice and do not guarantee audit outcomes.<br>NorthStar Holdings Trust | ABN 67 387 124 760</p></div>`;
    sendEmail(email, "Your Verdact NDIS Evidence Pack — " + runId, html, packText, jsonStr, runId, (ok) => log("Email to " + email + ": " + (ok ? "sent" : "failed")));
  });
}

function parseBody(req, cb) { let b = ""; req.on("data", c => b += c); req.on("end", () => cb(b)); }

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (url === "/favicon.ico") { const fp = path.join(BASE_DIR, "favicon.ico"); if (fs.existsSync(fp)) { res.writeHead(200, {"Content-Type":"image/x-icon"}); return res.end(fs.readFileSync(fp)); } }
  if (url === "/" || url === "/index.html") { const lf = path.join(BASE_DIR, "landing.html"); if (fs.existsSync(lf)) { res.writeHead(200, {"Content-Type":"text/html","Cache-Control":"no-store"}); return res.end(fs.readFileSync(lf,"utf8")); } }
  if (url === "/submit" || url === "/form") { const ff = path.join(BASE_DIR, "form.html"); if (fs.existsSync(ff)) { res.writeHead(200, {"Content-Type":"text/html","Cache-Control":"no-store"}); return res.end(fs.readFileSync(ff,"utf8")); } }
  if (url === "/health") { res.writeHead(200, {"Content-Type":"application/json"}); return res.end(JSON.stringify({status:"ok",service:"Verdact",timestamp:new Date().toISOString()})); }
  if (url === "/checkout" && req.method === "POST") {
    parseBody(req, (body) => {
      const params = new URLSearchParams(body);
      const tier = params.get("tier") || "full";
      const priceId = tier === "foundation" ? STRIPE_PRICE_FOUNDATION : tier === "bundle" ? STRIPE_PRICE_BUNDLE : STRIPE_PRICE_FULL;
      const meta = {}; for (const [k,v] of params.entries()) meta[k] = v;
      const sessionData = { "payment_method_types[]": "card", "line_items[0][price]": priceId, "line_items[0][quantity]": "1", "mode": "payment", "success_url": BASE_URL + "/success?session_id={CHECKOUT_SESSION_ID}", "cancel_url": BASE_URL + "/" };
      Object.entries(meta).forEach(([k,v]) => { sessionData["metadata["+k+"]"] = v; });
      stripeRequest("POST", "/checkout/sessions", sessionData, (err, session) => {
        if (err || session.error) { res.writeHead(500); return res.end("{}"); }
        res.writeHead(303, {"Location": session.url}); res.end();
      });
    }); return;
  }
  if (url === "/webhook/stripe" && req.method === "POST") {
    parseBody(req, (body) => {
      const sig = req.headers["stripe-signature"] || "";
      try { const parts = sig.split(",").reduce((a,p) => { const [k,v]=p.split("="); a[k]=v; return a; }, {}); const expected = crypto.createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(parts.t+"."+body).digest("hex"); if (expected !== parts.v1) throw new Error("Bad sig"); } catch(e) { res.writeHead(400); return res.end("Bad signature"); }
      try { const event = JSON.parse(body); if (event.type === "checkout.session.completed") { const session = event.data.object; const email = (session.customer_details || {}).email || ""; const runId = Date.now().toString(36).toUpperCase(); processOrder(session.metadata || {}, email, runId); } } catch(e) { log("Webhook error: " + e.message); }
      res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true}));
    }); return;
  }
  if (url === "/success") {
    res.writeHead(200, {"Content-Type":"text/html"});
    return res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Verdact Processing</title><link href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400&display=swap" rel="stylesheet"><style>body{font-family:Jost,sans-serif;background:#0a1628;color:#e8edf5;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}.box{max-width:480px;padding:48px;border:1px solid rgba(26,188,156,0.3);background:#0d1e38;}h1{color:#1abc9c;font-size:28px;margin-bottom:16px;}p{color:#8898aa;line-height:1.7;}</style></head><body><div class="box"><h1>Generating your evidence pack</h1><p>Your NDIS Evidence Pack and Verdact Compliance Schema are being generated.<br><br>Typically delivered within 60-120 seconds. Delivery times may vary.<br><br><small>NorthStar Holdings Trust | ABN 67 387 124 760</small></p></div></body></html>`);
  }


  if (url === "/demo-page") {
    const dp = path.join("C:\\northstar-verdact", "demo.html");
    if (fs.existsSync(dp)) { res.writeHead(200, {"Content-Type":"text/html","Cache-Control":"no-store"}); return res.end(fs.readFileSync(dp,"utf8")); }
  }
  if (url === "/demo" && req.method === "POST") {
    parseBody(req, (body) => {
      let data; try { data = JSON.parse(body); } catch(e) { res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"Invalid request"})); }
      const email = (data.email||"").toLowerCase().trim();
      if (!email) { res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"Email required"})); }
      const ef = "C:\\northstar-verdact\\demo_emails.json";
      let used=[]; try{used=JSON.parse(fs.readFileSync(ef,"utf8"));}catch(e){}
      if (used.includes(email)) { res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"This email has already been used for a free demo. Purchase the full report to continue."})); }
      const prompt = "You are the Verdact NDIS Compliance Engine. Assess Standards 1 and 2 only (max 280 words). Provider: "+(data.provider_name||"")+". Registration: "+(data.registration_type||"")+". Supports: "+(data.support_types||"")+". Produce: 1. STANDARD 1 ASSESSMENT. 2. STANDARD 2 ASSESSMENT. 3. PRIORITY GAP. 4. IMMEDIATE ACTION.";
      const llmPayload = JSON.stringify({model:"gemma3:4b",prompt,stream:false,options:{temperature:0.3,num_predict:1500}});
      const llmHeaders = {"Content-Type":"application/json","Content-Length":Buffer.byteLength(llmPayload)};
      llmHeaders["x-api-key"] = "ns-tri-1dad2d0d2693";
      const llmOpts = {hostname:"127.0.0.1",port:8080,path:"/api/generate",method:"POST",headers:llmHeaders};
      const llmReq = http.request(llmOpts, (llmRes) => {
        let d2=""; llmRes.on("data",c=>d2+=c);
        llmRes.on("end",()=>{
          try {
            const output = JSON.parse(d2).response || "Generation failed.";
            used.push(email); fs.writeFileSync(ef,JSON.stringify(used));
            log("DEMO: "+email+" ran demo");
            res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({output}));
          } catch(e) { res.writeHead(500,{"Content-Type":"application/json"}); res.end(JSON.stringify({error:"Generation failed."})); }
        });
      });
      llmReq.on("error",()=>{ res.writeHead(500,{"Content-Type":"application/json"}); res.end(JSON.stringify({error:"LLM unavailable."})); });
      llmReq.write(llmPayload); llmReq.end();
    }); return;
  }
  if (url === "/feedback" && req.method === "POST") {
    parseBody(req, (body) => {
      try { const d2=JSON.parse(body); log("FEEDBACK: "+JSON.stringify(d2)); } catch(e) {}
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true}));
    }); return;
  }

  if (url === "/demo-page") {
    const dp = path.join("C:\\northstar-verdact", "demo.html");
    if (fs.existsSync(dp)) { res.writeHead(200, {"Content-Type":"text/html","Cache-Control":"no-store"}); return res.end(fs.readFileSync(dp,"utf8")); }
  }
  if (url === "/demo" && req.method === "POST") {
    parseBody(req, (body) => {
      let data; try { data = JSON.parse(body); } catch(e) { res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"Invalid request"})); }
      const email = (data.email||"").toLowerCase().trim();
      if (!email) { res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"Email required"})); }
      const ef = "C:\\northstar-verdact\\demo_emails.json";
      let used=[]; try{used=JSON.parse(fs.readFileSync(ef,"utf8"));}catch(e){}
      if (used.includes(email)) { res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"This email has already been used for a free demo. Purchase the full report to continue."})); }
      const prompt = "You are the Verdact NDIS Compliance Engine. Assess Standards 1 and 2 only (max 280 words). Provider: "+(data.provider_name||"")+". Registration: "+(data.registration_type||"")+". Supports: "+(data.support_types||"")+". Produce: 1. STANDARD 1 ASSESSMENT. 2. STANDARD 2 ASSESSMENT. 3. PRIORITY GAP. 4. IMMEDIATE ACTION.";
      const llmPayload = JSON.stringify({model:"gemma3:4b",prompt,stream:false,options:{temperature:0.3,num_predict:1500}});
      const llmHeaders = {"Content-Type":"application/json","Content-Length":Buffer.byteLength(llmPayload)};
      llmHeaders["x-api-key"] = "ns-tri-1dad2d0d2693";
      const llmOpts = {hostname:"127.0.0.1",port:8080,path:"/api/generate",method:"POST",headers:llmHeaders};
      const llmReq = http.request(llmOpts, (llmRes) => {
        let d2=""; llmRes.on("data",c=>d2+=c);
        llmRes.on("end",()=>{
          try {
            const output = JSON.parse(d2).response || "Generation failed.";
            used.push(email); fs.writeFileSync(ef,JSON.stringify(used));
            log("DEMO: "+email+" ran demo");
            res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({output}));
          } catch(e) { res.writeHead(500,{"Content-Type":"application/json"}); res.end(JSON.stringify({error:"Generation failed."})); }
        });
      });
      llmReq.on("error",()=>{ res.writeHead(500,{"Content-Type":"application/json"}); res.end(JSON.stringify({error:"LLM unavailable."})); });
      llmReq.write(llmPayload); llmReq.end();
    }); return;
  }
  if (url === "/feedback" && req.method === "POST") {
    parseBody(req, (body) => {
      try { const d2=JSON.parse(body); log("FEEDBACK: "+JSON.stringify(d2)); } catch(e) {}
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true}));
    }); return;
  }
  res.writeHead(404, {"Content-Type":"application/json"}); res.end(JSON.stringify({error:"Not found"}));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Verdact running on 127.0.0.1:" + PORT);
  try { fs.appendFileSync(BASE_DIR + "\\verdact.log", new Date().toISOString() + " Verdact started on port " + PORT + "\n"); } catch(e) {}
});
