import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Unified loading / empty / error primitives for tables, grids and
 * large data pages. Use these instead of ad-hoc spinners or text
 * placeholders to keep the system feeling continuous.
 */

// ---------- KPI / stat strip ----------
export function StatCardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn(
        "grid gap-4",
        count <= 2 && "grid-cols-1 md:grid-cols-2",
        count === 3 && "grid-cols-1 md:grid-cols-3",
        count >= 4 && "grid-cols-2 md:grid-cols-4",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-5 surface-elevated border-0">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2 flex-1 min-w-0">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
            </div>
            <Skeleton className="size-10 rounded-md" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------- Table skeleton ----------
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

export function TableSkeleton({
  rows = 8,
  columns = 5,
  showHeader = true,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn("w-full overflow-hidden rounded-md", className)}>
      {showHeader && (
        <div className="grid gap-3 px-4 py-3 bg-secondary/40 border-b" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-3/4" />
          ))}
        </div>
      )}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-3 px-4 py-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
          >
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className={cn("h-4", c === 0 ? "w-4/5" : "w-2/3")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Grid skeleton (cards / tiles) ----------
export function GridSkeleton({
  items = 8,
  aspect = "square",
  className,
}: {
  items?: number;
  aspect?: "square" | "video" | "tall";
  className?: string;
}) {
  const aspectCls =
    aspect === "video" ? "aspect-video" : aspect === "tall" ? "aspect-[3/4]" : "aspect-square";
  return (
    <div
      className={cn(
        "grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
        className,
      )}
    >
      {Array.from({ length: items }).map((_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-lg", aspectCls)} />
      ))}
    </div>
  );
}

// ---------- Page-level skeleton wrapper ----------
export function PageSkeleton({
  showStats = true,
  statCount = 4,
  rows = 8,
  columns = 5,
}: {
  showStats?: boolean;
  statCount?: number;
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="p-6 space-y-6 max-w-[1500px] mx-auto animate-in fade-in duration-300">
      {showStats && <StatCardsSkeleton count={statCount} />}
      <Card className="p-5 surface-elevated border-0 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-32" />
        </div>
        <TableSkeleton rows={rows} columns={columns} />
      </Card>
    </div>
  );
}

// ---------- Error state ----------
interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | unknown;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "تعذّر تحميل البيانات",
  description = "حدث خطأ أثناء جلب البيانات. حاول مرة أخرى.",
  error,
  onRetry,
  className,
}: ErrorStateProps) {
  const msg = error instanceof Error ? error.message : undefined;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-6",
        className,
      )}
    >
      <div className="size-14 rounded-full bg-destructive/10 text-destructive grid place-items-center mb-4">
        <AlertCircle className="size-7" />
      </div>
      <h3 className="font-semibold text-base mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-2">{description}</p>
      {msg && (
        <p className="text-xs text-muted-foreground/70 max-w-md mb-4 font-mono truncate" dir="ltr">
          {msg}
        </p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2 mt-2">
          <RefreshCw className="size-4" />
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}

// ---------- Async boundary: wraps loading / error / empty for queries ----------
interface AsyncBoundaryProps<T> {
  isLoading: boolean;
  isError?: boolean;
  error?: unknown;
  data?: T;
  isEmpty?: (data: T) => boolean;
  onRetry?: () => void;
  loading?: React.ReactNode;
  empty?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}

export function AsyncBoundary<T>({
  isLoading,
  isError,
  error,
  data,
  isEmpty,
  onRetry,
  loading,
  empty,
  emptyTitle = "لا توجد بيانات",
  emptyDescription = "لم يتم العثور على أي عناصر لعرضها.",
  emptyIcon,
  emptyAction,
  children,
}: AsyncBoundaryProps<T>) {
  if (isLoading) return <>{loading ?? <TableSkeleton rows={6} columns={5} />}</>;
  if (isError)
    return <ErrorState error={error as Error} onRetry={onRetry} />;
  if (data === undefined || data === null) return null;
  if (isEmpty && isEmpty(data)) {
    return (
      <>
        {empty ?? (
          <div className="flex flex-col items-center justify-center text-center py-12 px-6">
            <div className="size-14 rounded-full bg-muted text-muted-foreground grid place-items-center mb-4">
              {emptyIcon ?? <Inbox className="size-7" />}
            </div>
            <h3 className="font-semibold text-base mb-1">{emptyTitle}</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">{emptyDescription}</p>
            {emptyAction}
          </div>
        )}
      </>
    );
  }
  return <>{children(data)}</>;
}
