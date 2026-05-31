import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Unified page header used at the top of every authenticated route.
 * Provides consistent spacing, typography, optional icon chip, and an
 * actions slot for primary CTAs / filters.
 */
export function PageHeader({
  title,
  description,
  icon,
  actions,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "border-b bg-card/40 backdrop-blur-sm sticky top-14 z-[5]",
        className,
      )}
    >
      <div className="px-4 md:px-6 py-4 flex flex-wrap items-center gap-3">
        {icon && (
          <div className="size-9 shrink-0 rounded-md bg-accent/15 text-accent grid place-items-center">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg md:text-xl font-bold tracking-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
      {children && <div className="px-4 md:px-6 pb-3">{children}</div>}
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-6",
        className,
      )}
    >
      {icon && (
        <div className="size-14 rounded-full bg-muted text-muted-foreground grid place-items-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="font-semibold text-base mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
