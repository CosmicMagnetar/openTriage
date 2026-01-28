# OpenRouter API Key Issue - Solutions

## Problem
The OpenRouter API key in your environment is **invalid** - returning "User not found" error.

## Solutions (Choose One)

### Solution 1: Get a Valid OpenRouter API Key (Recommended)

1. Go to: https://openrouter.ai
2. Sign up for a free account
3. Navigate to: https://openrouter.ai/keys
4. Create a new API key
5. Copy the key (should start with `sk-or-v1-`)
6. Add it to HuggingFace Spaces:
   - Go to: https://huggingface.co/spaces/cosmicmagnetar/opentriage-ai/settings
   - Set: `OPENROUTER_API_KEY=<your_new_key>`
   - Restart the space

### Solution 2: Use HuggingFace Inference API (Free Alternative)

If you don't want to use OpenRouter, we've added fallback support for HuggingFace Inference API:

1. Get a free HuggingFace token:
   - Go to: https://huggingface.co/settings/tokens
   - Create a new token (read-only is fine)

2. Add to HuggingFace Spaces:
   - Go to: https://huggingface.co/spaces/cosmicmagnetar/opentriage-ai/settings
   - Set: `HF_API_TOKEN=<your_hf_token>`
   - Restart the space

3. The AI will now automatically:
   - Try OpenRouter models (if API key is valid)
   - Fall back to HuggingFace Inference API (if OpenRouter fails)

### Solution 3: Switch to a Free LLM Service

Alternative free/freemium services:

**Option A: Google AI Studio (Gemini)**
- Go to: https://ai.google.dev/
- Get free API key
- Update backend to use Google's API

**Option B: Anthropic Claude (Claude 3.5 Sonnet)**
- Has a free tier
- https://console.anthropic.com/

**Option C: Together AI**
- Free tier available
- https://www.together.ai/

## Current Fallback Chain

After the latest update, the AI will try:

1. **OpenRouter** - All 5 models with fallbacks
   - meta-llama/llama-3.3-70b
   - arcee-ai/trinity-large-preview
   - liquid/lfm-2.5-1.2b-thinking
   - allenai/molmo-2-8b
   - nvidia/nemotron-3-nano-30b

2. **HuggingFace Inference API** - If OpenRouter fails
   - Uses Mistral-7B model (free)
   - Requires HF_API_TOKEN environment variable

3. **Graceful degradation** - If all fail
   - Returns helpful error message
   - User can try again later

## How to Check Which API Key is Being Used

Test endpoint (after restart):
```bash
# Check OpenRouter
curl -X POST https://cosmicmagnetar-opentriage-ai.hf.space/debug/test-openrouter \
  -H "X-API-Key: opentriage-secret-key-2024"

# This will show:
# - OpenRouter API status
# - Which model was used
# - Any error messages
```

## Recommended Action Now

**Get a new OpenRouter API key** (Solution 1):
- Fastest to implement
- Most reliable
- All models available
- Better quality responses

Then update the HuggingFace Space and restart.

---

## Files That Need Configuration

### HuggingFace Space: opentriage-ai

**Minimum (OpenRouter only):**
```
OPENROUTER_API_KEY=sk-or-v1-<your_key>
```

**Recommended (OpenRouter + Fallback):**
```
OPENROUTER_API_KEY=sk-or-v1-<your_key>
HF_API_TOKEN=<your_hf_token>
API_KEY=opentriage-secret-key-2024
JWT_SECRET=fbfd4546y6_y76hdvf_or_htfe5y5gr
```

**After changing any variables:** Click "Restart Space"
