# NorthStar LLM API

> Private AI inference for Australian businesses. Your data never leaves Australia.

[![Live](https://img.shields.io/badge/API-Live-brightgreen)](https://api.northstarholdings.com.au)
[![Models](https://img.shields.io/badge/Models-Gemma3%204b%20%7C%2012b-blue)](https://github.com/northstarholdings-au/northstar-llm-api)
[![Hosted In](https://img.shields.io/badge/Hosted%20In-South%20Australia-orange)](https://github.com/northstarholdings-au/northstar-llm-api)
[![Pricing](https://img.shields.io/badge/Pricing-From%20%2429%20AUD%2Fmo-purple)](https://northstarholdings.com.au/llm-api)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen)](https://github.com/northstarholdings-au/northstar-llm-api/pulls)

---

## The Problem

Australian businesses in healthcare, legal, and finance are feeding sensitive client data into American AI systems. US jurisdiction. US servers. US law.

Their compliance teams are starting to notice.

**NorthStar LLM API is the fix.**

---

## What This Is

A private AI inference API running on dedicated hardware in South Australia, served through Cloudflare's Sydney and Melbourne edge network.

- Data never leaves Australian jurisdiction
- No per-token billing, flat monthly subscription
- OpenAI-compatible, one line change from existing code
- No prompts logged or stored
- Built for regulated industries where data residency is a legal requirement

**Endpoint:** `https://api.northstarholdings.com.au`

---

## Why NorthStar Instead of OpenAI or Anthropic

| | NorthStar LLM API | OpenAI / Anthropic |
|---|---|---|
| Data location | South Australia | USA |
| Jurisdiction | Australian law | US law |
| Billing | Flat monthly | Per token, unpredictable |
| Data logged | Never | Yes |
| Suitable for health/legal/finance | Yes | Verify carefully |
| Data sovereignty compliant | Yes | No |

---

## Models Available

| Model | Parameters | Use Case | Tier |
|---|---|---|---|
| gemma3:4b | 4.3B Q4_K_M | Fast general inference | Developer, Basic |
| gemma3:12b | 12.2B Q4_K_M | Higher quality reasoning | Pro, Enterprise |

---

## Quick Start

The API is OpenAI-compatible. Existing code works with one endpoint change.

Request example using curl:

curl -X POST https://api.northstarholdings.com.au/api/generate \
  -H "x-api-key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemma3:4b","prompt":"Summarise this document:","stream":false}'

Request example using Python:

import requests
response = requests.post(
    "https://api.northstarholdings.com.au/api/generate",
    headers={"x-api-key": "your-api-key-here", "Content-Type": "application/json"},
    json={"model": "gemma3:4b", "prompt": "Summarise the key risks in this contract clause:", "stream": False}
)
print(response.json()["response"])

Request example using JavaScript:

const response = await fetch("https://api.northstarholdings.com.au/api/generate", {
  method: "POST",
  headers: {"x-api-key": "your-api-key-here", "Content-Type": "application/json"},
  body: JSON.stringify({model: "gemma3:4b", prompt: "Summarise the key risks in this contract clause:", stream: false})
});
const data = await response.json();
console.log(data.response);

---

## Real-World Use Cases

Healthcare: Summarise patient intake notes. Patient data stays in Australia. Zero offshore exposure.

Legal: Identify obligations and risks in contract clauses. Client documents never leave Australian jurisdiction.

Finance: Draft client communications from portfolio data. Financial data stays under Australian regulatory control.

Government: Summarise policy documents. Sovereign data stays within Australian jurisdiction. No US cloud exposure.

---

## Authentication

Every request requires an x-api-key header. Keys are issued per client.

To get a free trial key, 100 requests, no credit card required:

Email: director@northstarholdings.com.au
Subject: API Trial Request
Include: Your name, company, and use case

---

## Pricing

| Plan | Price | Models | Payment |
|---|---|---|---|
| Trial | Free | gemma3:4b | Email to request |
| Developer | $29 AUD/month | gemma3:4b | https://buy.stripe.com/9B6aEX6ou3pY4zd44M0co01 |
| Basic | $99 AUD/month | gemma3:4b | https://buy.stripe.com/7sYbJ114a0dMghVfNu0co02 |
| Pro | $199 AUD/month | gemma3:4b + 12b | https://buy.stripe.com/aFa8wP4gm3pYghVbxe0co03 |
| Enterprise | $499 AUD/month | All models + SLA | https://buy.stripe.com/4gMcN5bIOaSq9TxdFm0co04 |

Instant card payment via Stripe. Invoice and bank transfer available on request.

---

## Architecture

Client Request
-> api.northstarholdings.com.au
-> Cloudflare Edge, Sydney and Melbourne
-> Cloudflare Zero Trust Tunnel, encrypted, outbound-only
-> NorthStar API Gateway, Node.js, auth, logging, model isolation
-> Ollama, localhost only, never exposed to internet
-> Gemma3 inference
-> Response

Security design:
- Ollama never accepts external connections, localhost only
- No inbound ports open, Cloudflare tunnel outbound only
- Per-client API key isolation
- All requests logged with timestamp, client, endpoint, status
- Custom models hard-blocked at gateway, cannot be called externally
- TLS only, no plain HTTP accepted

---

## Infrastructure

Hardware: Intel i9-14900K / 32GB DDR5 / NVIDIA RTX A2000 12GB
Network: 520Mbps upload / Cloudflare Sydney and Melbourne edge
Location: South Australia
Data retention: Zero, no prompts stored

---

## Use Cases By Industry

| Industry | Problem Solved | Data Sensitivity |
|---|---|---|
| Healthcare | Patient note summarisation, triage support | PHI, must stay in AU |
| Legal | Contract review, document analysis | Privileged, offshore risk |
| Finance | Report generation, client communications | Regulated, ASIC/APRA |
| Government | Document processing, internal queries | Sovereign, AU jurisdiction required |
| Developers | Local AI without cloud API costs | Variable |

---

## Roadmap

- Live inference endpoint, complete
- Per-client API key authentication, complete
- Gemma3 4b and 12b models, complete
- Cloudflare Australian edge routing, complete
- Stripe billing five tiers, complete
- Automated key issuance on Stripe payment, complete
- northstarholdings.com.au domain and portfolio, complete
- Per-tier rate limiting, in progress
- Usage dashboard per client, planned
- Additional open-weight models, planned

---

## Contributing

We welcome contributions. See CONTRIBUTING.md for details.

Issues and pull requests are open. If you are building something with Australian data sovereignty requirements and want to discuss integration, reach out directly.

---

## Contact

NorthStar Holdings Trust
ABN 67 387 124 760
Adelaide, South Australia
director@northstarholdings.com.au
https://northstarholdings.com.au

---

## Licence

This repository documents the public API interface. The gateway, model configurations, and infrastructure remain proprietary.

---

Built in South Australia. Serious about privacy. Priced for real business.
