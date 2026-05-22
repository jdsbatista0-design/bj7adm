import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/bj7/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fiscal/dashboard")({
  component: FiscalDashboardPage,
});

// ===== Tipagens das views =====
type DashboardRow = {
  pendentes_proxima_semana: number | null;
  atrasadas: number | null;
  cumpridas_mes: number | null;
  valor_a_pagar_30d: number | null;
};

type MonitoramentoSimplesRow = {
  empresa_id: number | string;
  empresa: string;
  faturamento_12m: number;
  limite: number;
  percentual: number;
  margem_restante: number;
  alerta: "OK" | "ATENCAO" | "CRITICO" | string;
};

type CriticidadeRow = "URGENTE" | "ATENCAO" | "NO_PRAZO" | "ATRASADA" | string;

type CalendarioRow = {
  id: number | string;
  empresa: string;
  obrigacao: string;
  competencia: string | null;
  vencimento: string;
  dias_para_vencer: number | null;
  valor: number | null;
  status: string;
  criticidade: CriticidadeRow;
};

const fmtBRL = (v: number | null | undefined) =>
  (Number(v ?? 0)).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

const fmtInt = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR");

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtCompetencia(v: string | null | undefined) {
  if (!v) return "—";
  // Aceita "YYYY-MM" ou "YYYY-MM-DD"
  const m = /^(\d{4})-(\d{2})/.exec(v);
  if (!m) return v;
  const ano = m[1];
  const mes = Number(m[2]) - 1;
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${meses[mes] ?? "?"}/${ano.slice(2)}`;
}

function FiscalDashboardPage() {
  const dashQ = useQuery({
    queryKey: ["fiscal", "v_dashboard"],
    queryFn: async () => {
      const r = await supabase
        .schema("fiscal")
        .from("v_dashboard")
        .select("*")
        .maybeSingle();
      if (r.error) throw r.error;
      return (r.data ?? {}) as DashboardRow;
    },
  });

  const simplesQ = useQuery({
    queryKey: ["fiscal", "v_monitoramento_simples"],
    queryFn: async () => {
      const r = await supabase
        .schema("fiscal")
        .from("v_monitoramento_simples")
        .select("*")
        .order("percentual", { ascending: false });
      if (r.error) throw r.error;
      return (r.data ?? []) as MonitoramentoSimplesRow[];
    },
  });

  const calendarioQ = useQuery({
    queryKey: ["fiscal", "v_calendario_proximo", "dashboard-preview"],
    queryFn: async () => {
      const limite = new Date();
      limite.setDate(limite.getDate() + 30);
      const limiteIso = limite.toISOString().slice(0, 10);
      const r = await supabase
        .schema("fiscal")
        .from("v_calendario_proximo")
        .select("*")
        .neq("status", "CUMPRIDA")
        .lte("vencimento", limiteIso)
        .order("vencimento", { ascending: true })
        .limit(15);
      if (r.error) throw r.error;
      return (r.data ?? []) as CalendarioRow[];
    },
  });

  const d = dashQ.data;

  return (
    <PageShell
      title="Dashboard Fiscal"
      description="Visão consolidada do compliance tributário do Grupo BJ7"
    >
      {/* KPIs */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Pendentes próxima semana"
          value={dashQ.isLoading ? null : fmtInt(d?.pendentes_proxima_semana)}
          icon={<Clock className="h-4 w-4" />}
          tone="muted"
        />
        <KpiCard
          label="Atrasadas"
          value={dashQ.isLoading ? null : fmtInt(d?.atrasadas)}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="danger"
        />
        <KpiCard
          label="Cumpridas no mês"
          value={dashQ.isLoading ? null : fmtInt(d?.cumpridas_mes)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
        <KpiCard
          label="A pagar em 30 dias"
          value={dashQ.isLoading ? null : fmtBRL(d?.valor_a_pagar_30d)}
          icon={<Wallet className="h-4 w-4" />}
          tone="muted"
        />
      </div>

      {/* Limite do Simples Nacional */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Limite do Simples Nacional
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Faturamento dos últimos 12 meses por empresa optante.
          </p>
        </div>

        {simplesQ.isLoading ? (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : (simplesQ.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma empresa optante pelo Simples Nacional.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {(simplesQ.data ?? []).map((s) => (
              <SimplesCard key={String(s.empresa_id)} row={s} />
            ))}
          </div>
        )}
      </section>

      {/* Calendário próximas obrigações */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Calendário — próximas obrigações
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Obrigações em aberto com vencimento nos próximos 30 dias.
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            {calendarioQ.isLoading ? (
              <div className="p-4 space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (calendarioQ.data ?? []).length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Nada vencendo nos próximos 30 dias 🎉
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Obrigação</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Dias</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(calendarioQ.data ?? []).map((row) => (
                      <TableRow key={String(row.id)}>
                        <TableCell className="font-medium">{row.empresa}</TableCell>
                        <TableCell>{row.obrigacao}</TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {fmtCompetencia(row.competencia)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {fmtDate(row.vencimento)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            (row.dias_para_vencer ?? 0) < 0 && "text-destructive font-semibold",
                          )}
                        >
                          {row.dias_para_vencer == null
                            ? "—"
                            : row.dias_para_vencer < 0
                              ? `${Math.abs(row.dias_para_vencer)} dias atrasada`
                              : row.dias_para_vencer}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.valor != null ? fmtBRL(row.valor) : "—"}
                        </TableCell>
                        <TableCell>
                          <CriticidadeBadge value={row.criticidade} status={row.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Link
            to="/fiscal/calendario"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Ver calendário completo <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {(dashQ.error || simplesQ.error || calendarioQ.error) && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            Falha ao carregar dados fiscais:{" "}
            {(dashQ.error as Error | undefined)?.message ??
              (simplesQ.error as Error | undefined)?.message ??
              (calendarioQ.error as Error | undefined)?.message}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}

// ===== Subcomponentes =====

function KpiCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | null;
  icon: React.ReactNode;
  tone: "muted" | "danger" | "success";
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
          {label}
        </CardTitle>
        <span
          className={cn(
            "text-muted-foreground",
            tone === "danger" && "text-destructive",
            tone === "success" && "text-success",
          )}
        >
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        {value === null ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <div
            className={cn(
              "text-2xl font-semibold tabular-nums",
              tone === "danger" && "text-destructive",
              tone === "success" && "text-success",
            )}
          >
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SimplesCard({ row }: { row: MonitoramentoSimplesRow }) {
  const pct = Math.max(0, Math.min(100, Number(row.percentual ?? 0)));
  const alerta = String(row.alerta ?? "").toUpperCase();
  // Cor baseada no alerta (com fallback por percentual)
  const tone: "ok" | "warn" | "crit" =
    alerta === "CRITICO" || pct >= 90
      ? "crit"
      : alerta === "ATENCAO" || pct >= 80
        ? "warn"
        : "ok";

  const barColor =
    tone === "crit" ? "bg-destructive" : tone === "warn" ? "bg-warning" : "bg-success";
  const labelColor =
    tone === "crit"
      ? "text-destructive"
      : tone === "warn"
        ? "text-warning"
        : "text-success";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold truncate">{row.empresa}</CardTitle>
          <span className={cn("text-xs font-semibold tabular-nums", labelColor)}>
            {pct.toFixed(1)}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {fmtBRL(row.faturamento_12m)} de {fmtBRL(row.limite ?? 4_800_000)}
        </div>
        <div className="text-xs tabular-nums">
          Margem restante:{" "}
          <span className={cn("font-semibold", labelColor)}>
            {fmtBRL(row.margem_restante)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function CriticidadeBadge({
  value,
  status,
}: {
  value: CriticidadeRow;
  status: string;
}) {
  const v = String(value ?? "").toUpperCase();
  const isAtrasada = v === "ATRASADA" || String(status ?? "").toUpperCase() === "ATRASADA";

  if (isAtrasada) {
    return (
      <Badge className="bg-destructive/90 text-destructive-foreground hover:bg-destructive">
        ATRASADA
      </Badge>
    );
  }
  if (v === "URGENTE") {
    return (
      <Badge className="bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/20">
        URGENTE
      </Badge>
    );
  }
  if (v === "ATENCAO") {
    return (
      <Badge className="bg-warning/15 text-warning border border-warning/30 hover:bg-warning/20">
        ATENÇÃO
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      NO PRAZO
    </Badge>
  );
}
