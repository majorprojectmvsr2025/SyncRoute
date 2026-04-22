import * as React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  photo?: string | null;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  xs: "h-5 w-5",
  sm: "h-7 w-7",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
};

const iconSizes = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
  xl: "h-10 w-10",
};

const textSizes = {
  xs: "text-[8px]",
  sm: "text-[10px]",
  md: "text-sm",
  lg: "text-lg",
  xl: "text-2xl",
};

function getInitials(name?: string): string {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({ photo, name, size = "md", className }: UserAvatarProps) {
  const [imgError, setImgError] = React.useState(false);
  const initials = getInitials(name);
  const hasValidPhoto = photo && !imgError;

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {hasValidPhoto ? (
        <AvatarImage
          src={photo}
          alt={name || "User"}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="object-cover"
        />
      ) : null}
      <AvatarFallback className="bg-muted">
        {initials ? (
          <span className={cn("font-semibold text-muted-foreground", textSizes[size])}>
            {initials}
          </span>
        ) : (
          <User className={cn("text-muted-foreground", iconSizes[size])} />
        )}
      </AvatarFallback>
    </Avatar>
  );
}

export default UserAvatar;
