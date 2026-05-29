import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  VClienteLifetimeRow,
  VRankingVendedorRow,
  VEvolucaoMensalRow,
  RebateClienteStoneRow,
} from "@/integrations/supabase/database";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Legend, ReferenceLine,
  Tooltip as RTooltip,
} from "recharts";
import { formatBRL, MESES_PT } from "@/lib/format";
import { Users, TrendingUp, Coins, Layers, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes-stone")({
  component: ClientesStonePage,
});

const STALE = 5 * 60 * 1000;
const GC = 10 * 60 * 1000;
const PAGE_SIZE = 50;

function mesLabel(iso: string) {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  return `${MESES_PT[m - 1]}/${String(y).slice(2)}`;
}

// ===== KPIs (Seção 1) =====
function useKpis() {
  return useQuery({
    queryKey: ["clientes-stone", "kpis"],
    staleTime: STALE,
    gcTime: GC,
    queryFn: async () => {
      // Buscar último mês disponível
      const lastQ = await supabase
        .from("rebate_clientes_stone")
        .select("mes_referencia")
        .order("mes_referencia", { ascending: false })
        .limit(1);
      if (lastQ.error) throw lastQ.error;
      const ultimoMes = (lastQ.data?.[0]?.mes_referencia as string) ?? null;

      const ativos3mInicio = ultimoMes
        ? (() => {
            const d = new Date(ultimoMes);
            d.setMonth(d.getMonth() - 2);
            return d.toISOString().slice(0, 10);
          })()
        : null;

      const hoje = new Date();
      const inicio12m = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1)
        .toISOString().slice(0, 10);

      const [
        clientesAtivosQ,
        lucro12mQ,
        lucroTotalQ,
      ] = await Promise.all([
        ativos3mInicio
          ? supabase
              .from("rebate_clientes_stone")
              .select("stonecode", { head: false, count: "exact" })
              .gte("mes_referencia", ativos3mInicio)
              .limit(1)
          : Promise.resolve({ data: [], count: 0, error: null } as never),
        supabase
          .from("v_evolucao_mensal")
          .select("mes_referencia,lucro_bruto,lucro_bj7,lucro_stone_matriz")
          .gte("mes_referencia", inicio12m),
        supabase
          .from("v_evolucao_mensal")
          .select("mes_referencia,lucro_bruto,lucro_bj7,lucro_stone_matriz")
          .gte("mes_referencia", "2020-08-01"),
      ]);

      const erros = [clientesAtivosQ, lucro12mQ, lucroTotalQ].find((q) => q.error);
      if (erros && (erros as { error: unknown }).error) throw (erros as { error: Error }).error;

      // Distinct stonecodes via paginação leve (uma coluna)
      let clientesAtivos = 0;
      if (ativos3mInicio) {
        const pageQ = await supabase
          .from("rebate_clientes_stone")
          .select("stonecode")
          .gte("mes_referencia", ativos3mInicio)
          .limit(50000);
        if (!pageQ.error) {
          const set = new Set<string>();
          for (const r of (pageQ.data ?? []) as Array<{ stonecode: string }>) {
            set.add(r.stonecode);
          }
          clientesAtivos = set.size;
        }
      }


      const rows12 = (lucro12mQ.data ?? []) as VEvolucaoMensalRow[];
      const lucro12m = rows12.reduce(
        (s, r) => s + (Number(r.lucro_bj7) || 0) + (Number(r.lucro_stone_matriz) || 0),
        0,
      );

      const rowsTotal = (lucroTotalQ.data ?? []) as VEvolucaoMensalRow[];
      const lucroTotal = rowsTotal.reduce(
        (s, r) => s + (Number(r.lucro_bj7) || 0) + (Number(r.lucro_stone_matriz) || 0),
        0,
      );

      const ticket = clientesAtivos > 0 ? lucro12m / clientesAtivos : 0;
      return { clientesAtivos, lucro12m, lucroTotal, ticket, ultimoMes };
    },
  });
}

