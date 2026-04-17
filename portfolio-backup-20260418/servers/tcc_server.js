const http = require("http");
const https = require("https");
const { execSync, exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// === DEMO ROUTES ===
const DEMO_EMAILS_FILE = "C:\\northstar-tcc\\demo_emails.json";
const SERVICE_NAME = "TCC";
function getDemoEmails() { try { return JSON.parse(fs.readFileSync(DEMO_EMAILS_FILE, "utf8")); } catch(e) { return []; } }
function addDemoEmail(email) { const e = getDemoEmails(); e.push(email.toLowerCase()); fs.writeFileSync(DEMO_EMAILS_FILE, JSON.stringify(e)); }
function buildDemoPrompt(data) {
  return `You are the TCC Trust Signal Engine. Analyse this vendor submission and produce a trust signal assessment (max 280 words). Product: {product_name}. Buyer Objection: {buyer_objection}. Proof Point: {proof_point}. Produce: 1. OBJECTION ANALYSIS — Score 0-100. 2. TRUST SIGNAL STRENGTH — Verifiability assessment. 3. RECOMMENDATION — One specific improvement. Keep concise and professional.`.replace(/\{(\w+)\}/g, (m, k) => data[k] || "");
}
function notifyDirectorDemo(data, runId) {
  const payload = JSON.stringify({from:"NorthStar Demo <onboarding@resend.dev>",to:["director@northstarholdings.com.au"],subject:"[DEMO] TCC — "+(data.name||"Unknown")+" — "+(data.organisation||"Unknown"),html:"<div style='font-family:sans-serif;background:#0a1628;color:#e8edf5;padding:32px;'><h2 style='color:#4a7fc1;'>New Demo — TCC</h2><p><b>Name:</b> "+(data.name||"N/A")+"</p><p><b>Email:</b> "+(data.email||"N/A")+"</p><p><b>Organisation:</b> "+(data.organisation||"N/A")+"</p><p><b>Role:</b> "+(data.role||"N/A")+"</p><p><b>Heard via:</b> "+(data.hear_about||"N/A")+"</p><p><b>Run ID:</b> "+runId+"</p></div>"});
  const opts = {hostname:"api.resend.com",path:"/emails",method:"POST",headers:{"Authorization":"Bearer "+RESEND_API_KEY,"Content-Type":"application/json","Content-Length":Buffer.byteLength(payload)}};
  const rq = https.request(opts,()=>{}); rq.on("error",()=>{}); rq.write(payload); rq.end();
}
// === END DEMO ROUTES ===

const PORT = 8081;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.TCC_WEBHOOK_SECRET || "";
const STRIPE_PRICE_SINGLE = process.env.STRIPE_PRICE_TCC_SINGLE || "price_1TMlYTD8XVBclLBpwCO28wUb";
const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_TCC_PRO || "price_1TMlZ1D8XVBclLBpHcoFUsE9";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const BASE_URL = "https://tcc.northstarholdings.com.au";
const OUTPUT_DIR = "C:\\northstar-tcc\\outputs";
const FORM_FILE = path.join(__dirname, "form.html");
const LANDING_FILE = path.join(__dirname, "landing.html");

// Ensure output dir exists
try { require("fs").mkdirSync(OUTPUT_DIR, { recursive: true }); } catch(e) {}

function log(msg) {
  fs.appendFileSync(path.join(__dirname, "tcc.log"), new Date().toISOString() + " " + msg + "\n");
}

function stripeRequest(method, endpoint, data, callback) {
  const body = data ? new URLSearchParams(data).toString() : "";
  const opts = {
    hostname: "api.stripe.com",
    path: "/v1" + endpoint,
    method: method,
    headers: {
      "Authorization": "Bearer " + STRIPE_SECRET_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body)
    }
  };
  const req = https.request(opts, (res) => {
    let d = "";
    res.on("data", c => d += c);
    res.on("end", () => { try { callback(null, JSON.parse(d)); } catch(e) { callback(e); } });
  });
  req.on("error", callback);
  if (body) req.write(body);
  req.end();
}

function sendResendEmail(to, subject, html, attachments, callback) {
  const payload = JSON.stringify({ from: "TCC by NorthStar <onboarding@resend.dev>", to: [to], subject, html, attachments });
  const opts = {
    hostname: "api.resend.com",
    path: "/emails",
    method: "POST",
    headers: {
      "Authorization": "Bearer " + RESEND_API_KEY,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload)
    }
  };
  const req = https.request(opts, (res) => {
    let d = "";
    res.on("data", c => d += c);
    res.on("end", () => callback(res.statusCode));
  });
  req.on("error", () => callback(500));
  req.write(payload);
  req.end();
}

