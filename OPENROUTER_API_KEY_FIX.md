# Fix for "All AI Models Unavailable" Error

## Root Cause

The HuggingFace Space doesn't have the `OPENROUTER_API_KEY` environment variable set. Without it, all AI model API calls fail.

## Solution

### Step 1: Set Environment Variable on HuggingFace

Go to: **https://huggingface.co/spaces/cosmicmagnetar/opentriage-ai/settings**

Under **Environment variables** section, add:

```
OPENROUTER_API_KEY=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
```

(This is the same key from your local `backend-ts/.env.local`)

### Step 2: Optionally Add These Too (for completeness)

```
API_KEY=opentriage-secret-key-2024
JWT_SECRET=fbfd4546y6_y76hdvf_or_htfe5y5gr
```

### Step 3: Restart the Space

1. Click **Restart Space** button
2. Wait 3-5 minutes for restart

### Step 4: Test

After restart, test with:

```bash
# Test OpenRouter connectivity
curl -X POST https://cosmicmagnetar-opentriage-ai.hf.space/debug/test-openrouter \
  -H "X-API-Key: opentriage-secret-key-2024"

# If that works, try chat
curl -X POST https://cosmicmagnetar-opentriage-ai.hf.space/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "history": [], "context": {}}'
```

## What Changed in Code

Added better error logging that now shows:
- Which models are being tried
- Exact errors from each model
- Whether the API key is configured

This will help debug future issues faster.

## Environment Variables Needed on HuggingFace Spaces

### AI Engine Space (opentriage-ai)
```
OPENROUTER_API_KEY=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
API_KEY=opentriage-secret-key-2024
JWT_SECRET=fbfd4546y6_y76hdvf_or_htfe5y5gr
```

### Backend API Space (opentriage-api)
```
AI_ENGINE_URL=https://cosmicmagnetar-opentriage-ai.hf.space
AI_ENGINE_API_KEY=opentriage-secret-key-2024
OPENROUTER_API_KEY=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
JWT_SECRET=fbfd4546y6_y76hdvf_or_htfe5y5gr
TURSO_DATABASE_URL=libsql://opentriage-cosmicmagnetar.aws-ap-south-1.turso.io
TURSO_AUTH_TOKEN=(from your .env.local)
```

---

**The AI will work once you add the OPENROUTER_API_KEY to the HuggingFace Space!**
