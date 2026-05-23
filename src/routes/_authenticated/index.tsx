import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/bj7/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet, Building2, Settings, AlertCircle, FileText,
  Target, ArrowRight, TrendingUp, KanbanSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertaRow } from "@/integrations/supabase/database";

export const Route = createFileRoute("/_authenticated/")({
  component: HomeHub,
});

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);

const SEV_ORDER: Record<string, number> = { critical: 0, warn: 1, info: 2 };
const SEV_LABEL: Record<string, string> = { critical: "Crítico", warn: "Alerta", info: "Info" };

const QUICK_NAV = [
  { to: "/financeiro", search: { tab: "lancamentos" }, title: "Financeiro", icon: Wallet, cls: "bg-emerald-500/15 text-emerald-500" },
  { to: "/hoje", title: "Hoje", icon: AlertCircle, cls: "bg-amber-500/15 text-amber-500" },
  { to: "/itens", title: "Cockpit", icon: KanbanSquare, cls: "bg-violet-500/15 text-violet-500" },
  { to: "/documentos", title: "Documentos", icon: FileText, cls: "bg-sky-500/15 text-sky-500" },
  { to: "/empresas", title: "Empresas", icon: Building2, cls: "bg-rose-500/15 text-rose-500" },
  { to: "/config", title: "Config", icon: Settings, cls: "bg-zinc-500/15 text-zinc-400" },
] as const;

