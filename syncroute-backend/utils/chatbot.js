/**
 * Smart Chatbot Assistant - Backend
 * 
 * Provides:
 * - Natural language understanding for ride searches
 * - Advanced date parsing (today, tomorrow, next Monday, April 13, etc.)
 * - Intent detection for all platform actions
 * - Ride creation flow with guided conversation
 * - Context-aware conversations
 * - FAQ knowledge base
 * - Integration with ride search API
 * - Personalized ride recommendations
 */

const Ride = require("../models/Ride");
const { predictNextRide } = require("./routePrediction");
const { scoreAndRankRides } = require("./personalizedScorer");
const { trackSearch } = require("./behaviorTracker");

// ============================================================================
// CONVERSATION CONTEXT & STATE MANAGEMENT
// ============================================================================

// In-memory session storage (in production, use Redis or database)
const conversationSessions = new Map();

/**
 * Get or create a conversation session
 */
function getSession(sessionId) {
  if (!conversationSessions.has(sessionId)) {
    conversationSessions.set(sessionId, {
      context: {},
      lastSearchParams: null,
      rideCreationState: null,
      conversationHistory: [],
      lastIntent: null,
      createdAt: new Date()
    });
  }
  return conversationSessions.get(sessionId);
}

/**
 * Update session context
 */
function updateSession(sessionId, updates) {
  const session = getSession(sessionId);
  Object.assign(session, updates);
  conversationSessions.set(sessionId, session);
  return session;
}

// Clean up old sessions periodically (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [sessionId, session] of conversationSessions.entries()) {
    if (new Date(session.createdAt).getTime() < oneHourAgo) {
      conversationSessions.delete(sessionId);
    }
  }
}, 15 * 60 * 1000); // Every 15 minutes

// FAQ Knowledge Base
const FAQ_KNOWLEDGE = {
  // Booking related
  "how to book": {
    keywords: ["book", "booking", "reserve", "seat", "join"],
    response: "To book a ride:\n1. Search for rides using pickup & destination\n2. Select a ride that matches your needs\n3. Click 'Book Seat' or 'Request to Join'\n4. Wait for driver confirmation\n5. You'll receive a notification when confirmed!\n\nTip: Use the search filters to find rides that match your preferences."
  },
  "how to create ride": {
    keywords: ["create", "post", "offer", "publish", "driver"],
    response: "To create/offer a ride:\n1. Click 'Post Ride' or the + button\n2. Enter pickup location, destination, and route\n3. Set date, time, and available seats\n4. Set your price (we'll suggest a range)\n5. Add preferences (music, conversation, etc.)\n6. Publish your ride!\n\nYour ride will be visible to passengers searching for similar routes."
  },
  "how to cancel": {
    keywords: ["cancel", "cancellation", "refund"],
    response: "To cancel a booking:\n1. Go to 'My Rides' or 'Upcoming Rides'\n2. Find the ride you want to cancel\n3. Click 'Cancel Booking'\n4. Confirm the cancellation\n\n⚠️ Note: Frequent cancellations may affect your reputation score. Please cancel only when necessary."
  },
  
  // Features
  "waitlist": {
    keywords: ["waitlist", "wait list", "queue", "full"],
    response: "The Waitlist feature helps when a ride is full:\n\n• When all seats are booked, you can 'Join Waitlist'\n• If someone cancels, you'll be automatically offered the seat\n• You get priority based on when you joined\n• You'll receive instant notification when a seat opens\n\nGreat for popular routes!"
  },
  "driver verification": {
    keywords: ["verification", "verify", "verified", "trust", "safe"],
    response: "Driver Verification ensures safety:\n\n✅ Verified Badge means:\n• Valid driving license checked\n• Vehicle registration verified\n• Insurance documents confirmed\n• Identity verified\n\nTo get verified:\n1. Go to Profile > Driver Verification\n2. Upload required documents\n3. Wait for review (24-48 hours)\n4. Get your verified badge!"
  },
  "gender preference": {
    keywords: ["gender", "female only", "women", "ladies"],
    response: "Gender Preference rides offer comfort:\n\n👩 Women-Only Rides:\n• Female drivers can offer women-only rides\n• Only female passengers can book\n• Creates a comfortable environment\n\nTo find: Use the 'Gender Preference' filter in search.\nTo offer: Enable 'Women Only' when creating a ride."
  },
  "co-driving": {
    keywords: ["co-drive", "codriving", "share driving", "alternate"],
    response: "Co-Driving lets passengers share driving:\n\n🚗 How it works:\n• Driver can enable 'Co-Driving' option\n• Verified passengers can offer to drive part of the journey\n• Great for long trips\n• Often comes with reduced fare\n\nRequirements:\n• Must be a verified driver\n• Insurance must cover shared driving"
  },
  
  // Safety
  "safety": {
    keywords: ["safety", "secure", "emergency", "sos", "help"],
    response: "SyncRoute Safety Features:\n\n🆘 SOS Button:\n• One-tap emergency alert\n• Notifies emergency contacts\n• Shares live location\n• Available during active rides\n\n📍 Live Tracking:\n• Share ride with family/friends\n• Real-time location updates\n• Route deviation alerts\n\n✅ Verified Users:\n• Driver verification system\n• Ratings and reviews\n• Profile verification"
  },
  "sos": {
    keywords: ["sos", "emergency", "panic", "danger"],
    response: "🆘 SOS Emergency Button:\n\n1. During an active ride, tap the SOS button\n2. Your emergency contacts are immediately notified\n3. Your live location is shared\n4. You can also call emergency services\n\nTo set up:\n• Go to Profile > Emergency Contacts\n• Add up to 3 trusted contacts\n• They'll receive alerts if you trigger SOS"
  },
  
  // Notifications
  "notifications": {
    keywords: ["notification", "alert", "notify", "updates"],
    response: "Notification Types:\n\n📬 You'll receive notifications for:\n• Booking confirmations\n• Ride reminders\n• Driver messages\n• Seat availability (waitlist)\n• Ride recommendations\n• Safety alerts\n\nManage in: Profile > Notification Settings"
  },
  
  // Pricing
  "pricing": {
    keywords: ["price", "pricing", "cost", "fare", "charge", "fee"],
    response: "How Pricing Works:\n\n💰 Price is set by drivers but we suggest:\n• Base rate per km\n• Fuel cost estimation\n• Peak hour adjustment\n• Demand factor\n\n📊 Suggested Price Range:\n• We show min-max range\n• Based on distance & demand\n• Helps fair pricing\n\nTip: Look for 'Price Range' label on rides!"
  },
  
  // General
  "how it works": {
    keywords: ["work", "works", "use", "about", "what is"],
    response: "SyncRoute - Carpooling Made Easy! 🚗\n\n📱 For Passengers:\n1. Search rides by location & date\n2. Choose a matching ride\n3. Book and chat with driver\n4. Track your ride\n5. Rate after completion\n\n🚗 For Drivers:\n1. Post your ride with route\n2. Accept booking requests\n3. Pick up passengers\n4. Share the journey & costs\n\n🌱 Benefits:\n• Save money\n• Reduce traffic\n• Lower carbon footprint"
  },
  "contact support": {
    keywords: ["support", "contact", "help", "issue", "problem"],
    response: "Need Help?\n\n📧 Email: support@syncroute.com\n\n💬 In-App:\n• Go to Profile > Help & Support\n• Use the chat feature\n• Report specific ride issues from ride details\n\n⏰ Response time: Usually within 24 hours\n\nFor urgent issues, use the SOS feature during rides."
  }
};

// ============================================================================
// ENHANCED DATE PARSING
// ============================================================================

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 
                     'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_ABBREVS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Parse natural language date expressions into YYYY-MM-DD format
 * Supports: today, tomorrow, day after tomorrow, next Monday, April 13, 13-04-2026, etc.
 */
