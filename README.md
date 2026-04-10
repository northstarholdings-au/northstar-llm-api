# NorthStar LLM API

> Private AI inference for Australian businesses. Your data never leaves Australia.

[![Live](https://img.shields.io/badge/API-Live-brightgreen)](https://api.northstarbuyingguides.store)
[![Models](https://img.shields.io/badge/Models-Gemma3%204b%20%7C%2012b-blue)](https://github.com/northstarholdings-au/northstar-llm-api)
[![Hosted In](https://img.shields.io/badge/Hosted%20In-South%20Australia-orange)](https://github.com/northstarholdings-au/northstar-llm-api)
[![Pricing](https://img.shields.io/badge/Pricing-From%20%2429%20AUD%2Fmo-purple)](https://github.com/northstarholdings-au/northstar-llm-api#pricing)

---

## The Problem

Australian businesses in healthcare, legal, and finance are feeding sensitive client data into American AI systems. US jurisdiction. US servers. US law.

Their compliance teams are starting to notice.

**NorthStar LLM API is the fix.**

---

## What This Is

A private AI inference API running on dedicated hardware in South Australia — served through Cloudflare's Sydney and Melbourne edge network.

- Data never leaves Australian jurisdiction
- No per-token billing — flat monthly subscription
- OpenAI-compatible — one line change from existing code
- No prompts logged or stored
- Built for regulated industries where data residency is a legal requirement

**Endpoint:** `https://api.northstarbuyingguides.store`

---

## Why NorthStar Instead of OpenAI or Anthropic

| | NorthStar LLM API | OpenAI / Anthropic |
|---|---|---|
| Data location | South Australia | USA |
| Jurisdiction | Australian law | US law |
| Billing | Flat monthly | Per token — unpredictable |
| Data logged | Never | Yes |
| Suitable for health/legal/finance | Yes | Verify carefully |
| Data sovereignty compliant | Yes | No |

---

## Models Available

| Model | Parameters | Use Case | Tier |
|---|---|---|---|
| `gemma3:4b` | 4.3B Q4_K_M | Fast general inference | Developer, Basic |
| `gemma3:12b` | 12.2B Q4_K_M | Higher quality reasoning | Pro, Enterprise |

---

## Quick Start

### Python

```python
import requests

response = requests.post(
    "https://api.northstarbuyingguides.store/api/generate",
    headers={
        "x-api-key": "your-api-key-here",
        "Content-Type": "application/json"
    },
    json={
        "model": "gemma3:4b",
        "prompt": "Summarise the key risks in this contract clause:",
        "stream": False
    }
)

print(response.json()["response"])
```

### JavaScript / Node.js

```javascript
const response = await fetch(
  "https://api.northstarbuyingguides.store/api/generate",
  {
    method: "POST",
    headers: {
      "x-api-key": "your-api-key-here",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gemma3:4b",
      prompt: "Summarise the key risks in this contract clause:",
      stream: false
    })
  }
);

const data = await response.json();
console.log(data.response);
```

### curl

```bash
curl -X POST https://api.northstarbuyingguides.store/api/generate \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemma3:4b","prompt":"Summarise this document:","stream":false}'
```

---

## Real-World Use Cases

### Healthcare

```python
response = requests.post(endpoint, headers=headers, json={
    "model": "gemma3:12b",
    "prompt": "Summarise the following patient intake notes into key clinical points: [notes here]",
    "stream": False
})
```

Patient data stays in Australia. Zero offshore exposure.

### Legal

```python
response = requests.post(endpoint, headers=headers, json={
    "model": "gemma3:12b",
    "prompt": "Identify the key obligations and risks in this contract clause: [clause here]",
    "stream": False
})
```

Client documents never leave Australian jurisdiction.

### Finance

```python
response = requests.post(endpoint, headers=headers, json={
    "model": "gemma3:4b",
    "prompt": "Draft a client communication summarising these portfolio changes: [data here]",
    "stream": False
})
```

Financial data remains under Australian regulatory control.

---

## Authentication

Every request requires an `x-api-key` header.

To get a free trial key — 100 requests, no credit card:

**Email:** northstarholdings.global@gmail.com
**Subject:** API Trial Request
**Include:** Your name, company, and use case

---

## Pricing

| Plan | Price | Requests/min | Models | Payment |
|---|---|---|---|---|
| Trial | Free | 10 | gemma3:4b | [Request trial](mailto:northstarholdings.global@gmail.com?subject=API%20Trial%20Request) |
| Developer | $29 AUD/month | 30 | gemma3:4b | [Subscribe](https://buy.stripe.com/5kQfZg1Iq6No1wpcsI2Fa03) |
| Basic | $99 AUD/month | 60 | gemma3:4b | [Subscribe](https://buy.stripe.com/fZu9AS5YGgnYfnf0K02Fa02) |
| Pro | $199 AUD/month | 120 | gemma3:4b + 12b | [Subscribe](https://buy.stripe.com/28EaEWbj0fjU5MF3Wc2Fa01) |
| Enterprise | $499 AUD/month | Unlimited | All models + SLA | [Subscribe](https://buy.stripe.com/00w3cugDk7Rs6QJeAQ2Fa00) |

Instant card payment via Stripe. Invoice and bank transfer available on request.

---

## Architecture

```
Client Request
-> api.northstarbuyingguides.store
-> Cloudflare Edge (Sydney + Melbourne)
-> Cloudflare Zero Trust Tunnel (encrypted, outbound-only)
-> NorthStar API Gateway (Node.js - auth + logging + model isolation)
-> Ollama (localhost only - never exposed to internet)
-> Gemma3 inference
-> Response
```

Security design:
- Ollama never accepts external connections — localhost only
- No inbound ports open — Cloudflare tunnel outbound only
- Per-client API key isolation
- All requests logged with timestamp, client, endpoint, status
- Custom models hard-blocked at gateway — cannot be called externally
- TLS only — no plain HTTP accepted

---

## Infrastructure

- **Hardware:** Intel i9-14900K / 32GB DDR5 / NVIDIA RTX A2000 12GB
- **Network:** 520Mbps upload / Cloudflare Sydney + Melbourne edge
- **Location:** South Australia
- **Data retention:** Zero — no prompts stored

---

## Use Cases By Industry

| Industry | Problem Solved | Data Sensitivity |
|---|---|---|
| Healthcare | Patient note summarisation, triage support | PHI — must stay in AU |
| Legal | Contract review, document analysis | Privileged — offshore risk |
| Finance | Report generation, client communications | Regulated — ASIC/APRA |
| Government | Document processing, internal queries | Sovereign — AU jurisdiction required |
| Developers | Local AI without cloud API costs | Variable |

---

## Contact

**NorthStar Holdings**
Adelaide, South Australia
northstarholdings.global@gmail.com

---

## Roadmap

- [x] Live inference endpoint
- [x] Per-client API key authentication
- [x] Gemma3 4b and 12b models
- [x] Cloudflare Australian edge routing
- [x] Stripe billing
- [ ] Per-tier rate limiting
- [ ] Automated key issuance on payment
- [ ] Usage dashboard per client
- [ ] Additional open-weight models
- [ ] Dedicated hardware upgrade for higher capacity

---

*Built in South Australia. Serious about privacy. Priced for real business.*
