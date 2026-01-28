# AI Engine Setup Guide

## Quick Start

The OpenTriage AI engine requires a Python backend to process AI requests. Without it, you'll see 503 errors.

### Option 1: Docker (Recommended)

```bash
cd ai-engine
docker-compose up -d
```

This starts the AI engine on `http://localhost:7860`

### Option 2: Python Direct

```bash
cd ai-engine
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 7860
```

### Option 3: Using Render/HuggingFace

If you deployed the AI engine to Render or HuggingFace, configure it in `backend-ts/.env.local`:

```bash
AI_ENGINE_URL=https://your-deployed-ai-engine-url
```

## Configuration

In `backend-ts/.env.local`:

```bash
# Default local AI engine
AI_ENGINE_URL=http://localhost:7860

# Or your deployed URL
# AI_ENGINE_URL=https://cosmicmagnetar-opentriage-ai.hf.space
```

## Checking AI Engine Status

### From Browser

Visit: `http://localhost:7860/docs` (if running locally)

### From Terminal

```bash
curl http://localhost:7860/health
# or check backend health
curl http://localhost:3001/api/health
```

Expected response should include AI engine URL configuration.

## Troubleshooting

### 503 - AI Service Unavailable

- AI engine is not running
- Solution: Start the AI engine (see Quick Start above)

### 502 - Bad Gateway

- AI engine crashed or not responding
- Solution: Check AI engine logs and restart

### 500 - Internal Server Error

- AI engine processing error
- Solution: Check AI engine logs for details

## AI Engine Endpoints

The AI engine provides these endpoints:

- `POST /chat` - Chat completion
- `POST /triage` - Issue triage
- `POST /rag/chat` - RAG-based chat
- `POST /mentor-match` - Mentor matching

## Development vs Production

### Development

```bash
# Terminal 1: Backend
cd backend-ts
npm run dev

# Terminal 2: AI Engine
cd ai-engine
python -m uvicorn main:app --reload --port 7860

# Terminal 3: Frontend
cd frontend_new
npm run dev
```

### Production (Docker)

```bash
docker-compose up -d
```

All services start automatically and connect to each other.

## Environment Variables Needed

```bash
# backend-ts/.env.local
AI_ENGINE_URL=http://localhost:7860  # or your deployed URL
JWT_SECRET=your-secret
DATABASE_URL=your-database-url
TURSO_DATABASE_URL=your-turso-url
TURSO_AUTH_TOKEN=your-turso-token
```

## Testing AI Features

### Via Frontend

1. Start all services (backend, AI engine, frontend)
2. Navigate to Contributor > AI Chat
3. Ask a question
4. Should get AI response

### Via API

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","context":{}}'
```

## Common Issues

| Issue                   | Solution                              |
| ----------------------- | ------------------------------------- |
| 503 Service Unavailable | Start AI engine                       |
| Connection refused      | Check AI_ENGINE_URL                   |
| Timeout                 | AI engine too slow, check Python logs |
| 500 Internal Error      | Check AI engine logs for details      |

## Support

If you encounter persistent issues:

1. Check AI engine logs: `docker logs opentriage-ai` (if using Docker)
2. Check backend logs: Look at terminal running `npm run dev`
3. Verify environment variables are set correctly
4. Ensure database migrations have run
