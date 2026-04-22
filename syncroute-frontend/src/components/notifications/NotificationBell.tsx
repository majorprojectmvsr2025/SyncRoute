import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

const notifIcons: Record<string, string> = {
  booking_confirmed: "✅",
  booking_cancelled: "❌",
  booking_pending: "🕐",
  new_message: "💬",
  ride_reminder: "🔔",
  review_received: "⭐",
  ride_started: "🚗",
  ride_completed: "🏁",
};

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  // Handle notification click with appropriate navigation
  const handleNotificationClick = (n: any) => {
    if (!n.read) markAsRead(n._id);
    
    // Navigate based on notification type
    if (n.type === "new_message" && n.data) {
      const { rideId, senderId, senderName } = n.data;
      if (rideId && senderId) {
        setIsOpen(false);
        navigate(`/chat?rideId=${rideId}&userId=${senderId}&userName=${encodeURIComponent(senderName || "User")}`);
      }
    } else if (n.type === "ride_reminder" && n.data?.rideId) {
      setIsOpen(false);
      navigate(`/rides/${n.data.rideId}`);
    } else if ((n.type === "booking_confirmed" || n.type === "booking_cancelled" || n.type === "booking_pending") && n.data?.rideId) {
      setIsOpen(false);
      navigate(`/rides/${n.data.rideId}`);
    } else if (n.type === "ride_started" || n.type === "ride_completed") {
      if (n.data?.rideId) {
        setIsOpen(false);
        navigate(`/rides/${n.data.rideId}`);
      }
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-system border border-transparent hover:border-border">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center px-1 font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-popover border border-border shadow-lg" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <span className="h-4 min-w-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center px-1 font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-primary hover:underline transition-system"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.slice(0, 20).map((n) => (
              <button
                key={n._id}
                onClick={() => handleNotificationClick(n)}
                className={`w-full text-left px-3 py-3 hover:bg-accent/50 transition-system flex items-start gap-2 ${
                  !n.read ? "bg-primary/5" : ""
                }`}
              >
                {!n.read && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                )}
                <span className="shrink-0 text-sm mt-0.5">{notifIcons[n.type] || "🔔"}</span>
                <div className={`flex-1 min-w-0 ${!n.read ? "" : "pl-3.5"}`}>
                  <p className="text-xs font-medium leading-snug">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