function parseNaturalDate(message) {
  const lowerMessage = message.toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 1. Today / Tonight
  if (/\b(today|tonight)\b/i.test(lowerMessage)) {
    return { date: formatDate(today), readable: "today" };
  }
  
  // 2. Tomorrow
  if (/\btomorrow\b/i.test(lowerMessage)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return { date: formatDate(tomorrow), readable: "tomorrow" };
  }
  
  // 3. Day after tomorrow
  if (/\bday\s+after\s+tomorrow\b/i.test(lowerMessage)) {
    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);
    return { date: formatDate(dayAfter), readable: "day after tomorrow" };
  }
  
  // 4. This weekend (Saturday)
  if (/\bthis\s+weekend\b/i.test(lowerMessage)) {
    const saturday = getNextDayOfWeek(today, 6); // 6 = Saturday
    return { date: formatDate(saturday), readable: "this weekend" };
  }
  
  // 5. Next week (7 days from now)
  if (/\bnext\s+week\b/i.test(lowerMessage)) {
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    return { date: formatDate(nextWeek), readable: "next week" };
  }
  
  // 6. Next [weekday] - e.g., "next Monday", "next Friday"
  const nextDayMatch = lowerMessage.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (nextDayMatch) {
    const targetDay = DAY_NAMES.indexOf(nextDayMatch[1].toLowerCase());
    const nextDate = getNextDayOfWeek(today, targetDay, true); // true = force next week
    return { date: formatDate(nextDate), readable: `next ${nextDayMatch[1]}` };
  }
  
  // 7. This [weekday] - e.g., "this Monday", "this Friday"
  const thisDayMatch = lowerMessage.match(/\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (thisDayMatch) {
    const targetDay = DAY_NAMES.indexOf(thisDayMatch[1].toLowerCase());
    const thisDate = getNextDayOfWeek(today, targetDay, false);
    return { date: formatDate(thisDate), readable: `this ${thisDayMatch[1]}` };
  }
  
  // 8. Just weekday name - e.g., "Monday", "on Friday"
  const dayOnlyMatch = lowerMessage.match(/\b(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (dayOnlyMatch) {
    const targetDay = DAY_NAMES.indexOf(dayOnlyMatch[1].toLowerCase());
    const targetDate = getNextDayOfWeek(today, targetDay, false);
    return { date: formatDate(targetDate), readable: dayOnlyMatch[1] };
  }
  
  // 9. Date patterns: "13 April", "April 13", "13th April", "April 13th"
  const dateWithMonthPatterns = [
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)\b/i, // 13 April, 13th of April
    /\b([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i, // April 13, April 13th
  ];
  
  for (const pattern of dateWithMonthPatterns) {
    const match = lowerMessage.match(pattern);
    if (match) {
      let day, monthStr;
      if (isNaN(parseInt(match[1]))) {
        monthStr = match[1].toLowerCase();
        day = parseInt(match[2]);
      } else {
        day = parseInt(match[1]);
        monthStr = match[2].toLowerCase();
      }
      
      let monthIndex = MONTH_NAMES.findIndex(m => monthStr.startsWith(m.substring(0, 3)));
      if (monthIndex === -1) {
        monthIndex = MONTH_ABBREVS.findIndex(m => monthStr.startsWith(m));
      }
      
      if (monthIndex !== -1 && day >= 1 && day <= 31) {
        let year = today.getFullYear();
        const targetDate = new Date(year, monthIndex, day);
        
        // If date is in the past, use next year
        if (targetDate < today) {
          targetDate.setFullYear(year + 1);
        }
        
        return { date: formatDate(targetDate), readable: `${day} ${MONTH_NAMES[monthIndex]}` };
      }
    }
  }
  
  // 10. Numeric date patterns: "13-04-2026", "13/04/2026", "2026-04-13"
  const numericPatterns = [
    /\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\b/, // DD-MM-YYYY or DD/MM/YYYY
    /\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/, // YYYY-MM-DD
  ];
  
  for (const pattern of numericPatterns) {
    const match = lowerMessage.match(pattern);
    if (match) {
      let year, month, day;
      if (match[1].length === 4) {
        // YYYY-MM-DD format
        year = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        day = parseInt(match[3]);
      } else {
        // DD-MM-YYYY format (common in India)
        day = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        year = parseInt(match[3]);
      }
      
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const targetDate = new Date(year, month, day);
        return { date: formatDate(targetDate), readable: `${day}/${month + 1}/${year}` };
      }
    }
  }
  
  // 11. "on the 13th", "on 5th"
  const dayOnlyNumber = lowerMessage.match(/\bon\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (dayOnlyNumber) {
    const day = parseInt(dayOnlyNumber[1]);
    if (day >= 1 && day <= 31) {
      let targetDate = new Date(today.getFullYear(), today.getMonth(), day);
      if (targetDate < today) {
        targetDate.setMonth(targetDate.getMonth() + 1);
      }
      return { date: formatDate(targetDate), readable: `the ${day}${getOrdinalSuffix(day)}` };
    }
  }
  
  // 12. "in X days"
  const inDaysMatch = lowerMessage.match(/\bin\s+(\d+)\s+days?\b/i);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1]);
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + days);
    return { date: formatDate(targetDate), readable: `in ${days} day${days > 1 ? 's' : ''}` };
  }
  
  return null;
}

/**
 * Get the next occurrence of a day of the week
 */
