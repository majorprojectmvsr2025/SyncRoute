# Gemini AI Chatbot Setup

## Overview

SyncRoute now uses **Google Gemini AI** for natural language understanding in the chatbot, replacing hardcoded pattern matching.

## Setup Instructions

### 1. Install Dependencies

```bash
cd syncroute-backend
npm install @google/generative-ai
```

### 2. Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key

### 3. Add to Environment Variables

Edit `syncroute-backend/.env`:

```env
GEMINI_API_KEY=your_api_key_here
```

### 4. Restart Backend

```bash
npm run dev
```

## Features

✅ **Natural Language Understanding** - Understands conversational queries
✅ **Smart Context** - Remembers conversation history
✅ **Fallback Support** - Works without API key (uses pattern matching)
✅ **Markdown Rendering** - Proper bold (**text**) formatting
✅ **Clean UI** - Simplified, less icons

## Example Queries

The AI chatbot understands:

- "Find rides from Hyderabad to Gachibowli tomorrow"
- "I need a ride to airport today evening"
- "Show me rides from Balapur to Golconda on April 12"
- "Any rides to Hi-Tech City this weekend?"

## Fallback Mode

If Gemini API is not configured, the chatbot automatically falls back to pattern matching mode. You'll see this in logs:

```
[GeminiAI] No API key found - chatbot will use fallback mode
```

## Cost

Gemini 1.5 Flash is **FREE** up to:

- 15 requests per minute
- 1 million tokens per minute
- 1,500 requests per day

Perfect for development and small-scale production!

## Troubleshooting

### "Unknown origin/destination"

This means your existing rides in the database don't have `from.name` and `to.name` fields.

**Solution**: Create new test rides, or update existing rides:

```javascript
// MongoDB update script
db.rides.updateMany(
  { "from.name": { $exists: false } },
  {
    $set: {
      "from.name": "Test Origin",
      "to.name": "Test Destination",
    },
  },
);
```

### Chatbot not responding

1. Check backend logs for errors
2. Verify GEMINI_API_KEY is set
3. Check API quota at [Google AI Studio](https://makersuite.google.com/app/apikey)

## Files Modified

- `syncroute-backend/utils/geminiChatbot.js` - New AI chatbot logic
- `syncroute-backend/routes/chatbotRoutes.js` - Updated to use Gemini
- `syncroute-frontend/src/components/ChatWidget.tsx` - Markdown rendering, simplified UI
