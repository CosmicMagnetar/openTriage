# OpenTriage AI Engine - Full Backend

Full-featured AI backend for OpenTriage, lifted directly from the original Python codebase.

## Features

- **Issue Triage** - AI-powered classification and labeling
- **RAG Chatbot** - Repository-aware Q&A using retrieval-augmented generation  
- **Mentor Matching** - Tech stack-based mentor recommendations
- **Hype Generator** - Celebration messages for PRs
- **AI Chat** - General assistance for contributors

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/triage` | POST | Issue classification |
| `/chat` | POST | AI chat assistant |
| `/rag/chat` | POST | RAG-based Q&A |
| `/rag/index` | POST | Index repository for RAG |
| `/rag/suggestions` | GET | Suggested questions |
| `/mentor-match` | POST | Find mentor matches |
| `/hype` | POST | Generate PR celebration |
| `/rag/prepare` | POST | Prepare RAG documents |
| `/rag/chunks` | GET | Get chunks for embedding |

## Quick Start

### Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export OPENROUTER_API_KEY=your_key_here

# Run the server
python main.py
```

### Docker

```bash
docker build -t opentriage-ai-engine .
docker run -p 7860:7860 -e OPENROUTER_API_KEY=your_key opentriage-ai-engine
```

## Hugging Face Spaces Deployment

1. Create a new Space (Docker SDK)
2. Add secrets in Space settings:
   - `OPENROUTER_API_KEY` (required)
   - `MONGO_URL` (optional, for DB features)
3. Push this folder to the Space

The Dockerfile is pre-configured for HF Spaces (non-root user, port 7860).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `MONGO_URL` | No | MongoDB connection string |
| `FRONTEND_URL` | No | Frontend URL for CORS |
| `CORS_ORIGINS` | No | Comma-separated CORS origins |
| `ENVIRONMENT` | No | `development` or `production` |

## Architecture

```
ai-engine/
├── main.py              # FastAPI wrapper (new)
├── Dockerfile           # HF-compliant Docker config
├── requirements.txt     # Python dependencies
├── config/
│   └── settings.py      # Environment configuration
├── models/              # Pydantic models (original)
├── services/            # AI services (original, unchanged)
│   ├── ai_service.py
│   ├── rag_chatbot_service.py
│   ├── mentor_matching_service.py
│   ├── hype_generator_service.py
│   └── rag_data_prep.py
└── utils/               # Utilities (original)
```

## License

MIT - See parent repository LICENSE file.
