import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  User,
  Loader2,
  MapPin,
  Clock,
  Car,
  ChevronRight,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { chatbotAPI } from '@/lib/api';
import { useTheme } from 'next-themes';

// Simple markdown renderer for ** bold **
const renderMarkdown = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
};

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  rides?: any[];
  suggestions?: string[];
  quickActions?: QuickAction[];
  isTyping?: boolean;
  recommendedCount?: number;
}

interface QuickAction {
  type: string;
  text: string;
  action: string;
  url?: string;  // For navigation actions
}

const QUICK_ACTIONS: QuickAction[] = [
  { type: 'action', text: '🔍 Search Ride', action: 'Search Ride' },
  { type: 'action', text: '➕ Create Ride', action: 'Create Ride' },
  { type: 'faq', text: '❓ How to book?', action: 'How to book a ride?' },
  { type: 'action', text: '🛡️ Safety', action: 'Safety' }
];

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [suggestions, setSuggestions] = useState<QuickAction[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  // Determine if dark mode is active
  const isDarkMode = theme === 'dark';

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Welcome message when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: 'welcome',
        type: 'bot',
        content: user 
          ? `👋 Hi ${user.name?.split(' ')[0] || 'there'}! I'm SyncBot, your ride assistant. How can I help you today?`
          : "👋 Hi there! I'm SyncBot, your ride assistant. How can I help you find or book a ride?",
        timestamp: new Date(),
        quickActions: QUICK_ACTIONS
      };
      setMessages([welcomeMessage]);
      loadSuggestions();
    }
  }, [isOpen, user, messages.length]);

  // Load personalized suggestions
  const loadSuggestions = async () => {
    try {
      const response = await chatbotAPI.getSuggestions();
      if (response.suggestions) {
        setSuggestions(response.suggestions);
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  // Send message to chatbot
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Add typing indicator
    const typingId = `typing-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: typingId,
      type: 'bot',
      content: '',
      timestamp: new Date(),
      isTyping: true
    }]);

    try {
      const response = await chatbotAPI.sendMessage(text, sessionId);
      
      if (response.sessionId) {
        setSessionId(response.sessionId);
      }

      // Remove typing indicator and add response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== typingId);
        
        // Build quick actions based on response type
        let quickActions = response.quickActions;
        
        // Add navigation action for ride creation complete
        if (response.type === 'ride_creation_complete' && response.redirectUrl) {
          quickActions = [
            { type: 'navigate', text: '🚗 Review & Create Ride', action: 'navigate', url: response.redirectUrl }
          ];
        }
        
        // Add navigation action for navigate responses
        if (response.type === 'navigate' && response.redirectUrl) {
          quickActions = quickActions || [
            { type: 'navigate', text: '📍 Go', action: 'navigate', url: response.redirectUrl }
          ];
        }
        
        // Default actions for no results
        if (!quickActions && response.rides?.length === 0) {
          quickActions = [
            { type: 'action', text: '🔄 Try different dates', action: 'Show me rides for next week' },
            { type: 'action', text: '➕ Create this ride', action: 'Create Ride' }
          ];
        }
        
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          content: response.message,
          timestamp: new Date(),
          rides: response.rides,
          suggestions: response.quickReplies || response.suggestions,
          quickActions: quickActions,
          recommendedCount: response.recommendedCount
        };
        
        return [...filtered, botMessage];
      });

    } catch (error) {
      console.error('Chatbot error:', error);
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== typingId);
        return [...filtered, {
          id: `error-${Date.now()}`,
          type: 'bot',
          content: "Sorry, I'm having trouble right now. Please try again in a moment.",
          timestamp: new Date()
        }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle quick action click
  const handleQuickAction = (action: string | QuickAction) => {
    // Handle QuickAction object with URL
    if (typeof action === 'object' && action.url) {
      navigate(action.url);
      setIsOpen(false);
      return;
    }
    
    const actionStr = typeof action === 'object' ? action.action : action;
    
    switch (actionStr) {
      case 'Search Ride':
        sendMessage('I want to search for a ride');
        break;
      case 'Create Ride':
        navigate('/offer-ride');
        setIsOpen(false);
        break;
      case 'Safety':
        sendMessage('Tell me about safety features');
        break;
      case 'Go to Search':
        navigate('/search');
        setIsOpen(false);
        break;
      case 'Go to Dashboard':
        navigate('/dashboard');
        setIsOpen(false);
        break;
      case 'Go to Profile':
        navigate('/profile');
        setIsOpen(false);
        break;
      default:
        // Check if action starts with navigation prefix
        if (actionStr.startsWith('navigate:')) {
          const url = actionStr.replace('navigate:', '');
          navigate(url);
          setIsOpen(false);
        } else {
          sendMessage(actionStr);
        }
    }
  };

  // Handle navigation action from bot response
  const handleNavigationAction = (action: QuickAction) => {
    if (action.url) {
      navigate(action.url);
      setIsOpen(false);
    } else if (action.action) {
      handleQuickAction(action.action);
    }
  };

  // Handle ride card click
  const handleRideClick = (rideId: string) => {
    navigate(`/rides/${rideId}`);
    setIsOpen(false);
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  // Render ride card in chat - simplified, no excess icons
  const renderRideCard = (ride: any) => (
    <div 
      key={ride._id}
      onClick={() => handleRideClick(ride._id)}
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-foreground/30 transition-colors"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="truncate">{ride.from?.name || ride.source?.name || 'Unknown origin'}</span>
          <span className="text-muted-foreground">→</span>
          <span className="truncate">{ride.to?.name || ride.destination?.name || 'Unknown destination'}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{ride.date || 'No date'} • {ride.departureTime || 'No time'}</span>
          <span className="font-semibold text-foreground">₹{ride.price || ride.pricePerSeat || '0'}</span>
        </div>
      </div>
    </div>
  );

  // Render message - using grayscale theme
  const renderMessage = (message: Message) => {
    if (message.isTyping) {
      return (
        <div className="flex items-start gap-2 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-foreground" />
          </div>
          <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`flex items-start gap-2 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          message.type === 'user' 
            ? 'bg-foreground' 
            : 'bg-foreground/10'
        }`}>
          {message.type === 'user' 
            ? <User className="w-4 h-4 text-background" />
            : <Bot className="w-4 h-4 text-foreground" />
          }
        </div>
        <div className={`flex flex-col gap-2 max-w-[80%] ${message.type === 'user' ? 'items-end' : 'items-start'}`}>
          <div className={`rounded-2xl px-4 py-2 ${
            message.type === 'user' 
              ? 'bg-foreground text-background rounded-tr-sm' 
              : 'bg-muted text-foreground rounded-tl-sm'
          }`}>
            <p className="text-sm whitespace-pre-wrap">{renderMarkdown(message.content)}</p>
          </div>
          
          {/* Ride Results */}
          {message.rides && message.rides.length > 0 && (
            <div className="w-full space-y-2">
              <div className="text-xs text-muted-foreground">
                Found {message.rides.length} ride{message.rides.length > 1 ? 's' : ''}
              </div>
              {message.rides.slice(0, 3).map(renderRideCard)}
              {message.rides.length > 3 && (
                <button 
                  onClick={() => navigate('/search')}
                  className="text-sm text-foreground hover:underline flex items-center gap-1"
                >
                  View all {message.rides.length} rides
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          
          {/* Quick Actions - grayscale buttons */}
          {message.quickActions && (
            <div className="flex flex-wrap gap-2 mt-1">
              {message.quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleNavigationAction(action)}
                  className="px-3 py-1.5 text-xs bg-card border border-border rounded-full hover:bg-accent hover:border-foreground/30 transition-colors text-foreground"
                >
                  {action.text}
                </button>
              ))}
            </div>
          )}
          
          {/* Suggestions - grayscale styling */}
          {message.suggestions && message.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {message.suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(suggestion)}
                  className="px-3 py-1.5 text-xs bg-foreground/5 text-foreground border border-border rounded-full hover:bg-foreground/10 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Floating Chat Button - grayscale theme */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-foreground rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition-all z-50 group"
          >
            <MessageCircle className="w-6 h-6 text-background" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-foreground/80 rounded-full flex items-center justify-center border-2 border-background">
              <span className="text-[10px] text-background font-bold">?</span>
            </span>
            
            {/* Tooltip */}
            <div className="absolute right-full mr-3 px-3 py-1.5 bg-popover text-popover-foreground text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-border shadow-md">
              Need help? Chat with SyncBot
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full border-8 border-transparent border-l-popover" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 w-96 h-[600px] max-h-[80vh] bg-card rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-border"
          >
            {/* Header - grayscale theme */}
            <div className="bg-foreground px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-background/20 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5 text-background" />
                </div>
                <div>
                  <h3 className="font-semibold text-background">SyncBot</h3>
                  <p className="text-xs text-background/70">Your ride assistant</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors"
              >
                <X className="w-4 h-4 text-background" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
              {messages.map(renderMessage)}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions Bar - grayscale styling */}
            {suggestions.length > 0 && messages.length === 1 && (
              <div className="px-4 py-2 bg-card border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Suggestions</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {suggestions.slice(0, 4).map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickAction(sug.action)}
                      className="px-3 py-1.5 text-xs bg-foreground/5 text-foreground border border-border rounded-full hover:bg-foreground/10 whitespace-nowrap flex-shrink-0 transition-colors"
                    >
                      {sug.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input - grayscale theme */}
            <form onSubmit={handleSubmit} className="p-4 bg-card border-t border-border">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask me anything..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-muted rounded-full text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="w-10 h-10 bg-foreground rounded-full flex items-center justify-center hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 text-background animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-background" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Try: "Find rides from Hyderabad to Gachibowli tomorrow"
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatWidget;
