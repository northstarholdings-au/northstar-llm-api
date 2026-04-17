const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// === DEMO ROUTES ===
const DEMO_EMAILS_FILE = "C:\\northstar-ilogix\\demo_emails.json";
const SERVICE_NAME = "iLOGIX";
function getDemoEmails() { try { return JSON.parse(fs.readFileSync(DEMO_EMAILS_FILE, "utf8")); } catch(e) { return []; } }
function addDemoEmail(email) { const e = getDemoEmails(); e.push(email.toLowerCase()); fs.writeFileSync(DEMO_EMAILS_FILE, JSON.stringify(e)); }
function buildDemoPrompt(data) {
  return `You are the iLOGIX Governance Engine. Assess this decision (max 250 words). Role: {professional_role}. Decision: {decision_made}. Risk: {risk_acknowledged}. Produce: 1. REASONING QUALITY SCORE 0-100. 2. DOCUMENTATION ASSESSMENT. 3. LIABILITY EXPOSURE. 4. PRIORITY ACTION.`.replace(/\{(\w+)\}/g, (m, k) => data[k] || "");
}
function notifyDirectorDemo(data, runId) {
  const payload = JSON.stringify({from:"NorthStar Demo <onboarding@resend.dev>",to:["director@northstarholdings.com.au"],subject:"[DEMO] iLOGIX — "+(data.name||"Unknown")+" — "+(data.organisation||"Unknown"),html:"<div style='font-family:sans-serif;background:#0a1628;color:#e8edf5;padding:32px;'><h2 style='color:#4a7fc1;'>New Demo — iLOGIX</h2><p><b>Name:</b> "+(data.name||"N/A")+"</p><p><b>Email:</b> "+(data.email||"N/A")+"</p><p><b>Organisation:</b> "+(data.organisation||"N/A")+"</p><p><b>Role:</b> "+(data.role||"N/A")+"</p><p><b>Heard via:</b> "+(data.hear_about||"N/A")+"</p><p><b>Run ID:</b> "+runId+"</p></div>"});
  const opts = {hostname:"api.resend.com",path:"/emails",method:"POST",headers:{"Authorization":"Bearer "+RESEND_API_KEY,"Content-Type":"application/json","Content-Length":Buffer.byteLength(payload)}};
  const rq = https.request(opts,()=>{}); rq.on("error",()=>{}); rq.write(payload); rq.end();
}
// === END DEMO ROUTES ===

const PORT = 8083;
const BASE_DIR = "C:\\northstar-ilogix";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.ILOGIX_WEBHOOK_SECRET || "";
const STRIPE_PRICE_SINGLE = process.env.STRIPE_PRICE_ILOGIX_SINGLE || "";
const STRIPE_PRICE_BUNDLE = process.env.STRIPE_PRICE_ILOGIX_BUNDLE || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const LLM_ENDPOINT = "http://127.0.0.1:8080/api/generate";
const LLM_API_KEY = "ns-tri-1dad2d0d2693";
const BASE_URL = "https://ilogix.northstarholdings.com.au";
const OUTPUT_DIR = BASE_DIR + "\\outputs";

try { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); } catch(e) {}

function log(msg) {
  try { fs.appendFileSync(BASE_DIR + "\\ilogix.log", new Date().toISOString() + " " + msg + "\n"); } catch(e) {}
}

const SYSTEM_PROMPT = `You are the iLOGIX Decision Governance Engine v1.0.
You analyse professional decision records and produce two structured outputs.

OUTPUT A: Decision Governance Report (structured plain text, numbered sections):
1. DECISION SUMMARY — What was decided, by whom, in what professional context
2. REASONING QUALITY ASSESSMENT — Grade 0-100, analysis of reasoning chain completeness
3. EVIDENCE BASE REVIEW — Quality and completeness of evidence cited
4. ALTERNATIVES ANALYSIS — Whether alternatives were adequately considered
5. RISK ACKNOWLEDGEMENT — How identified risks were addressed
6. GOVERNANCE GAPS — Missing documentation, undocumented assumptions, liability exposure points
7. REMEDIATION PRIORITIES — Ordered list of actions to improve governance posture
8. GOVERNANCE SCORE — Overall 0-100 with grade (A+/A/B/C/D/F)

OUTPUT B: iLOGIX Compliance Schema (valid JSON, start with open brace after OUTPUT A)

Rules:
- Base all outputs exclusively on submitted information
- Never fabricate evidence, reasoning, or outcomes
- Flag [UNDOCUMENTED] for any assertion without stated evidence
- Include explicit liability exposure statements
- Professional and precise language throughout`;

function buildPrompt(meta) {
  return `${SYSTEM_PROMPT}

SUBMISSION:
Professional Role: ${meta.professional_role || ""}
Industry: ${meta.industry || ""}
Regulatory Framework: ${meta.regulatory_framework || ""}
Decision Made: ${meta.decision_made || ""}
Reasoning Chain: ${meta.reasoning_chain || ""}
Evidence Base: ${meta.evidence_base || ""}
Alternatives Considered: ${meta.alternatives || "Not provided"}
Risks Acknowledged: ${meta.risks_acknowledged || "Not provided"}
Known Governance Gaps: ${meta.governance_gaps || "None disclosed"}

Produce OUTPUT A (numbered sections) then OUTPUT B (JSON starting with open brace).`;
}

