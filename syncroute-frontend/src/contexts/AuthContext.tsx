import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authAPI } from "@/lib/api";
import { toast } from "sonner";

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  rating: number;
  trips: number;
  verified: boolean;
  role: string;
  documents?: {
    licenseVerified?: boolean;
    rcVerified?: boolean;
    insuranceVerified?: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone?: string; role?: string }) => Promise<void>;
  googleLogin: (googleData: { email: string; name: string; googleId: string; photo?: string }) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        try {
          const userData = await authAPI.getCurrentUser();
          setUser(userData);
        } catch (error) {
          console.error("Failed to fetch user:", error);
          localStorage.removeItem("token");
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const data = await authAPI.login({ email, password });
      setUser(data);
      setToken(data.token);
      localStorage.setItem("token", data.token);
      toast.success("Welcome back!");
    } catch (error: any) {
      const message = error.response?.data?.message || "Login failed";
      toast.error(message);
      throw error;
    }
  };

  const register = async (data: { name: string; email: string; password: string; phone?: string; role?: string }) => {
    try {
      const response = await authAPI.register(data);
      setUser(response);
      setToken(response.token);
      localStorage.setItem("token", response.token);
      toast.success("Account created successfully!");
    } catch (error: any) {
      const message = error.response?.data?.message || "Registration failed";
      toast.error(message);
      throw error;
    }
  };

  const googleLogin = async (googleData: { email: string; name: string; googleId: string; photo?: string }) => {
    try {
      const response = await authAPI.googleLogin(googleData);
      setUser(response);
      setToken(response.token);
      localStorage.setItem("token", response.token);
      toast.success("Welcome back!");
    } catch (error: any) {
      const message = error.response?.data?.message || "Google sign-in failed";
      toast.error(message);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    toast.success("Logged out successfully");
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, googleLogin, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
