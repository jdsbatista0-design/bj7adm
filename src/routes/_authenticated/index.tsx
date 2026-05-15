import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { from, asRows } from "@/integrations/supabase/db";
import { useCurrentUser } from "@/contexts/auth-context";
import { useEmpresas } from "@/hooks/use-refs";
import { useItemDrawer } from "@/components/bj7/ItemDrawer";
import type { AlertaRow, TarefaRow, LancamentoRow } from "@/integrations/supabase/database";
import { PageShell, SectionHeader } from "@/components/bj7/PageShell";
import { KpiCard } from "@/components/bj7/KpiCard";
import { ItemCard, type UnifiedItem } from "@/components/bj7/ItemCard";
import { EmptyState } from "@/components/bj7/EmptyState";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Wallet,
  Sparkles,
  Loader2,
  ArrowRight,
  Building2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  component: Central,
});

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfPrevMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

function Central() {
  const user = useCurrentUser();
  const empresas = useEmpresas();
  const drawer = useItemDrawer();
  const qc = useQueryClient();

  // ---------- Dados ----------
  const periodo = useMemo(() => {
    const now = new Date();
    const inicioMes = startOfMonth(now);
    const inicioMesAnt = startOfPrevMonth(now);
    return {
      inicioMes: inicioMes.toISOString().slice(0, 10),
      inicioMesAnt: inicioMesAnt.toISOString().slice(0, 10),
      fimMesAnt: inicioMes.toISOString().slice(0, 10),
      // fim aberto = futuro
    };
  }, []);

  const lanc = useQuery({
    queryKey: ["central", "lancamentos", periodo.inicioMesAnt, user.id],
    queryFn: async () => {
      let q = from("lancamentos")
        .select("id,data,empresa_id,tipo,valor,contar_no_total,status,revisado,categoria_id")
        .gte("data", periodo.inicioMesAnt)
        .eq("contar_no_total", true)
        .in("tipo", ["Receita", "Despesa"]);
      if (!user.ve_todas_empresas) {
        if (user.empresas_ids.length === 0) return [];
        q = q.in("empresa_id", user.empresas_ids);
      }
      const r = await q.limit(50000);
      if (r.error) throw r.error;
      return asRows("lancamentos", r.data);
    },
  });

  const alertasQ = useQuery({
    queryKey: ["central", "alertas"],
    queryFn: async () => {
      const r = await supabase
        .from("alertas")
        .select("*")
        .in("status", ["aberto", "ack"])
        .order("severidade", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(100);
      if (r.error) throw r.error;
      return (r.data ?? []) as AlertaRow[];
    },
  });

  const tarefasQ = useQuery({
    queryKey: ["central", "tarefas"],
    queryFn: async () => {
      const r = await supabase
        .from("tarefas")
        .select("*")
        .in("status", ["aberta", "em_andamento", "aguardando"])
        .order("prioridade", { ascending: false })
        .order("prazo", { ascending: true, nullsFirst: false })
        .limit(200);
      if (r.error) throw r.error;
      return (r.data ?? []) as TarefaRow[];
    },
  });

  // ---------- Agregações ----------
  const agg = useMemo(() => {
    const rows = lanc.data ?? [];
    const inicioMes = periodo.inicioMes;
    const isMesAtual = (d: string) => d >= inicioMes;
    const isMesAnt = (d: string) => d >= periodo.inicioMesAnt && d < periodo.fimMesAnt;

    const sum = (rs: LancamentoRow[]) =>
      rs.reduce((s, r) => s + Math.abs(Number(r.valor) || 0), 0);

    const recMes = sum(rows.filter((r) => r.tipo === "Receita" && isMesAtual(r.data)));
    const despMes = sum(rows.filter((r) => r.tipo === "Despesa" && isMesAtual(r.data)));
    const recAnt = sum(rows.filter((r) => r.tipo === "Receita" && isMesAnt(r.data)));
    const despAnt = sum(rows.filter((r) => r.tipo === "Despesa" && isMesAnt(r.data)));

    const margem = recMes > 0 ? ((recMes - despMes) / recMes) * 100 : 0;
    const margemAnt = recAnt > 0 ? ((recAnt - despAnt) / recAnt) * 100 : 0;

    const trendReceita = recAnt > 0 ? (recMes - recAnt) / recAnt : null;
    const trendDespesa = despAnt > 0 ? (despMes - despAnt) / despAnt : null;
    const trendMargem = margemAnt !== 0 ? (margem - margemAnt) / Math.abs(margemAnt) : null;

    // Dinheiro parado: receitas com status aberto/pendente + receitas não revisadas
    const dinheiroParado = sum(
      rows.filter(
        (r) =>
          r.tipo === "Receita" &&
          (!r.revisado ||
            (r.status &&
              ["aberto", "pendente", "em aberto", "atrasado"].some((s) =>
                (r.status ?? "").toLowerCase().includes(s),
              ))),
      ),
    );

    // Resultado por empresa (mês atual)
    const porEmpresa = new Map<number, { rec: number; desp: number }>();
    for (const r of rows.filter((r) => isMesAtual(r.data))) {
      const e = porEmpresa.get(r.empresa_id) ?? { rec: 0, desp: 0 };
      const v = Math.abs(Number(r.valor) || 0);
      if (r.tipo === "Receita") e.rec += v;
      else e.desp += v;
      porEmpresa.set(r.empresa_id, e);
    }

    return {
      recMes,
      despMes,
      margem,
      dinheiroParado,
      trendReceita,
      trendDespesa,
      trendMargem,
      porEmpresa,
    };
  }, [lanc.data, periodo]);

  const criticos = (alertasQ.data ?? []).filter(
    (a) => a.severidade === "critical" && a.status === "aberto",
  );
  const exigeAtencao: UnifiedItem[] = useMemo(() => {
    const al = (alertasQ.data ?? [])
      .filter((a) => a.severidade !== "info" && a.status !== "snoozed")
      .slice(0, 5)
      .map((a) => ({ kind: "alerta" as const, data: a }));
    const tr = (tarefasQ.data ?? [])
      .filter(
        (t) =>
          t.prioridade === "urgente" ||
          t.prioridade === "alta" ||
          (t.prazo && new Date(t.prazo).getTime() < Date.now()),
      )
      .slice(0, 5)
      .map((t) => ({ kind: "tarefa" as const, data: t }));
    return [...al, ...tr].slice(0, 7);
  }, [alertasQ.data, tarefasQ.data]);

  // ---------- Mutations ----------
  const ack = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "resolver" | "snooze" }) => {
      const fn = action === "resolver" ? "resolver_alerta" : "snooze_alerta";
      const params = action === "snooze" ? { _id: id, _horas: 24 } : { _id: id };
      const r = await supabase.rpc(fn, params);
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["central"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const concluir = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.rpc("concluir_tarefa", { _id: id });
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["central"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const motor = useMutation({
    mutationFn: async () => {
      const r = await supabase.rpc("executar_regras");
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Motor de regras executado");
      qc.invalidateQueries({ queryKey: ["central"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---------- Render ----------
  const loading = lanc.isLoading || alertasQ.isLoading || tarefasQ.isLoading;

  return (
    <PageShell
      title={`Olá, ${user.nome?.split(" ")[0] ?? user.email?.split("@")[0]}`}
      description={new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      })}
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => motor.mutate()}
          disabled={motor.isPending}
        >
          {motor.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Rodar motor
        </Button>
      }
    >
      {/* ===== Saúde do Grupo ===== */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Receita do mês"
            value={formatBRL(agg.recMes)}
            trend={agg.trendReceita}
            status={agg.recMes > 0 ? "ok" : "neutral"}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <KpiCard
            label="Despesas do mês"
            value={formatBRL(agg.despMes)}
            trend={agg.trendDespesa != null ? -agg.trendDespesa : null}
            status={agg.despMes > agg.recMes ? "atencao" : "neutral"}
            icon={<TrendingDown className="h-4 w-4" />}
          />
          <KpiCard
            label="Margem"
            value={`${agg.margem.toFixed(1)}%`}
            trend={agg.trendMargem}
            status={agg.margem >= 20 ? "ok" : agg.margem >= 0 ? "atencao" : "critico"}
          />
          <KpiCard
            label="Dinheiro parado"
            value={formatBRL(agg.dinheiroParado)}
            hint="Receitas abertas / não revisadas"
            status={agg.dinheiroParado > 0 ? "atencao" : "ok"}
            icon={<Wallet className="h-4 w-4" />}
          />
          <KpiCard
            label="Items críticos"
            value={criticos.length}
            hint={`${tarefasQ.data?.filter((t) => t.prazo && new Date(t.prazo) < new Date()).length ?? 0} tarefas atrasadas`}
            status={criticos.length > 0 ? "critico" : "ok"}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* ===== Exige minha atenção + Hoje ===== */}
      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <SectionHeader
            title="Exige minha atenção"
            description="Alertas críticos e tarefas urgentes do dia"
            action={
              <Link to="/hoje" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                Ver tudo <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          {loading && exigeAtencao.length === 0 ? (
            <SkeletonItems />
          ) : exigeAtencao.length === 0 ? (
            <EmptyState
              title="Tudo sob controle"
              description="Nenhum alerta crítico ou tarefa urgente no momento."
              action={
                <Button size="sm" variant="outline" onClick={() => drawer.open()}>
                  <Plus className="h-4 w-4 mr-1" /> Criar Item
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {exigeAtencao.map((it) => (
                <ItemCard
                  key={`${it.kind}-${it.data.id}`}
                  item={it}
                  onResolver={(id) => ack.mutate({ id, action: "resolver" })}
                  onSnooze={(id) => ack.mutate({ id, action: "snooze" })}
                  onConcluir={(id) => concluir.mutate(id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Dinheiro parado breakdown */}
        <section>
          <SectionHeader
            title="Dinheiro parado"
            description="Receitas em aberto + não revisadas"
          />
          <div
            className="rounded-2xl bg-card p-5 ring-1 ring-white/5"
            style={{ boxShadow: "var(--shadow-elegant)" }}
          >
            <div className="text-3xl font-semibold tabular tracking-tight">
              {formatBRL(agg.dinheiroParado)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Some o que ainda não virou caixa: receitas em aberto, lançamentos pendentes de revisão.
            </p>
            <div className="mt-4 grid gap-2 text-xs">
              <Link
                to="/a-revisar"
                className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 hover:bg-muted/60 transition"
              >
                <span>Lançamentos a revisar</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/razao"
                className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 hover:bg-muted/60 transition"
              >
                <span>Ver razão completo</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* ===== Empresas ===== */}
      <section>
        <SectionHeader
          title="Empresas do grupo"
          description="Receita / margem / items abertos por empresa neste mês"
          action={
            <Link to="/empresas" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(empresas.data ?? []).map((e) => {
            const a = agg.porEmpresa.get(e.id) ?? { rec: 0, desp: 0 };
            const margem = a.rec > 0 ? ((a.rec - a.desp) / a.rec) * 100 : 0;
            const itensEmpresa =
              (alertasQ.data ?? []).filter((al) => al.empresa_id === e.id && al.status === "aberto").length +
              (tarefasQ.data ?? []).filter((t) => t.empresa_id === e.id).length;
            const score = computeScore({ margem, hasReceita: a.rec > 0, items: itensEmpresa });
            return (
              <Link
                key={e.id}
                to="/empresas/$id"
                params={{ id: String(e.id) }}
                className="rounded-2xl bg-card p-4 ring-1 ring-white/5 hover:ring-primary/30 transition"
                style={{ boxShadow: "var(--shadow-elegant)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{e.nome}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {itensEmpresa} item{itensEmpresa === 1 ? "" : "s"} aberto{itensEmpresa === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <ScoreBadge score={score} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Receita" value={formatBRL(a.rec)} tone="success" />
                  <Stat label="Despesa" value={formatBRL(a.desp)} tone="muted" />
                  <Stat
                    label="Margem"
                    value={a.rec > 0 ? `${margem.toFixed(0)}%` : "—"}
                    tone={margem >= 20 ? "success" : margem >= 0 ? "warning" : "danger"}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}

function computeScore({
  margem,
  hasReceita,
  items,
}: {
  margem: number;
  hasReceita: boolean;
  items: number;
}): number {
  if (!hasReceita) return 50;
  let s = 50;
  s += Math.min(35, Math.max(-35, margem)); // margem ± 35
  s -= Math.min(20, items * 2); // 2 pts por item aberto, máx -20
  return Math.max(0, Math.min(100, Math.round(s)));
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-destructive";
  return (
    <div className="text-right">
      <div className={`text-xl font-bold tabular ${tone}`}>{score}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">score</div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "danger" | "muted";
}) {
  const cls = {
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
    muted: "text-foreground",
  }[tone];
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-xs font-semibold tabular truncate ${cls}`}>{value}</div>
    </div>
  );
}

function SkeletonItems() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl bg-card p-3 ring-1 ring-white/5 animate-pulse h-16" />
      ))}
    </div>
  );
}
