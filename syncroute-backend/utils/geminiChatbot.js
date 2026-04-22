/**
 * Gemini AI-powered Chatbot for SyncRoute
 * With full conversation history support
 */

const Ride = require("../models/Ride");
const User = require("../models/User");

// Initialize Gemini AI
let genAI, model;

try {
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  // Use provided API key or env variable
  const apiKey = process.env.GEMINI_API_KEY || "AIzaSyC1z9UXlwtMTOZmgR5lZopB3NXVPNWu_xY";
  
  if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("[GeminiAI] Initialized successfully with conversation support");
  } else {
    console.warn("[GeminiAI] No API key found - chatbot will use fallback mode");
  }
} catch (error) {
  console.warn("[GeminiAI] Package not installed - run: npm install @google/generative-ai");
}

// Store conversation history per session (in-memory for simplicity)
const conversationHistory = new Map();

// Clean old conversations every hour
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [sessionId, data] of conversationHistory.entries()) {
    if (data.lastUpdate < oneHourAgo) {
      conversationHistory.delete(sessionId);
    }
  }
}, 60 * 60 * 1000);

/**
 * System prompt for the AI
 */
const SYSTEM_PROMPT = `You are SyncBot, a helpful assistant for SyncRoute - a carpooling/ride-sharing platform in India.

STRICT RULES:
1. ONLY answer questions about SyncRoute, carpooling, rides, bookings, and transportation
2. If asked about ANYTHING else (weather, news, politics, general knowledge, etc.), respond: "I can only help with SyncRoute ride-sharing questions. Ask me about finding rides, booking, safety features, or how the platform works."
3. Be concise - keep responses under 3 sentences unless explaining features
4. No emojis except in greetings

Your capabilities:
- Help users search for rides between locations
- Answer questions about how the platform works
- Provide information about booking, pricing, safety features
- Help with common issues

Key information about SyncRoute:
- Users can search rides by pickup/drop location and date
- Drivers are verified with government ID and vehicle documents using OCR
- Route matching ensures 60%+ overlap between driver and passenger routes
- Instant booking available - no waiting for driver approval
- All prices are per seat, no booking fees
- In-app chat with drivers
- Real-time ride tracking
- SOS emergency button
- Driver and passenger ratings

Safety Features:
- Government ID verification (driving license, vehicle registration)
- OCR-based document verification
- Driver background checks
- Real-time GPS tracking
- In-app emergency SOS button
- Share ride details with emergency contacts
- Driver and passenger ratings
- Route deviation alerts
- 24/7 support

When user wants to search for a ride, extract:
- Origin/pickup location
- Destination/drop location  
- Date (today, tomorrow, or specific)
- Number of passengers (default 1)

If you can extract ride search info, respond ONLY with valid JSON:
{
  "intent": "search_ride",
  "from": "location name",
  "to": "location name",
  "date": "YYYY-MM-DD or null",
  "passengers": 1
}

Otherwise, respond conversationally. Be concise, helpful, and professional.

Current date: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

/**
 * Main function to process messages with Gemini AI and conversation history
 */
async function processMessageWithAI(userMessage, context = {}) {
  const sessionId = context.sessionId || 'default';
  
  // Get or create conversation history for this session
  if (!conversationHistory.has(sessionId)) {
    conversationHistory.set(sessionId, {
      messages: [],
      lastUpdate: Date.now()
    });
  }
  
  const session = conversationHistory.get(sessionId);
  session.lastUpdate = Date.now();
  
  // Add user message to history
  session.messages.push({
    role: 'user',
    content: userMessage
  });
  
  // Keep only last 10 messages to avoid token limits
  if (session.messages.length > 10) {
    session.messages = session.messages.slice(-10);
  }
  
  // If Gemini is not available, fallback to pattern matching
  if (!model) {
    const response = await processMessageFallback(userMessage, context);
    session.messages.push({ role: 'assistant', content: response.message });
    return response;
  }

  try {
    // Build conversation context
    const conversationContext = session.messages
      .slice(-8) // Last 8 messages for context
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const prompt = `${SYSTEM_PROMPT}

Previous conversation:
${conversationContext}

Respond to the latest user message. If they're searching for rides, extract the details and return JSON. Otherwise respond helpfully.

