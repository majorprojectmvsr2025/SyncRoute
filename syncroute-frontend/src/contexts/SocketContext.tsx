import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

interface SocketContextType {
  socket: Socket | null;
  joinRideRoom: (rideId: string) => void;
  leaveRideRoom: (rideId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  joinRideRoom: () => {},
  leaveRideRoom: () => {}
});

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    const socketUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000/api")
      .replace("/api", "");

    const s = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    s.on("connect", () => {
      console.log("Socket connected");
      setSocket(s);
    });

    s.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

    socketRef.current = s;

    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [token]);

  const joinRideRoom = useCallback((rideId: string) => {
    socketRef.current?.emit("join_ride_room", rideId);
  }, []);

  const leaveRideRoom = useCallback((rideId: string) => {
    socketRef.current?.emit("leave_ride_room", rideId);
  }, []);

  return (
    <SocketContext.Provider value={{ socket, joinRideRoom, leaveRideRoom }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
