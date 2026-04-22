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
5. IMPORTANT: Analyze each question carefully and provide SPECIFIC answers based on the question type

Your capabilities:
- Help users search for rides between locations
- Answer questions about how the platform works
- Provide information about booking, pricing, safety features
- Help with common issues

Key information about SyncRoute:

HOW IT WORKS:
- Route-matched carpooling: We match riders with drivers who share 60%+ of the actual road route
- Not just nearby - we use OSRM road routing for accurate matching
- Three simple steps: Enter route → Pick driver → Book and go
- Instant booking - no waiting for driver approval
- In-app chat with drivers for coordination

SAFETY FEATURES (VERY IMPORTANT):
- Government ID verification: All drivers upload driving license and vehicle registration
- OCR-based document verification: Automated text extraction and validation
- 8-layer verification system: OCR, format validation, state/RTO code check, age verification (18+), name matching, data consistency, tampering detection, input field verification
- Real-time GPS tracking during rides
- SOS emergency button: One-tap emergency alert to contacts and authorities
- Share ride details with emergency contacts
- Driver and passenger ratings system
- Route deviation alerts
- Background checks for all drivers
- 24/7 support team

BOOKING & PRICING:
- Pay only for the distance you actually travel (proportional pricing)
- No booking fees ever
- Prices shown are per seat
- Instant seat confirmation
- Cancel anytime before ride starts

FEATURES:
- In-app chat with drivers
- Real-time ride tracking
- Route-first matching (60%+ overlap required)
- Verified drivers only
- Lower emissions by sharing rides
- Accurate pickup & drop on map

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

QUESTION TYPES TO HANDLE:
1. "How does SyncRoute work?" → Explain the 3-step process and route-matching
2. "What safety features?" → List ID verification, GPS tracking, SOS button, ratings
3. "How to book?" → Explain search → select → instant booking process
4. "Pricing/cost?" → Explain proportional pricing, no booking fees
5. "Cancel ride?" → Explain cancellation policy
6. "Driver verification?" → Explain 8-layer OCR verification system
7. "Emergency/SOS?" → Explain SOS button and emergency contact features

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

  // Handle common questions first
  if (lowerMessage.includes('how') && (lowerMessage.includes('work') || lowerMessage.includes('syncroute'))) {
    return {
      type: "message",
      message: "SyncRoute works in 3 simple steps:\n\n1. Enter your route (pickup and drop location)\n2. Pick a verified driver with 60%+ route overlap\n3. Book instantly and chat with your driver\n\nWe match you with drivers sharing your actual road route, not just nearby locations.",
      quickReplies: ["Safety features", "Search rides", "Pricing"]
    };
  }

  if (lowerMessage.includes('safety') || lowerMessage.includes('secure') || lowerMessage.includes('safe')) {
    return {
      type: "message",
      message: "SyncRoute safety features:\n\n✓ Government ID verification (DL + RC)\n✓ 8-layer OCR document verification\n✓ Real-time GPS tracking\n✓ SOS emergency button\n✓ Share ride details with emergency contacts\n✓ Driver & passenger ratings\n✓ 24/7 support",
      quickReplies: ["How it works", "Search rides"]
    };
  }

  if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('pay') || lowerMessage.includes('fee')) {
    return {
      type: "message",
      message: "SyncRoute pricing:\n\n• Pay only for the distance YOU travel (proportional pricing)\n• No booking fees - ever\n• Prices shown are per seat\n• Instant confirmation - no waiting",
      quickReplies: ["Search rides", "How it works"]
    };
  }

  if (lowerMessage.includes('book') && !lowerMessage.includes('to')) {
    return {
      type: "message",
      message: "Booking is simple:\n\n1. Search for rides by entering your route\n2. Select a driver that matches your route\n3. Choose number of seats\n4. Instant confirmation - no approval wait\n5. Chat with driver to coordinate pickup",
      quickReplies: ["Search rides", "Safety features"]
    };
  }

  if (lowerMessage.includes('cancel')) {
    return {
      type: "message",
      message: "You can cancel your booking anytime before the ride starts. Just go to your bookings and tap cancel. No cancellation fees for early cancellations.",
      quickReplies: ["My bookings", "Search rides"]
    };
  }

  if (lowerMessage.includes('driver') && lowerMessage.includes('verif')) {
    return {
      type: "message",
      message: "All drivers go through 8-layer verification:\n\n✓ OCR text extraction from documents\n✓ DL/RC format validation\n✓ State & RTO code verification\n✓ Age verification (18+)\n✓ Name matching\n✓ Data consistency checks\n✓ Tampering detection\n✓ Input field verification",
      quickReplies: ["Safety features", "Search rides"]
    };
  }

  if (lowerMessage.includes('sos') || lowerMessage.includes('emergency')) {
    return {
      type: "message",
      message: "SyncRoute emergency features:\n\n• One-tap SOS button during rides\n• Instant alert to your emergency contacts\n• Real-time location sharing\n• 24/7 support team\n• Route deviation alerts",
      quickReplies: ["Safety features", "How it works"]
    };
  }

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
      message: "Hello! I'm SyncBot, your SyncRoute assistant. I can help you:\n\n• Find rides\n• Learn about safety features\n• Understand how booking works\n• Answer questions about pricing\n\nWhat would you like to know?",
      quickReplies: ["Search rides", "Safety features", "How it works"]
    };
  }

  return {
    type: "message",
    message: "I can help you with:\n\n• Finding rides (e.g., 'Hyderabad to Gachibowli tomorrow')\n• Safety features\n• How SyncRoute works\n• Booking and pricing\n\nWhat would you like to know?",
    quickReplies: ["Search rides", "Safety features", "How it works"]
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
