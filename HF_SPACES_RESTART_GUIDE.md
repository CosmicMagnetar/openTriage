# HuggingFace Spaces Manual Restart Required

## Problem

HuggingFace Spaces is not automatically deploying the latest code from GitHub. The changes you pushed are in the repo but not deployed.

## Solution

### For AI Engine Space (cosmicmagnetar-opentriage-ai)

1. Go to: https://huggingface.co/spaces/cosmicmagnetar/opentriage-ai
2. Click **Settings** (top right, gear icon)
3. Scroll down to **Restart** section
4. Click the **Restart** button
5. Wait 2-3 minutes for redeploy
6. Check with: `curl https://cosmicmagnetar-opentriage-ai.hf.space/health`

### For Backend API Space (cosmicmagnetar-opentriage-api)

1. Go to: https://huggingface.co/spaces/cosmicmagnetar/opentriage-api
2. Click **Settings** (top right, gear icon)
3. Scroll down to **Restart** section
4. Click the **Restart** button
5. Wait 2-3 minutes for redeploy

## Current Status

The code has been updated in the GitHub repository:

- ✅ AI engine auth temporarily disabled for testing
- ✅ Backend API configured to send API key headers
- ⏳ Waiting for HuggingFace Spaces to deploy

Once you restart both spaces, the AI chat should work!

## What Changed in Code

1. **AI Engine (ai-engine/middleware.py)**
   - Temporarily disabled authentication check
   - (Will re-enable once we confirm everything works)

2. **Backend API (backend-ts/.env.local + src/lib/ai-client.ts)**
   - Added `AI_ENGINE_API_KEY` environment variable
   - Backend sends API key to AI engine with each request

## Testing After Restart

```bash
# Test AI engine health
curl https://cosmicmagnetar-opentriage-ai.hf.space/health

# Test chat endpoint (auth disabled, so no API key needed)
curl -X POST https://cosmicmagnetar-opentriage-ai.hf.space/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "history": [], "context": {}}'

# Test through backend API
curl -X POST https://cosmicmagnetar-opentriage-api.hf.space/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"message": "Hello", "sessionId": "test", "history": [], "context": {}}'
```
