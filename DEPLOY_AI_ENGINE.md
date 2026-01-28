# Deploying AI Engine to HuggingFace Spaces

The OpenTriage backend needs the AI engine service running to provide chat, triage, and RAG features. This guide explains how to deploy it to HuggingFace Spaces.

## Prerequisites

- [HuggingFace Account](https://huggingface.co/join)
- Git installed locally
- Access to the OpenTriage AI engine repository

## Deployment Steps

### 1. Create a New Space on HuggingFace

1. Go to [HuggingFace Spaces](https://huggingface.co/spaces)
2. Click "Create new Space"
3. Choose:
   - **Name**: `opentriage-ai-engine` (or any name)
   - **License**: Apache 2.0
   - **Space SDK**: Docker
   - **Space hardware**: GPU (if available) or CPU
   - **Private/Public**: Public
4. Click "Create Space"

### 2. Deploy the AI Engine

#### Option A: Using Git (Recommended)

```bash
# Clone your repo if you haven't
git clone https://github.com/YourUsername/openTriage.git
cd openTriage/ai-engine

# Add HuggingFace repo as remote
git remote add hf https://huggingface.co/spaces/YourUsername/opentriage-ai-engine
# or update existing
git remote set-url hf https://huggingface.co/spaces/YourUsername/opentriage-ai-engine

# Push to HuggingFace
git push hf main --force
```

#### Option B: Upload via Web UI

1. Go to your HuggingFace Space
2. Click "Files" tab
3. Upload:
   - `ai-engine/Dockerfile`
   - `ai-engine/main.py`
   - `ai-engine/requirements.txt`
   - `ai-engine/middleware.py`
   - `ai-engine/spark_manager.py`

### 3. Configure Environment Variables

1. Go to Space Settings
2. Click "Repository secrets"
3. Add variables needed by your AI engine:
   - `GITHUB_TOKEN` (if used)
   - `DATABASE_URL` (if needed)
   - Any other API keys

### 4. Configure Backend to Use Deployed AI Engine

In `backend-ts/.env.local` (or deployment environment):

```bash
# Use the HuggingFace Spaces URL for AI engine
AI_ENGINE_URL=https://yourusername-opentriage-ai-engine.hf.space

# Or use the deployed backend's AI engine if running there
AI_ENGINE_URL=https://cosmicmagnetar-opentriage-api.hf.space
```

### 5. Monitor Deployment

- Check HuggingFace Space page for logs
- Wait for "Building" status to complete
- Space URL will be shown when ready

## Verify Deployment

```bash
# Check if AI engine is running
curl https://yourusername-opentriage-ai-engine.hf.space/health

# Expected response: Health check endpoint response
```

## Troubleshooting

### Space is stuck building

- Check the "App logs" in your Space
- Common issues:
  - Missing dependencies in `requirements.txt`
  - Port conflicts (should use port 7860 for HuggingFace)
  - Out of memory (upgrade to better hardware)

### 503 Error from Backend

- Verify `AI_ENGINE_URL` is correct in backend env vars
- Check AI engine Space is actually running
- Ensure Space is Public (not Private)

### Slow Responses

- AI engine may be on CPU-only hardware
- Upgrade to GPU in Space settings
- Optimize model loading in `main.py`

## Running Locally for Testing

Before deploying to HuggingFace, test locally:

```bash
cd ai-engine
docker build -t opentriage-ai .
docker run -p 7860:7860 opentriage-ai

# Should be accessible at http://localhost:7860
```

## HuggingFace Space Structure

Your Space should have this structure:

```
opentriage-ai-engine/
├── Dockerfile
├── main.py
├── middleware.py
├── requirements.txt
├── spark_manager.py
└── models/ (optional)
```

## Dockerfile Considerations

The `Dockerfile` should:

- Expose port 7860 (HuggingFace requirement)
- Start the service with:
  ```dockerfile
  CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
  ```

## Managing Multiple Deployments

You can have multiple AI engine instances:

**Local Development**

```bash
AI_ENGINE_URL=http://localhost:7860
```

**HuggingFace Deployment**

```bash
AI_ENGINE_URL=https://yourusername-opentriage-ai-engine.hf.space
```

**On-Premises Deployment**

```bash
AI_ENGINE_URL=https://your-domain.com/ai-engine
```

Switch by changing the environment variable.

## Cost Considerations

- **Free tier**: Limited compute, may timeout
- **Paid tier**: Persistent storage, more resources
- **Recommended**: Upgrade to Pro Space for consistent availability

## Getting Help

- Check HuggingFace Spaces documentation
- Review AI engine logs in Space page
- Check OpenTriage documentation
- Open an issue on GitHub

## Advanced: Custom Domain

If you want a custom domain for your AI engine:

1. Go to Space Settings → General
2. Find "Custom domain" section
3. Add your domain
4. Update DNS records
5. Update `AI_ENGINE_URL` in backend

Example:

```bash
AI_ENGINE_URL=https://ai.yourdomain.com
```
