import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { from, asRows } from "@/integrations/supabase/db";
import { useEmpresas } from "@/hooks/use-refs";
import type { AlertaRow, LancamentoRow, TarefaRow } from "@/integrations/supabase/database";
import { PageShell, SectionHeader } from "@/components/bj7/PageShell";
import { ItemCard } from "@/components/bj7/ItemCard";
import { EmptyState } from "@/components/bj7/EmptyState";
import { Button } from "@/components/ui/button";
import { useItemDrawer } from "@/components/bj7/ItemDrawer";
import { formatBRL } from "@/lib/format";
import { ArrowLeft, Plus, Store } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/empresas/$id")({
  component: EmpresaDetalhe,
});

function EmpresaDetalhe() {
  const { id } = Route.useParams();
  const empresaId = Number(id);
  const empresas = useEmpresas();
  const drawer = useItemDrawer();
  const qc = useQueryClient();
  const empresa = empresas.data?.find((e) => e.id === empresaId);
  const isStone = (empresa?.nome ?? "").toLowerCase().includes("stone");

  const startMonth = useMemo(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    [],
  );

  const lancQ = useQuery({
    queryKey: ["empresa", empresaId, "lanc", startMonth],
    queryFn: async () => {
      const r = await from("lancamentos")
        .select("tipo,valor,data,contar_no_total")
        .eq("empresa_id", empresaId)
        .gte("data", startMonth)
        .eq("contar_no_total", true)
        .limit(20000);
      if (r.error) throw r.error;
      return asRows("lancamentos", r.data);
    },
  });

  const alertasQ = useQuery({
    queryKey: ["empresa", empresaId, "alertas"],
    queryFn: async () => {
      const r = await supabase
        .from("alertas")
        .select("*")
        .eq("empresa_id", empresaId)
        .in("status", ["aberto", "ack"])
        .limit(200);
      if (r.error) throw r.error;
      return (r.data ?? []) as AlertaRow[];
    },
  });

  const tarefasQ = useQuery({
    queryKey: ["empresa", empresaId, "tarefas"],
    queryFn: async () => {
      const r = await supabase
        .from("tarefas")
        .select("*")
        .eq("empresa_id", empresaId)
        .in("status", ["aberta", "em_andamento", "aguardando"])
        .limit(500);
      if (r.error) throw r.error;
      return (r.data ?? []) as TarefaRow[];
    },
  });

  const tot = useMemo(() => {
    const rows = (lancQ.data ?? []) as LancamentoRow[];
    const rec = rows
      .filter((r) => r.tipo === "Receita")
      .reduce((s, r) => s + Math.abs(Number(r.valor) || 0), 0);
    const desp = rows
      .filter((r) => r.tipo === "Despesa")
      .reduce((s, r) => s + Math.abs(Number(r.valor) || 0), 0);
    return { rec, desp, margem: rec > 0 ? ((rec - desp) / rec) * 100 : 0 };
  }, [lancQ.data]);

  const ack = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "resolver" | "snooze" }) => {
      const fn = action === "resolver" ? "resolver_alerta" : "snooze_alerta";
      const params = action === "snooze" ? { _id: id, _horas: 24 } : { _id: id };
      const r = await supabase.rpc(fn, params);
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empresa", empresaId] }),
  });
  const concluir = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.rpc("concluir_tarefa", { _id: id });
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empresa", empresaId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell
      title={empresa?.nome ?? `Empresa #${empresaId}`}
      description="Saúde financeira, items abertos e ações"
      actions={
        <div className="flex items-center gap-2">
          <Link to="/empresas" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Empresas
          </Link>
          <Button size="sm" onClick={() => drawer.open({ empresa_id: empresaId })}>
            <Plus className="h-4 w-4 mr-1" /> Item
          </Button>
        </div>
      }
    >
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Receita do mês" value={formatBRL(tot.rec)} />
        <Stat label="Despesa do mês" value={formatBRL(tot.desp)} />
        <Stat label="Margem" value={tot.rec > 0 ? `${tot.margem.toFixed(1)}%` : "—"} />
      </div>

      {isStone && (
        <Link
          to="/stone"
          className="rounded-2xl bg-card p-4 ring-1 ring-white/5 hover:ring-primary/30 transition flex items-center justify-between"
          style={{ boxShadow: "var(--shadow-elegant)" }}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-primary">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Painel Stone</div>
              <div className="text-xs text-muted-foreground">Rebate, base, churn, clientes sumidos</div>
            </div>
          </div>
          <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
        </Link>
      )}

      <section>
        <SectionHeader title="Items abertos" description="Alertas + tarefas desta empresa" />
        {(alertasQ.data ?? []).length === 0 && (tarefasQ.data ?? []).length === 0 ? (
          <EmptyState title="Nada aberto" description="Sem alertas ou tarefas para esta empresa." />
        ) : (
          <div className="space-y-2">
            {(alertasQ.data ?? []).map((a) => (
              <ItemCard
                key={`a-${a.id}`}
                item={{ kind: "alerta", data: a }}
                onResolver={(id) => ack.mutate({ id, action: "resolver" })}
                onSnooze={(id) => ack.mutate({ id, action: "snooze" })}
              />
            ))}
            {(tarefasQ.data ?? []).map((t) => (
              <ItemCard
                key={`t-${t.id}`}
                item={{ kind: "tarefa", data: t }}
                onConcluir={(id) => concluir.mutate(id)}
              />
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-white/5" style={{ boxShadow: "var(--shadow-elegant)" }}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular">{value}</div>
    </div>
  );
}