function getNextDayOfWeek(fromDate, targetDay, forceNextWeek = false) {
  const result = new Date(fromDate);
  const currentDay = result.getDay();
  let daysToAdd = targetDay - currentDay;
  
  if (daysToAdd < 0 || (daysToAdd === 0 && forceNextWeek)) {
    daysToAdd += 7;
  }
  if (forceNextWeek && daysToAdd < 7) {
    daysToAdd += 7;
  }
  
  result.setDate(result.getDate() + daysToAdd);
  return result;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get ordinal suffix (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

// ============================================================================
// ENHANCED INTENT DETECTION
// ============================================================================

// Intent detection patterns - ORDER MATTERS! More specific patterns first
const INTENT_PATTERNS = {
  // CREATE_RIDE must come BEFORE SEARCH_RIDE to catch "create ride from X to Y"
  CREATE_RIDE: {
    patterns: [
      /(?:create|post|offer|publish|add)\s+(?:a\s+)?ride\s+(?:from|to)/i,  // "create ride from X" or "create a ride to Y"
      /(?:create|post|offer|publish|add)\s+(?:a\s+)?ride/i,
      /(?:i\s+)?want\s+to\s+(?:create|offer|post|give)\s+(?:a\s+)?ride/i,
      /(?:i'm|i\s+am)\s+(?:driving|going)\s+(?:from|to)/i,
      /offer\s+(?:a\s+)?(?:seat|lift|ride)/i,
      /give\s+(?:a\s+)?(?:ride|lift)/i,
      /(?:i\s+)?(?:want|need)\s+to\s+offer/i
    ]
  },
  
  SEARCH_RIDE: {
    patterns: [
      /(?:find|search|show|get|any|looking for|need|book)\s+(?:a\s+)?rides?/i,
      /rides?\s+(?:from|to|between)/i,
      /(?:from|going to)\s+\w+\s+to\s+\w+/i,
      /(?:tomorrow|today|tonight|this\s+(?:morning|evening|afternoon))/i
    ],
    extract: extractSearchParameters
  },
  
  // Navigation intents
  NAVIGATE: {
    patterns: [
      /(?:go|take|navigate|open|show)\s+(?:me\s+)?(?:to\s+)?(?:the\s+)?(?:search|offer|profile|dashboard|safety|settings|bookings?|my\s+rides?)/i,
      /(?:open|show)\s+(?:the\s+)?(?:search|offer|profile|dashboard)/i
    ]
  },
  
  // View bookings/rides intent
  VIEW_BOOKINGS: {
    patterns: [
      /(?:show|view|see|check)\s+(?:my\s+)?(?:bookings?|upcoming\s+rides?|my\s+rides?|booked\s+rides?)/i,
      /what\s+(?:rides?|bookings?)\s+do\s+i\s+have/i
    ]
  },
  
  // Safety features intent
  SAFETY: {
    patterns: [
      /(?:safety|emergency|sos|panic|help\s+me|danger)/i,
      /(?:show|explain|tell\s+(?:me\s+)?about)\s+(?:the\s+)?safety/i
    ]
  },
  
  FAQ: {
    patterns: [
      /(?:how\s+(?:do\s+I|to|does|can))/i,
      /(?:what\s+is|what's|whats)/i,
      /(?:tell\s+me\s+about|explain)/i,
      /(?:help\s+with|guide)/i
    ],
    handler: handleFAQ
  },
  GREETING: {
    patterns: [/^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening))/i],
    response: "Hello! 👋 I'm your SyncRoute assistant. I can help you:\n\n🔍 Search for rides (try: \"Find rides to Gachibowli tomorrow\")\n➕ Create rides (try: \"I want to offer a ride\")\n❓ Answer questions about the platform\n📚 Guide you through features\n\nHow can I help you today?"
  },
  THANKS: {
    patterns: [/(?:thank|thanks|thx|ty)/i],
    response: "You're welcome! 😊 Is there anything else I can help you with?"
  },
  REFINE_SEARCH: {
    patterns: [
      /(?:cheaper|lower\s+price|less\s+expensive)/i,
      /(?:earlier|later|different\s+time)/i,
      /(?:female|male)\s+driver/i,
      /with\s+(?:music|ac|air\s+conditioning)/i,
      /(?:only|just)\s+(?:morning|evening|afternoon|night)/i,
      /(?:filter|narrow|refine)/i
    ],
    handler: handleSearchRefinement
  }
};

// Location aliases
const LOCATION_ALIASES = {
  "hyd": "Hyderabad",
  "sec": "Secunderabad",
  "gachi": "Gachibowli",
  "hitech": "Hi-Tech City",
  "hitec": "Hi-Tech City",
  "madhapur": "Madhapur",
  "kukatpally": "Kukatpally",
  "kkp": "Kukatpally",
  "jntu": "JNTU",
  "miyapur": "Miyapur",
  "ameerpet": "Ameerpet",
  "sr nagar": "SR Nagar",
  "dilsukhnagar": "Dilsukhnagar",
  "lb nagar": "LB Nagar",
  "mehdipatnam": "Mehdipatnam",
  "tolichowki": "Tolichowki",
  "airport": "Rajiv Gandhi Airport",
  "rgia": "Rajiv Gandhi Airport",
  "shamshabad": "Shamshabad",
  "campus": "University Campus",
  "office": "Office Area",
  "station": "Railway Station"
};

// Time aliases
const TIME_ALIASES = {
  "morning": { start: 6, end: 11, label: "morning (6 AM - 11 AM)" },
  "afternoon": { start: 12, end: 16, label: "afternoon (12 PM - 4 PM)" },
  "evening": { start: 17, end: 20, label: "evening (5 PM - 8 PM)" },
  "night": { start: 21, end: 23, label: "night (9 PM - 11 PM)" },
  "early morning": { start: 5, end: 8, label: "early morning (5 AM - 8 AM)" },
  "late night": { start: 22, end: 23, label: "late night (10 PM - 11 PM)" }
};

// ============================================================================
// RIDE CREATION FLOW STATE
// ============================================================================

const RIDE_CREATION_FIELDS = [
  { key: 'pickup', prompt: '📍 Where will you be starting from? (pickup location)', required: true },
  { key: 'destination', prompt: '📍 Where are you heading to? (destination)', required: true },
  { key: 'date', prompt: '📅 When do you want to schedule the ride? (e.g., tomorrow, April 15)', required: true },
  { key: 'time', prompt: '🕐 What time will you depart? (e.g., 9 AM, 14:30)', required: true },
  { key: 'seats', prompt: '💺 How many seats are available for passengers?', required: true },
  { key: 'price', prompt: '💰 What price per seat? (in ₹)', required: true },
  { key: 'vehicleType', prompt: '🚗 What type of vehicle? (Sedan, SUV, Hatchback, Bike)', required: false },
  { key: 'instantBooking', prompt: '⚡ Allow instant booking? (yes = passengers book directly, no = you approve each request)', required: true },
  { key: 'preferences', prompt: '🎵 Any preferences? (music allowed, AC available, women-only, skip for none)', required: false }
];

/**
 * Handle ride creation conversation flow
 */
function handleRideCreation(message, session) {
  const state = session.rideCreationState || { step: 0, data: {} };
  const lowerMessage = message.toLowerCase().trim();
  
  // Check for cancellation
  if (/\b(cancel|stop|quit|exit|never\s*mind)\b/i.test(lowerMessage)) {
    session.rideCreationState = null;
    return {
      type: "text",
      message: "No problem! Ride creation cancelled. How else can I help you?",
      quickReplies: ["Search Ride", "Help"],
      sessionUpdate: { rideCreationState: null }
    };
  }
  
  // Process previous field answer (if we're past step 0)
  if (state.step > 0 && state.currentFieldKey) {
    const value = extractFieldValue(state.currentFieldKey, message);
    if (value !== null && value !== undefined && value !== '') {
      state.data[state.currentFieldKey] = value;
    }
  }
  
  // Find next unanswered required field
  let nextField = null;
  let nextFieldIndex = state.step;
  
  for (let i = state.step; i < RIDE_CREATION_FIELDS.length; i++) {
    const field = RIDE_CREATION_FIELDS[i];
    // Skip if already has data, unless it's the current step
    if (state.data[field.key] && i !== state.step) {
      continue;
    }
    // Check if this field needs to be asked
    if (!state.data[field.key] || i === state.step) {
      // For optional fields, check if user said "skip"
      if (!field.required && /\b(skip|none|no|nothing)\b/i.test(lowerMessage) && state.currentFieldKey === field.key) {
        state.data[field.key] = ''; // Mark as skipped
        continue;
      }
      if (!state.data[field.key]) {
        nextField = field;
        nextFieldIndex = i;
        break;
      }
    }
  }
  
  // Check if all fields are collected
  if (!nextField) {
    // All fields collected - generate redirect URL
    const redirectUrl = generateOfferRideUrl(state.data);
    session.rideCreationState = null;
    
    const instantText = state.data.instantBooking ? 'Yes (instant booking)' : 'No (approval required)';
    
    return {
      type: "ride_creation_complete",
      message: `✅ Great! I've collected all the details:\n\n📍 **From:** ${state.data.pickup || 'Not specified'}\n📍 **To:** ${state.data.destination || 'Not specified'}\n📅 **Date:** ${state.data.date || 'Not specified'}\n🕐 **Time:** ${state.data.time || 'Not specified'}\n💺 **Seats:** ${state.data.seats || 'Not specified'}\n💰 **Price:** ₹${state.data.price || 'Not specified'}\n🚗 **Vehicle:** ${state.data.vehicleType || 'Sedan'}\n⚡ **Instant Booking:** ${instantText}\n\nClick below to review and publish your ride!`,
      redirectUrl: redirectUrl,
      rideData: state.data,
      quickActions: [
        { type: 'navigate', text: '🚗 Review & Create Ride', action: 'navigate', url: redirectUrl }
      ],
      sessionUpdate: { rideCreationState: null }
    };
  }
  
  // Update state for next question
  state.step = nextFieldIndex + 1;
  state.currentFieldKey = nextField.key;
  session.rideCreationState = state;
  
  return {
    type: "ride_creation_prompt",
    message: nextField.prompt,
    currentField: nextField.key,
    collectedData: state.data,
    quickReplies: getFieldSuggestions(nextField.key),
    sessionUpdate: { rideCreationState: state }
  };
}

/**
 * Extract field value from user message
 */
function extractFieldValue(field, message) {
  const lowerMessage = message.toLowerCase().trim();
  
  switch (field) {
    case 'pickup':
    case 'destination':
      return normalizeLocation(message.trim());
    
    case 'date':
      const parsedDate = parseNaturalDate(message);
      return parsedDate ? parsedDate.date : message.trim();
    
    case 'time':
      // Parse time expressions
      const timeMatch = message.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        const minutes = timeMatch[2] || '00';
        const ampm = timeMatch[3]?.toLowerCase();
        
        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        
        return `${String(hour).padStart(2, '0')}:${minutes}`;
      }
      // Check for time aliases
      for (const [alias, config] of Object.entries(TIME_ALIASES)) {
        if (lowerMessage.includes(alias)) {
          return `${String(config.start).padStart(2, '0')}:00`;
        }
      }
      return message.trim();
    
    case 'seats':
      const seatsMatch = message.match(/(\d+)/);
      return seatsMatch ? parseInt(seatsMatch[1]) : 1;
    
    case 'price':
      const priceMatch = message.match(/(\d+)/);
      return priceMatch ? parseInt(priceMatch[1]) : 100;
    
    case 'vehicleType':
      if (/sedan/i.test(lowerMessage)) return 'Sedan';
      if (/suv/i.test(lowerMessage)) return 'SUV';
      if (/hatchback/i.test(lowerMessage)) return 'Hatchback';
      if (/bike|motorcycle/i.test(lowerMessage)) return 'Bike';
      if (/compact/i.test(lowerMessage)) return 'Compact';
      if (/van/i.test(lowerMessage)) return 'Van';
      return message.trim() || 'Sedan';
    
    case 'instantBooking':
      // Parse yes/no for instant booking
      if (/\b(yes|yeah|yep|sure|ok|okay|instant|direct|y)\b/i.test(lowerMessage)) return true;
      if (/\b(no|nope|nah|approval|approve|manual|n)\b/i.test(lowerMessage)) return false;
      // Default to yes if unclear
      return true;
    
    case 'preferences':
      if (/\b(skip|none|no|nothing)\b/i.test(lowerMessage)) return '';
      return message.trim();
    
    default:
      return message.trim();
  }
}

/**
 * Get contextual suggestions for a field
 */
function getFieldSuggestions(field) {
  const suggestions = {
    pickup: ["Hyderabad", "Hi-Tech City", "Gachibowli"],
    destination: ["Secunderabad", "Airport", "Ameerpet"],
    date: ["Tomorrow", "Day after tomorrow", "This weekend"],
    time: ["9 AM", "6 PM", "Morning"],
    seats: ["1", "2", "3", "4"],
    price: ["50", "100", "150"],
    vehicleType: ["Sedan", "SUV", "Hatchback"],
    instantBooking: ["Yes (instant)", "No (approval required)"],
    preferences: ["Music allowed", "AC available", "Women only", "Skip"]
  };
  return suggestions[field] || [];
}

/**
 * Generate offer ride URL with prefilled data
 */
function generateOfferRideUrl(data) {
  const params = new URLSearchParams();
  
  if (data.pickup) params.append('pickup', data.pickup);
  if (data.destination) params.append('destination', data.destination);
  if (data.date) params.append('date', data.date);
  if (data.time) params.append('time', data.time);
  if (data.seats) params.append('seats', data.seats.toString());
  if (data.price) params.append('price', data.price.toString());
  if (data.vehicleType) params.append('vehicleType', data.vehicleType);
  if (data.instantBooking !== undefined) params.append('instantBooking', data.instantBooking.toString());
  
  return `/offer-ride?${params.toString()}`;
}

// ============================================================================
// MAIN CHATBOT PROCESSING
// ============================================================================

/**
 * Main chatbot processing function with session support
 */
async function processMessage(message, context = {}) {
  const sessionId = context.sessionId || 'default';
  const session = getSession(sessionId);
  const normalizedMessage = message.trim().toLowerCase();
  
  // Store message in conversation history
  session.conversationHistory.push({
    role: 'user',
    content: message,
    timestamp: new Date()
  });
  
  // Check if we're in ride creation flow
  if (session.rideCreationState) {
    const result = handleRideCreation(message, session);
    updateSession(sessionId, { rideCreationState: session.rideCreationState });
    return result;
  }
  
  // Detect intent
  const intent = detectIntent(normalizedMessage, message);
  session.lastIntent = intent.type;
  
  switch (intent.type) {
    case "SEARCH_RIDE":
      // Use context-aware search that considers previous searches
      const searchResult = await handleRideSearch(message, { ...context, session });
      // Store search params for refinement
      if (searchResult.searchParams) {
        updateSession(sessionId, { lastSearchParams: searchResult.searchParams });
      }
      return searchResult;
    
    case "CREATE_RIDE":
      // Start ride creation flow
      const createParams = extractSearchParameters(message);
      const initialState = { 
        step: 0, 
        data: {
          pickup: createParams.from || null,
          destination: createParams.to || null,
          date: createParams.date || null
        },
        currentFieldKey: null
      };
      
      // Find the first missing field
      let firstMissingFieldIndex = 0;
      for (let i = 0; i < RIDE_CREATION_FIELDS.length; i++) {
        const field = RIDE_CREATION_FIELDS[i];
        if (!initialState.data[field.key] && field.required) {
          firstMissingFieldIndex = i;
          break;
        } else if (!initialState.data[field.key]) {
          firstMissingFieldIndex = i;
          break;
        }
      }
      
      initialState.step = firstMissingFieldIndex;
      const nextField = RIDE_CREATION_FIELDS[firstMissingFieldIndex];
      initialState.currentFieldKey = nextField?.key;
      
      updateSession(sessionId, { rideCreationState: initialState });
      
      if (initialState.data.pickup || initialState.data.destination || initialState.data.date) {
        // Some data already provided, acknowledge and ask for next field
        let ackMessage = "🚗 Great! Let's create your ride.\n\n";
        if (initialState.data.pickup) ackMessage += `📍 From: **${initialState.data.pickup}**\n`;
        if (initialState.data.destination) ackMessage += `📍 To: **${initialState.data.destination}**\n`;
        if (initialState.data.date) ackMessage += `📅 Date: **${initialState.data.date}**\n`;
        ackMessage += "\n";
        
        if (nextField) {
          ackMessage += nextField.prompt;
        }
        
        return {
          type: "ride_creation_prompt",
          message: ackMessage,
          currentField: nextField?.key,
          collectedData: initialState.data,
          quickReplies: getFieldSuggestions(nextField?.key),
          sessionUpdate: { rideCreationState: initialState }
        };
      }
      
      return {
        type: "ride_creation_start",
        message: "🚗 Great! Let's create your ride. I'll ask you a few questions.\n\n" + RIDE_CREATION_FIELDS[0].prompt,
        currentField: 'pickup',
        collectedData: initialState.data,
        quickReplies: getFieldSuggestions('pickup'),
        sessionUpdate: { rideCreationState: initialState }
      };
    
    case "NAVIGATE":
      return handleNavigation(normalizedMessage);
    
    case "VIEW_BOOKINGS":
      return {
        type: "navigate",
        message: "📋 Let me take you to your bookings. Click below to view your upcoming rides and booking history.",
        redirectUrl: "/dashboard",
        quickActions: [
          { type: 'navigate', text: '📊 Go to Dashboard', action: 'navigate', url: '/dashboard' }
        ]
      };
    
    case "SAFETY":
      return {
        type: "safety",
        message: FAQ_KNOWLEDGE.safety.response,
        redirectUrl: "/safety",
        quickActions: [
          { type: 'navigate', text: '🛡️ Safety Features', action: 'navigate', url: '/safety' },
          { type: 'navigate', text: '🆘 Emergency Info', action: 'navigate', url: '/profile#emergency' }
        ],
        quickReplies: ["How does SOS work?", "Emergency contacts", "Search Ride"]
      };
    
    case "FAQ":
      return handleFAQ(normalizedMessage);
    
    case "GREETING":
      return {
        type: "text",
        message: intent.response,
        quickReplies: ["Search Ride", "Create Ride", "Safety", "Help"]
      };
    
    case "THANKS":
      return {
        type: "text",
        message: intent.response,
        quickReplies: ["Search Ride", "Help"]
      };
    
    case "REFINE_SEARCH":
      // Use stored search params from session
      const refinementContext = { 
        ...context, 
        searchParams: session.lastSearchParams 
      };
      return handleSearchRefinement(normalizedMessage, refinementContext);
    
    default:
      // Check FAQ first
      const faqResponse = handleFAQ(normalizedMessage);
      if (faqResponse.confidence > 0.5) {
        return faqResponse;
      }
      
      // Check if message contains location-like content (might be search refinement)
      if (session.lastSearchParams && session.lastIntent === 'SEARCH_RIDE') {
        // Try to treat as search refinement
        const refinedResult = await handleSearchRefinement(normalizedMessage, { 
          searchParams: session.lastSearchParams 
        });
        if (refinedResult.type !== 'clarification') {
          return refinedResult;
        }
      }
      
      // Default response
      return {
        type: "text",
        message: "I'm not sure I understood that. Here's what I can help with:\n\n🔍 **Search rides**: \"Find rides from Hyderabad to Gachibowli tomorrow\"\n➕ **Create ride**: \"I want to offer a ride\"\n❓ **Questions**: \"How does booking work?\"\n\nTry one of the options below:",
        quickReplies: ["Search Ride", "Create Ride", "Safety", "Help"]
      };
  }
}

/**
 * Handle navigation requests
 */
function handleNavigation(message) {
  const routes = {
    search: { url: '/search', label: 'Search Rides' },
    offer: { url: '/offer-ride', label: 'Offer a Ride' },
    profile: { url: '/profile', label: 'Your Profile' },
    dashboard: { url: '/dashboard', label: 'Dashboard' },
    safety: { url: '/safety', label: 'Safety Features' },
    settings: { url: '/profile#settings', label: 'Settings' },
    bookings: { url: '/dashboard', label: 'Your Bookings' },
    rides: { url: '/dashboard', label: 'Your Rides' }
  };
  
  for (const [key, route] of Object.entries(routes)) {
    if (message.includes(key)) {
      return {
        type: "navigate",
        message: `📍 Taking you to **${route.label}**...`,
        redirectUrl: route.url,
        quickActions: [
          { type: 'navigate', text: `Go to ${route.label}`, action: 'navigate', url: route.url }
        ]
      };
    }
  }
  
  return {
    type: "text",
    message: "Where would you like to go?",
    quickActions: [
      { type: 'navigate', text: '🔍 Search', action: 'navigate', url: '/search' },
      { type: 'navigate', text: '➕ Offer Ride', action: 'navigate', url: '/offer-ride' },
      { type: 'navigate', text: '👤 Profile', action: 'navigate', url: '/profile' },
      { type: 'navigate', text: '📊 Dashboard', action: 'navigate', url: '/dashboard' }
    ]
  };
}

/**
 * Detect user intent
 */
function detectIntent(normalizedMessage, originalMessage) {
  for (const [intentType, config] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(normalizedMessage) || pattern.test(originalMessage)) {
        return { type: intentType, ...config };
      }
    }
  }
  return { type: "UNKNOWN" };
}

