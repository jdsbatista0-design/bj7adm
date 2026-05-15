import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiStatus = "ok" | "atencao" | "critico" | "neutral";

export function KpiCard({
  label,
  value,
  hint,
  trend,
  status = "neutral",
  icon,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  /** -1..1 ou número já calculado em %. Ex: 0.12 = +12% */
  trend?: number | null;
  status?: KpiStatus;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const statusRing = {
    ok: "ring-success/30",
    atencao: "ring-warning/30",
    critico: "ring-destructive/40",
    neutral: "ring-white/5",
  }[status];

  const statusDot = {
    ok: "bg-success",
    atencao: "bg-warning",
    critico: "bg-destructive",
    neutral: "bg-muted-foreground/40",
  }[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full text-left rounded-2xl bg-card p-4 ring-1 transition",
        statusRing,
        onClick ? "hover:ring-primary/40 hover:bg-card/80 cursor-pointer" : "cursor-default",
      )}
      style={{ boxShadow: "var(--shadow-elegant)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("h-1.5 w-1.5 rounded-full", statusDot)} />
          <span>{label}</span>
        </div>
        {icon && <div className="text-muted-foreground/70">{icon}</div>}
      </div>

      <div className="mt-2 text-2xl sm:text-3xl font-semibold tabular tracking-tight">
        {value}
      </div>

      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground/80">{hint ?? "\u00A0"}</span>
        {typeof trend === "number" && <TrendBadge trend={trend} />}
      </div>
    </button>
  );
}

function TrendBadge({ trend }: { trend: number }) {
  const pct = Math.abs(trend) >= 1 ? trend : trend * 100;
  const rounded = Math.round(pct * 10) / 10;
  const up = rounded > 0;
  const flat = Math.abs(rounded) < 0.5;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const cls = flat
    ? "text-muted-foreground"
    : up
      ? "text-success"
      : "text-destructive";
  return (
    <span className={cn("inline-flex items-center gap-0.5 tabular", cls)}>
      <Icon className="h-3 w-3" />
      {flat ? "estável" : `${up ? "+" : ""}${rounded}%`}
    </span>
  );
}
