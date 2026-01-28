# Messaging & AI Chat Fixes

## Issues Fixed

### 1. ✅ Message Send/Edit/Delete Errors

**Problems:**

- `setMenuOpenId is not defined` - Missing state variable
- Database insert error: `edited_at` field causing constraint violations
- Unable to send, edit, or delete messages

**Fixes Applied:**

- Added missing `menuOpenId` state in [MessagesPage.jsx](frontend_new/src/components/contributor/MessagesPage.jsx#L25)
- Set `editedAt: null` explicitly in `sendMessage` function to satisfy database schema
- Both issues resolved in the same commit

### 2. ✅ AI Chatbot 502 Error

**Problems:**

- AI chatbot returning 502 Bad Gateway
- No clear error messages for users

**Fixes Applied:**

- Enhanced error handling in [chat/route.ts](backend-ts/src/app/api/chat/route.ts)
- Changed 502 to 503 status code for AI service unavailability
- Added detailed error logging with stack traces
- Added user-friendly error messages in [ContributorAIChat.jsx](frontend_new/src/components/contributor/ContributorAIChat.jsx)
- Added AI_ENGINE_URL to health check endpoint

## Configuration Required

### AI Engine Setup

The AI chatbot requires a Python AI engine to be running. Configure it in `backend-ts/.env.local`:

```bash
# AI Engine Configuration
AI_ENGINE_URL=http://localhost:7860
```

**To start the AI engine:**

```bash
cd ai-engine
python -m uvicorn main:app --host 0.0.0.0 --port 7860
```

Or if using Docker:

```bash
cd ai-engine
docker-compose up -d
```

### Check AI Engine Status

Test if your AI engine is accessible:

```bash
# Check health endpoint
curl http://localhost:3001/api/health

# Expected output should include:
{
  "status": "healthy",
  "env": {
    "ai_engine_url": "http://localhost:7860"
  }
}
```

## Testing the Fixes

### 1. Test Messaging

**Send Message:**

1. Navigate to Messages page
2. Select a conversation
3. Type and send a message
4. Should work without 500 errors

**Edit Message:**

1. Click the menu (•••) on your own message
2. Click "Edit"
3. Modify the text
4. Click save (✓)
5. Should update without errors

**Delete Message:**

1. Click the menu (•••) on your own message
2. Click "Delete"
3. Confirm deletion
4. Message should be removed

### 2. Test AI Chatbot

**With AI Engine Running:**

1. Open the AI Chat panel
2. Type a message
3. Should receive AI response

**Without AI Engine:**

1. Will show error: "AI service is temporarily unavailable. Please try again later."
2. This is expected behavior when AI engine is not running

## Error Messages Explained

### Messaging Errors

- ✅ **"Failed to send message"** → Fixed by adding `editedAt: null`
- ✅ **"setMenuOpenId is not defined"** → Fixed by adding state variable
- ✅ **Database constraint violation** → Fixed by explicitly setting nullable fields

### AI Chatbot Errors

- **503 - AI service unavailable** → AI engine is not running or not accessible
- **502 - Bad Gateway** → Changed to 503 for clarity
- **Network error** → Frontend cannot reach backend

## Files Modified

### Backend

- `backend-ts/src/lib/db/queries/messages.ts` - Fixed sendMessage to include editedAt
- `backend-ts/src/app/api/chat/route.ts` - Enhanced error handling
- `backend-ts/src/app/api/health/route.ts` - Added AI_ENGINE_URL to health check

### Frontend

- `frontend_new/src/components/contributor/MessagesPage.jsx` - Added menuOpenId state
- `frontend_new/src/components/contributor/ContributorAIChat.jsx` - Better error messages

## Next Steps

1. **Start the AI engine** if you want the chatbot to work:

   ```bash
   cd ai-engine
   python -m uvicorn main:app --host 0.0.0.0 --port 7860
   ```

2. **Test all messaging functions** to ensure they work correctly

3. **Monitor logs** for any remaining issues:

   ```bash
   # Backend logs
   cd backend-ts && npm run dev

   # Check browser console for frontend errors
   ```

## Build and Deploy

Build the backend to verify no TypeScript errors:

```bash
cd backend-ts
npm run build
```

Expected output: ✅ Build successful with no errors

Then commit and deploy:

```bash
git add .
git commit -m "fix: Resolve messaging and AI chatbot errors"
git push
```
