/**
 * Chatbot Routes
 * 
 * API endpoints for the Gemini AI-powered chatbot assistant
 */

const express = require("express");
const { protect, optionalAuth } = require("../middleware/auth");
const { processMessageWithAI } = require("../utils/geminiChatbot");
const { processMessage: processMessageFallback } = require("../utils/chatbot");

const router = express.Router();

// Conversation context store (in-memory, would use Redis in production)
const conversationContexts = new Map();

/**
 * Send message to chatbot (Gemini AI-powered)
 * POST /api/chatbot/message
 */
router.post("/message", optionalAuth, async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Get or create conversation context
    const contextKey = sessionId || req.user?._id?.toString() || `anon-${Date.now()}`;
    let context = conversationContexts.get(contextKey) || {};
    
    // Pass sessionId to process message for session management
    context.sessionId = contextKey;
    context.userId = req.user?._id;

    // Process message with Gemini AI (falls back to pattern matching if unavailable)
    const response = await processMessageWithAI(message, context);

    // Update context
    if (response.searchParams) {
      context.searchParams = response.searchParams;
      context.lastSearch = new Date();
    }
    if (response.context) {
      context = { ...context, ...response.context };
    }
    if (response.sessionUpdate) {
      context = { ...context, ...response.sessionUpdate };
    }
    context.lastMessage = message;
    context.lastMessageTime = new Date();

    conversationContexts.set(contextKey, context);

    // Auto-cleanup old contexts (after 30 mins)
    setTimeout(() => {
      const storedContext = conversationContexts.get(contextKey);
      if (storedContext && Date.now() - storedContext.lastMessageTime > 30 * 60 * 1000) {
        conversationContexts.delete(contextKey);
      }
    }, 30 * 60 * 1000);

    res.json({
      ...response,
      sessionId: contextKey,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Chatbot error:", error);
    res.status(500).json({
      type: "error",
      message: "Sorry, I encountered an error. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

/**
 * Handle quick action buttons
 * POST /api/chatbot/action
 */
router.post("/action", optionalAuth, async (req, res) => {
  try {
    const { action, sessionId } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action is required" });
    }

    const response = getQuickActionResponse(action);

    if (response) {
      return res.json({
        ...response,
        sessionId,
        timestamp: new Date().toISOString()
      });
    }

    // If action is a search refinement or custom action
    const contextKey = sessionId || req.user?._id?.toString() || "anonymous";
    const context = conversationContexts.get(contextKey) || {};

    // Process as a message
    const messageResponse = await processMessage(action, context);
    
    res.json({
      ...messageResponse,
      sessionId: contextKey,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Chatbot action error:", error);
    res.status(500).json({
      type: "error",
      message: "Sorry, I couldn't process that action."
    });
  }
});

/**
 * Get ride prediction for user
 * GET /api/chatbot/prediction
 */
router.get("/prediction", protect, async (req, res) => {
  try {
    const prediction = await getPredictedRide(req.user._id);

    if (prediction) {
      res.json(prediction);
    } else {
      res.json({
        type: "no_prediction",
        message: "Complete more rides to get personalized predictions!"
      });
    }
  } catch (error) {
    console.error("Prediction error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get FAQ topics
 * GET /api/chatbot/faq
 */
router.get("/faq", (req, res) => {
  const topics = Object.entries(FAQ_KNOWLEDGE).map(([key, value]) => ({
    id: key,
    keywords: value.keywords.slice(0, 3),
    preview: value.response.substring(0, 100) + "..."
  }));

  res.json({
    topics,
    categories: ["booking", "features", "safety", "pricing", "general"]
  });
});

/**
 * Get specific FAQ answer
 * GET /api/chatbot/faq/:topic
 */
router.get("/faq/:topic", (req, res) => {
  const topic = req.params.topic.toLowerCase().replace(/-/g, " ");
  const faq = FAQ_KNOWLEDGE[topic];

  if (faq) {
    res.json({
      topic,
      response: faq.response,
      relatedTopics: Object.keys(FAQ_KNOWLEDGE)
        .filter(k => k !== topic)
        .slice(0, 3)
    });
  } else {
    res.status(404).json({ error: "FAQ topic not found" });
  }
});

/**
 * Get conversation history
 * GET /api/chatbot/history
 */
router.get("/history", protect, async (req, res) => {
  try {
    const contextKey = req.user._id.toString();
    const context = conversationContexts.get(contextKey);

    res.json({
      hasContext: !!context,
      lastSearch: context?.searchParams || null,
      lastMessageTime: context?.lastMessageTime || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Clear conversation context
 * DELETE /api/chatbot/history
 */
router.delete("/history", protect, (req, res) => {
  const contextKey = req.user._id.toString();
  conversationContexts.delete(contextKey);
  res.json({ message: "Conversation context cleared" });
});

/**
 * Get chatbot suggestions based on context
 * GET /api/chatbot/suggestions
 */
router.get("/suggestions", optionalAuth, async (req, res) => {
  try {
    const suggestions = [];

    // If authenticated, add personalized suggestions
    if (req.user) {
      // Add prediction if available
      const prediction = await getPredictedRide(req.user._id);
      if (prediction?.prediction) {
        suggestions.push({
          type: "predicted_route",
          text: `${prediction.prediction.route.from?.name} → ${prediction.prediction.route.to?.name}`,
          action: `Find rides from ${prediction.prediction.route.from?.name} to ${prediction.prediction.route.to?.name}`
        });
      }
    }

    // Add common suggestions
    suggestions.push(
      { type: "action", text: "🔍 Search for a ride", action: "Search Ride" },
      { type: "action", text: "➕ Post a new ride", action: "Create Ride" },
      { type: "faq", text: "❓ How does booking work?", action: "How to book?" },
      { type: "faq", text: "🛡️ Safety features", action: "Safety features" }
    );

    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
