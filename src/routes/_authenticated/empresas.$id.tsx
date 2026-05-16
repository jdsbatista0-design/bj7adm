import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { from, paginateAll } from "@/integrations/supabase/db";
import { useEmpresas } from "@/hooks/use-refs";
import { PageShell, SectionHeader } from "@/components/bj7/PageShell";
import { KpiCard } from "@/components/bj7/KpiCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatBRL, MESES_PT, toLocalIsoDate } from "@/lib/format";
import {
  ArrowLeft,
  Wallet,
  TrendingDown,
  PiggyBank,
  Percent,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresas/$id")({
  component: EmpresaDetalhe,
});

type PeriodoKey =
  | "mes_atual"
  | "mes_anterior"
  | "ult_3m"
  | "ult_6m"
  | "ult_12m"
  | "ano_atual";

const PERIODOS: { key: PeriodoKey; label: string }[] = [
  { key: "mes_atual", label: "Mês atual" },
  { key: "mes_anterior", label: "Mês anterior" },
  { key: "ult_3m", label: "Últimos 3 meses" },
  { key: "ult_6m", label: "Últimos 6 meses" },
  { key: "ult_12m", label: "Últimos 12 meses" },
  { key: "ano_atual", label: "Ano atual" },
];

function isoDate(d: Date) {
  return toLocalIsoDate(d);
}

function rangesFor(p: PeriodoKey) {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  let start: Date;
  let end: Date;
  if (p === "mes_atual") {
    start = new Date(y, m, 1);
    end = new Date(y, m + 1, 1);
  } else if (p === "mes_anterior") {
    start = new Date(y, m - 1, 1);
    end = new Date(y, m, 1);
  } else if (p === "ult_3m") {
    start = new Date(y, m - 2, 1);
    end = new Date(y, m + 1, 1);
  } else if (p === "ult_6m") {
    start = new Date(y, m - 5, 1);
    end = new Date(y, m + 1, 1);
  } else if (p === "ult_12m") {
    start = new Date(y, m - 11, 1);
    end = new Date(y, m + 1, 1);
  } else {
    start = new Date(y, 0, 1);
    end = new Date(y + 1, 0, 1);
  }
  const ms = end.getTime() - start.getTime();
  const endPrev = new Date(start.getTime());
  const startPrev = new Date(start.getTime() - ms);
  return {
    start: isoDate(start),
    end: isoDate(end),
    startPrev: isoDate(startPrev),
    endPrev: isoDate(endPrev),
  };
}

// Ordem fixa de exibição da DRE — define como os grupos aparecem
const ORDEM_DRE: {
  grupo: string;
  label: string;
  tipo: "receita" | "subtracao" | "neutro";
}[] = [
  { grupo: "receita_bruta", label: "Receita Bruta", tipo: "receita" },
  { grupo: "receita_locacao", label: "Receita de Locação", tipo: "receita" },
  { grupo: "desp_impostos", label: "(-) Impostos", tipo: "subtracao" },
  { grupo: "desp_pessoal", label: "(-) Pessoal", tipo: "subtracao" },
  { grupo: "desp_pessoal_terceiro", label: "(-) Pessoal Terceirizado", tipo: "subtracao" },
  { grupo: "desp_comissao", label: "(-) Comissões/Bonificações", tipo: "subtracao" },
  { grupo: "desp_beneficios_veiculo", label: "(-) Veículos e Benefícios", tipo: "subtracao" },
  { grupo: "desp_aluguel", label: "(-) Aluguel", tipo: "subtracao" },
  { grupo: "desp_utilities", label: "(-) Água/Luz/Gás/Internet", tipo: "subtracao" },
  { grupo: "desp_administrativa", label: "(-) Administrativas", tipo: "subtracao" },
  { grupo: "desp_servicos", label: "(-) Serviços Terceiros", tipo: "subtracao" },
  { grupo: "desp_marketing", label: "(-) Marketing", tipo: "subtracao" },
  { grupo: "desp_seguranca", label: "(-) Segurança e Seguros", tipo: "subtracao" },
  { grupo: "desp_financeira", label: "(-) Despesas Financeiras", tipo: "subtracao" },
  { grupo: "desp_nao_classificada", label: "(-) Não Classificado", tipo: "subtracao" },
  { grupo: "investimento_capex", label: "(-) CAPEX/Investimentos", tipo: "subtracao" },
];

