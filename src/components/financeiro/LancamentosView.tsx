import { useNavigate, getRouteApi } from "@tanstack/react-router";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { from, asRows } from "@/integrations/supabase/db";
import { supabase } from "@/integrations/supabase/client";
import type { LancamentoRow } from "@/integrations/supabase/database";
import { useEmpresas, useUnidades, useCategorias } from "@/hooks/use-refs";
import { useCurrentUser } from "@/contexts/auth-context";
import {
  tiposVisiveis,
  podeEditarLancamento,
  podeMarcarRevisado,
} from "@/lib/permissions";
import { formatBRL, formatDate, MESES_PT } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, CheckCircle2, Tags } from "lucide-react";
import { CategoriasManagerDialog } from "@/components/categoria/CategoriasManagerDialog";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

import { toast } from "sonner";

const PAGE_SIZE = 50;
const ANOS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

function pad(n: number) { return String(n).padStart(2, "0"); }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function presetToRange(p: string): { data_de: string; data_ate: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (p === "mes") {
    return { data_de: isoDate(new Date(y, m, 1)), data_ate: isoDate(new Date(y, m + 1, 0)) };
  }
  if (p === "3m") {
    return { data_de: isoDate(new Date(y, m - 2, 1)), data_ate: isoDate(new Date(y, m + 1, 0)) };
  }
  if (p === "6m") {
    return { data_de: isoDate(new Date(y, m - 5, 1)), data_ate: isoDate(new Date(y, m + 1, 0)) };
  }
  if (p === "12m") {
    return { data_de: isoDate(new Date(y, m - 11, 1)), data_ate: isoDate(new Date(y, m + 1, 0)) };
  }
  if (p === "ano") {
    return { data_de: `${y}-01-01`, data_ate: `${y}-12-31` };
  }
  if (p === "tudo") {
    return { data_de: "", data_ate: "" };
  }
  return null;
}

type Tipo = "" | "Receita" | "Despesa" | "Retirada" | "Empréstimo";
type Revisado = "" | "sim" | "nao";
type PeriodoPreset = "" | "mes" | "3m" | "6m" | "12m" | "ano" | "tudo" | "custom";
type LancSearch = {
  ano: number; mes: number; tipo: Tipo; empresa: number;
  unidade: number; categoria: number; q: string;
  revisado: Revisado; page: number;
  data_de: string; data_ate: string; periodo: PeriodoPreset;
};

const financeiroRoute = getRouteApi("/_authenticated/financeiro");

export function LancamentosView() {
  return <LancamentosPage />;
}

