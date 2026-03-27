import { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-16 w-16 rounded-sm border border-border bg-muted flex items-center justify-center mb-4 text-muted-foreground">
        {icon}
      </div>
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-[240px] mb-4 leading-relaxed">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="h-8 px-4 bg-primary text-primary-foreground text-xs font-medium rounded-sm hover:opacity-90 transition-system"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
