import { cn } from "@/lib/utils";
import type {
  AlertaStatus,
  Prioridade,
  Severidade,
  TarefaStatus,
} from "@/integrations/supabase/database";

const baseChip =
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide";

export function SeveridadeBadge({ s }: { s: Severidade }) {
  const map: Record<Severidade, { label: string; cls: string }> = {
    critical: { label: "Crítico", cls: "bg-destructive/15 text-destructive" },
    warn: { label: "Atenção", cls: "bg-warning/15 text-warning" },
    info: { label: "Info", cls: "bg-info/15 text-info" },
  };
  const { label, cls } = map[s];
  return <span className={cn(baseChip, cls)}>{label}</span>;
}

export function PrioridadeBadge({ p }: { p: Prioridade }) {
  const map: Record<Prioridade, string> = {
    urgente: "bg-destructive/15 text-destructive",
    alta: "bg-warning/15 text-warning",
    media: "bg-info/15 text-info",
    baixa: "bg-muted text-muted-foreground",
  };
  return <span className={cn(baseChip, map[p])}>{p}</span>;
}

export function TarefaStatusBadge({ s }: { s: TarefaStatus }) {
  const map: Record<TarefaStatus, { label: string; cls: string }> = {
    aberta: { label: "Aberta", cls: "bg-info/15 text-info" },
    em_andamento: { label: "Em curso", cls: "bg-primary/15 text-primary" },
    aguardando: { label: "Aguardando", cls: "bg-warning/15 text-warning" },
    concluida: { label: "Concluída", cls: "bg-success/15 text-success" },
    cancelada: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
  };
  const { label, cls } = map[s];
  return <span className={cn(baseChip, cls)}>{label}</span>;
}

export function AlertaStatusBadge({ s }: { s: AlertaStatus }) {
  const map: Record<AlertaStatus, { label: string; cls: string }> = {
    aberto: { label: "Aberto", cls: "bg-destructive/15 text-destructive" },
    ack: { label: "Visto", cls: "bg-info/15 text-info" },
    snoozed: { label: "Snooze", cls: "bg-warning/15 text-warning" },
    resolvido: { label: "Resolvido", cls: "bg-success/15 text-success" },
  };
  const { label, cls } = map[s];
  return <span className={cn(baseChip, cls)}>{label}</span>;
}