/**
 * Handle ride search queries with fuzzy matching and proximity search
 */
async function handleRideSearch(message, context) {
  const params = extractSearchParameters(message);
  
  // Check if we have minimum required parameters
  if (!params.from && !params.to && !params.date && !params.nearLocation) {
    return {
      type: "clarification",
      message: "I can help you search for rides! Please tell me:\n\n📍 Where are you going from and to?\n📅 When do you want to travel?\n\nExample: \"Find rides from Hyderabad to Gachibowli tomorrow morning\"",
      quickReplies: ["Tomorrow morning", "Today evening", "This weekend"],
      context: { intent: "search", partial: params }
    };
  }

  // Build search summary with readable dates
  let searchSummary = "🔍 Searching for rides";
  if (params.from) searchSummary += ` from **${params.from}**`;
  if (params.to) searchSummary += ` to **${params.to}**`;
  if (params.nearLocation) searchSummary += ` near **${params.nearLocation}**`;
  if (params.dateReadable) {
    searchSummary += ` **${params.dateReadable}**`;
  } else if (params.date) {
    searchSummary += ` on **${params.date}**`;
  }
  if (params.timeRange) searchSummary += ` in the **${params.timeRange}**`;
  searchSummary += "...";

  try {
    // Build base query - exclude completed/cancelled rides
    const query = {
      status: { $in: ["scheduled", "active"] },
      availableSeats: { $gte: params.passengers || 1 }
    };

    // Date filter - only show future rides
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (params.date) {
      query.date = params.date;
    } else {
      // Default: show rides from today onwards
      query.date = { $gte: today.toISOString().split("T")[0] };
    }

    // Time filter
    if (params.timeRange) {
      const timeConfig = TIME_ALIASES[params.timeRange];
      if (timeConfig) {
        query.departureTime = {
          $gte: `${String(timeConfig.start).padStart(2, "0")}:00`,
          $lte: `${String(timeConfig.end).padStart(2, "0")}:59`
        };
      }
    }

    // Preference filters
    if (params.preferences?.genderPreference) {
      query.genderPreference = params.preferences.genderPreference;
    }
    if (params.preferences?.music) {
      query.musicPreference = { $ne: "none" };
    }

    // First, try exact/fuzzy location matching
    let rides = await findRidesWithFuzzyLocation(query, params);

    // If no results, try with relaxed criteria
    if (rides.length === 0 && (params.from || params.to)) {
      rides = await findRidesWithRelaxedCriteria(query, params);
    }

    if (rides.length === 0) {
      const alternativeMessage = generateSmartAlternatives(params);
      
      return {
        type: "no_results",
        message: `${searchSummary}\n\n😔 No rides found matching your criteria.\n\n${alternativeMessage.message}`,
        searchParams: params,
        quickReplies: alternativeMessage.suggestions,
        quickActions: [
          { type: 'action', text: '➕ Offer this ride', action: 'Create Ride', url: generateOfferRideUrl({ 
            pickup: params.from, 
            destination: params.to, 
            date: params.date 
          })},
          { type: 'navigate', text: '🔍 Browse all rides', action: 'navigate', url: '/search' }
        ]
      };
    }

    // Apply personalization if user is logged in (context has userId)
    let personalizedRides = rides;
    let isPersonalized = false;
    let recommendedCount = 0;

    if (context.userId) {
      try {
        // Track search behavior (async)
        trackSearch(context.userId, {
          fromName: params.from,
          toName: params.to,
          date: params.date,
          passengers: 1
        }, rides.length, {});

        // Apply personalized scoring
        personalizedRides = await scoreAndRankRides(rides, context.userId, null);
        isPersonalized = personalizedRides.some(r => r.personalization?.isPersonalized);
        recommendedCount = personalizedRides.filter(r => r.personalization?.isRecommended).length;
        
        console.log(`[Chatbot] Personalized search for ${context.userId}: ${recommendedCount}/${personalizedRides.length} recommended`);
      } catch (err) {
        console.warn("[Chatbot] Personalization failed:", err.message);
        personalizedRides = rides;
      }
    }

    // Format rides for display - use correct field names (from/to, not source/destination)
    const formattedRides = personalizedRides.map(ride => {
      // Ensure from and to are properly structured
      const from = ride.from || ride.source || {};
      const to = ride.to || ride.destination || {};
      
      return {
        _id: ride._id,
        // Ensure both source/destination AND from/to are set for compatibility
        source: from,
        destination: to,
        from: from,
        to: to,
        date: ride.date,
        departureTime: ride.departureTime,
        price: ride.price || ride.pricePerSeat || 0,
        pricePerSeat: ride.pricePerSeat || ride.price || 0,
        availableSeats: ride.availableSeats || 0,
        driver: {
          _id: ride.driver?._id,
          name: ride.driver?.name || 'Driver',
          photo: ride.driver?.photo,
          // Only include rating if driver has actual reviews
          rating: ride.driver?.reviewStats?.avgStars || ride.driver?.reliabilityScore?.avgRating || null,
          reviewStats: ride.driver?.reviewStats,
          reliabilityScore: ride.driver?.reliabilityScore,
          trips: ride.driver?.trips || 0
        },
        vehicleType: ride.vehicleType || 'Sedan',
        preferences: {
          music: ride.musicPreference,
          smoking: ride.smokingAllowed
        },
        matchScore: ride._matchScore,
        // Include personalization data
        personalization: ride.personalization || null
      };
    });

    // Build response message with personalization info
    let resultMessage = `${searchSummary}\n\n✅ Found ${rides.length} ride${rides.length > 1 ? "s" : ""}`;
    if (isPersonalized && recommendedCount > 0) {
      resultMessage += ` (${recommendedCount} recommended for you)`;
    }
    resultMessage += ":";

    return {
      type: "ride_results",
      message: resultMessage,
      rides: formattedRides,
      searchParams: params,
      isPersonalized,
      recommendedCount,
      quickReplies: rides.length > 0 ? ["Show more", "Filter by price", "Female drivers only"] : []
    };

  } catch (error) {
    console.error("Chatbot search error:", error);
    return {
      type: "error",
      message: "Sorry, I encountered an error while searching. Please try the regular search page.",
      quickReplies: ["Try again", "Go to Search"]
    };
  }
}

