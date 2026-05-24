import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresas } from "@/hooks/use-refs";
import { PageShell } from "@/components/bj7/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatBRL, MESES_PT, toLocalIsoDate } from "@/lib/format";
import { ChevronRight, ChevronDown, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DreOperacionalRow } from "@/integrations/supabase/database";

export const Route = createFileRoute("/_authenticated/financeiro/dre-consolidado")({
  component: DrePage,
});

const MIN_YEAR = 2020;
function anosOpts() {
  const y = new Date().getFullYear();
  const out: number[] = [];
  for (let i = y; i >= MIN_YEAR; i--) out.push(i);
  return out;
}

function DrePage() {
  const empresasQ = useEmpresas();
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const start = toLocalIsoDate(new Date(ano, 0, 1));
  const end = toLocalIsoDate(new Date(ano + 1, 0, 1));

  const dreQ = useQuery({
    queryKey: ["dre-cons", ano, empresaId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      let q = supabase
        .from("dre_operacional")
        .select("empresa_id,mes_ref,tipo,grupo,categoria,valor_total")
        .gte("mes_ref", start)
        .lt("mes_ref", end);
      if (empresaId !== "all") q = q.eq("empresa_id", Number(empresaId));
      const r = await q;
      if (r.error) throw r.error;
      return (r.data ?? []) as (DreOperacionalRow & { tipo?: string | null })[];
    },
  });

  const dre = useMemo(() => {
    const rows = dreQ.data ?? [];
    // tipos: Receita / Despesa / Retirada → ordem e sinal
    type Cat = { categoria: string; meses: number[]; total: number };
    type Grp = { grupo: string; categorias: Map<string, Cat>; meses: number[]; total: number };
    type Tip = { tipo: string; grupos: Map<string, Grp>; meses: number[]; total: number };

    const tipos = new Map<string, Tip>();

    for (const r of rows) {
      const tipo = (r as { tipo?: string | null }).tipo ?? "Outros";
      const grp = r.grupo ?? "Sem grupo";
      const cat = r.categoria ?? "(sem categoria)";
      const mIdx = r.mes_ref ? new Date(r.mes_ref).getMonth() : 0;
      const v = Math.abs(Number(r.valor_total) || 0);

      let T = tipos.get(tipo);
      if (!T) { T = { tipo, grupos: new Map(), meses: Array(12).fill(0), total: 0 }; tipos.set(tipo, T); }
      let G = T.grupos.get(grp);
      if (!G) { G = { grupo: grp, categorias: new Map(), meses: Array(12).fill(0), total: 0 }; T.grupos.set(grp, G); }
      let C = G.categorias.get(cat);
      if (!C) { C = { categoria: cat, meses: Array(12).fill(0), total: 0 }; G.categorias.set(cat, C); }
      C.meses[mIdx] += v; C.total += v;
      G.meses[mIdx] += v; G.total += v;
      T.meses[mIdx] += v; T.total += v;
    }

    const tipoOrder = ["Receita", "Despesa", "Retirada"];
    const sortedTipos = Array.from(tipos.values()).sort((a, b) => {
      const ai = tipoOrder.indexOf(a.tipo); const bi = tipoOrder.indexOf(b.tipo);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    sortedTipos.forEach(t => {
      t.grupos = new Map(Array.from(t.grupos.entries()).sort((a, b) => b[1].total - a[1].total));
      t.grupos.forEach(g => {
        g.categorias = new Map(Array.from(g.categorias.entries()).sort((a, b) => b[1].total - a[1].total));
      });
    });

    // Linhas de resumo
    const receita = tipos.get("Receita")?.meses ?? Array(12).fill(0);
    const despesa = tipos.get("Despesa")?.meses ?? Array(12).fill(0);
    const retirada = tipos.get("Retirada")?.meses ?? Array(12).fill(0);
    const resultado = receita.map((v, i) => v - despesa[i] - retirada[i]);
    const totalReceita = receita.reduce((a, b) => a + b, 0);
    const totalDespesa = despesa.reduce((a, b) => a + b, 0);
    const totalRetirada = retirada.reduce((a, b) => a + b, 0);
    const totalResultado = totalReceita - totalDespesa - totalRetirada;
    const margem = totalReceita > 0 ? totalResultado / totalReceita : null;

    return { tipos: sortedTipos, receita, despesa, retirada, resultado,
             totalReceita, totalDespesa, totalRetirada, totalResultado, margem };
  }, [dreQ.data]);

  function toggle(key: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  function exportCSV() {
    const lines: string[] = [];
    const header = ["Conta", ...MESES_PT, "Total"].join(";");
    lines.push(header);
    dre.tipos.forEach(t => {
      lines.push([t.tipo.toUpperCase(), ...t.meses.map(v => v.toFixed(2)), t.total.toFixed(2)].join(";"));
      t.grupos.forEach(g => {
        lines.push(["  " + g.grupo, ...g.meses.map(v => v.toFixed(2)), g.total.toFixed(2)].join(";"));
        g.categorias.forEach(c => {
          lines.push(["    " + c.categoria, ...c.meses.map(v => v.toFixed(2)), c.total.toFixed(2)].join(";"));
        });
      });
    });
    lines.push(["RESULTADO", ...dre.resultado.map(v => v.toFixed(2)), dre.totalResultado.toFixed(2)].join(";"));
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `DRE_${ano}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <PageShell
      title="DRE Consolidado"
      description="Demonstrativo de Resultados — visão contábil por grupo, categoria e mês"
      actions={
        <Button size="sm" variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      }
    >
      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Período:</span>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosOpts().map(y => <SelectItem key={y} value={String(y)}>Ano {y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger className="h-9 w-[220px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {(empresasQ.data ?? []).map(e => (
                <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-3 text-xs">
            <KpiInline label="Receita" value={dre.totalReceita} tone="receita" />
            <KpiInline label="Despesa" value={dre.totalDespesa} tone="despesa" />
            <KpiInline label="Resultado" value={dre.totalResultado} tone={dre.totalResultado >= 0 ? "receita" : "despesa"} />
            {dre.margem !== null && (
              <KpiInline label="Margem" value={dre.margem * 100} suffix="%" tone={dre.margem >= 0 ? "receita" : "despesa"} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela DRE */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {dreQ.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-7" />)}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/50 z-20 min-w-[260px]">Conta</th>
                  {MESES_PT.map(m => (
                    <th key={m} className="text-right px-2 py-2 font-medium tabular-nums">{m}</th>
                  ))}
                  <th className="text-right px-3 py-2 font-semibold tabular-nums bg-muted">Total</th>
                </tr>
              </thead>
              <tbody>
                {dre.tipos.map(t => {
                  const tKey = `t:${t.tipo}`;
                  const tOpen = expanded.has(tKey);
                  const tCls = t.tipo === "Receita" ? "text-emerald-500"
                            : t.tipo === "Despesa" ? "text-rose-500"
                            : t.tipo === "Retirada" ? "text-amber-500" : "";
                  return (
                    <Fragment key={tKey}>
                      <tr className={cn("border-t border-border font-semibold bg-card hover:bg-muted/40 cursor-pointer", tCls)}
                          onClick={() => toggle(tKey)}>
                        <td className="px-3 py-2 sticky left-0 bg-card z-10">
                          <div className="flex items-center gap-1">
                            {tOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <span>{t.tipo.toUpperCase()}</span>
                          </div>
                        </td>
                        {t.meses.map((v, i) => (
                          <td key={i} className="text-right px-2 py-2 tabular-nums">{v ? formatBRL(v) : "—"}</td>
                        ))}
                        <td className="text-right px-3 py-2 tabular-nums bg-muted/30">{formatBRL(t.total)}</td>
                      </tr>
                      {tOpen && Array.from(t.grupos.values()).map(g => {
                        const gKey = `g:${t.tipo}:${g.grupo}`;
                        const gOpen = expanded.has(gKey);
                        return (
                          <Fragment key={gKey}>
                            <tr className="border-t border-border/40 hover:bg-muted/30 cursor-pointer" onClick={() => toggle(gKey)}>
                              <td className="px-3 py-1.5 pl-7 sticky left-0 bg-background z-10">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  {gOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  <span className="text-foreground/90">{g.grupo}</span>
                                </div>
                              </td>
                              {g.meses.map((v, i) => (
                                <td key={i} className="text-right px-2 py-1.5 tabular-nums text-muted-foreground">{v ? formatBRL(v) : "—"}</td>
                              ))}
                              <td className="text-right px-3 py-1.5 tabular-nums font-medium">{formatBRL(g.total)}</td>
                            </tr>
                            {gOpen && Array.from(g.categorias.values()).map(c => (
                              <tr key={`c:${gKey}:${c.categoria}`} className="border-t border-border/20 hover:bg-muted/20">
                                <td className="px-3 py-1 pl-12 sticky left-0 bg-background z-10 text-muted-foreground">
                                  {c.categoria}
                                </td>
                                {c.meses.map((v, i) => (
                                  <td key={i} className="text-right px-2 py-1 tabular-nums text-muted-foreground/80">{v ? formatBRL(v) : ""}</td>
                                ))}
                                <td className="text-right px-3 py-1 tabular-nums">{formatBRL(c.total)}</td>
                              </tr>
                            ))}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
                {/* Resultado */}
                <tr className="border-t-2 border-primary/60 bg-primary/10 font-bold">
                  <td className="px-3 py-2.5 sticky left-0 bg-primary/10 z-10">RESULTADO LÍQUIDO</td>
                  {dre.resultado.map((v, i) => (
                    <td key={i} className={cn("text-right px-2 py-2.5 tabular-nums",
                      v > 0 ? "text-emerald-500" : v < 0 ? "text-rose-500" : "")}>
                      {v ? formatBRL(v) : "—"}
                    </td>
                  ))}
                  <td className={cn("text-right px-3 py-2.5 tabular-nums bg-primary/15",
                    dre.totalResultado >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {formatBRL(dre.totalResultado)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

function KpiInline({ label, value, suffix, tone }: { label: string; value: number; suffix?: string; tone: "receita" | "despesa" }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", tone === "receita" ? "text-emerald-500" : "text-rose-500")}>
        {suffix === "%" ? value.toFixed(1) + "%" : formatBRL(value)}
      </span>
    </div>
  );
}

// Fragment alias to keep imports tidy
import { Fragment } from "react";