function processOrder(meta, customerEmail, runId) {
  log("Processing order " + runId + " for " + customerEmail);
  // Write form data to temp file for Python processing
  const dataFile = path.join(OUTPUT_DIR, runId + "_input.json");
  fs.writeFileSync(dataFile, JSON.stringify(meta));
  
  // Call Python in WSL2 to generate PDF and JSON
  const wslCmd = `wsl -d Ubuntu -e bash -c "source /home/michael_bristow/tcc/.env && python3 /home/michael_bristow/tcc/generate.py ${runId}"`;
  exec(wslCmd, { timeout: 120000 }, (err, stdout, stderr) => {
    if (err) { log("Generate error: " + err.message); return; }
    log("Generate output: " + stdout.trim());
    
    const pdfFile = path.join(OUTPUT_DIR, runId + "_pack.pdf");
    const jsonFile = path.join(OUTPUT_DIR, runId + "_schema.json");
    
    if (!fs.existsSync(pdfFile)) { log("PDF not found: " + pdfFile); return; }
    
    const pdfB64 = fs.readFileSync(pdfFile).toString("base64");
    const jsonB64 = fs.existsSync(jsonFile) ? fs.readFileSync(jsonFile).toString("base64") : "";
    const vendorName = meta.product_name || "Your Product";
    
    const html = `<div style="font-family:sans-serif;background:#0a1628;color:#e8edf5;padding:40px;max-width:600px;margin:0 auto;">
      <h1 style="color:#4a7fc1;">Your TCC outputs are ready</h1>
      <p style="color:#8898aa;">Run ID: ${runId}</p>
      <p>Attached: Decision Confidence Pack (PDF) and TTS v1.0 Trust Schema (JSON)</p>
      <p style="color:#8898aa;font-size:12px;margin-top:40px;">TCC outputs are structured communication aids and do not constitute legal, financial, or professional advice.<br>NorthStar Holdings Trust | ABN 67 387 124 760</p>
      </div>`;
    
    const attachments = [{ filename: "TCC_Pack_" + runId + ".pdf", content: pdfB64 }];
    if (jsonB64) attachments.push({ filename: "TCC_Schema_" + runId + ".json", content: jsonB64 });
    
    sendResendEmail(customerEmail, "Your TCC Decision Confidence Pack - " + vendorName, html, attachments, (status) => {
      log("Email sent to " + customerEmail + " status: " + status);
    });
  });
}

