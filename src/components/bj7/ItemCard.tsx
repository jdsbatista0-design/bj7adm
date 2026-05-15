import type { AlertaRow, TarefaRow } from "@/integrations/supabase/database";
import { useEmpresas } from "@/hooks/use-refs";
import {
  PrioridadeBadge,
  SeveridadeBadge,
} from "@/components/bj7/badges";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Pause, Clock, Building2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type UnifiedItem =
  | { kind: "alerta"; data: AlertaRow }
  | { kind: "tarefa"; data: TarefaRow };

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function isOverdue(iso: string | null | undefined) {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

export function ItemCard({
  item,
  onResolver,
  onSnooze,
  onConcluir,
}: {
  item: UnifiedItem;
  onResolver?: (id: number) => void;
  onSnooze?: (id: number) => void;
  onConcluir?: (id: number) => void;
}) {
  const empresas = useEmpresas();
  const empresaNome = (id: number | null) =>
    id ? empresas.data?.find((e) => e.id === id)?.nome ?? `#${id}` : null;

  if (item.kind === "alerta") {
    const a = item.data;
    return (
      <div
        className={cn(
          "group rounded-xl bg-card p-3 ring-1 ring-white/5 transition hover:ring-primary/30",
          a.severidade === "critical" && "ring-destructive/30",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5">
            <AlertTriangle
              className={cn(
                "h-4 w-4",
                a.severidade === "critical"
                  ? "text-destructive"
                  : a.severidade === "warn"
                    ? "text-warning"
                    : "text-info",
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-medium leading-tight">{a.titulo}</h3>
              <SeveridadeBadge s={a.severidade} />
              {empresaNome(a.empresa_id) && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {empresaNome(a.empresa_id)}
                </span>
              )}
            </div>
            {a.descricao && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.descricao}</p>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-end gap-1">
          {onSnooze && (
            <Button size="sm" variant="ghost" onClick={() => onSnooze(a.id)}>
              <Pause className="h-3.5 w-3.5 mr-1" /> 24h
            </Button>
          )}
          {onResolver && (
            <Button size="sm" onClick={() => onResolver(a.id)}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolver
            </Button>
          )}
        </div>
      </div>
    );
  }

  const t = item.data;
  const overdue = isOverdue(t.prazo);
  return (
    <div
      className={cn(
        "group rounded-xl bg-card p-3 ring-1 ring-white/5 transition hover:ring-primary/30",
        overdue && "ring-destructive/30",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Clock
          className={cn("h-4 w-4 mt-0.5", overdue ? "text-destructive" : "text-muted-foreground")}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-sm font-medium leading-tight">{t.titulo}</h3>
            <PrioridadeBadge p={t.prioridade} />
            {t.entidade_tipo && (
              <span className="text-[10px] text-muted-foreground uppercase">
                {t.entidade_tipo}
              </span>
            )}
            {empresaNome(t.empresa_id) && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Building2 className="h-3 w-3" />
                {empresaNome(t.empresa_id)}
              </span>
            )}
          </div>
          {t.descricao && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.descricao}</p>
          )}
          {t.prazo && (
            <p
              className={cn(
                "text-[11px] mt-1 tabular",
                overdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {overdue ? "Atrasada · " : "Prazo · "}
              {formatDate(t.prazo)}
            </p>
          )}
        </div>
      </div>
      {onConcluir && (
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={() => onConcluir(t.id)}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Concluir
          </Button>
        </div>
      )}
    </div>
  );
}
