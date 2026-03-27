import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

declare global {
  interface Window {
    google: any;
  }
}

interface GoogleSignInProps {
  onSuccess?: () => void;
}

export function GoogleSignIn({ onSuccess }: GoogleSignInProps) {
  const navigate = useNavigate();
  const { googleLogin } = useAuth();

  useEffect(() => {
    // Load Google Sign-In script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: "759769223324-YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
          callback: handleCredentialResponse,
        });

        window.google.accounts.id.renderButton(
          document.getElementById("googleSignInButton"),
          {
            theme: "outline",
            size: "large",
            width: "100%",
            text: "continue_with",
          }
        );
      }
    };

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handleCredentialResponse = async (response: any) => {
    try {
      // Decode JWT token from Google
      const credential = response.credential;
      const payload = JSON.parse(atob(credential.split('.')[1]));
      
      const googleData = {
        email: payload.email,
        name: payload.name,
        googleId: payload.sub,
        photo: payload.picture,
      };

      await googleLogin(googleData);
      
      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/");
      }
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      toast.error(error.response?.data?.message || "Google sign-in failed. Please try again.");
    }
  };

  return <div id="googleSignInButton" className="w-full" />;
}
