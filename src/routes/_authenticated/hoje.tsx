import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/contexts/auth-context";
import type { AlertaRow, TarefaRow } from "@/integrations/supabase/database";
import { PageShell, SectionHeader } from "@/components/bj7/PageShell";
import { ItemCard, type UnifiedItem } from "@/components/bj7/ItemCard";
import { EmptyState } from "@/components/bj7/EmptyState";
import { Button } from "@/components/ui/button";
import { useItemDrawer } from "@/components/bj7/ItemDrawer";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hoje")({
  component: Hoje,
});

function Hoje() {
  const user = useCurrentUser();
  const drawer = useItemDrawer();
  const qc = useQueryClient();

  const alertasQ = useQuery({
    queryKey: ["hoje", "alertas"],
    queryFn: async () => {
      const r = await supabase
        .from("alertas")
        .select("*")
        .in("status", ["aberto", "ack"])
        .order("severidade", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(200);
      if (r.error) throw r.error;
      return (r.data ?? []) as AlertaRow[];
    },
  });

  const tarefasQ = useQuery({
    queryKey: ["hoje", "tarefas"],
    queryFn: async () => {
      const r = await supabase
        .from("tarefas")
        .select("*")
        .in("status", ["aberta", "em_andamento", "aguardando"])
        .order("prazo", { ascending: true, nullsFirst: false })
        .limit(500);
      if (r.error) throw r.error;
      return (r.data ?? []) as TarefaRow[];
    },
  });

  const grupos = useMemo(() => {
    const tarefas = tarefasQ.data ?? [];
    const alertas = alertasQ.data ?? [];
    const now = Date.now();
    const fimDoDia = new Date();
    fimDoDia.setHours(23, 59, 59, 999);
    const fimSemana = new Date();
    fimSemana.setDate(fimSemana.getDate() + 7);

    const atrasados: UnifiedItem[] = [];
    const hoje: UnifiedItem[] = [];
    const semana: UnifiedItem[] = [];
    const semPrazo: UnifiedItem[] = [];

    for (const t of tarefas) {
      const item: UnifiedItem = { kind: "tarefa", data: t };
      if (!t.prazo) {
        if (t.responsavel_id === user.id) semPrazo.push(item);
        continue;
      }
      const ts = new Date(t.prazo).getTime();
      if (ts < now) atrasados.push(item);
      else if (ts <= fimDoDia.getTime()) hoje.push(item);
      else if (ts <= fimSemana.getTime()) semana.push(item);
    }

    // alertas críticos no topo de "atrasados"
    for (const a of alertas) {
      if (a.severidade === "critical" && a.status === "aberto") {
        atrasados.unshift({ kind: "alerta", data: a });
      }
    }

    return { atrasados, hoje, semana, semPrazo };
  }, [tarefasQ.data, alertasQ.data, user.id]);

  const ack = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "resolver" | "snooze" }) => {
      const fn = action === "resolver" ? "resolver_alerta" : "snooze_alerta";
      const params = action === "snooze" ? { _id: id, _horas: 24 } : { _id: id };
      const r = await supabase.rpc(fn, params);
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hoje"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const concluir = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.rpc("concluir_tarefa", { _id: id });
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hoje"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const total = grupos.atrasados.length + grupos.hoje.length + grupos.semana.length + grupos.semPrazo.length;

  return (
    <PageShell
      title="Hoje"
      description="O que precisa de você agora — atrasados, do dia, da semana"
      actions={
        <Button size="sm" onClick={() => drawer.open()}>
          <Plus className="h-4 w-4 mr-1" /> Item
        </Button>
      }
    >
      {total === 0 && !alertasQ.isLoading && !tarefasQ.isLoading ? (
        <EmptyState
          title="Inbox limpo"
          description="Nada atrasado, nada para hoje, nada na semana. Crie um Item ou volte mais tarde."
          action={
            <Button size="sm" onClick={() => drawer.open()}>
              <Plus className="h-4 w-4 mr-1" /> Criar Item
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          <Group title="Atrasados" subtitle={`${grupos.atrasados.length} item(ns)`} tone="danger">
            {grupos.atrasados.map((it) => (
              <ItemCard
                key={`${it.kind}-${it.data.id}`}
                item={it}
                onResolver={(id) => ack.mutate({ id, action: "resolver" })}
                onSnooze={(id) => ack.mutate({ id, action: "snooze" })}
                onConcluir={(id) => concluir.mutate(id)}
              />
            ))}
            {grupos.atrasados.length === 0 && <Empty text="Nada atrasado." />}
          </Group>

          <Group title="Para hoje" subtitle={`${grupos.hoje.length} item(ns)`} tone="warning">
            {grupos.hoje.map((it) => (
              <ItemCard
                key={`${it.kind}-${it.data.id}`}
                item={it}
                onResolver={(id) => ack.mutate({ id, action: "resolver" })}
                onSnooze={(id) => ack.mutate({ id, action: "snooze" })}
                onConcluir={(id) => concluir.mutate(id)}
              />
            ))}
            {grupos.hoje.length === 0 && <Empty text="Sem itens com prazo hoje." />}
          </Group>

          <Group title="Esta semana" subtitle={`${grupos.semana.length} item(ns)`} tone="info">
            {grupos.semana.map((it) => (
              <ItemCard
                key={`${it.kind}-${it.data.id}`}
                item={it}
                onConcluir={(id) => concluir.mutate(id)}
              />
            ))}
            {grupos.semana.length === 0 && <Empty text="Sem itens na semana." />}
          </Group>

          {grupos.semPrazo.length > 0 && (
            <Group title="Suas tarefas sem prazo" subtitle={`${grupos.semPrazo.length} item(ns)`} tone="muted">
              {grupos.semPrazo.map((it) => (
                <ItemCard
                  key={`${it.kind}-${it.data.id}`}
                  item={it}
                  onConcluir={(id) => concluir.mutate(id)}
                />
              ))}
            </Group>
          )}
        </div>
      )}
    </PageShell>
  );
}

function Group({
  title,
  subtitle,
  tone,
  children,
}: {
  title: string;
  subtitle?: string;
  tone: "danger" | "warning" | "info" | "muted";
  children: React.ReactNode;
}) {
  const dot = {
    danger: "bg-destructive",
    warning: "bg-warning",
    info: "bg-info",
    muted: "bg-muted-foreground/40",
  }[tone];
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle && <span className="text-xs text-muted-foreground">· {subtitle}</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-card/30 p-4 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