/**
 * Find rides with fuzzy location matching
 */
async function findRidesWithFuzzyLocation(baseQuery, params) {
  const query = { ...baseQuery };
  
  // Use correct field names: from.name and to.name (not source/destination)
  if (params.from) {
    // Generate fuzzy regex patterns for source location
    const fuzzyPatterns = generateFuzzyPatterns(params.from);
    query["$or"] = fuzzyPatterns.map(p => ({ "from.name": { $regex: p, $options: "i" } }));
  }
  
  if (params.to) {
    const fuzzyPatterns = generateFuzzyPatterns(params.to);
    const toConditions = fuzzyPatterns.map(p => ({ "to.name": { $regex: p, $options: "i" } }));
    
    if (query["$or"]) {
      // Combine with AND for both from and to
      const fromConditions = query["$or"];
      delete query["$or"];
      query["$and"] = [
        { "$or": fromConditions },
        { "$or": toConditions }
      ];
    } else {
      query["$or"] = toConditions;
    }
  }
  
  // Handle "near" location searches
  if (params.nearLocation) {
    const fuzzyPatterns = generateFuzzyPatterns(params.nearLocation);
    const nearConditions = fuzzyPatterns.flatMap(p => [
      { "from.name": { $regex: p, $options: "i" } },
      { "to.name": { $regex: p, $options: "i" } }
    ]);
    
    if (query["$and"]) {
      query["$and"].push({ "$or": nearConditions });
    } else if (query["$or"]) {
      const existingOr = query["$or"];
      delete query["$or"];
      query["$and"] = [{ "$or": existingOr }, { "$or": nearConditions }];
    } else {
      query["$or"] = nearConditions;
    }
  }

  const rides = await Ride.find(query)
    .populate("driver", "name photo reliabilityScore reviewStats trips gender")
    .sort({ date: 1, departureTime: 1 })
    .limit(10);

  // Score and sort rides by match quality
  return scoreAndSortRides(rides, params);
}