function parseBody(req, callback) {
  let body = "";
  req.on("data", c => body += c);
  req.on("end", () => callback(body));
}

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  
  if (url === "/" || url === "/index.html") {
    const lf = fs.existsSync(LANDING_FILE) ? LANDING_FILE : FORM_FILE;
      res.writeHead(200, {"Content-Type": "text/html"});
      return res.end(fs.readFileSync(lf, "utf8"));
  }
  
  if (url === "/health") {
    res.writeHead(200, {"Content-Type": "application/json"});
    return res.end(JSON.stringify({status:"ok",service:"TCC",timestamp:new Date().toISOString()}));
  }
  
  if (url === "/checkout" && req.method === "POST") {
    parseBody(req, (body) => {
      const params = new URLSearchParams(body);
      const tier = params.get("tier") || "single";
      const priceId = tier === "pro" ? STRIPE_PRICE_PRO : STRIPE_PRICE_SINGLE;
      const meta = {};
      for (const [k,v] of params.entries()) meta[k] = v;
      
      const sessionData = {
        "payment_method_types[]": "card",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "mode": "payment",
        "success_url": BASE_URL + "/success?session_id={CHECKOUT_SESSION_ID}",
        "cancel_url": BASE_URL + "/"
      };
      // Add metadata
      Object.entries(meta).forEach(([k,v]) => { sessionData["metadata["+k+"]"] = v; });
      
      stripeRequest("POST", "/checkout/sessions", sessionData, (err, session) => {
        if (err || session.error) {
          log("Checkout error: " + JSON.stringify(session));
          res.writeHead(500, {"Content-Type": "application/json"});
          return res.end(JSON.stringify({error: "Checkout failed"}));
        }
        res.writeHead(303, {"Location": session.url});
        res.end();
      });
    });
    return;
  }
  
  if (url === "/webhook/stripe" && req.method === "POST") {
    parseBody(req, (body) => {
      const sig = req.headers["stripe-signature"] || "";
      // Verify webhook signature
      try {
        const parts = sig.split(",").reduce((acc, p) => { const [k,v]=p.split("="); acc[k]=v; return acc; }, {});
        const ts = parts.t;
        const payload = ts + "." + body;
        const expected = crypto.createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(payload).digest("hex");
        if (expected !== parts.v1) throw new Error("Invalid signature");
      } catch(e) {
        log("Webhook sig error: " + e.message);
        res.writeHead(400); return res.end("Invalid signature");
      }
      
      try {
        const event = JSON.parse(body);
        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          const meta = session.metadata || {};
          const email = (session.customer_details || {}).email || "";
          const runId = Date.now().toString(36).toUpperCase();
          processOrder(meta, email, runId);
        }
      } catch(e) { log("Webhook parse error: " + e.message); }
      
      res.writeHead(200, {"Content-Type": "application/json"});
      res.end(JSON.stringify({status:"ok"}));
    });
    return;
  }
  
  if (url === "/success") {
    res.writeHead(200, {"Content-Type": "text/html"});
    return res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>TCC Processing</title>
      <link href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
      <style>body{font-family:Jost,sans-serif;background:#0a1628;color:#e8edf5;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}
      .box{max-width:480px;padding:48px;border:1px solid rgba(74,127,193,0.22);background:#0d1e38;}
      h1{color:#4a7fc1;font-size:28px;margin-bottom:16px;}p{color:#8898aa;line-height:1.7;}</style></head>
      <body><div class="box"><h1>Processing your pack</h1>
      <p>Your Decision Confidence Pack and TTS v1.0 Trust Schema are being generated.<br><br>
      You will receive both files by email within 60 seconds.<br><br>
      <small>NorthStar Holdings Trust | ABN 67 387 124 760</small></p></div></body></html>`);
  }
  

  if (url === "/demo-page") {
    const dp = path.join("C:\\northstar-tcc", "demo.html");
    if (fs.existsSync(dp)) { res.writeHead(200, {"Content-Type":"text/html","Cache-Control":"no-store"}); return res.end(fs.readFileSync(dp,"utf8")); }
  }
  if (url === "/demo" && req.method === "POST") {
    parseBody(req, (body) => {
      let data; try { data = JSON.parse(body); } catch(e) { res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"Invalid request"})); }
      const email = (data.email||"").toLowerCase().trim();
      if (!email) { res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"Email required"})); }
      const ef = "C:\\northstar-tcc\\demo_emails.json";
      let used=[]; try{used=JSON.parse(fs.readFileSync(ef,"utf8"));}catch(e){}
      if (used.includes(email)) { res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"This email has already been used for a free demo. Purchase the full report to continue."})); }
      const prompt = "You are the TCC Trust Signal Engine. Analyse this vendor submission (max 280 words). Product: "+(data.product_name||"")+". Objection: "+(data.buyer_objection||"")+". Proof: "+(data.proof_point||"")+". Produce: 1. OBJECTION ANALYSIS Score 0-100. 2. TRUST SIGNAL STRENGTH. 3. RECOMMENDATION.";
      const llmPayload = JSON.stringify({model:"gemma3:4b",prompt,stream:false,options:{temperature:0.3,num_predict:1500}});
      const llmHeaders = {"Content-Type":"application/json","Content-Length":Buffer.byteLength(llmPayload),"x-api-key":"ns-tri-1dad2d0d2693"};
      if (process.env.LLM_API_KEY) llmHeaders["x-api-key"] = process.env.LLM_API_KEY;
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
    const dp = path.join("C:\\northstar-tcc", "demo.html");
    if (fs.existsSync(dp)) { res.writeHead(200, {"Content-Type":"text/html","Cache-Control":"no-store"}); return res.end(fs.readFileSync(dp,"utf8")); }
  }
  if (url === "/demo" && req.method === "POST") {
    parseBody(req, (body) => {
      let data; try { data = JSON.parse(body); } catch(e) { res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"Invalid request"})); }
      const email = (data.email||"").toLowerCase().trim();
      if (!email) { res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"Email required"})); }
      const ef = "C:\\northstar-tcc\\demo_emails.json";
      let used=[]; try{used=JSON.parse(fs.readFileSync(ef,"utf8"));}catch(e){}
      if (used.includes(email)) { res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"This email has already been used for a free demo. Purchase the full report to continue."})); }
      const prompt = "You are the TCC Trust Signal Engine. Analyse this vendor submission (max 280 words). Product: "+(data.product_name||"")+". Objection: "+(data.buyer_objection||"")+". Proof: "+(data.proof_point||"")+". Produce: 1. OBJECTION ANALYSIS Score 0-100. 2. TRUST SIGNAL STRENGTH. 3. RECOMMENDATION.";
      const llmPayload = JSON.stringify({model:"gemma3:4b",prompt,stream:false,options:{temperature:0.3,num_predict:1500}});
      const llmHeaders = {"Content-Type":"application/json","Content-Length":Buffer.byteLength(llmPayload),"x-api-key":"ns-tri-1dad2d0d2693"};
      if (process.env.LLM_API_KEY) llmHeaders["x-api-key"] = process.env.LLM_API_KEY;
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
  res.writeHead(404, {"Content-Type": "application/json"});
  res.end(JSON.stringify({error:"Not found"}));
});

server.listen(PORT, "127.0.0.1", () => {
  log("TCC Gateway started on port " + PORT);
  console.log("TCC running on 127.0.0.1:" + PORT);
});
