import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { from, asRows } from "@/integrations/supabase/db";
import type { LancamentoRow } from "@/integrations/supabase/database";
import { useEmpresas, useUnidades, useCategorias } from "@/hooks/use-refs";
import { useCurrentUser } from "@/contexts/auth-context";
import {
  tiposVisiveis,
  podeEditarLancamento,
  podeMarcarRevisado,
  podeLancar,
} from "@/lib/permissions";
import { formatBRL, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, CheckCircle2, Plus } from "lucide-react";
import { LancamentoDialog, useLancamentoDialog } from "@/components/lancamento/LancamentoDialog";
import { toast } from "sonner";

const PAGE_SIZE = 50;
const ANOS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

const search = z.object({
  ano: fallback(z.number().int(), 0).default(0),
  mes: fallback(z.number().int().min(0).max(12), 0).default(0),
  tipo: fallback(z.enum(["", "Receita", "Despesa", "Retirada", "Empréstimo"]), "").default(""),
  empresa: fallback(z.number().int(), 0).default(0),
  unidade: fallback(z.number().int(), 0).default(0),
  categoria: fallback(z.number().int(), 0).default(0),
  q: fallback(z.string(), "").default(""),
  revisado: fallback(z.enum(["", "sim", "nao"]), "").default(""),
  page: fallback(z.number().int().min(1), 1).default(1),
});

export const Route = createFileRoute("/_authenticated/razao")({
  validateSearch: zodValidator(search),
  component: RazaoPage,
});

function RazaoPage() {
  const user = useCurrentUser();
  const params = Route.useSearch();
  const navigate = useNavigate({ from: "/razao" });
  const empresas = useEmpresas();
  const unidades = useUnidades();
  const categorias = useCategorias();
  const dlg = useLancamentoDialog();
  const qc = useQueryClient();

  const tiposPermitidos = tiposVisiveis(user);

  const queryKey = useMemo(
    () => ["lancamentos", params, user.id] as const,
    [params, user.id],
  );

  const list = useQuery({
    queryKey,
    queryFn: async () => {
      let q = from("lancamentos").select("*", { count: "exact" });
      // Restringe por permissão
      q = q.in("tipo", tiposPermitidos);
      if (!user.ve_todas_empresas) {
        if (user.empresas_ids.length === 0) {
          return { rows: [] as LancamentoRow[], count: 0 };
        }
        q = q.in("empresa_id", user.empresas_ids);
      }
      if (params.ano) q = q.eq("ano", params.ano);
      if (params.mes) q = q.eq("mes", params.mes);
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
  });

  const total = list.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const empresaNome = (id: number | null) =>
    empresas.data?.find((e) => e.id === id)?.nome ?? "—";
  const categoriaNome = (id: number | null) =>
    categorias.data?.find((c) => c.id === id)?.nome ?? "—";

  const atualizarCategoria = useMutation({
    mutationFn: async ({ l, categoria_id }: { l: LancamentoRow; categoria_id: number | null }) => {
      const r = await from("lancamentos")
        .update({ categoria_id })
        .eq("id", l.id);
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

  function update(patch: Partial<typeof params>) {
    void navigate({ search: (prev: typeof params) => ({ ...prev, ...patch, page: 1 }) });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Razão</h1>
        {podeLancar(user) && (
          <Button onClick={dlg.openNew}>
            <Plus className="h-4 w-4 mr-1" /> Novo lançamento
          </Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <Select value={String(params.ano)} onValueChange={(v) => update({ ano: Number(v) })}>
            <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Todos os anos</SelectItem>
              {ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(params.mes)} onValueChange={(v) => update({ mes: Number(v) })}>
            <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Todos meses</SelectItem>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Button variant="ghost" onClick={() => void navigate({ search: () => ({ ano: 0, mes: 0, tipo: "" as const, empresa: 0, unidade: 0, categoria: 0, q: "", revisado: "" as const, page: 1 }) })}>
            Limpar
          </Button>
        </CardContent>
      </Card>

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
                    <TableCell className="text-sm">{categoriaNome(l.categoria_id)}</TableCell>
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
            onClick={() => void navigate({ search: (p: typeof params) => ({ ...p, page: Math.max(1, p.page - 1) }) })}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" disabled={params.page >= totalPages}
            onClick={() => void navigate({ search: (p: typeof params) => ({ ...p, page: Math.min(totalPages, p.page + 1) }) })}>
            Próxima
          </Button>
        </div>
      </div>

      <LancamentoDialog open={dlg.open} onOpenChange={dlg.setOpen} lancamento={dlg.editing} />
    </div>
  );
}
