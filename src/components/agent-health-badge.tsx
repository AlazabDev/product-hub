import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAgentHealth } from "@/lib/agent-health.functions";
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function AgentHealthBadge({ compact = false }: { compact?: boolean }) {
  const fn = useServerFn(getAgentHealth);
  const q = useQuery({
    queryKey: ["agent-health"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const status = q.isLoading
    ? "loading"
    : q.isError
      ? "error"
      : q.data?.overall
        ? "ok"
        : "degraded";

  const color =
    status === "ok"
      ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
      : status === "degraded"
        ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
        : status === "error"
          ? "bg-destructive/15 text-destructive border-destructive/30"
          : "bg-muted text-muted-foreground border-border";

  const Icon =
    status === "ok"
      ? CheckCircle2
      : status === "degraded"
        ? AlertTriangle
        : status === "error"
          ? XCircle
          : Loader2;

  const label =
    status === "ok"
      ? "الوكيل متصل"
      : status === "degraded"
        ? "اتصال جزئي"
        : status === "error"
          ? "فشل الاتصال"
          : "جاري الفحص…";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        color,
      )}
      title={q.data ? JSON.stringify(q.data.checks, null, 2) : label}
    >
      <Icon className={cn("size-3", status === "loading" && "animate-spin")} />
      {!compact && <span>{label}</span>}
    </div>
  );
}