/**
 * Find rides with relaxed criteria (broader search)
 * FIXED: Still requires at least one location to match - doesn't return all rides
 */
async function findRidesWithRelaxedCriteria(baseQuery, params) {
  // If no location parameters provided, don't do relaxed search
  if (!params.from && !params.to && !params.nearLocation) {
    return [];
  }
  
  const relaxedQuery = { 
    status: { $in: ["scheduled", "active"] },
    availableSeats: { $gte: 1 }
  };
  
  // Only keep date filter if provided
  if (params.date) {
    relaxedQuery.date = params.date;
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    relaxedQuery.date = { $gte: today.toISOString().split("T")[0] };
  }
  
  // FIXED: Use more restrictive matching - require location match in correct field
  // Instead of matching 'from' in both from.name and to.name, be more specific
  const locationConditions = [];
  
  if (params.from) {
    // 'from' location should primarily match the ride's from.name
    const patterns = generateFuzzyPatterns(params.from);
    patterns.forEach(p => {
      locationConditions.push({ "from.name": { $regex: p, $options: "i" } });
    });
  }
  
  if (params.to) {
    // 'to' location should primarily match the ride's to.name
    const patterns = generateFuzzyPatterns(params.to);
    patterns.forEach(p => {
      locationConditions.push({ "to.name": { $regex: p, $options: "i" } });
    });
  }
  
  if (params.nearLocation) {
    // 'near' can match either from or to
    const patterns = generateFuzzyPatterns(params.nearLocation);
    patterns.forEach(p => {
      locationConditions.push({ "from.name": { $regex: p, $options: "i" } });
      locationConditions.push({ "to.name": { $regex: p, $options: "i" } });
    });
  }
  
  // Must have at least one location condition
  if (locationConditions.length === 0) {
    return [];
  }
  
  relaxedQuery["$or"] = locationConditions;

  const rides = await Ride.find(relaxedQuery)
    .populate("driver", "name photo reliabilityScore reviewStats trips gender")
    .sort({ date: 1, departureTime: 1 })
    .limit(10);

  return scoreAndSortRides(rides, params);
}

/**
 * Generate fuzzy regex patterns for location matching
 * Handles typos, partial matches, and common variations
 */
function generateFuzzyPatterns(location) {
  const normalized = location.toLowerCase().trim();
  const patterns = [];
  
  // Exact match pattern
  patterns.push(escapeRegex(normalized));
  
  // Allow character transpositions and common typos
  // "hyderbad" -> "hyderabad"
  const fuzzyPattern = normalized
    .split('')
    .map(c => `${escapeRegex(c)}?`)
    .join('.?');
  patterns.push(fuzzyPattern);
  
  // Partial match - starts with or contains
  if (normalized.length > 3) {
    patterns.push(`^${escapeRegex(normalized.substring(0, 3))}`);
    patterns.push(escapeRegex(normalized.substring(0, Math.min(5, normalized.length))));
  }
  
  // Common spelling variations
  const variations = getLocationVariations(normalized);
  variations.forEach(v => patterns.push(escapeRegex(v)));
  
  return [...new Set(patterns)]; // Remove duplicates
}

/**
 * Get common spelling variations for locations
 */
function getLocationVariations(location) {
  const variations = [];
  
  // Common Indian location spelling variations
  const spellingMap = {
    'hy': ['hi'],
    'gh': ['g'],
    'ch': ['c', 'sh'],
    'sh': ['s', 'ch'],
    'th': ['t'],
    'ph': ['f'],
    'aa': ['a'],
    'ee': ['i', 'e'],
    'oo': ['u', 'o'],
    'ai': ['ay', 'ae'],
    'ei': ['ey', 'e'],
    'ou': ['ow', 'o']
  };
  
  let modified = location;
  for (const [from, toList] of Object.entries(spellingMap)) {
    for (const to of toList) {
      if (location.includes(from)) {
        variations.push(location.replace(from, to));
      }
      if (location.includes(to)) {
        variations.push(location.replace(to, from));
      }
    }
  }
  
  // Also check location aliases
  const aliasMatch = LOCATION_ALIASES[location];
  if (aliasMatch) {
    variations.push(aliasMatch.toLowerCase());
  }
  
  // Reverse alias lookup
  for (const [alias, fullName] of Object.entries(LOCATION_ALIASES)) {
    if (fullName.toLowerCase().includes(location) || location.includes(fullName.toLowerCase())) {
      variations.push(alias);
      variations.push(fullName.toLowerCase());
    }
  }
  
  return variations;
}

