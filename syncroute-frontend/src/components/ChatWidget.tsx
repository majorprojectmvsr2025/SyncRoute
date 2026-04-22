import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, Loader2, ChevronRight, Sparkles, Calendar, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { chatbotAPI } from "@/lib/api";

/* ── Types ──────────────────────────────────────────────────────── */
interface Msg {
  id: string;
  role: "user" | "bot";
  text: string;
  ts: Date;
  rides?: any[];
  chips?: { label: string; action: string }[];
  typing?: boolean;
}

/* ── Markdown: bold only ────────────────────────────────────────── */
function Md({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

/* ── Typing dots ────────────────────────────────────────────────── */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 150, 300].map(d => (
        <span key={d} className="h-2 w-2 rounded-full bg-muted-foreground/40"
          style={{ animation: `typingDot 1.2s ${d}ms ease-in-out infinite` }} />
      ))}
    </div>
  );
}

/* ── Ride card inside chat ──────────────────────────────────────── */
function ChatRideCard({ ride, onClick }: { ride: any; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full text-left p-4 rounded-xl border-2 border-border bg-card hover:bg-accent hover:border-primary/30 transition-all group shadow-sm hover:shadow-md">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground mb-1.5">
            <div className="h-2 w-2 rounded-full bg-success shrink-0" />
            <span className="truncate">{ride.from?.name || ride.source?.name || "Pickup"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-destructive shrink-0" />
            <span className="truncate">{ride.to?.name || ride.destination?.name || "Drop-off"}</span>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 group-hover:translate-x-1 group-hover:text-primary transition-all" />
      </div>
      
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {ride.date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(ride.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
            </span>
          )}
          {ride.departureTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {ride.departureTime}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-lg font-display font-bold text-primary">₹{ride.price || ride.pricePerSeat || "—"}</span>
          <span className="text-xs text-muted-foreground">/seat</span>
        </div>
      </div>
    </button>
  );
}

/* ── Main widget ────────────────────────────────────────────────── */
const ChatWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [unread, setUnread] = useState(0);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Hide chatbot during intro animation
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem("syncroute_intro_seen");
  });

  useEffect(() => {
    const checkIntro = () => {
      setShowIntro(!sessionStorage.getItem("syncroute_intro_seen"));
    };
    
    // Check every 100ms if intro is complete
    const interval = setInterval(checkIntro, 100);
    
    return () => clearInterval(interval);
  }, []);

  const scrollEnd = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollEnd(); }, [msgs, scrollEnd]);

  // Don't render if intro is showing
  if (showIntro) {
    return null;
  }

  /* Welcome message */
  useEffect(() => {
    if (open && msgs.length === 0) {
      const greeting = user
        ? `Hi ${user.name?.split(" ")[0]}! I'm SyncBot. Ask me to find rides, explain how booking works, or anything else.`
        : "Hi! I'm SyncBot. I can help you find rides, explain how SyncRoute works, or answer any questions.";

      setMsgs([{
        id: "welcome",
        role: "bot",
        text: greeting,
        ts: new Date(),
        chips: [
          { label: "Find a ride", action: "I want to find a ride" },
          { label: "How does it work?", action: "How does SyncRoute work?" },
          { label: "Offer a ride", action: "How do I offer a ride?" },
          { label: "Safety features", action: "What safety features do you have?" },
        ],
      }]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (open) setUnread(0);
  }, [open, user, msgs.length]);

  const addBotMsg = (partial: Omit<Msg, "id" | "ts" | "role">) => {
    setMsgs(prev => [...prev, { id: `bot-${Date.now()}`, role: "bot", ts: new Date(), ...partial }]);
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;

    setMsgs(prev => [...prev, { id: `u-${Date.now()}`, role: "user", text: t, ts: new Date() }]);
    setInput("");
    setBusy(true);

    const typingId = `typing-${Date.now()}`;
    setMsgs(prev => [...prev, { id: typingId, role: "bot", text: "", ts: new Date(), typing: true }]);

    try {
      const res = await chatbotAPI.sendMessage(t, sessionId);
      if (res.sessionId) setSessionId(res.sessionId);

      setMsgs(prev => {
        const filtered = prev.filter(m => m.id !== typingId);
        const chips: { label: string; action: string }[] = [];

        if (res.quickActions) {
          res.quickActions.forEach((a: any) => chips.push({ label: a.text, action: a.action }));
        }
        if (res.rides?.length === 0) {
          chips.push({ label: "Try different dates", action: "Show rides for next week" });
          chips.push({ label: "Offer this route", action: "How do I offer a ride?" });
        }

        return [...filtered, {
          id: `bot-${Date.now()}`,
          role: "bot" as const,
          text: res.message || "",
          ts: new Date(),
          rides: res.rides,
          chips: chips.length ? chips : undefined,
        }];
      });

      if (!open) setUnread(u => u + 1);
    } catch {
      setMsgs(prev => {
        const filtered = prev.filter(m => m.id !== typingId);
        return [...filtered, {
          id: `err-${Date.now()}`,
          role: "bot" as const,
          text: "Something went wrong. Please try again.",
          ts: new Date(),
        }];
      });
    } finally {
      setBusy(false);
    }
  };

  const handleChip = (action: string) => {
    if (action === "navigate:/offer-ride" || action === "Create Ride") { navigate("/offer-ride"); setOpen(false); return; }
    if (action === "navigate:/search" || action === "Go to Search") { navigate("/search"); setOpen(false); return; }
    if (action === "navigate:/dashboard") { navigate("/dashboard"); setOpen(false); return; }
    if (action.startsWith("navigate:")) { navigate(action.slice(9)); setOpen(false); return; }
    send(action);
  };

  return (
    <>
      {/* ── Trigger button ──────────────────────────────── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 group"
          aria-label="Open chat assistant"
        >
          {/* Main button — clean, no radiation ring */}
          <div className="relative h-14 w-14 bg-primary rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center">
            <MessageCircle className="h-6 w-6 text-primary-foreground" />
          </div>
          
          {/* Unread badge */}
          {unread > 0 && (
            <div className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-md">
              {unread}
            </div>
          )}
        </button>
      )}

      {/* ── Chat window ─────────────────────────────────── */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col bg-card border-2 border-border rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl"
          style={{ 
            width: "min(420px, calc(100vw - 24px))", 
            height: "min(650px, calc(100vh - 80px))",
            animation: "chatSlideIn 0.3s cubic-bezier(0.16,1,0.3,1) both"
          }}>

          {/* Header — redesigned with gradient */}
          <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-primary to-primary/90 shrink-0 relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Ccircle cx='3' cy='3' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
            }} />
            
            <div className="relative h-11 w-11 rounded-2xl bg-primary-foreground/15 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0 relative">
              <div className="font-bold text-primary-foreground text-base flex items-center gap-2">
                SyncBot
                <span className="px-2 py-0.5 text-[10px] font-bold bg-primary-foreground/20 rounded-full uppercase tracking-wider">AI</span>
              </div>
              <div className="text-xs text-primary-foreground/80 flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                Online · Instant replies
              </div>
            </div>
            <button onClick={() => setOpen(false)}
              className="relative h-9 w-9 rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 flex items-center justify-center transition-colors">
              <X className="h-4.5 w-4.5 text-primary-foreground" />
            </button>
          </div>

          {/* Messages — improved styling */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 bg-gradient-to-b from-background to-muted/20">
            {msgs.map((msg) => (
              <div key={msg.id} className={`flex items-end gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {/* Avatar */}
                {msg.role === "bot" && (
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0 mb-0.5 border border-primary/20">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}

                <div className={`flex flex-col gap-2.5 max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  {/* Bubble */}
                  {msg.typing ? (
                    <div className="bg-muted/80 backdrop-blur-sm rounded-2xl rounded-bl-md border border-border">
                      <TypingDots />
                    </div>
                  ) : msg.text ? (
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md"
                        : "bg-card border border-border text-foreground rounded-bl-md"
                    }`}>
                      <Md text={msg.text} />
                    </div>
                  ) : null}

                  {/* Ride cards — improved design */}
                  {msg.rides && msg.rides.length > 0 && (
                    <div className="w-full space-y-2.5">
                      <p className="text-xs font-semibold text-muted-foreground px-1 uppercase tracking-wider">
                        {msg.rides.length} {msg.rides.length === 1 ? "ride" : "rides"} found
                      </p>
                      {msg.rides.slice(0, 3).map((ride: any, i: number) => (
                        <ChatRideCard key={ride._id || i} ride={ride}
                          onClick={() => { navigate(`/rides/${ride._id}`); setOpen(false); }} />
                      ))}
                      {msg.rides.length > 3 && (
                        <button onClick={() => { navigate("/search"); setOpen(false); }}
                          className="text-sm text-primary font-semibold flex items-center gap-1.5 hover:gap-2 transition-all px-1 group">
                          View all {msg.rides.length} rides 
                          <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Chips — improved design */}
                  {msg.chips && msg.chips.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {msg.chips.map((chip, i) => (
                        <button key={i} onClick={() => handleChip(chip.action)}
                          className="px-4 py-2 text-xs font-semibold bg-card border-2 border-border rounded-xl hover:bg-accent hover:border-primary/30 transition-all text-foreground shadow-sm hover:shadow-md">
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Input — improved design */}
          <form onSubmit={e => { e.preventDefault(); send(input); }}
            className="flex items-center gap-3 px-4 py-4 border-t-2 border-border bg-card/80 backdrop-blur-sm shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask me anything..."
              disabled={busy}
              className="flex-1 h-11 px-4 bg-background border-2 border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 transition-all"
            />
            <button type="submit" disabled={!input.trim() || busy}
              className="h-11 w-11 bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all shrink-0 shadow-lg shadow-primary/20">
              {busy
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <Send className="h-5 w-5" />
              }
            </button>
          </form>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes chatSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
};

export default ChatWidget;