Response:`;

    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();

    // Try to parse as JSON for ride search
    try {
      // Check if response looks like JSON
      if (response.startsWith('{') && response.includes('"intent"')) {
        const parsed = JSON.parse(response);
        if (parsed.intent === "search_ride") {
          const searchResult = await searchRidesWithParams(parsed);
          session.messages.push({ role: 'assistant', content: searchResult.message });
          return searchResult;
        }
      }
    } catch {
      // Not JSON, continue with text response
    }

    // Clean up response - remove markdown code blocks if present
    let cleanResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    session.messages.push({ role: 'assistant', content: cleanResponse });

    return {
      type: "message",
      message: cleanResponse,
      quickReplies: generateSmartReplies(cleanResponse, userMessage)
    };

  } catch (error) {
    console.error("[GeminiAI] Error:", error);
    const fallbackResponse = await processMessageFallback(userMessage, context);
    session.messages.push({ role: 'assistant', content: fallbackResponse.message });
    return fallbackResponse;
  }
}

/**
 * Search rides with extracted parameters
 */
async function searchRidesWithParams(params) {
  try {
    const fromLocation = params.from?.trim() || null;
    const toLocation = params.to?.trim() || null;

    const fromDisplay = fromLocation || "your origin";
    const toDisplay = toLocation || "your destination";

    // If we don't have both locations, ask for them
    if (!fromLocation || !toLocation) {
      const missingParts = [];
      if (!fromLocation) missingParts.push("pickup location");
      if (!toLocation) missingParts.push("destination");
      
      return {
        type: "need_info",
        message: `I need your ${missingParts.join(" and ")} to search for rides.\n\nExample: "Hyderabad to Gachibowli tomorrow"`,
        quickReplies: ["Hyderabad to Gachibowli", "Madhapur to Hi-Tech City"]
      };
    }

    const query = {
      status: "active",
      availableSeats: { $gte: params.passengers || 1 }
    };

    // Date filter
    if (params.date) {
      query.date = params.date;
    } else {
      const today = new Date().toISOString().split("T")[0];
      query.date = { $gte: today };
    }

    // Location fuzzy matching
    query.$and = [
      { "from.name": { $regex: fromLocation, $options: "i" } },
      { "to.name": { $regex: toLocation, $options: "i" } }
    ];

    const rides = await Ride.find(query)
      .populate("driver", "name photo reviewStats reliabilityScore trips")
      .sort({ date: 1, departureTime: 1 })
      .limit(10);

    if (rides.length === 0) {
      return {
        type: "no_results",
        message: `No rides found from ${fromDisplay} to ${toDisplay}${params.date ? ` on ${params.date}` : ''}.\n\nTry different dates or nearby locations.`,
        quickReplies: ["Try tomorrow", "Search all dates", "Offer a ride"]
      };
    }

    const formattedRides = rides.map(ride => ({
      _id: ride._id,
      from: ride.from,
      to: ride.to,
      date: ride.date,
      departureTime: ride.departureTime,
      price: ride.price || ride.pricePerSeat || 0,
      pricePerSeat: ride.pricePerSeat || ride.price || 0,
      availableSeats: ride.availableSeats || 0,
      driver: {
        _id: ride.driver?._id,
        name: ride.driver?.name || 'Driver',
        photo: ride.driver?.photo,
        rating: ride.driver?.reviewStats?.avgStars || ride.driver?.reliabilityScore?.avgRating || null,
        trips: ride.driver?.trips || 0
      },
      vehicleType: ride.vehicleType || 'Sedan'
    }));

    return {
      type: "ride_results",
      message: `Found ${rides.length} ride${rides.length > 1 ? 's' : ''} from ${fromDisplay} to ${toDisplay}${params.date ? ` on ${params.date}` : ''}:`,
      rides: formattedRides,
      quickReplies: ["See more", "Filter by price"]
    };

  } catch (error) {
    console.error("[Search] Error:", error);
    return {
      type: "error",
      message: "Sorry, I had trouble searching. Please try the main search page.",
      quickReplies: ["Try again", "Go to Search"]
    };
  }
}

/**
 * Fallback pattern matching when Gemini is unavailable
 */
function processMessageFallback(message, context) {
  const lowerMessage = message.toLowerCase();

  // Extract locations
  let fromLocation = null;
  let toLocation = null;

  const fromToMatch = message.match(/from\s+([a-zA-Z\s\-]+?)\s+to\s+([a-zA-Z\s\-]+?)(?:\s+(?:on|tomorrow|today|next|this)|$)/i);
  if (fromToMatch) {
    fromLocation = fromToMatch[1].trim();
    toLocation = fromToMatch[2].trim();
  } else {
    const simpleMatch = message.match(/([a-zA-Z\s\-]+?)\s+to\s+([a-zA-Z\s\-]+?)(?:\s+(?:on|tomorrow|today|next|this)|$)/i);
    if (simpleMatch) {
      const skipWords = ['find', 'search', 'rides', 'get', 'show', 'looking', 'want', 'need'];
      if (!skipWords.some(w => simpleMatch[1].toLowerCase().includes(w))) {
        fromLocation = simpleMatch[1].trim();
        toLocation = simpleMatch[2].trim();
      }
    }
  }

  // Extract date
  let date = null;
  if (lowerMessage.includes('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    date = tomorrow.toISOString().split('T')[0];
  } else if (lowerMessage.includes('today')) {
    date = new Date().toISOString().split('T')[0];
  }

  if (fromLocation || toLocation) {
    return searchRidesWithParams({ from: fromLocation, to: toLocation, date });
  }

  // Greeting
  if (/^(hi|hello|hey|hii+)\b/i.test(message.trim())) {
    return {
      type: "message",
      message: "Hello! I can help you find rides.\n\nTell me where you want to go, for example:\n\"Hyderabad to Gachibowli tomorrow\"",
      quickReplies: ["Search rides", "My bookings", "Help"]
    };
  }

  return {
    type: "message",
    message: "I can help you find rides. Tell me your pickup and drop locations.\n\nExample: \"Hyderabad to Gachibowli tomorrow\"",
    quickReplies: ["Search rides", "My bookings"]
  };
}

/**
 * Generate contextual quick replies
 */
function generateSmartReplies(botResponse, userMessage) {
  const response = botResponse.toLowerCase();
  
  if (response.includes('where') || response.includes('location') || response.includes('from')) {
    return ["Hyderabad", "Gachibowli", "Hi-Tech City"];
  }
  if (response.includes('when') || response.includes('date')) {
    return ["Today", "Tomorrow"];
  }
  if (response.includes('no rides') || response.includes('not found')) {
    return ["Try tomorrow", "Offer a ride"];
  }
  
  return ["Search rides", "Help"];
}

/**
 * Clear conversation history for a session
 */
function clearConversation(sessionId) {
  conversationHistory.delete(sessionId);
}

module.exports = {
  processMessageWithAI,
  searchRidesWithParams,
  clearConversation
};