/**
 * Helper: Check if a ride is still available for display
 * A ride is available if:
 * - Status is "scheduled" or "active"
 * - Ride date/time is at least 3 hours in the future
 */
function isRideAvailableForChatbot(ride) {
  // Allow both scheduled and active rides
  if (!ride || !["scheduled", "active"].includes(ride.status)) return false;
  
  const now = new Date();
  
  // Parse ride date and time
  const rideDate = ride.date;
  const rideTime = ride.departureTime || "00:00";
  
  // Build ride datetime
  const [hours, minutes] = rideTime.split(":").map(Number);
  const rideDateTime = new Date(rideDate);
  rideDateTime.setHours(hours, minutes, 0, 0);
  
  // Ride must be at least 3 hours from now to be shown
  const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  
  return rideDateTime >= threeHoursFromNow;
}

// Minimum match score threshold - rides below this are filtered out
const MIN_MATCH_SCORE_THRESHOLD = 110; // Base 100 + at least some location match

/**
 * Score and sort rides by relevance
 * FIXED: Only returns rides that actually match the search criteria
 */
function scoreAndSortRides(rides, params) {
  // Filter out rides that are not available (Part 1 - Time filtering)
  const availableRides = rides.filter(ride => isRideAvailableForChatbot(ride));
  
  const scoredRides = availableRides.map(ride => {
    let score = 100;
    let hasLocationMatch = false;
    
    // Score based on location match quality (use correct field names: from/to)
    if (params.from && ride.from?.name) {
      const fromScore = calculateSimilarity(params.from.toLowerCase(), ride.from.name.toLowerCase());
      score += fromScore * 50;
      if (fromScore > 0.3) hasLocationMatch = true;
    }
    if (params.to && ride.to?.name) {
      const toScore = calculateSimilarity(params.to.toLowerCase(), ride.to.name.toLowerCase());
      score += toScore * 50;
      if (toScore > 0.3) hasLocationMatch = true;
    }
    
    // For nearLocation searches, check both from and to
    if (params.nearLocation && !params.from && !params.to) {
      const fromScore = ride.from?.name ? calculateSimilarity(params.nearLocation.toLowerCase(), ride.from.name.toLowerCase()) : 0;
      const toScore = ride.to?.name ? calculateSimilarity(params.nearLocation.toLowerCase(), ride.to.name.toLowerCase()) : 0;
      const nearScore = Math.max(fromScore, toScore);
      score += nearScore * 50;
      if (nearScore > 0.3) hasLocationMatch = true;
    }
    
    // Bonus for exact time match
    if (params.timeRange && ride.departureTime) {
      const timeConfig = TIME_ALIASES[params.timeRange];
      if (timeConfig) {
        const hour = parseInt(ride.departureTime.split(':')[0]);
        if (hour >= timeConfig.start && hour <= timeConfig.end) {
          score += 20;
        }
      }
    }
    
    ride._matchScore = score;
    ride._hasLocationMatch = hasLocationMatch;
    return ride;
  });
  
  // CRITICAL FIX: Only return rides that have a meaningful match
  // Filter out rides that don't match the search criteria
  const matchingRides = scoredRides.filter(ride => {
    // If user specified location(s), ride must have a location match
    if ((params.from || params.to || params.nearLocation) && !ride._hasLocationMatch) {
      return false;
    }
    // Must meet minimum score threshold
    return ride._matchScore >= MIN_MATCH_SCORE_THRESHOLD;
  });
  
  return matchingRides.sort((a, b) => b._matchScore - a._matchScore);
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Quick checks
  if (str1 === str2) return 1;
  if (str1.includes(str2) || str2.includes(str1)) return 0.9;
  
  // Levenshtein distance
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
  
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  
  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : (maxLen - distance) / maxLen;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract search parameters from message with improved NLP
 */
function extractSearchParameters(message) {
  const params = {
    from: null,
    to: null,
    nearLocation: null,
    date: null,
    dateReadable: null,
    timeRange: null,
    passengers: 1,
    preferences: {}
  };

  const lowerMessage = message.toLowerCase();

  // Extract "near" location for proximity searches
  const nearMatch = lowerMessage.match(/(?:near|around|close to|nearby|in)\s+([a-zA-Z\s]+?)(?:\s+today|\s+tomorrow|\s+on|\s+at|$)/i);
  if (nearMatch && !lowerMessage.includes(' from ') && !lowerMessage.includes(' to ')) {
    params.nearLocation = normalizeLocation(nearMatch[1].trim());
  }

  // Extract locations - improved patterns
  const fromPatterns = [
    /(?:from|leaving|starting|departing)\s+([a-zA-Z\s]+?)(?:\s+to\s|\s+at\s|\s+on\s|\s+tomorrow|\s+today|\s+next|\s+this|,|$)/i,
    /^([a-zA-Z\s]+?)\s+to\s+/i  // "Hyderabad to Gachibowli"
  ];
  
  const toPatterns = [
    /(?:to|towards|going to|reach|reaching|heading to)\s+([a-zA-Z\s]+?)(?:\s+at\s|\s+on\s|\s+tomorrow|\s+today|\s+next|\s+this|\s+in\s+the|,|$)/i,
    /\s+to\s+([a-zA-Z\s]+?)(?:\s+tomorrow|\s+today|\s+on|\s+at|\s+next|\s+this|,|$)/i
  ];

  // Words that should not be captured as locations
  const excludedWords = ['tomorrow', 'today', 'morning', 'evening', 'afternoon', 'night', 
                         'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
                         'next', 'this', 'week', 'weekend', 'day', 'after'];

  for (const pattern of fromPatterns) {
    const match = lowerMessage.match(pattern);
    if (match && !params.from) {
      const loc = match[1].trim();
      if (!excludedWords.includes(loc.toLowerCase())) {
        params.from = normalizeLocation(loc);
        break;
      }
    }
  }
  
  for (const pattern of toPatterns) {
    const match = lowerMessage.match(pattern);
    if (match && !params.to) {
      const loc = match[1].trim();
      if (!excludedWords.includes(loc.toLowerCase())) {
        params.to = normalizeLocation(loc);
        break;
      }
    }
  }

  // ENHANCED: Use the new parseNaturalDate function for comprehensive date parsing
  const parsedDate = parseNaturalDate(message);
  if (parsedDate) {
    params.date = parsedDate.date;
    params.dateReadable = parsedDate.readable;
  }

  // Extract time
  for (const [timeName, config] of Object.entries(TIME_ALIASES)) {
    if (lowerMessage.includes(timeName)) {
      params.timeRange = timeName;
      break;
    }
  }
  
  // Also check for specific time mentions like "at 9am"
  const timeMatch = lowerMessage.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    if (timeMatch[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12;
    if (timeMatch[3]?.toLowerCase() === 'am' && hour === 12) hour = 0;
    
    // Map to time range
    if (hour >= 5 && hour <= 8) params.timeRange = "early morning";
    else if (hour >= 6 && hour <= 11) params.timeRange = "morning";
    else if (hour >= 12 && hour <= 16) params.timeRange = "afternoon";
    else if (hour >= 17 && hour <= 20) params.timeRange = "evening";
    else if (hour >= 21) params.timeRange = "night";
  }

  // Extract preferences
  if (/female\s+driver|women\s+only|ladies|women-only/i.test(lowerMessage)) {
    params.preferences.genderPreference = "female";
  }
  if (/music|songs/i.test(lowerMessage)) {
    params.preferences.music = true;
  }
  if (/no\s+smoking|non-smoking/i.test(lowerMessage)) {
    params.preferences.smoking = false;
  }
  if (/ac|air[\s-]?condition/i.test(lowerMessage)) {
    params.preferences.ac = true;
  }

  // Extract passengers
  const passengerMatch = lowerMessage.match(/(\d+)\s+(?:passenger|seat|people|person)/i);
  if (passengerMatch) {
    params.passengers = parseInt(passengerMatch[1]);
  }

  return params;
}

/**
 * Normalize location names
 */
function normalizeLocation(location) {
  const lower = location.toLowerCase().trim();
  return LOCATION_ALIASES[lower] || location.trim();
}

/**
 * Handle FAQ queries
 */
function handleFAQ(message) {
  let bestMatch = null;
  let bestScore = 0;

  for (const [topic, config] of Object.entries(FAQ_KNOWLEDGE)) {
    let score = 0;
    
    for (const keyword of config.keywords) {
      if (message.includes(keyword)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { topic, ...config };
    }
  }

  if (bestMatch && bestScore > 0) {
    return {
      type: "faq",
      message: bestMatch.response,
      topic: bestMatch.topic,
      confidence: Math.min(1, bestScore / 3),
      quickReplies: ["More questions", "Search Ride", "Contact Support"]
    };
  }

  return {
    type: "faq",
    confidence: 0,
    message: "I couldn't find a specific answer. Here are some popular topics:",
    quickReplies: ["How to book?", "How to create ride?", "Safety features", "Pricing", "Contact Support"]
  };
}

/**
 * Handle search refinement with context awareness
 */
async function handleSearchRefinement(message, context) {
  if (!context.searchParams) {
    return {
      type: "clarification",
      message: "I don't have a previous search to refine. Let's start fresh - where would you like to go?",
      quickReplies: ["Search Ride"]
    };
  }

  const refinedParams = { ...context.searchParams };
  const lowerMessage = message.toLowerCase();
  let refinementDescription = [];

  // Price refinements
  if (/cheaper|lower|less\s+expensive|budget/i.test(message)) {
    refinedParams.maxPrice = (context.searchParams.avgPrice || 200) * 0.8;
    refinementDescription.push("lower price");
  }
  
  // Time refinements
  if (/earlier/i.test(message)) {
    refinedParams.timeRange = "morning";
    refinementDescription.push("morning time");
  } else if (/later/i.test(message)) {
    refinedParams.timeRange = "evening";
    refinementDescription.push("evening time");
  } else if (/afternoon/i.test(message)) {
    refinedParams.timeRange = "afternoon";
    refinementDescription.push("afternoon");
  } else if (/(?:only|just)\s+morning/i.test(message)) {
    refinedParams.timeRange = "morning";
    refinementDescription.push("morning only");
  } else if (/(?:only|just)\s+evening/i.test(message)) {
    refinedParams.timeRange = "evening";
    refinementDescription.push("evening only");
  }
  
  // Gender preference refinements
  if (/female\s+driver|women\s+only|ladies/i.test(message)) {
    refinedParams.preferences = { ...refinedParams.preferences, genderPreference: "female" };
    refinementDescription.push("female drivers");
  } else if (/male\s+driver/i.test(message)) {
    refinedParams.preferences = { ...refinedParams.preferences, genderPreference: "male" };
    refinementDescription.push("male drivers");
  }
  
  // Music preference
  if (/with\s+music|music\s+allowed/i.test(message)) {
    refinedParams.preferences = { ...refinedParams.preferences, music: true };
    refinementDescription.push("music allowed");
  }
  
  // AC preference
  if (/with\s+ac|air\s+condition/i.test(message)) {
    refinedParams.preferences = { ...refinedParams.preferences, ac: true };
    refinementDescription.push("AC available");
  }

  // If no refinements detected, explain what we can do
  if (refinementDescription.length === 0) {
    return {
      type: "clarification",
      message: "I can refine your search. Try saying:\n• \"Only morning rides\"\n• \"Cheaper options\"\n• \"Female drivers only\"\n• \"With music\"",
      quickReplies: ["Morning only", "Cheaper rides", "Female drivers", "With AC"],
      searchParams: context.searchParams
    };
  }

  // Re-run the search with refined parameters
  const refinedSearchMessage = `Find rides from ${refinedParams.from || 'anywhere'} to ${refinedParams.to || 'anywhere'}`;
  const result = await handleRideSearch(refinedSearchMessage, { ...context, searchParams: refinedParams });
  
  // Add refinement info to the response
  result.message = `🔄 Refined search (${refinementDescription.join(", ")}):\n\n${result.message}`;
  result.searchParams = refinedParams;
  
  return result;
}

/**
 * Generate alternative suggestions
 */
function generateAlternativeSuggestion(params) {
  const suggestions = [];

  if (params.timeRange) {
    suggestions.push("• Try a different time of day");
  }
  if (params.date) {
    suggestions.push("• Check rides for nearby dates");
  }
  suggestions.push("• Set up a ride alert to get notified");
  suggestions.push("• Post your own ride request");

  return "**Suggestions:**\n" + suggestions.join("\n");
}

/**
 * Generate smart alternatives when no rides found
 */
function generateSmartAlternatives(params) {
  const suggestions = [];
  let message = "**Here are some alternatives:**\n\n";
  
  // Suggest different time
  if (params.timeRange === "morning") {
    suggestions.push("Try afternoon rides");
    message += "• Morning rides are often limited. Try searching for **afternoon** or **evening** rides.\n";
  } else if (params.timeRange === "evening") {
    suggestions.push("Try morning rides");
    message += "• Try searching for **morning** rides - there might be more availability.\n";
  }
  
  // Suggest different date
  if (params.date) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    
    suggestions.push(`Check ${formatDate(tomorrow)}`);
    suggestions.push(`Check ${formatDate(dayAfter)}`);
    message += "• Try **tomorrow** or **day after tomorrow** for more options.\n";
  } else {
    suggestions.push("Tomorrow");
    suggestions.push("This weekend");
  }
  
  // Suggest creating the ride
  if (params.from && params.to) {
    message += `• **Offer this ride yourself** and earn money while traveling!\n`;
    suggestions.push("Create this ride");
  }
  
  // Always offer to browse all rides
  suggestions.push("Browse all rides");
  
  return {
    message,
    suggestions
  };
}

/**
 * Get predicted rides for user
 */
async function getPredictedRide(userId) {
  try {
    const prediction = await predictNextRide(userId);
    
    if (prediction.hasPrediction && prediction.predictions.length > 0) {
      const topPrediction = prediction.predictions[0];
      
      return {
        type: "prediction",
        message: `🔮 Based on your travel patterns, you might need:\n\n📍 ${topPrediction.route.from?.name} → ${topPrediction.route.to?.name}\n⏰ Around ${topPrediction.suggestedTime}\n\n${topPrediction.reason}`,
        prediction: topPrediction,
        quickReplies: ["Search this route", "Not today", "Show other predictions"]
      };
    }

    return null;
  } catch (error) {
    console.error("Prediction error:", error);
    return null;
  }
}

/**
 * Get quick action handlers
 */
function getQuickActionResponse(action) {
  const actions = {
    "Search Ride": {
      type: "prompt",
      message: "Where would you like to go? Tell me your pickup location, destination, and when you want to travel.\n\nExample: \"From Hyderabad to Gachibowli tomorrow morning\"",
      quickReplies: ["Tomorrow morning", "Today evening", "This weekend"]
    },
    "How to book?": () => handleFAQ("how to book"),
    "How to create ride?": () => handleFAQ("create ride"),
    "Help": {
      type: "help",
      message: "I can help you with:\n\n🔍 **Find Rides** - Search for carpooling options\n❓ **Answer Questions** - About booking, safety, features\n🎯 **Guide You** - Through the platform\n\nJust ask me anything!",
      quickReplies: ["Search Ride", "Safety features", "How it works", "Contact Support"]
    },
    "Safety features": () => handleFAQ("safety"),
    "Contact Support": () => handleFAQ("contact support")
  };

  const handler = actions[action];
  if (typeof handler === "function") {
    return handler();
  }
  return handler || null;
}

module.exports = {
  processMessage,
  extractSearchParameters,
  handleFAQ,
  getPredictedRide,
  getQuickActionResponse,
  FAQ_KNOWLEDGE,
  LOCATION_ALIASES,
  TIME_ALIASES,
  parseNaturalDate,
  getSession,
  updateSession
};