function callLLM(prompt, callback) {
  const payload = JSON.stringify({ model: "gemma3:4b", prompt, stream: false, options: { temperature: 0.2, num_predict: 4000 } });
  const headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) };
  if (LLM_API_KEY) headers["x-api-key"] = LLM_API_KEY;
  const opts = { hostname: "127.0.0.1", port: 8080, path: "/api/generate", method: "POST", headers };
  const req = http.request(opts, (res) => {
    let d = ""; res.on("data", c => d += c);
    res.on("end", () => { try { callback(null, JSON.parse(d).response || ""); } catch(e) { callback(e); } });
  });
  req.on("error", callback);
  req.write(payload); req.end();
}

function stripeRequest(method, endpoint, data, callback) {
  const body = data ? new URLSearchParams(data).toString() : "";
  const opts = {
    hostname: "api.stripe.com", path: "/v1" + endpoint, method,
    headers: { "Authorization": "Bearer " + STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) }
  };
  const req = https.request(opts, (res) => {
    let d = ""; res.on("data", c => d += c);
    res.on("end", () => { try { callback(null, JSON.parse(d)); } catch(e) { callback(e); } });
  });
  req.on("error", callback);
  if (body) req.write(body); req.end();
}

function sendEmail(to, subject, html, packText, jsonStr, runId, callback) {
  const packB64 = Buffer.from(packText).toString("base64");
  const jsonB64 = Buffer.from(jsonStr).toString("base64");
  const payload = JSON.stringify({
    from: "iLOGIX by NorthStar <onboarding@resend.dev>",
    to: [to], subject, html,
    attachments: [
      { filename: `iLOGIX_Report_${runId}.txt`, content: packB64 },
      { filename: `iLOGIX_Schema_${runId}.json`, content: jsonB64 }
    ]
  });
  const opts = {
    hostname: "api.resend.com", path: "/emails", method: "POST",
    headers: { "Authorization": "Bearer " + RESEND_API_KEY, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
  };
  const req = https.request(opts, (res) => { callback(res.statusCode === 200); });
  req.on("error", () => callback(false));
  req.write(payload); req.end();
}

function processOrder(meta, email, runId) {
  log("Processing iLOGIX order " + runId + " for " + email);
  callLLM(buildPrompt(meta), (err, raw) => {
    if (err) { log("LLM error: " + err.message); return; }
    const jsonStart = raw.lastIndexOf("{");
    const packText = jsonStart > 0 ? raw.substring(0, jsonStart).trim() : raw;
    let schema = {};
    try { schema = JSON.parse(raw.substring(jsonStart)); } catch(e) {}
    const jsonStr = JSON.stringify(schema, null, 2);
    fs.writeFileSync(path.join(OUTPUT_DIR, runId + "_report.txt"), packText);
    fs.writeFileSync(path.join(OUTPUT_DIR, runId + "_schema.json"), jsonStr);
    const html = `<div style="font-family:sans-serif;background:#0a1628;color:#e8edf5;padding:40px;max-width:600px;margin:0 auto;">
      <h1 style="color:#2ecc71;">Your iLOGIX report is ready</h1>
      <p style="color:#8898aa;">Run ID: ${runId}</p>
      <p>Attached: Decision Governance Report and iLOGIX Compliance Schema (JSON)</p>
      <p style="color:#8898aa;font-size:12px;margin-top:40px;">iLOGIX outputs are structured analytical aids only. Not legal or professional advice.<br>
      NorthStar Holdings Trust | ABN 67 387 124 760</p></div>`;
    sendEmail(email, "Your iLOGIX Governance Report — " + runId, html, packText, jsonStr, runId,
      (ok) => log("Email to " + email + ": " + (ok ? "sent" : "failed"))
    );
  });
}

function parseBody(req, cb) { let b = ""; req.on("data", c => b += c); req.on("end", () => cb(b)); }

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  const qparams = new URLSearchParams(req.url.includes("?") ? req.url.split("?")[1] : "");

  if (url === "/" || url === "/index.html") {
    const lf = path.join(BASE_DIR, "landing.html");
    if (fs.existsSync(lf)) { res.writeHead(200, {"Content-Type":"text/html","Cache-Control":"no-store"}); return res.end(fs.readFileSync(lf,"utf8")); }
  }
  if (url === "/submit" || url === "/form") {
    const ff = path.join(BASE_DIR, "form.html");
    if (fs.existsSync(ff)) { res.writeHead(200, {"Content-Type":"text/html","Cache-Control":"no-store"}); return res.end(fs.readFileSync(ff,"utf8")); }
  }
  if (url === "/health") {
    res.writeHead(200, {"Content-Type":"application/json"});
    return res.end(JSON.stringify({status:"ok",service:"iLOGIX",timestamp:new Date().toISOString()}));
  }
  if (url === "/checkout" && req.method === "POST") {
    parseBody(req, (body) => {
      const params = new URLSearchParams(body);
      const tier = params.get("tier") || "single";
      const priceId = tier === "bundle" ? STRIPE_PRICE_BUNDLE : STRIPE_PRICE_SINGLE;
      const meta = {}; for (const [k,v] of params.entries()) meta[k] = v;
      const sessionData = {
        "payment_method_types[]": "card",
        "line_items[0][price]": priceId, "line_items[0][quantity]": "1",
        "mode": "payment",
        "success_url": BASE_URL + "/success?session_id={CHECKOUT_SESSION_ID}",
        "cancel_url": BASE_URL + "/"
      };
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
      try {
        const parts = sig.split(",").reduce((a,p) => { const [k,v]=p.split("="); a[k]=v; return a; }, {});
        const expected = crypto.createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(parts.t+"."+body).digest("hex");
        if (expected !== parts.v1) throw new Error("Bad sig");
      } catch(e) { res.writeHead(400); return res.end("Bad signature"); }
      try {
        const event = JSON.parse(body);
        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          const email = (session.customer_details || {}).email || "";
          const runId = Date.now().toString(36).toUpperCase();
          processOrder(session.metadata || {}, email, runId);
        }
      } catch(e) { log("Webhook error: " + e.message); }
      res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true}));
    }); return;
  }
  if (url === "/success") {
    res.writeHead(200, {"Content-Type":"text/html"});
    return res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>iLOGIX Processing</title>
      <link href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400&display=swap" rel="stylesheet">
      <style>body{font-family:Jost,sans-serif;background:#0a1628;color:#e8edf5;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}
      .box{max-width:480px;padding:48px;border:1px solid rgba(46,204,113,0.3);background:#0d1e38;}
      h1{color:#2ecc71;font-size:28px;margin-bottom:16px;}p{color:#8898aa;line-height:1.7;}</style></head>
      <body><div class="box"><h1>Generating your report</h1>
      <p>Your Decision Governance Report and iLOGIX Compliance Schema are being generated.<br><br>
      Typically delivered within 60-120 seconds. Delivery times may vary.<br><br>
      <small>NorthStar Holdings Trust | ABN 67 387 124 760</small></p></div></body></html>`);
  }


  if (url === "/demo-page") {
    const dp = path.join("C:\\northstar-ilogix", "demo.html");
    if (fs.existsSync(dp)) { res.writeHead(200, {"Content-Type":"text/html","Cache-Control":"no-store"}); return res.end(fs.readFileSync(dp,"utf8")); }
  }
  if (url === "/demo" && req.method === "POST") {
    parseBody(req, (body) => {
      let data; try { data = JSON.parse(body); } catch(e) { res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"Invalid request"})); }
      const email = (data.email||"").toLowerCase().trim();
      if (!email) { res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"Email required"})); }
      const ef = "C:\\northstar-ilogix\\demo_emails.json";
      let used=[]; try{used=JSON.parse(fs.readFileSync(ef,"utf8"));}catch(e){}
      if (used.includes(email)) { res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"This email has already been used for a free demo. Purchase the full report to continue."})); }
      const prompt = "You are the iLOGIX Governance Engine. Assess this decision (max 250 words). Role: "+(data.professional_role||"")+". Decision: "+(data.decision_made||"")+". Risk: "+(data.risk_acknowledged||"")+". Produce: 1. REASONING QUALITY SCORE 0-100. 2. DOCUMENTATION ASSESSMENT. 3. LIABILITY EXPOSURE. 4. PRIORITY ACTION.";
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
    const dp = path.join("C:\\northstar-ilogix", "demo.html");
    if (fs.existsSync(dp)) { res.writeHead(200, {"Content-Type":"text/html","Cache-Control":"no-store"}); return res.end(fs.readFileSync(dp,"utf8")); }
  }
  if (url === "/demo" && req.method === "POST") {
    parseBody(req, (body) => {
      let data; try { data = JSON.parse(body); } catch(e) { res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"Invalid request"})); }
      const email = (data.email||"").toLowerCase().trim();
      if (!email) { res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"Email required"})); }
      const ef = "C:\\northstar-ilogix\\demo_emails.json";
      let used=[]; try{used=JSON.parse(fs.readFileSync(ef,"utf8"));}catch(e){}
      if (used.includes(email)) { res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"This email has already been used for a free demo. Purchase the full report to continue."})); }
      const prompt = "You are the iLOGIX Governance Engine. Assess this decision (max 250 words). Role: "+(data.professional_role||"")+". Decision: "+(data.decision_made||"")+". Risk: "+(data.risk_acknowledged||"")+". Produce: 1. REASONING QUALITY SCORE 0-100. 2. DOCUMENTATION ASSESSMENT. 3. LIABILITY EXPOSURE. 4. PRIORITY ACTION.";
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
  console.log("iLOGIX running on 127.0.0.1:" + PORT);
  try { fs.appendFileSync(BASE_DIR + "\\ilogix.log", new Date().toISOString() + " iLOGIX started on port " + PORT + "\n"); } catch(e) {}
});
