# OpenTriage - Final Configuration Guide

## Current Status

✅ **Backend**: Configured with API key authentication
✅ **Backend Build**: Successful (all TypeScript errors resolved)
⏳ **AI Engine**: Deployed but needs environment variable configuration

## What You Need to Do

### Step 1: Configure AI Engine on HuggingFace Spaces

1. Go to: https://huggingface.co/spaces/cosmicmagnetar/opentriage-ai
2. Click **Settings** (gear icon, top right)
3. Look for **Repository secrets** or **Environment variables** section
4. Add this variable:
   ```
   API_KEY=opentriage-secret-key-2024
   ```
5. Save/Submit
6. Click **Restart** button to redeploy the space
7. Wait 2-3 minutes for the space to restart

### Step 2: Verify Configuration

Once the space has restarted, test with:

```bash
curl -X POST https://cosmicmagnetar-opentriage-ai.hf.space/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: opentriage-secret-key-2024" \
  -d '{"message": "Hello", "history": [], "context": {}}'
```

You should get an AI response, not an authentication error.

### Step 3: Test Full Integration

1. Go to your OpenTriage application
2. Navigate to contributor dashboard
3. Try the AI Chat feature
4. Should work without 503 errors

## Complete Configuration Reference

### Backend (.env.local) - Already Set ✅

```env
# AI Engine URL
AI_ENGINE_URL=https://cosmicmagnetar-opentriage-ai.hf.space
AI_ENGINE_API_KEY=opentriage-secret-key-2024
```

### AI Engine (HuggingFace Spaces) - NEEDS TO BE SET

Environment variable name: `API_KEY`
Value: `opentriage-secret-key-2024`

## Authentication Flow

```
[Frontend]
    ↓ (sends message with JWT token)
[Backend API - /api/chat]
    ↓ (validates user, then forwards with API key)
[AI Engine - /chat]
    ↓ (validates API key)
[OpenRouter LLM API]
    ↓ (generates response)
[Backend]
    ↓
[Frontend - displays response]
```

## File Changes Made

1. **backend-ts/.env.local**
   - Added: `AI_ENGINE_API_KEY=opentriage-secret-key-2024`

2. **backend-ts/src/lib/ai-client.ts**
   - Added API key constant: `const AI_ENGINE_API_KEY = process.env.AI_ENGINE_API_KEY || "";`
   - Changed auth from JWT to API key: `headers["X-API-Key"] = AI_ENGINE_API_KEY;`

3. **backend-ts/src/app/api/chat/route.ts**
   - Removed JWT token generation (no longer needed)
   - Simplified chat call parameters

## Next Steps

1. ⚠️ **Set API_KEY on HuggingFace Spaces** (you need to do this manually)
2. Restart the space
3. Test the AI chat feature
4. If still having issues, check:
   - HF Spaces environment variables are saved
   - The space restart completed successfully
   - The backend has the correct AI_ENGINE_URL and API_KEY

## Debugging

If AI chat still doesn't work:

```bash
# 1. Check AI engine is running
curl https://cosmicmagnetar-opentriage-ai.hf.space/health

# 2. Test with API key (after HF config)
curl -X POST https://cosmicmagnetar-opentriage-ai.hf.space/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: opentriage-secret-key-2024" \
  -d '{"message": "test", "history": [], "context": {}}'

# 3. Check backend logs on HuggingFace Spaces
# (Go to space and check the "App" tab for logs)
```

---

**Summary**: The AI engine authentication is now fixed on the backend side. You just need to add the `API_KEY` environment variable to the HuggingFace Spaces deployment and restart it. After that, the AI chat should work!
