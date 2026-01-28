# AI Engine - HuggingFace Spaces Configuration Guide

## Problem

The AI engine requires JWT_SECRET to authenticate requests from the backend, but the HuggingFace Spaces deployment may not have it configured.

## Solution

### Step 1: Access HuggingFace Spaces Settings

1. Go to https://huggingface.co/spaces/cosmicmagnetar/opentriage-ai
2. Click **Settings** button (top right)
3. Look for **Repository secrets** or **Environment variables** section

### Step 2: Add Required Secrets

Add the following environment variables:

| Variable             | Value                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `JWT_SECRET`         | `fbfd4546y6_y76hdvf_or_htfe5y5gr`                                                             |
| `OPENROUTER_API_KEY` | (same as backend) `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` |

### Step 3: Restart the Space

After adding secrets:

1. Click **Restart** button in the Space interface
2. Wait for the deployment to restart (~2-5 minutes)
3. Test with: `curl https://cosmicmagnetar-opentriage-ai.hf.space/health`

## Manual Testing

Once secrets are configured, test with:

```bash
# Generate a test token (using backend's JWT_SECRET)
TOKEN=$(node -e "
const jwt = require('jsonwebtoken');
const secret = 'fbfd4546y6_y76hdvf_or_htfe5y5gr';
const token = jwt.sign({
  user_id: 'test-user',
  role: 'contributor'
}, secret, { algorithm: 'HS256' });
console.log(token);
")

# Test chat endpoint
curl -X POST https://cosmicmagnetar-opentriage-ai.hf.space/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "Hello", "history": [], "context": {}}'
```

Expected response: AI chat response (not 401 error)

## HuggingFace Spaces Documentation

https://huggingface.co/docs/hub/spaces-config-reference#environment-variables

## Alternatively: Use API Key Authentication

If you prefer API key authentication instead of JWT:

1. Add `API_KEY` environment variable to HF Spaces:

   ```
   API_KEY=your-secret-api-key-here
   ```

2. Update backend to use API key:

   ```typescript
   // In ai-client.ts
   headers["X-API-Key"] = process.env.AI_ENGINE_API_KEY || "your-api-key";
   ```

3. Test with:
   ```bash
   curl -X POST https://cosmicmagnetar-opentriage-ai.hf.space/chat \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-secret-api-key-here" \
     -d '{"message": "Hello", "history": [], "context": {}}'
   ```
