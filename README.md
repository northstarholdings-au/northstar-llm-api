# NorthStar LLM API

> Private AI inference for Australian businesses. Your data never leaves Australia.

## What This Is

A private, hosted AI API running on Australian infrastructure. No data sent offshore. No per-token billing surprises. No rate limit headaches.

Built for Australian developers and businesses who need AI inference that stays within Australian borders — for compliance, privacy, or sovereignty reasons.

**Endpoint:** `https://api.northstarbuyingguides.store`

---

## Why Use This Instead of OpenAI or Anthropic

| | NorthStar LLM API | OpenAI / Anthropic |
|---|---|---|
| Data location | Australia | USA |
| Billing | Flat monthly | Per token |
| Data logged by provider | No | Yes |
| Suitable for health/legal/finance data | Yes | Verify carefully |
| Rate limits | Generous | Restrictive on lower tiers |

---

## Models Available

| Model | Use Case | Speed |
|---|---|---|
| `gemma3:4b` | General tasks, fast responses | Fast |
| `gemma3:12b` | Complex reasoning, better quality | Moderate |

---

## Quick Start

The API is OpenAI-compatible. If you have existing code using OpenAI, you can point it at this endpoint with minimal changes.

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

---

## Authentication

Every request requires an `x-api-key` header. Keys are issued per client.

To request a free trial key (100 requests, no credit card):

**Email:** northstarholdings.global@gmail.com
**Subject:** API Trial Request
**Include:** Your name, company, and intended use case

---

## Pricing

| Plan | Price | Requests/min | Model Access | Payment |
|---|---|---|---|---|
| Trial | Free | 10 | gemma3:4b | [Request trial](mailto:northstarholdings.global@gmail.com?subject=API%20Trial%20Request) |
| Basic | $99 AUD/month | 60 | gemma3:4b | [Subscribe](https://buy.stripe.com/fZu9AS5YGgnYfnf0K02Fa02) |
| Pro | $199 AUD/month | 120 | gemma3:4b + 12b | [Subscribe](https://buy.stripe.com/28EaEWbj0fjU5MF3Wc2Fa01) |
| Enterprise | $499 AUD/month | Unlimited | All models + SLA | [Subscribe](https://buy.stripe.com/00w3cugDk7Rs6QJeAQ2Fa00) |

Instant card payment via Stripe. Invoice and bank transfer available on request.

---

## Use Cases

- **Healthcare:** Summarise patient notes, triage queries — data stays in Australia
- **Legal:** Contract review, document analysis — no offshore data exposure
- **Finance:** Report generation, client communication drafts
- **Developers:** Prototype and build AI features without cloud API costs
- **Compliance:** Meet data residency requirements without managing your own infrastructure

---

## Infrastructure

- Hosted in South Australia
- Served via Cloudflare's Australian edge network (Sydney + Melbourne)
- Encrypted in transit — TLS only, no plain HTTP accepted
- No prompt logging — your data is not stored or used for training

---

## Contact

**NorthStar Holdings**
Adelaide, South Australia
northstarholdings.global@gmail.com

---

*Built for Australia. Priced for small business. Serious about privacy.*