function HomeHub() {
  const hoje = new Date();
  const mesRef = format(startOfMonth(hoje), "yyyy-MM-dd");
  const todayStr = format(hoje, "yyyy-MM-dd");
  const mesLabel = (() => {
    const s = format(hoje, "MMMM 'de' yyyy", { locale: ptBR });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  // DRE operacional do mês atual — todos os lançamentos com entra_dre_operacional
  const dreQ = useQuery({
    queryKey: ["home", "dre", mesRef],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await supabase
        .from("dre_consolidada")
        .select("tipo, entra_dre_operacional, valor_total")
        .eq("mes_ref", mesRef)
        .eq("entra_dre_operacional", true);
      if (r.error) throw r.error;
      const rows = (r.data ?? []) as { tipo: string; valor_total: number }[];
      const receita = rows.filter(x => x.tipo === "Receita").reduce((s, x) => s + Number(x.valor_total), 0);
      const despesa = rows.filter(x => x.tipo === "Despesa").reduce((s, x) => s + Number(x.valor_total), 0);
      return { receita, despesa, ebitda: receita - despesa };
    },
  });

  // Alertas abertos — ordenados por severidade no frontend
  const alertasQ = useQuery({
    queryKey: ["home", "alertas"],
    staleTime: 60_000,
    queryFn: async () => {
      const r = await supabase
        .from("alertas")
        .select("id, severidade, titulo")
        .eq("status", "aberto")
        .limit(20);
      if (r.error) throw r.error;
      const rows = (r.data ?? []) as Pick<AlertaRow, "id" | "severidade" | "titulo">[];
      return [...rows].sort((a, b) => (SEV_ORDER[a.severidade] ?? 9) - (SEV_ORDER[b.severidade] ?? 9));
    },
  });

  // Itens ativos do cockpit
  const itensQ = useQuery({
    queryKey: ["home", "itens"],
    staleTime: 60_000,
    queryFn: async () => {
      const r = await supabase
        .from("itens")
        .select("id, titulo, tipo, estado, prazo, decisao_tomada")
        .not("estado", "in", "(CONCLUIDO,ARQUIVADO)")
        .limit(500);
      if (r.error) throw r.error;
      return (r.data ?? []) as {
        id: number; titulo: string; tipo: string | null;
        estado: string | null; prazo: string | null; decisao_tomada: string | null;
      }[];
    },
  });

  // KPI de documentos vencendo
  const docsQ = useQuery({
    queryKey: ["home", "docs-kpi"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await supabase.schema("documentos" as never)
        .from("v_dashboard")
        .select("vencendo_30d, docs_vencidos")
        .limit(1);
      if (r.error) throw r.error;
      return (r.data?.[0] ?? { vencendo_30d: 0, docs_vencidos: 0 }) as {
        vencendo_30d: number; docs_vencidos: number;
      };
    },
  });

  const { decisoes, itensHoje, atrasados } = useMemo(() => {
    const all = itensQ.data ?? [];
    return {
      decisoes: all.filter(i => i.tipo === "DECISAO" && !i.decisao_tomada),
      itensHoje: all.filter(i => i.estado === "HOJE" || i.prazo === todayStr),
      atrasados: all.filter(i => i.prazo && i.prazo < todayStr),
    };
  }, [itensQ.data, todayStr]);

  const dre = dreQ.data;
  const margem = dre && dre.receita > 0 ? Math.round((dre.ebitda / dre.receita) * 100) : null;
  const criticos = (alertasQ.data ?? []).filter(a => a.severidade === "critical").length;

  return (
    <PageShell
      title="BJ7 Central"
      description={mesLabel}
    >
      {/* KPIs financeiros */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Receita operacional"
          value={dre ? fmtMoney(dre.receita) : null}
          loading={dreQ.isLoading}
          tone="success"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Despesa operacional"
          value={dre ? fmtMoney(dre.despesa) : null}
          loading={dreQ.isLoading}
          tone="neutral"
        />
        <KpiCard
          label="EBITDA operacional"
          value={dre ? fmtMoney(dre.ebitda) : null}
          loading={dreQ.isLoading}
          tone={!dre ? "neutral" : dre.ebitda >= 0 ? "success" : "danger"}
        />
        <KpiCard
          label="Margem EBITDA"
          value={margem !== null ? `${margem}%` : dre ? "—" : null}
          loading={dreQ.isLoading}
          tone={margem === null ? "neutral" : margem >= 30 ? "success" : margem >= 0 ? "warning" : "danger"}
        />
      </div>

      {/* Alertas + Cockpit */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Alertas */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Alertas abertos
              {criticos > 0 && (
                <Badge variant="destructive" className="text-[10px] ml-1">
                  {criticos} crítico{criticos > 1 ? "s" : ""}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {alertasQ.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)
            ) : (alertasQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum alerta aberto</p>
            ) : (
              <>
                {(alertasQ.data ?? []).slice(0, 6).map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5 text-sm">
                    <span className={cn(
                      "mt-1.5 h-2 w-2 rounded-full shrink-0",
                      a.severidade === "critical" ? "bg-destructive" :
                      a.severidade === "warn" ? "bg-amber-500" : "bg-blue-400"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="line-clamp-1">{a.titulo}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {SEV_LABEL[a.severidade] ?? a.severidade}
                      </div>
                    </div>
                  </div>
                ))}
                <Link
                  to="/inteligencia"
                  className="text-xs text-primary hover:underline flex items-center gap-1 pt-1"
                >
                  Ver todos ({alertasQ.data?.length})
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        {/* Cockpit resumo */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Cockpit
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1">
            {itensQ.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
            ) : (
              <>
                <CockpitRow label="Para hoje" count={itensHoje.length} to="/hoje"
                  tone={itensHoje.length > 0 ? "warning" : "ok"} />
                <CockpitRow label="Atrasados" count={atrasados.length} to="/hoje"
                  tone={atrasados.length > 0 ? "danger" : "ok"} />
                <CockpitRow label="Decisões pendentes" count={decisoes.length} to="/itens"
                  tone={decisoes.length > 3 ? "warning" : "ok"} />
                <CockpitRow
                  label="Documentos vencendo (30d)"
                  count={docsQ.data?.vencendo_30d ?? 0}
                  to="/documentos"
                  tone={(docsQ.data?.vencendo_30d ?? 0) > 0 ? "warning" : "ok"}
                  loading={docsQ.isLoading}
                />
                <CockpitRow
                  label="Documentos vencidos"
                  count={docsQ.data?.docs_vencidos ?? 0}
                  to="/documentos"
                  tone={(docsQ.data?.docs_vencidos ?? 0) > 0 ? "danger" : "ok"}
                  loading={docsQ.isLoading}
                />
              </>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Navegação rápida */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {QUICK_NAV.map((h) => (
          <Link
            key={h.to}
            to={h.to as never}
            search={"search" in h ? h.search as never : undefined}
            className="group flex flex-col items-center gap-1.5 rounded-xl bg-card px-2 py-3 ring-1 ring-white/5 hover:ring-primary/40 transition-all text-center"
          >
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", h.cls)}>
              <h.icon className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              {h.title}
            </span>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}

function KpiCard({ label, value, loading, tone, icon }: {
  label: string;
  value: string | null;
  loading: boolean;
  tone: "success" | "danger" | "warning" | "neutral";
  icon?: React.ReactNode;
}) {
  const valueCls = {
    success: "text-emerald-500",
    danger: "text-destructive",
    warning: "text-amber-500",
    neutral: "text-foreground",
  }[tone];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {icon}
          {label}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-28 mt-2" />
        ) : (
          <div className={cn("text-xl font-semibold mt-1 tabular-nums", valueCls)}>
            {value ?? "—"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CockpitRow({ label, count, to, tone, loading }: {
  label: string;
  count: number;
  to: string;
  tone: "danger" | "warning" | "ok";
  loading?: boolean;
}) {
  return (
    <Link
      to={to as never}
      className="flex items-center justify-between py-1.5 text-sm hover:text-primary transition-colors border-b border-border/40 last:border-0"
    >
      <span className="text-muted-foreground">{label}</span>
      {loading ? (
        <Skeleton className="h-5 w-8" />
      ) : (
        <span className={cn(
          "font-semibold tabular-nums",
          tone === "danger" ? "text-destructive" :
          tone === "warning" ? "text-amber-500" : "text-muted-foreground",
        )}>
          {count}
        </span>
      )}
    </Link>
  );
}
