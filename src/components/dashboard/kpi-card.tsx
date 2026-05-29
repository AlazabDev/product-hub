import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface KPICardProps {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  tone: "primary" | "success" | "warning" | "muted" | "accent";
  change?: number;
  trend?: "up" | "down";
  onClick?: () => void;
  className?: string;
}

const toneMap: Record<string, { chip: string; stripe: string }> = {
  primary: { chip: "bg-primary/10 text-primary", stripe: "bg-primary/70" },
  success: { chip: "bg-success/10 text-success", stripe: "bg-success/70" },
  warning: { chip: "bg-warning/10 text-warning", stripe: "bg-warning/70" },
  muted: { chip: "bg-secondary text-muted-foreground", stripe: "bg-muted-foreground/40" },
  accent: { chip: "bg-accent/15 text-accent", stripe: "bg-accent/80" },
};

export function KPICard({
  label,
  value,
  icon: Icon,
  tone,
  change,
  trend,
  onClick,
  className,
}: KPICardProps) {
  const t = toneMap[tone];
  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`relative overflow-hidden p-4 surface-elevated border-0 transition-all duration-200 ${
        onClick
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          : ""
      } ${className ?? ""}`}
      onClick={onClick}
    >
      <span aria-hidden className={`absolute inset-y-0 right-0 w-[3px] ${t.stripe}`} />
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-muted-foreground font-medium tracking-wide uppercase truncate">
              {label}
            </div>
            <div className="text-3xl font-bold mt-1.5 num leading-none">
              {value?.toLocaleString("en-US") ?? "—"}
            </div>
          </div>
          <div className={`size-10 rounded-lg grid place-items-center shrink-0 ${t.chip}`}>
            <Icon className="size-5" />
          </div>
        </div>

        {change !== undefined && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className={trend === "up" ? "text-success" : "text-destructive"}>
              {trend === "up" ? "↑" : "↓"} {Math.abs(change)}%
            </span>
            <span className="text-muted-foreground">من الشهر الماضي</span>
          </div>
        )}
      </div>
    </Card>
  );
}
