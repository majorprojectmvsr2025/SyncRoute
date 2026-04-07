import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { messagesAPI, messageAPI, type LocationMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { Send, ArrowLeft, MessageCircle, Loader2, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ChatLocationMessage, ShareLocationButton } from "@/components/ChatLocationMessage";

interface PopulatedUser {
  _id: string;
  name: string;
  photo?: string;
}

interface Message {
  _id: string;
  ride: string;
  sender: PopulatedUser;
  receiver: PopulatedUser;
  type?: "text" | "location" | "location_share" | "system";
  text?: string;
  location?: {
    coordinates: [number, number];
    isLive: boolean;
    trackingToken?: string;
    lastUpdated?: string;
    snapshot?: {
      address?: string;
      distanceRemaining?: number;
      etaMinutes?: number;
    };
  };
  locationExpired?: boolean;
  read: boolean;
  createdAt: string;
}

interface Conversation {
  rideId: string;
  otherUser: PopulatedUser;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  route?: string;
  hasLiveLocation?: boolean;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2);
}

export default function Chat() {
  const { user } = useAuth();
  const { socket, joinRideRoom, leaveRideRoom } = useSocket();
  const [searchParams] = useSearchParams();

  // URL params from "Message Driver" link
  const paramRideId   = searchParams.get("rideId") || "";
  const paramUserId   = searchParams.get("userId") || "";
  const paramUserName = searchParams.get("userName") || "";
  const paramRoute    = searchParams.get("route") || "";

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRideId = useRef<string | null>(null);

  useEffect(() => {
    messagesAPI.getConversations()
      .then((data) => {
        const convos: Conversation[] = data.map((item: {
          ride: { _id: string; from?: { name: string }; to?: { name: string } };
          otherUser: PopulatedUser;
          lastMessage: { text: string; createdAt: string };
          unreadCount: number;
        }) => ({
          rideId: item.ride._id,
          otherUser: item.otherUser,
          lastMessage: item.lastMessage?.text || "",
          lastMessageTime: item.lastMessage?.createdAt
            ? formatDistanceToNow(new Date(item.lastMessage.createdAt), { addSuffix: true })
            : "",
          unreadCount: item.unreadCount || 0,
          route: item.ride?.from?.name && item.ride?.to?.name
            ? `${item.ride.from.name} → ${item.ride.to.name}`
            : undefined,
        }));

        // If coming from "Message Driver" link, inject/find that conversation
        if (paramRideId && paramUserId) {
          const existing = convos.find(
            (c) => c.rideId === paramRideId && c.otherUser._id === paramUserId
          );
          if (existing) {
            setConversations(convos);
            handleSelectConvo(existing);
          } else {
            // Inject a new conversation stub so the user can start chatting
            const newConvo: Conversation = {
              rideId: paramRideId,
              otherUser: { _id: paramUserId, name: paramUserName || "Driver" },
              lastMessage: "",
              lastMessageTime: "",
              unreadCount: 0,
              route: paramRoute || undefined,
            };
            const merged = [newConvo, ...convos];
            setConversations(merged);
            handleSelectConvo(newConvo);
          }
        } else {
          setConversations(convos);
          if (convos.length > 0) handleSelectConvo(convos[0]);
        }
      })
      .catch(() => toast.error("Failed to load conversations"))
      .finally(() => setLoadingConvos(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSelectConvo = useCallback(async (convo: Conversation) => {
    if (prevRideId.current) leaveRideRoom(prevRideId.current);
    setActiveConvo(convo);
    setLoadingMessages(true);
    prevRideId.current = convo.rideId;
    joinRideRoom(convo.rideId);
    try {
      const data = await messagesAPI.getConversation(convo.rideId, convo.otherUser._id);
      setMessages(data);
      await messagesAPI.markAsRead(convo.rideId, convo.otherUser._id);
      setConversations(prev => prev.map(c => c.rideId === convo.rideId ? { ...c, unreadCount: 0 } : c));
    } catch {
      toast.error("Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  }, [joinRideRoom, leaveRideRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (message: Message) => {
      const msgRideId = message.ride as unknown as string;
      if (msgRideId === prevRideId.current) {
        setMessages(prev => [...prev, message]);
        setTypingUser(null);
      }
      setConversations(prev => prev.map(c =>
        c.rideId === msgRideId
          ? { ...c, lastMessage: message.text, lastMessageTime: "just now" }
          : c
      ));
    };
    const onTyping = ({ userId }: { userId: string }) => {
      if (userId !== user?._id) setTypingUser(userId);
    };
    const onStopTyping = () => setTypingUser(null);

    socket.on("message_received", onMessage);
    socket.on("user_typing", onTyping);
    socket.on("user_stop_typing", onStopTyping);
    return () => {
      socket.off("message_received", onMessage);
      socket.off("user_typing", onTyping);
      socket.off("user_stop_typing", onStopTyping);
    };
  }, [socket, user?._id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!socket || !activeConvo) return;
    socket.emit("typing", { rideId: activeConvo.rideId });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("stop_typing", { rideId: activeConvo!.rideId });
    }, 1500);
  };

  const sendMessage = () => {
    if (!input.trim() || !activeConvo || !socket) return;
    socket.emit("send_message", {
      rideId: activeConvo.rideId,
      receiverId: activeConvo.otherUser._id,
      text: input.trim()
    });
    setInput("");
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation Sidebar */}
        <div className={`w-full md:w-80 border-r border-border shrink-0 flex flex-col ${activeConvo ? "hidden md:flex" : "flex"}`}>
          <div className="h-12 px-4 flex items-center border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-wider">Messages</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {loadingConvos ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="h-12 w-12 rounded-sm border border-border bg-muted flex items-center justify-center mb-3">
                  <MessageCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">No conversations yet</p>
                <p className="text-xs text-muted-foreground">Book a ride to start chatting</p>
              </div>
            ) : conversations.map((c) => (
              <button
                key={c.rideId}
                onClick={() => handleSelectConvo(c)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-system ${
                  activeConvo?.rideId === c.rideId ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-border flex items-center justify-center text-xs font-bold shrink-0">
                  {getInitials(c.otherUser.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{c.otherUser.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{c.lastMessageTime}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground truncate">{c.lastMessage}</span>
                    {c.unreadCount > 0 && (
                      <span className="h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center px-1 font-bold shrink-0">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  {c.route && <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{c.route}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Panel */}
        {activeConvo ? (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="h-12 px-4 flex items-center gap-3 border-b border-border shrink-0">
              <button onClick={() => setActiveConvo(null)} className="md:hidden text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-border flex items-center justify-center text-[10px] font-bold shrink-0">
                {getInitials(activeConvo.otherUser.name)}
              </div>
              <div>
                <div className="text-sm font-medium">{activeConvo.otherUser.name}</div>
                {activeConvo.route && <div className="text-[10px] text-muted-foreground">{activeConvo.route}</div>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="h-10 w-10 rounded-sm border border-border bg-muted flex items-center justify-center mb-3">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => {
                    const isOwn = msg.sender._id === user?._id;
                    
                    // Render location message
                    if (msg.type === "location_share" || msg.type === "location") {
                      return (
                        <div key={msg._id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                          <ChatLocationMessage
                            message={msg as LocationMessage}
                            isOwn={isOwn}
                            onStopSharing={() => {
                              setMessages(prev => prev.map(m => 
                                m._id === msg._id 
                                  ? { ...m, location: { ...m.location!, isLive: false }, locationExpired: true }
                                  : m
                              ));
                            }}
                          />
                        </div>
                      );
                    }
                    
                    // Render text message
                    return (
                      <div key={msg._id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[72%] px-3 py-2 text-sm rounded-xl ${
                          isOwn
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                        }`}>
                          <p className="leading-relaxed">{msg.text}</p>
                          <p className={`text-[10px] mt-1 ${isOwn ? "text-white/60" : "text-muted-foreground"}`}>
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {typingUser && (
                    <div className="flex justify-start">
                      <div className="px-3 py-2 bg-muted rounded-xl rounded-bl-sm">
                        <div className="flex gap-1 items-center h-4">
                          <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="border-t border-border p-3 shrink-0">
              <div className="flex items-center gap-2">
                <ShareLocationButton
                  rideId={activeConvo.rideId}
                  receiverId={activeConvo.otherUser._id}
                  onShared={(msg) => {
                    setMessages(prev => [...prev, msg as unknown as Message]);
                    toast.success("Location shared");
                  }}
                />
                <input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 h-10 px-3 text-sm bg-transparent border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring transition-system"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="h-10 w-10 flex items-center justify-center bg-primary text-primary-foreground rounded-sm transition-system hover:opacity-90 disabled:opacity-30"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center flex-col gap-3 text-muted-foreground">
            <div className="h-16 w-16 rounded-sm border border-border bg-muted flex items-center justify-center">
              <MessageCircle className="h-7 w-7" />
            </div>
            <p className="text-sm">Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