type DreRow = { grupo: string; tipo: string; valor_total: number; mes_ref: string };

function EmpresaDetalhe() {
  const { id } = Route.useParams();
  const empresaId = Number(id);
  const empresas = useEmpresas();
  const empresa = empresas.data?.find((e) => e.id === empresaId);

  const [periodoKey, setPeriodoKey] = useState<PeriodoKey>("mes_atual");
  const periodo = useMemo(() => rangesFor(periodoKey), [periodoKey]);

  const dreQ = useQuery({
    queryKey: ["empresa", empresaId, "dre", periodo.start, periodo.end],
    queryFn: () =>
      paginateAll<DreRow>((fromIdx, toIdx) =>
        from("dre_view" as never)
          .select("grupo,tipo,valor_total,mes_ref,empresa_id")
          .eq("empresa_id", empresaId)
          .gte("mes_ref", periodo.start)
          .lt("mes_ref", periodo.end)
          .order("mes_ref", { ascending: true })
          .range(fromIdx, toIdx),
      ),
  });

  const dreAntQ = useQuery({
    queryKey: ["empresa", empresaId, "dre-ant", periodo.startPrev, periodo.endPrev],
    queryFn: () =>
      paginateAll<DreRow>((fromIdx, toIdx) =>
        from("dre_view" as never)
          .select("grupo,tipo,valor_total,empresa_id,mes_ref")
          .eq("empresa_id", empresaId)
          .gte("mes_ref", periodo.startPrev)
          .lt("mes_ref", periodo.endPrev)
          .order("mes_ref", { ascending: true })
          .range(fromIdx, toIdx),
      ),
  });

  const evolQ = useQuery({
    queryKey: ["empresa", empresaId, "evol12m"],
    queryFn: () => {
      const hoje = new Date();
      const start = isoDate(new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1));
      return paginateAll<DreRow>((fromIdx, toIdx) =>
        from("dre_view" as never)
          .select("tipo,valor_total,mes_ref,empresa_id")
          .eq("empresa_id", empresaId)
          .gte("mes_ref", start)
          .order("mes_ref", { ascending: true })
          .range(fromIdx, toIdx),
      );
    },
  });

  const dre = useMemo(() => {
    const rows = dreQ.data ?? [];
    const rowsAnt = dreAntQ.data ?? [];

    const sumGrupo = (rs: DreRow[], grupo: string) =>
      rs.filter((r) => r.grupo === grupo).reduce((s, r) => s + Number(r.valor_total || 0), 0);
    const sumTipo = (rs: DreRow[], tipo: string) =>
      rs.filter((r) => r.tipo === tipo).reduce((s, r) => s + Number(r.valor_total || 0), 0);

    // Receita e Despesa totais vêm SEMPRE por tipo — assim qualquer grupo
    // novo cadastrado no Supabase (ex.: "outras_receitas") é contabilizado
    // mesmo que ainda não esteja listado em ORDEM_DRE.
    const receita = sumTipo(rows, "Receita");
    const receitaAnt = sumTipo(rowsAnt, "Receita");

    const despesa = sumTipo(rows, "Despesa");
    const despesaAnt = sumTipo(rowsAnt, "Despesa");

    const lucro = receita - despesa;
    const lucroAnt = receitaAnt - despesaAnt;
    const margem = receita > 0 ? (lucro / receita) * 100 : 0;
    const margemAnt = receitaAnt > 0 ? (lucroAnt / receitaAnt) * 100 : 0;

    const trend = (cur: number, ant: number) => (ant > 0 ? (cur - ant) / ant : null);

    const linhas = ORDEM_DRE.map((d) => {
      const valor = sumGrupo(rows, d.grupo);
      const valorAnt = sumGrupo(rowsAnt, d.grupo);
      const pctReceita = receita > 0 ? (valor / receita) * 100 : 0;
      const variacao = trend(valor, valorAnt);
      return { ...d, valor, valorAnt, pctReceita, variacao };
    }).filter((l) => l.valor > 0 || l.valorAnt > 0);

    // "Outros" — quaisquer grupos retornados pela view que ainda não
    // foram mapeados em ORDEM_DRE. Garante que a soma da tabela bata
    // com os KPIs (que somam por tipo, não por grupo conhecido).
    const conhecidos = new Set(ORDEM_DRE.map((d) => d.grupo));
    const outrosReceitaCur = rows
      .filter((r) => r.tipo === "Receita" && !conhecidos.has(r.grupo))
      .reduce((s, r) => s + Number(r.valor_total || 0), 0);
    const outrosReceitaAnt = rowsAnt
      .filter((r) => r.tipo === "Receita" && !conhecidos.has(r.grupo))
      .reduce((s, r) => s + Number(r.valor_total || 0), 0);
    const outrosDespCur = rows
      .filter((r) => r.tipo === "Despesa" && !conhecidos.has(r.grupo))
      .reduce((s, r) => s + Number(r.valor_total || 0), 0);
    const outrosDespAnt = rowsAnt
      .filter((r) => r.tipo === "Despesa" && !conhecidos.has(r.grupo))
      .reduce((s, r) => s + Number(r.valor_total || 0), 0);

    if (outrosReceitaCur > 0 || outrosReceitaAnt > 0) {
      linhas.push({
        grupo: "__outros_receita",
        label: "Outras Receitas",
        tipo: "receita",
        valor: outrosReceitaCur,
        valorAnt: outrosReceitaAnt,
        pctReceita: receita > 0 ? (outrosReceitaCur / receita) * 100 : 0,
        variacao: trend(outrosReceitaCur, outrosReceitaAnt),
      });
    }
    if (outrosDespCur > 0 || outrosDespAnt > 0) {
      linhas.push({
        grupo: "__outros_despesa",
        label: "(-) Outras Despesas",
        tipo: "subtracao",
        valor: outrosDespCur,
        valorAnt: outrosDespAnt,
        pctReceita: receita > 0 ? (outrosDespCur / receita) * 100 : 0,
        variacao: trend(outrosDespCur, outrosDespAnt),
      });
    }

    return {
      receita,
      despesa,
      lucro,
      margem,
      receitaAnt,
      despesaAnt,
      lucroAnt,
      margemAnt,
      trendRec: trend(receita, receitaAnt),
      trendDesp: trend(despesa, despesaAnt),
      trendLucro: trend(lucro, lucroAnt),
      trendMargemPp: margem - margemAnt,
      linhas,
    };
  }, [dreQ.data, dreAntQ.data]);

  const evolucao = useMemo(() => {
    const rows = evolQ.data ?? [];
    const buckets = new Map<string, { receita: number; despesa: number }>();
    const hoje = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, { receita: 0, despesa: 0 });
    }
    for (const r of rows) {
      const key = (r.mes_ref ?? "").slice(0, 7);
      const b = buckets.get(key);
      if (!b) continue;
      const v = Number(r.valor_total || 0);
      if (r.tipo === "Receita") b.receita += v;
      else if (r.tipo === "Despesa") b.despesa += v;
    }
    return Array.from(buckets.entries()).map(([key, v]) => {
      const [y, m] = key.split("-").map(Number);
      return {
        mes: `${MESES_PT[m - 1]}/${String(y).slice(2)}`,
        receita: Math.round(v.receita),
        despesa: Math.round(v.despesa),
        lucro: Math.round(v.receita - v.despesa),
      };
    });
  }, [evolQ.data]);

  const loading = dreQ.isLoading || dreAntQ.isLoading;
  const labelPeriodo = PERIODOS.find((p) => p.key === periodoKey)?.label ?? "";

  return (
    <PageShell
      title={empresa?.nome ?? `Empresa #${empresaId}`}
      description={`DRE — ${labelPeriodo}`}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/empresas">
              <ArrowLeft className="h-4 w-4 mr-1" /> Empresas
            </Link>
          </Button>
          <Select value={periodoKey} onValueChange={(v) => setPeriodoKey(v as PeriodoKey)}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      {/* KPIs */}
      <section>
        <SectionHeader title="Resumo do período" description={labelPeriodo} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Receita"
            value={formatBRL(dre.receita)}
            trend={dre.trendRec}
            icon={<Wallet className="h-4 w-4" />}
            status="neutral"
          />
          <KpiCard
            label="Despesa"
            value={formatBRL(dre.despesa)}
            trend={dre.trendDesp}
            icon={<TrendingDown className="h-4 w-4" />}
            status={dre.trendDesp != null && dre.trendDesp > 0.1 ? "atencao" : "neutral"}
          />
          <KpiCard
            label="Lucro"
            value={formatBRL(dre.lucro)}
            trend={dre.trendLucro}
            icon={<PiggyBank className="h-4 w-4" />}
            status={dre.lucro < 0 ? "critico" : "ok"}
          />
          <KpiCard
            label="Margem"
            value={dre.receita > 0 ? `${dre.margem.toFixed(1)}%` : "—"}
            hint={
              dre.receita > 0
                ? `${dre.trendMargemPp >= 0 ? "+" : ""}${dre.trendMargemPp.toFixed(1)} pp vs anterior`
                : undefined
            }
            icon={<Percent className="h-4 w-4" />}
            status={dre.margem < 0 ? "critico" : dre.margem < 10 ? "atencao" : "ok"}
          />
        </div>
      </section>

      {/* DRE Detalhada */}
      <section>
        <SectionHeader title="DRE detalhada" description="Agrupado por grupo da categoria" />
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right w-28">% Receita</TableHead>
                  <TableHead className="text-right w-32">vs Anterior</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && dre.linhas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Sem dados no período selecionado.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  dre.linhas.map((l) => {
                    const cor =
                      l.tipo === "receita"
                        ? "text-success"
                        : l.valor > 0
                          ? ""
                          : "text-muted-foreground";
                    const varCor =
                      l.variacao == null
                        ? "text-muted-foreground"
                        : l.variacao > 0.05
                          ? l.tipo === "receita"
                            ? "text-success"
                            : "text-destructive"
                          : l.variacao < -0.05
                            ? l.tipo === "receita"
                              ? "text-destructive"
                              : "text-success"
                            : "text-muted-foreground";
                    return (
                      <TableRow key={l.grupo}>
                        <TableCell className="text-sm">{l.label}</TableCell>
                        <TableCell className={`text-right tabular-nums ${cor}`}>
                          {formatBRL(l.valor)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                          {dre.receita > 0 ? `${l.pctReceita.toFixed(1)}%` : "—"}
                        </TableCell>
                        <TableCell className={`text-right text-xs tabular-nums ${varCor}`}>
                          {l.variacao == null
                            ? "—"
                            : `${l.variacao >= 0 ? "+" : ""}${(l.variacao * 100).toFixed(1)}%`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {!loading && dre.linhas.length > 0 && (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Resultado Operacional</TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${dre.lucro < 0 ? "text-destructive" : "text-success"}`}
                    >
                      {formatBRL(dre.lucro)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {dre.receita > 0 ? `${dre.margem.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {dre.receita > 0
                        ? `${dre.trendMargemPp >= 0 ? "+" : ""}${dre.trendMargemPp.toFixed(1)} pp`
                        : "—"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Gráfico evolução 12m */}
      <section>
        <SectionHeader title="Evolução últimos 12 meses" />
        <Card>
          <CardContent className="p-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      new Intl.NumberFormat("pt-BR", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(v as number)
                    }
                  />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="receita"
                    name="Receita"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="despesa"
                    name="Despesa"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="lucro"
                    name="Lucro"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