function LancamentosPage() {
  const user = useCurrentUser();
  const all = financeiroRoute.useSearch() as LancSearch & { tab?: string };
  const params: LancSearch = {
    ano: all.ano ?? 0, mes: all.mes ?? 0, tipo: (all.tipo ?? "") as Tipo,
    empresa: all.empresa ?? 0, unidade: all.unidade ?? 0,
    categoria: all.categoria ?? 0, q: all.q ?? "",
    revisado: (all.revisado ?? "") as Revisado, page: all.page ?? 1,
    data_de: all.data_de ?? "", data_ate: all.data_ate ?? "",
    periodo: (all.periodo ?? "") as PeriodoPreset,
  };
  const navigate = useNavigate();
  const empresas = useEmpresas();
  const unidades = useUnidades();
  const categorias = useCategorias();
  const dlg = useLancamentoDialog();
  const qc = useQueryClient();
  const [catMgrOpen, setCatMgrOpen] = useState(false);

  const tiposPermitidos = tiposVisiveis(user);

  const queryKey = useMemo(
    () => ["lancamentos", params, user.id] as const,
    [params, user.id],
  );

  const list = useQuery({
    queryKey,
    queryFn: async () => {
      // Seleciona apenas as colunas usadas na UI (era select=* = 28 colunas)
      let q = from("lancamentos").select(
        "id,data,ano,mes,empresa_id,unidade_id,categoria_id,tipo,descricao,valor,contar_no_total,revisado,revisado_por,revisado_em",
        { count: "exact" },
      );
      q = q.in("tipo", tiposPermitidos);
      if (!user.ve_todas_empresas) {
        if (user.empresas_ids.length === 0) {
          return { rows: [] as LancamentoRow[], count: 0 };
        }
        q = q.in("empresa_id", user.empresas_ids);
      }
      const hasRange = !!(params.data_de || params.data_ate);
      if (hasRange) {
        if (params.data_de) q = q.gte("data", params.data_de);
        if (params.data_ate) q = q.lte("data", params.data_ate);
      } else {
        if (params.ano) q = q.eq("ano", params.ano);
        if (params.mes) q = q.eq("mes", params.mes);
      }
      if (params.tipo) q = q.eq("tipo", params.tipo);
      if (params.empresa) q = q.eq("empresa_id", params.empresa);
      if (params.unidade) q = q.eq("unidade_id", params.unidade);
      if (params.categoria) q = q.eq("categoria_id", params.categoria);
      if (params.revisado === "sim") q = q.eq("revisado", true);
      if (params.revisado === "nao") q = q.eq("revisado", false);
      if (params.q) q = q.ilike("descricao", `%${params.q}%`);

      const fromIdx = (params.page - 1) * PAGE_SIZE;
      const toIdx = fromIdx + PAGE_SIZE - 1;
      q = q.order("data", { ascending: false }).order("id", { ascending: false }).range(fromIdx, toIdx);

      const r = await q;
      if (r.error) throw r.error;
      return { rows: asRows("lancamentos", r.data), count: r.count ?? 0 };
    },
    staleTime: 30_000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const total = list.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const empresaNome = (id: number | null) =>
    empresas.data?.find((e) => e.id === id)?.nome ?? "—";
  const categoriaNome = (id: number | null) =>
    categorias.data?.find((c) => c.id === id)?.nome ?? "—";

  // Agregação via view DRE (não pagina lançamentos brutos).
  // Filtros incompatíveis com a view (categoria, texto livre) desativam o agg.
  const aggSuportado = !params.categoria && !params.q;

  const aggQ = useQuery({
    queryKey: ["lanc-agg-dre", params.ano, params.mes, params.data_de, params.data_ate, params.tipo, params.empresa, user.id, aggSuportado],
    enabled: aggSuportado,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      let q = supabase
        .from("dre_consolidada")
        .select("empresa_id,mes_ref,tipo,grupo,valor_total")
        .eq("entra_dre", true);
      if (!user.ve_todas_empresas) {
        if (user.empresas_ids.length === 0) return [];
        q = q.in("empresa_id", user.empresas_ids);
      }
      if (params.empresa) q = q.eq("empresa_id", params.empresa);
      if (params.tipo) q = q.eq("tipo", params.tipo);
      const hasRange = !!(params.data_de || params.data_ate);
      if (hasRange) {
        if (params.data_de) {
          const s = params.data_de.slice(0, 7) + "-01";
          q = q.gte("mes_ref", s);
        }
        if (params.data_ate) {
          const [yy, mm] = params.data_ate.slice(0, 7).split("-").map(Number);
          const next = new Date(yy, mm, 1); // next month start
          q = q.lt("mes_ref", `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`);
        }
      } else if (params.ano && params.mes) {
        const start = `${params.ano}-${String(params.mes).padStart(2, "0")}-01`;
        q = q.eq("mes_ref", start);
      } else if (params.ano) {
        q = q
          .gte("mes_ref", `${params.ano}-01-01`)
          .lt("mes_ref", `${params.ano + 1}-01-01`);
      }
      const r = await q;
      if (r.error) throw r.error;
      return (r.data ?? []) as Array<{
        empresa_id: number;
        mes_ref: string;
        tipo: string;
        grupo: string | null;
        valor_total: number;
      }>;
    },
  });

  const resumo = useMemo(() => {
    const rows = aggQ.data ?? [];
    let receita = 0;
    let despesa = 0;
    const porGrupo = new Map<string, { nome: string; receita: number; despesa: number }>();
    const porMes = new Map<string, { receita: number; despesa: number }>();

    for (const r of rows) {
      const v = Math.abs(Number(r.valor_total) || 0);
      if (r.tipo === "Receita") receita += v;
      else if (r.tipo === "Despesa") despesa += v;

      const gKey = r.grupo ?? "sem";
      const gNome = r.grupo ?? "Sem grupo";
      const g = porGrupo.get(gKey) ?? { nome: gNome, receita: 0, despesa: 0 };
      if (r.tipo === "Receita") g.receita += v;
      else if (r.tipo === "Despesa") g.despesa += v;
      porGrupo.set(gKey, g);

      const mesKey = (r.mes_ref ?? "").slice(0, 7);
      if (mesKey) {
        const m = porMes.get(mesKey) ?? { receita: 0, despesa: 0 };
        if (r.tipo === "Receita") m.receita += v;
        else if (r.tipo === "Despesa") m.despesa += v;
        porMes.set(mesKey, m);
      }
    }

    const grupos = Array.from(porGrupo.values())
      .map((c) => ({ ...c, total: c.receita + c.despesa }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const meses = Array.from(porMes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        const [y, m] = k.split("-").map(Number);
        return {
          mes: `${MESES_PT[m - 1]}/${String(y).slice(2)}`,
          receita: Math.round(v.receita),
          despesa: Math.round(v.despesa),
          saldo: Math.round(v.receita - v.despesa),
        };
      });

    return {
      receita,
      despesa,
      saldo: receita - despesa,
      categorias: grupos, // mantém a chave usada pelo chart (rotulado como grupos)
      meses,
    };
  }, [aggQ.data]);

  const atualizarCategoria = useMutation({
    mutationFn: async ({ l, categoria_id }: { l: LancamentoRow; categoria_id: number | null }) => {
      const r = await from("lancamentos").update({ categoria_id }).eq("id", l.id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      toast.success("Categoria atualizada");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const marcarRevisado = useMutation({
    mutationFn: async (l: LancamentoRow) => {
      const r = await from("lancamentos")
        .update({
          revisado: !l.revisado,
          revisado_por: !l.revisado ? user.id : null,
          revisado_em: !l.revisado ? new Date().toISOString() : null,
        })
        .eq("id", l.id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      qc.invalidateQueries({ queryKey: ["a-revisar"] });
      toast.success("Atualizado");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function nav(reducer: (prev: LancSearch & { tab?: string }) => Partial<LancSearch & { tab?: string }>) {
    void navigate({ search: reducer as never });
  }
  function update(patch: Partial<typeof params>) {
    nav((prev) => ({ ...prev, ...patch, page: 1 }));
  }
  function applyPeriodo(p: PeriodoPreset) {
    if (p === "custom") {
      update({ periodo: "custom" });
      return;
    }
    const r = presetToRange(p);
    if (r) {
      update({ periodo: p, data_de: r.data_de, data_ate: r.data_ate, ano: 0, mes: 0 });
    } else {
      update({ periodo: "", data_de: "", data_ate: "" });
    }
  }


  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Lançamentos</h1>
          <p className="text-sm text-muted-foreground">Conta corrente — entradas, saídas, saldo acumulado</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCatMgrOpen(true)}>
            <Tags className="h-4 w-4 mr-1" /> Categorias
          </Button>
          {podeLancar(user) && (
            <Button size="sm" onClick={dlg.openNew}>
              <Plus className="h-4 w-4 mr-1" /> Novo Lançamento
            </Button>
          )}
        </div>
      </div>
      <CategoriasManagerDialog open={catMgrOpen} onOpenChange={setCatMgrOpen} />

      <Card>
        <CardHeader><CardTitle className="text-sm">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <Select value={params.periodo || "none"} onValueChange={(v) => applyPeriodo((v === "none" ? "" : v) as PeriodoPreset)}>
            <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Período (ano/mês)</SelectItem>
              <SelectItem value="mes">Mês atual</SelectItem>
              <SelectItem value="3m">Últimos 3 meses</SelectItem>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
              <SelectItem value="ano">Ano atual</SelectItem>
              <SelectItem value="tudo">Tudo</SelectItem>
              <SelectItem value="custom">Personalizado…</SelectItem>
            </SelectContent>
          </Select>
          {params.periodo === "custom" ? (
            <>
              <Input type="date" value={params.data_de} onChange={(e) => update({ data_de: e.target.value })} />
              <Input type="date" value={params.data_ate} onChange={(e) => update({ data_ate: e.target.value })} />
            </>
          ) : (
            <>
              <Select value={String(params.ano)} onValueChange={(v) => update({ ano: Number(v), periodo: "", data_de: "", data_ate: "" })}>
                <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Todos os anos</SelectItem>
                  {ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(params.mes)} onValueChange={(v) => update({ mes: Number(v), periodo: "", data_de: "", data_ate: "" })}>
                <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Todos meses</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Select value={params.tipo || "all"} onValueChange={(v) => update({ tipo: (v === "all" ? "" : v) as typeof params.tipo })}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              {tiposPermitidos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(params.empresa)} onValueChange={(v) => update({ empresa: Number(v) })}>
            <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Todas empresas</SelectItem>
              {(empresas.data ?? [])
                .filter((e) => user.ve_todas_empresas || user.empresas_ids.includes(e.id))
                .map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(params.unidade)} onValueChange={(v) => update({ unidade: Number(v) })}>
            <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Todas unidades</SelectItem>
              {(unidades.data ?? [])
                .filter((u) => !params.empresa || u.empresa_id === params.empresa)
                .map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(params.categoria)} onValueChange={(v) => update({ categoria: Number(v) })}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Todas categorias</SelectItem>
              {(categorias.data ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={params.revisado || "all"} onValueChange={(v) => update({ revisado: (v === "all" ? "" : v) as typeof params.revisado })}>
            <SelectTrigger><SelectValue placeholder="Revisado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="sim">Revisados</SelectItem>
              <SelectItem value="nao">Não revisados</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Buscar descrição..."
            defaultValue={params.q}
            onBlur={(e) => update({ q: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") update({ q: (e.target as HTMLInputElement).value });
            }}
            className="lg:col-span-2"
          />
          <Button variant="ghost" onClick={() => nav((prev) => ({ tab: prev.tab, ano: 0, mes: 0, tipo: "", empresa: 0, unidade: 0, categoria: 0, q: "", revisado: "", page: 1, data_de: "", data_ate: "", periodo: "" }))}>
            Limpar
          </Button>

        </CardContent>
      </Card>

      {/* ===== Resumo dos filtros ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Receita (filtro)</CardTitle></CardHeader>
          <CardContent className="pt-0"><div className="text-xl font-semibold tabular-nums text-success">{formatBRL(resumo.receita)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Despesa (filtro)</CardTitle></CardHeader>
          <CardContent className="pt-0"><div className="text-xl font-semibold tabular-nums text-destructive">{formatBRL(resumo.despesa)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Saldo</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className={`text-xl font-semibold tabular-nums ${resumo.saldo < 0 ? "text-destructive" : "text-success"}`}>
              {formatBRL(resumo.saldo)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Qtd. lançamentos</CardTitle></CardHeader>
          <CardContent className="pt-0"><div className="text-xl font-semibold tabular-nums">{total}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top grupos (receita + despesa)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              {!aggSuportado ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground text-center px-4">Gráfico desativado: filtros por categoria ou texto livre não são suportados pela view agregada. Limpe o filtro de categoria/busca para ver agregação.</div>
              ) : aggQ.isLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando…</div>
              ) : aggQ.error ? (
                <div className="h-full flex items-center justify-center text-sm text-destructive">Erro: {(aggQ.error as Error).message}</div>
              ) : resumo.categorias.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados no filtro</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resumo.categorias} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 70%)" opacity={0.3} horizontal={false} />
                    <XAxis type="number" tick={{ fill: "hsl(220 9% 46%)", fontSize: 11 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v as number)} />
                    <YAxis type="category" dataKey="nome" width={140} tick={{ fill: "hsl(220 9% 46%)", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(220 13% 70%)", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number) => formatBRL(value)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="receita" name="Receita" stackId="a" fill="hsl(142 71% 45%)" />
                    <Bar dataKey="despesa" name="Despesa" stackId="a" fill="hsl(0 84% 60%)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Evolução mensal</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              {!aggSuportado ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground text-center px-4">Gráfico desativado para filtros avançados.</div>
              ) : aggQ.isLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando…</div>
              ) : aggQ.error ? (
                <div className="h-full flex items-center justify-center text-sm text-destructive">Erro: {(aggQ.error as Error).message}</div>
              ) : resumo.meses.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados no filtro</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={resumo.meses} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 70%)" opacity={0.3} />
                    <XAxis dataKey="mes" tick={{ fill: "hsl(220 9% 46%)", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "hsl(220 9% 46%)", fontSize: 11 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v as number)} />
                    <Tooltip contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(220 13% 70%)", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number) => formatBRL(value)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="receita" name="Receita" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="despesa" name="Despesa" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(217 91% 60%)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Data</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-20">Rev.</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              )}
              {!list.isLoading && (list.data?.rows.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum lançamento encontrado.</TableCell></TableRow>
              )}
              {list.data?.rows.map((l) => {
                const editavel = podeEditarLancamento(user, l);
                return (
                  <TableRow key={l.id}>
                    <TableCell>{formatDate(l.data)}</TableCell>
                    <TableCell className="text-sm">{empresaNome(l.empresa_id)}</TableCell>
                    <TableCell><Badge variant="outline">{l.tipo}</Badge></TableCell>
                    <TableCell className="text-sm">
                      {editavel ? (
                        <Select
                          value={l.categoria_id ? String(l.categoria_id) : "0"}
                          onValueChange={(v) =>
                            atualizarCategoria.mutate({ l, categoria_id: v === "0" ? null : Number(v) })
                          }
                        >
                          <SelectTrigger className="h-8 w-[180px] text-xs">
                            <SelectValue placeholder="Sem categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">— Sem categoria —</SelectItem>
                            {(categorias.data ?? []).map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        categoriaNome(l.categoria_id)
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-[280px] truncate" title={l.descricao ?? ""}>{l.descricao ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(Number(l.valor))}</TableCell>
                    <TableCell>
                      {l.revisado
                        ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">sim</Badge>
                        : <Badge variant="secondary">não</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" disabled={!editavel} onClick={() => dlg.openEdit(l)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {podeMarcarRevisado(user) && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => marcarRevisado.mutate(l)}
                            title={l.revisado ? "Desmarcar" : "Marcar revisado"}
                          >
                            <CheckCircle2 className={`h-4 w-4 ${l.revisado ? "text-emerald-600" : ""}`} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{total} lançamentos · página {params.page} de {totalPages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={params.page <= 1}
            onClick={() => nav((p) => ({ ...p, page: Math.max(1, (p.page ?? 1) - 1) }))}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" disabled={params.page >= totalPages}
            onClick={() => nav((p) => ({ ...p, page: Math.min(totalPages, (p.page ?? 1) + 1) }))}>
            Próxima
          </Button>

        </div>
      </div>

      <LancamentoDialog open={dlg.open} onOpenChange={dlg.setOpen} lancamento={dlg.editing} />
    </div>
  );
}
