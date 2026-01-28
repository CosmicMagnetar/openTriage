# Final Fix: AI Engine Configuration

## What's Changed

The backend now uses **API Key Authentication** instead of JWT tokens. This is simpler and doesn't require the AI engine to have the same JWT secret.

## Configuration Steps

### 1. Backend Configuration ✅

Already done in `backend-ts/.env.local`:

```env
AI_ENGINE_API_KEY=opentriage-secret-key-2024
```

### 2. AI Engine Configuration (HuggingFace Spaces)

Go to: https://huggingface.co/spaces/cosmicmagnetar/opentriage-ai/settings

Add this environment variable:

```
API_KEY=opentriage-secret-key-2024
```

Then click **Restart** to redeploy the space.

### 3. Test the Connection

```bash
curl -X POST https://cosmicmagnetar-opentriage-ai.hf.space/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: opentriage-secret-key-2024" \
  -d '{"message": "Hello", "history": [], "context": {}}'
```

Expected response: AI response (not 401 error)

## How It Works

1. Frontend user sends message to `/api/chat`
2. Backend authenticates user's JWT token
3. Backend forwards request to AI engine with `X-API-Key: opentriage-secret-key-2024`
4. AI engine validates API key
5. AI engine processes request and returns response
6. Backend returns response to frontend

## Troubleshooting

- **Still getting 401 errors?** → Check that `API_KEY` environment variable is set in HF Spaces
- **Still getting 503 errors?** → Check that the space is running (click "Restart" if needed)
- **Timeout errors?** → The AI engine might be sleeping (HF Spaces puts spaces to sleep after 48h inactivity)
