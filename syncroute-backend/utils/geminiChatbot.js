/**
 * Gemini AI-powered Chatbot for SyncRoute
 * Replaces hardcoded pattern matching with real AI
 */

const Ride = require("../models/Ride");
const User = require("../models/User");

// You'll need to: npm install @google/generative-ai
// Then set GEMINI_API_KEY in your .env file
let genAI, model;

try {
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("[GeminiAI] Initialized successfully");
  } else {
    console.warn("[GeminiAI] No API key found - chatbot will use fallback mode");
  }
} catch (error) {
  console.warn("[GeminiAI] Package not installed - run: npm install @google/generative-ai");
}

/**
 * Main function to process messages with Gemini AI
 */
async function processMessageWithAI(userMessage, context = {}) {
  // If Gemini is not available, fallback to pattern matching
  if (!model) {
    return processMessageFallback(userMessage, context);
  }

  try {
    // Build context for Gemini
    const systemPrompt = `You are SyncBot, a helpful ride-sharing assistant for SyncRoute, a carpooling platform in India.

Your role:
- Help users search for rides between locations
- Extract trip details: origin, destination, date, time, preferences
- Be concise, friendly, and emoji-light
- Use proper formatting (bold with ** for emphasis)
- Focus on getting: from location, to location, date/time

Current date: ${new Date().toLocaleDateString('en-IN')}

When user wants to search:
1. Extract origin and destination (cities/areas in India)
2. Extract date (today, tomorrow, specific date)
3. Extract time preference (morning, afternoon, evening, or specific time)
4. Return in format:
   {
     "intent": "search_ride",
     "from": "location name",
     "to": "location name", 
     "date": "YYYY-MM-DD",
     "timeRange": "morning/afternoon/evening",
     "passengers": number
   }

Be helpful and conversational. Don't be overly formal.`;

    const prompt = `${systemPrompt}\n\nUser: ${userMessage}\n\nRespond with either:
1. A JSON object if you can extract search parameters
2. A conversational response if you need more info

Response:`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Try to parse as JSON for ride search
    try {
      const parsed = JSON.parse(response);
      if (parsed.intent === "search_ride") {
        return await searchRidesWithParams(parsed);
      }
    } catch {
      // Not JSON, it's a conversational response
      return {
        type: "message",
        message: response,
        quickReplies: generateSmartReplies(response, userMessage)
      };
    }

    return {
      type: "message",
      message: response,
      quickReplies: []
    };

  } catch (error) {
    console.error("[GeminiAI] Error:", error);
    return processMessageFallback(userMessage, context);
  }
}

/**
 * Search rides with extracted parameters
 */
async function searchRidesWithParams(params) {
  try {
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
    const locationConditions = [];
    if (params.from) {
      locationConditions.push({ "from.name": { $regex: params.from, $options: "i" } });
    }
    if (params.to) {
      locationConditions.push({ "to.name": { $regex: params.to, $options: "i" } });
    }

    if (locationConditions.length > 0) {
      query.$and = locationConditions;
    }

    const rides = await Ride.find(query)
      .populate("driver", "name photo reviewStats reliabilityScore trips")
      .sort({ date: 1, departureTime: 1 })
      .limit(10);

    if (rides.length === 0) {
      return {
        type: "no_results",
        message: `No rides found from **${params.from}** to **${params.to}** ${params.date ? `on **${params.date}**` : ''}.

Try:
• Adjusting your dates
• Checking nearby locations
• Creating your own ride`,
        quickReplies: ["Try tomorrow", "Search nearby", "Offer this ride"]
      };
    }

    // Format rides for display
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
      message: `Found **${rides.length}** ride${rides.length > 1 ? 's' : ''} from **${params.from}** to **${params.to}**`,
      rides: formattedRides,
      quickReplies: ["Show more details", "Filter by price", "Book now"]
    };

  } catch (error) {
    console.error("[Search] Error:", error);
    return {
      type: "error",
      message: "Sorry, I had trouble searching. Please try again or use the main search page.",
      quickReplies: ["Try again", "Go to Search"]
    };
  }
}

/**
 * Fallback pattern matching when Gemini is unavailable
 */
function processMessageFallback(message, context) {
  const lowerMessage = message.toLowerCase();

  // Simple pattern matching for ride search
  const fromMatch = message.match(/from\s+([a-zA-Z\s]+?)(?:\s+to|\s+$)/i);
  const toMatch = message.match(/to\s+([a-zA-Z\s]+?)(?:\s+on|\s+tomorrow|\s+today|\s+$)/i);

  if (fromMatch || toMatch) {
    const params = {
      from: fromMatch ? fromMatch[1].trim() : null,
      to: toMatch ? toMatch[1].trim() : null,
      date: null
    };

    if (lowerMessage.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      params.date = tomorrow.toISOString().split('T')[0];
    } else if (lowerMessage.includes('today')) {
      params.date = new Date().toISOString().split('T')[0];
    }

    if (params.from || params.to) {
      return searchRidesWithParams(params);
    }
  }

  // Default response
  return {
    type: "message",
    message: "I can help you find rides! Tell me:\n• Where are you traveling from and to?\n• When do you want to travel?\n\nExample: \"Find rides from Hyderabad to Gachibowli tomorrow\"",
    quickReplies: ["Search rides", "My bookings", "Help"]
  };
}

/**
 * Generate smart quick replies based on conversation
 */
function generateSmartReplies(botResponse, userMessage) {
  const responses = botResponse.toLowerCase();
  const replies = [];

  if (responses.includes('from') || responses.includes('where')) {
    replies.push("Hyderabad", "Gachibowli", "Hi-Tech City");
  } else if (responses.includes('when') || responses.includes('date')) {
    replies.push("Today", "Tomorrow", "This weekend");
  } else {
    replies.push("Search rides", "My bookings");
  }

  return replies.slice(0, 3);
}

module.exports = {
  processMessageWithAI,
  searchRidesWithParams
};
