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

const toneMap: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  muted: "bg-secondary text-muted-foreground",
  accent: "bg-accent/10 text-accent",
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
  return (
    <Card
      className={`p-4 surface-elevated border-0 cursor-pointer transition-all hover:shadow-lg ${
        onClick ? "hover:border-accent/50" : ""
      } ${className}`}
      onClick={onClick}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground font-medium">{label}</div>
            <div className="text-3xl font-bold mt-1.5 num">
              {value?.toLocaleString("en-US") ?? "—"}
            </div>
          </div>
          <div className={`size-10 rounded-lg grid place-items-center shrink-0 ${toneMap[tone]}`}>
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
