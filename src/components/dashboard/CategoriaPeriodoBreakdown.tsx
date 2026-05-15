import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { from, asRows } from "@/integrations/supabase/db";
import { useCategorias } from "@/hooks/use-refs";
import { useCurrentUser } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatBRL } from "@/lib/format";
import { TrendingUp, TrendingDown } from "lucide-react";

type PeriodoKey = "mes_atual" | "mes_anterior" | "ult_3m" | "ult_12m" | "ano_atual";

const PERIODOS: { key: PeriodoKey; label: string }[] = [
  { key: "mes_atual", label: "Mês atual" },
  { key: "mes_anterior", label: "Mês anterior" },
  { key: "ult_3m", label: "Últimos 3 meses" },
  { key: "ult_12m", label: "Últimos 12 meses" },
  { key: "ano_atual", label: "Ano atual" },
];

function rangeFor(p: PeriodoKey): { start: string; end: string } {
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
  } else if (p === "ult_12m") {
    start = new Date(y, m - 11, 1);
    end = new Date(y, m + 1, 1);
  } else {
    start = new Date(y, 0, 1);
    end = new Date(y + 1, 0, 1);
  }
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export function CategoriaPeriodoBreakdown() {
  const user = useCurrentUser();
  const categorias = useCategorias();
  const [periodo, setPeriodo] = useState<PeriodoKey>("mes_atual");
  const [tipo, setTipo] = useState<"Despesa" | "Receita">("Despesa");

  const { start, end } = useMemo(() => rangeFor(periodo), [periodo]);

  const q = useQuery({
    queryKey: ["dash-cat-periodo", periodo, user.id],
    queryFn: async () => {
      let query = from("lancamentos")
        .select("categoria_id,tipo,valor,data,contar_no_total")
        .gte("data", start)
        .lt("data", end)
        .eq("contar_no_total", true)
        .in("tipo", ["Receita", "Despesa"]);
      if (!user.ve_todas_empresas) {
        if (user.empresas_ids.length === 0) return [];
        query = query.in("empresa_id", user.empresas_ids);
      }
      const r = await query.limit(20000);
      if (r.error) throw r.error;
      return asRows("lancamentos", r.data);
    },
  });

  const catNome = (id: number | null) =>
    id == null ? "Sem categoria" : categorias.data?.find((c) => c.id === id)?.nome ?? `#${id}`;

  const dados = useMemo(() => {
    const rows = q.data ?? [];
    const filtradas = rows.filter((r) => r.tipo === tipo);
    const totalGeral = filtradas.reduce((s, r) => s + Math.abs(Number(r.valor) || 0), 0);
    const map = new Map<number | null, number>();
    for (const r of filtradas) {
      const k = r.categoria_id ?? null;
      map.set(k, (map.get(k) ?? 0) + Math.abs(Number(r.valor) || 0));
    }
    const items = Array.from(map.entries())
      .map(([categoria_id, total]) => ({
        categoria_id,
        nome: catNome(categoria_id),
        total,
        pct: totalGeral > 0 ? (total / totalGeral) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
    return { items, totalGeral };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, tipo, categorias.data]);

  const totalReceitas = useMemo(
    () =>
      (q.data ?? [])
        .filter((r) => r.tipo === "Receita")
        .reduce((s, r) => s + Math.abs(Number(r.valor) || 0), 0),
    [q.data],
  );
  const totalDespesas = useMemo(
    () =>
      (q.data ?? [])
        .filter((r) => r.tipo === "Despesa")
        .reduce((s, r) => s + Math.abs(Number(r.valor) || 0), 0),
    [q.data],
  );
  const saldo = totalReceitas - totalDespesas;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-base">Por categoria & período</CardTitle>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoKey)}>
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
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat
            label="Receitas"
            value={formatBRL(totalReceitas)}
            tone="positive"
            icon={<TrendingUp className="h-3.5 w-3.5" />}
          />
          <MiniStat
            label="Despesas"
            value={formatBRL(totalDespesas)}
            tone="negative"
            icon={<TrendingDown className="h-3.5 w-3.5" />}
          />
          <MiniStat
            label="Saldo"
            value={formatBRL(saldo)}
            tone={saldo >= 0 ? "positive" : "negative"}
          />
        </div>

        <Tabs value={tipo} onValueChange={(v) => setTipo(v as "Despesa" | "Receita")}>
          <TabsList className="grid grid-cols-2 w-full sm:w-[260px]">
            <TabsTrigger value="Despesa">Despesas</TabsTrigger>
            <TabsTrigger value="Receita">Receitas</TabsTrigger>
          </TabsList>

          <TabsContent value={tipo} className="mt-3">
            {q.isLoading ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
            ) : dados.items.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Sem lançamentos no período.
              </div>
            ) : (
              <ul className="space-y-2">
                {dados.items.slice(0, 12).map((it) => (
                  <li key={String(it.categoria_id)} className="space-y-1">
                    <div className="flex items-center justify-between text-sm gap-2">
                      <span className="truncate">{it.nome}</span>
                      <span className="font-medium tabular-nums shrink-0">
                        {formatBRL(it.total)}
                        <span className="text-muted-foreground ml-2 text-xs">
                          {it.pct.toFixed(1)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded bg-muted overflow-hidden">
                      <div
                        className={
                          tipo === "Receita"
                            ? "h-full bg-emerald-500"
                            : "h-full bg-destructive"
                        }
                        style={{ width: `${Math.min(100, it.pct)}%` }}
                      />
                    </div>
                  </li>
                ))}
                {dados.items.length > 12 && (
                  <li className="text-xs text-muted-foreground pt-1">
                    + {dados.items.length - 12} outras categorias
                  </li>
                )}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
}) {
  const color =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="rounded-md border p-2">
      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`text-sm font-semibold tabular-nums mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}