function Kpis() {
  const k = useKpis();

  const cards = [
    {
      label: "Clientes ativos (últ. 3 meses)",
      value: k.data ? k.data.clientesAtivos.toLocaleString("pt-BR") : "—",
      icon: <Users className="h-4 w-4" />,
      hint: k.data?.ultimoMes ? `Base: ${mesLabel(k.data.ultimoMes)}` : "",
    },
    {
      label: "Lucro últimos 12 meses",
      value: k.data ? formatBRL(k.data.lucro12m) : "—",
      icon: <TrendingUp className="h-4 w-4" />,
      hint: "Formato atual (2020-08+)",
    },
    {
      label: "Ticket médio por cliente",
      value: k.data ? formatBRL(k.data.ticket) : "—",
      icon: <Coins className="h-4 w-4" />,
      hint: "Lucro 12m ÷ clientes ativos",
    },
    {
      label: "Lucro acumulado (vida toda)",
      value: k.data ? formatBRL(k.data.lucroTotal) : "—",
      icon: <Layers className="h-4 w-4" />,
      hint: "Formato atual",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <Card key={i}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              {c.label}
            </CardTitle>
            <span className="text-muted-foreground">{c.icon}</span>
          </CardHeader>
          <CardContent className="pt-0">
            {k.isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="text-xl font-semibold tabular-nums">{c.value}</div>
            )}
            <div className="text-[11px] text-muted-foreground mt-1">{c.hint}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ===== Tab Ranking =====
type RankingFilters = {
  cidade: string;
  vendedor: string;
  ativos: boolean;
  page: number;
};

function RankingTab({
  onOpenCliente,
}: {
  onOpenCliente: (stonecode: string) => void;
}) {
  const [f, setF] = useState<RankingFilters>({
    cidade: "",
    vendedor: "",
    ativos: false,
    page: 1,
  });

  const filtersQ = useQuery({
    queryKey: ["clientes-stone", "filters"],
    staleTime: STALE,
    gcTime: GC,
    queryFn: async () => {
      const r = await supabase
        .from("v_cliente_lifetime")
        .select("cidade,vendedor_atual")
        .limit(5000);
      if (r.error) throw r.error;
      const cidades = new Set<string>();
      const vendedores = new Set<string>();
      for (const row of (r.data ?? []) as VClienteLifetimeRow[]) {
        if (row.cidade) cidades.add(row.cidade);
        if (row.vendedor_atual) vendedores.add(row.vendedor_atual);
      }
      return {
        cidades: Array.from(cidades).sort(),
        vendedores: Array.from(vendedores).sort(),
      };
    },
  });

  const listQ = useQuery({
    queryKey: ["clientes-stone", "ranking", f],
    staleTime: STALE,
    gcTime: GC,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("v_cliente_lifetime")
        .select(
          "stonecode,nome_fantasia,cidade,vendedor_atual,meses_ativo,lucro_total,ultimo_mes,provavel_churn",
          { count: "exact" },
        )
        .order("lucro_total", { ascending: false, nullsFirst: false });
      if (f.cidade) q = q.eq("cidade", f.cidade);
      if (f.vendedor) q = q.eq("vendedor_atual", f.vendedor);
      if (f.ativos) q = q.eq("provavel_churn", false);
      const from = (f.page - 1) * PAGE_SIZE;
      q = q.range(from, from + PAGE_SIZE - 1);
      const r = await q;
      if (r.error) throw r.error;
      return { rows: (r.data ?? []) as VClienteLifetimeRow[], count: r.count ?? 0 };
    },
  });

  const totalPages = Math.max(1, Math.ceil((listQ.data?.count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-center">
          <Select
            value={f.cidade || "all"}
            onValueChange={(v) =>
              setF((p) => ({ ...p, cidade: v === "all" ? "" : v, page: 1 }))
            }
          >
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Cidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas cidades</SelectItem>
              {(filtersQ.data?.cidades ?? []).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={f.vendedor || "all"}
            onValueChange={(v) =>
              setF((p) => ({ ...p, vendedor: v === "all" ? "" : v, page: 1 }))
            }
          >
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos vendedores</SelectItem>
              {(filtersQ.data?.vendedores ?? []).map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 text-sm">
            <Switch
              checked={f.ativos}
              onCheckedChange={(v) => setF((p) => ({ ...p, ativos: v, page: 1 }))}
            />
            Só ativos (sem churn)
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setF({ cidade: "", vendedor: "", ativos: false, page: 1 })
            }
          >
            Limpar
          </Button>

          <div className="ml-auto text-xs text-muted-foreground">
            {listQ.data ? `${listQ.data.count.toLocaleString("pt-BR")} clientes` : ""}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Meses</TableHead>
                <TableHead className="text-right">Lucro total</TableHead>
                <TableHead>Último mês</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQ.isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!listQ.isLoading && (listQ.data?.rows ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum cliente no filtro.
                  </TableCell>
                </TableRow>
              )}
              {(listQ.data?.rows ?? []).map((r) => (
                <TableRow
                  key={r.stonecode}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => onOpenCliente(r.stonecode)}
                >
                  <TableCell className="font-medium">
                    {r.nome_fantasia ?? r.stonecode}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.cidade ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.vendedor_atual ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.meses_ativo ?? 0}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${
                      (r.lucro_total ?? 0) < 0 ? "text-destructive" : ""
                    }`}
                  >
                    {formatBRL(Number(r.lucro_total) || 0)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.ultimo_mes ? mesLabel(r.ultimo_mes) : "—"}
                  </TableCell>
                  <TableCell>
                    {r.provavel_churn ? (
                      <Badge variant="destructive">Churn</Badge>
                    ) : (
                      <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-600/30">
                        Ativo
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          Página {f.page} de {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={f.page <= 1}
            onClick={() => setF((p) => ({ ...p, page: p.page - 1 }))}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={f.page >= totalPages}
            onClick={() => setF((p) => ({ ...p, page: p.page + 1 }))}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}

// ===== Tab Vendedores =====
function VendedoresTab() {
  const [mostrarStone, setMostrarStone] = useState(false);

  const q = useQuery({
    queryKey: ["clientes-stone", "vendedores", mostrarStone],
    staleTime: STALE,
    gcTime: GC,
    queryFn: async () => {
      let qb = supabase
        .from("v_ranking_vendedor")
        .select("vendedor_canonico,tipo_vendedor,clientes_unicos,meses_total,lucro_total,lucro_ult_6m")
        .order("lucro_ult_6m", { ascending: false, nullsFirst: false })
        .limit(200);
      qb = mostrarStone
        ? qb.in("tipo_vendedor", ["BJ7", "STONE_MATRIZ"])
        : qb.eq("tipo_vendedor", "BJ7");
      const r = await qb;
      if (r.error) throw r.error;
      return (r.data ?? []) as VRankingVendedorRow[];
    },
  });

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="py-3 flex items-center gap-3 text-sm">
          <Switch checked={mostrarStone} onCheckedChange={setMostrarStone} />
          Mostrar vendedores Stone Matriz
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Clientes</TableHead>
                <TableHead className="text-right">Meses</TableHead>
                <TableHead className="text-right">Lucro total</TableHead>
                <TableHead className="text-right">Últ. 6 meses</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {q.error && (
                <TableRow>
                  <TableCell colSpan={6} className="text-destructive text-sm py-4">
                    Erro: {(q.error as Error).message}
                  </TableCell>
                </TableRow>
              )}
              {(q.data ?? []).map((v) => (
                <TableRow key={v.vendedor_canonico}>
                  <TableCell className="font-medium">{v.vendedor_canonico}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        v.tipo_vendedor === "BJ7"
                          ? "border-primary/40 text-primary"
                          : "text-muted-foreground"
                      }
                    >
                      {v.tipo_vendedor}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {v.clientes_unicos ?? 0}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {v.meses_total ?? 0}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(Number(v.lucro_total) || 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(Number(v.lucro_ult_6m) || 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Tab Evolução =====
function EvolucaoTab() {
  const [excluirLegado, setExcluirLegado] = useState(true);

  const q = useQuery({
    queryKey: ["clientes-stone", "evolucao"],
    staleTime: STALE,
    gcTime: GC,
    queryFn: async () => {
      const r = await supabase
        .from("v_evolucao_mensal")
        .select("mes_referencia,lucro_bruto,lucro_bj7,lucro_stone_matriz")
        .order("mes_referencia", { ascending: true });
      if (r.error) throw r.error;
      return (r.data ?? []) as VEvolucaoMensalRow[];
    },
  });

  const dados = useMemo(() => {
    const rows = q.data ?? [];
    return rows
      .filter((r) => (excluirLegado ? r.mes_referencia >= "2020-08-01" : true))
      .map((r) => ({
        mes: r.mes_referencia.slice(0, 7),
        label: mesLabel(r.mes_referencia),
        bj7: Math.round(Number(r.lucro_bj7) || 0),
        stone: Math.round(Number(r.lucro_stone_matriz) || 0),
      }));
  }, [q.data, excluirLegado]);

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="py-3 flex items-center gap-3 text-sm flex-wrap">
          <Switch checked={excluirLegado} onCheckedChange={setExcluirLegado} />
          Excluir formato legado (pré-2020-08)
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">
                  Antes de Ago/2020 a fórmula de lucro era diferente; somar com o
                  formato atual distorce a série.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Evolução mensal (lucro BJ7 + Stone Matriz)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[380px]">
            {q.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados} margin={{ top: 8, right: 16, left: 8, bottom: 24 }}>
                  <CartesianGrid stroke="hsl(220 13% 30%)" opacity={0.25} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "hsl(220 9% 70%)", fontSize: 10 }}
                    interval={Math.max(0, Math.floor(dados.length / 14))}
                  />
                  <YAxis
                    tick={{ fill: "hsl(220 9% 70%)", fontSize: 11 }}
                    tickFormatter={(v) =>
                      new Intl.NumberFormat("pt-BR", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(v as number)
                    }
                  />
                  <RTooltip
                    contentStyle={{
                      background: "hsl(220 13% 12%)",
                      border: "1px solid hsl(220 13% 30%)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => formatBRL(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="bj7" name="BJ7" stackId="lucro" fill="hsl(217 91% 55%)" />
                  <Bar
                    dataKey="stone"
                    name="Stone Matriz"
                    stackId="lucro"
                    fill="hsl(142 71% 45%)"
                  />
                  {!excluirLegado && (
                    <ReferenceLine
                      x={mesLabel("2020-08-01")}
                      stroke="hsl(38 92% 55%)"
                      strokeDasharray="3 3"
                      label={{
                        value: "Modelo atual",
                        position: "top",
                        fill: "hsl(38 92% 55%)",
                        fontSize: 10,
                      }}
                    />
                  )}
                  <ReferenceLine
                    x={mesLabel("2023-02-01")}
                    stroke="hsl(0 84% 60%)"
                    strokeDasharray="3 3"
                    label={{
                      value: "Rebate23",
                      position: "top",
                      fill: "hsl(0 84% 60%)",
                      fontSize: 10,
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Drawer Cliente =====
function ClienteDrawer({
  stonecode,
  onClose,
}: {
  stonecode: string | null;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["clientes-stone", "cliente", stonecode],
    enabled: !!stonecode,
    staleTime: STALE,
    gcTime: GC,
    queryFn: async () => {
      const r = await supabase
        .from("rebate_clientes_stone")
        .select(
          "mes_referencia,nome_fantasia,cidade,vendedor_canonico,status,lucro_bruto,rec_mdr,rec_rav,rec_banking,rec_adesao,tpv_m0,formato",
        )
        .eq("stonecode", stonecode!)
        .order("mes_referencia", { ascending: false });
      if (r.error) throw r.error;
      return (r.data ?? []) as RebateClienteStoneRow[];
    },
  });

  const rows = q.data ?? [];
  const header = rows[0];
  const totais = useMemo(() => {
    const atu = rows.filter((r) => r.formato === "atual");
    return {
      mdr: atu.reduce((s, r) => s + (Number(r.rec_mdr) || 0), 0),
      rav: atu.reduce((s, r) => s + (Number(r.rec_rav) || 0), 0),
      banking: atu.reduce((s, r) => s + (Number(r.rec_banking) || 0), 0),
      adesao: atu.reduce((s, r) => s + (Number(r.rec_adesao) || 0), 0),
      lucro: atu.reduce((s, r) => s + (Number(r.lucro_bruto) || 0), 0),
    };
  }, [rows]);

  const serie = useMemo(
    () =>
      [...rows]
        .reverse()
        .map((r) => ({
          label: mesLabel(r.mes_referencia),
          lucro: Math.round(Number(r.lucro_bruto) || 0),
        })),
    [rows],
  );

  return (
    <Sheet open={!!stonecode} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{header?.nome_fantasia ?? stonecode}</SheetTitle>
          <SheetDescription>
            {header?.cidade ?? "—"} · Vendedor: {header?.vendedor_canonico ?? "—"} · Status:{" "}
            {header?.status ?? "—"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {q.isLoading && <Skeleton className="h-40 w-full" />}

          {!q.isLoading && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <Card><CardContent className="py-2">
                  <div className="text-muted-foreground">MDR</div>
                  <div className="tabular-nums font-medium">{formatBRL(totais.mdr)}</div>
                </CardContent></Card>
                <Card><CardContent className="py-2">
                  <div className="text-muted-foreground">RAV</div>
                  <div className="tabular-nums font-medium">{formatBRL(totais.rav)}</div>
                </CardContent></Card>
                <Card><CardContent className="py-2">
                  <div className="text-muted-foreground">Banking</div>
                  <div className="tabular-nums font-medium">{formatBRL(totais.banking)}</div>
                </CardContent></Card>
                <Card><CardContent className="py-2">
                  <div className="text-muted-foreground">Adesão</div>
                  <div className="tabular-nums font-medium">{formatBRL(totais.adesao)}</div>
                </CardContent></Card>
                <Card><CardContent className="py-2">
                  <div className="text-muted-foreground">Lucro lifetime</div>
                  <div className="tabular-nums font-medium">{formatBRL(totais.lucro)}</div>
                </CardContent></Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Lucro mês a mês</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={serie}>
                        <CartesianGrid stroke="hsl(220 13% 30%)" opacity={0.25} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "hsl(220 9% 70%)", fontSize: 10 }}
                          interval={Math.max(0, Math.floor(serie.length / 8))}
                        />
                        <YAxis
                          tick={{ fill: "hsl(220 9% 70%)", fontSize: 10 }}
                          tickFormatter={(v) =>
                            new Intl.NumberFormat("pt-BR", {
                              notation: "compact",
                            }).format(v as number)
                          }
                        />
                        <RTooltip
                          formatter={(v: number) => formatBRL(v)}
                          contentStyle={{
                            background: "hsl(220 13% 12%)",
                            border: "1px solid hsl(220 13% 30%)",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="lucro"
                          stroke="hsl(217 91% 55%)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Meses ativos ({rows.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês</TableHead>
                        <TableHead className="text-right">TPV</TableHead>
                        <TableHead className="text-right">Lucro</TableHead>
                        <TableHead>Formato</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.mes_referencia}>
                          <TableCell>{mesLabel(r.mes_referencia)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatBRL(Number(r.tpv_m0) || 0)}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums ${
                              (r.lucro_bruto ?? 0) < 0 ? "text-destructive" : ""
                            }`}
                          >
                            {formatBRL(Number(r.lucro_bruto) || 0)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                r.formato === "legado"
                                  ? "text-amber-400 border-amber-400/30"
                                  : "text-muted-foreground"
                              }
                            >
                              {r.formato}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ===== Page =====
function ClientesStonePage() {
  const [tab, setTab] = useState("ranking");
  const [openCliente, setOpenCliente] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Clientes Stone
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          8 anos de histórico de rebate · 11.500+ clientes · 90 meses
        </p>
      </div>

      <Kpis />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-4">
          <RankingTab onOpenCliente={setOpenCliente} />
        </TabsContent>
        <TabsContent value="vendedores" className="mt-4">
          <VendedoresTab />
        </TabsContent>
        <TabsContent value="evolucao" className="mt-4">
          <EvolucaoTab />
        </TabsContent>
      </Tabs>

      <ClienteDrawer stonecode={openCliente} onClose={() => setOpenCliente(null)} />
    </div>
  );
}
