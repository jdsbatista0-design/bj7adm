import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { from, asRows } from "@/integrations/supabase/db";
import { supabase } from "@/integrations/supabase/client";
import type { ContaAPagarRow } from "@/integrations/supabase/database";
import { useEmpresas, useCategorias } from "@/hooks/use-refs";
import { ContaAPagarDialog } from "@/components/financeiro/ContaAPagarDialog";

import { PageShell } from "@/components/bj7/PageShell";
import { KpiCard } from "@/components/bj7/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, CheckCircle2, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/financeiro/contas-a-pagar")({
  component: ContasAPagarPage,
});

type Tab = "vencer" | "atrasadas" | "pagas" | "todas";

const RECORRENCIAS = [
  { value: "unica", label: "Única" },
  { value: "mensal", label: "Mensal (12x)" },
  { value: "anual", label: "Anual (3x)" },
];

function brl(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function ContasAPagarPage() {
  const qc = useQueryClient();
  
  const empresas = useEmpresas();
  const categorias = useCategorias();

  const [tab, setTab] = useState<Tab>("vencer");
  const [empresaId, setEmpresaId] = useState<string>("0");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContaAPagarRow | null>(null);
  const [delTarget, setDelTarget] = useState<ContaAPagarRow | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  const q = useQuery({
    queryKey: ["contas_a_pagar", { tab, empresaId }],
    queryFn: async () => {
      let qb = from("contas_a_pagar").select("*").order("vencimento", { ascending: true }).limit(2000);
      if (empresaId !== "0") qb = qb.eq("empresa_id", Number(empresaId));
      if (tab === "vencer") qb = qb.eq("pago", false).gte("vencimento", todayIso);
      else if (tab === "atrasadas") qb = qb.eq("pago", false).lt("vencimento", todayIso);
      else if (tab === "pagas") qb = qb.eq("pago", true);
      const r = await qb;
      if (r.error) throw r.error;
      return asRows("contas_a_pagar", r.data);
    },
  });

  // KPIs simples sobre o mês atual
  const kpiQ = useQuery({
    queryKey: ["contas_a_pagar", "kpis", empresaId],
    queryFn: async () => {
      const ini = todayIso.slice(0, 7) + "-01";
      const fim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
      let qb = from("contas_a_pagar").select("*").gte("vencimento", ini).lte("vencimento", fim);
      if (empresaId !== "0") qb = qb.eq("empresa_id", Number(empresaId));
      const r = await qb;
      if (r.error) throw r.error;
      const rows = asRows("contas_a_pagar", r.data);
      const aVencer = rows.filter(r => !r.pago && r.vencimento >= todayIso).reduce((a, b) => a + Number(b.valor || 0), 0);
      const atrasadas = rows.filter(r => !r.pago && r.vencimento < todayIso).reduce((a, b) => a + Number(b.valor || 0), 0);
      const pagas = rows.filter(r => r.pago).reduce((a, b) => a + Number(b.valor_pago ?? b.valor ?? 0), 0);
      return { aVencer, atrasadas, pagas };
    },
  });

  const empresaNome = (id: number | null) =>
    id ? empresas.data?.find(e => e.id === id)?.nome ?? `#${id}` : "—";
  const categoriaNome = (id: number | null) =>
    id ? categorias.data?.find(c => c.id === id)?.nome ?? `#${id}` : "—";

  const marcarPago = useMutation({
    mutationFn: async (row: ContaAPagarRow) => {
      const r = await supabase.from("contas_a_pagar").update({
        pago: true,
        data_pagamento: todayIso,
        valor_pago: row.valor,
      }).eq("id", row.id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Marcada como paga");
      qc.invalidateQueries({ queryKey: ["contas_a_pagar"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.from("contas_a_pagar").delete().eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Excluída");
      setDelTarget(null);
      qc.invalidateQueries({ queryKey: ["contas_a_pagar"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell
      title="Contas a Pagar"
      description="Acompanhamento de obrigações financeiras"
      actions={
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nova conta
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="A vencer (mês)" value={kpiQ.isLoading ? "..." : brl(kpiQ.data?.aVencer)} />
        <KpiCard label="Atrasadas (mês)" value={kpiQ.isLoading ? "..." : brl(kpiQ.data?.atrasadas)} status={(kpiQ.data?.atrasadas ?? 0) > 0 ? "critico" : "neutral"} />
        <KpiCard label="Pagas (mês)" value={kpiQ.isLoading ? "..." : brl(kpiQ.data?.pagas)} status="ok" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="vencer">A vencer</TabsTrigger>
            <TabsTrigger value="atrasadas">Atrasadas</TabsTrigger>
            <TabsTrigger value="pagas">Pagas</TabsTrigger>
            <TabsTrigger value="todas">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex-1" />
        <Select value={empresaId} onValueChange={setEmpresaId}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Todas as empresas</SelectItem>
            {empresas.data?.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-white/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[140px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}><Skeleton className="h-6" /></TableCell>
                </TableRow>
              ))
            ) : (q.data?.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma conta encontrada
                </TableCell>
              </TableRow>
            ) : (
              q.data!.map(c => {
                const atrasada = !c.pago && c.vencimento < todayIso;
                return (
                  <TableRow key={c.id}>
                    <TableCell className={cn("tabular", atrasada && "text-destructive font-medium")}>
                      {atrasada && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                      {formatDate(c.vencimento)}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">{c.descricao}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{empresaNome(c.empresa_id)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{categoriaNome(c.categoria_id)}</TableCell>
                    <TableCell className="text-right tabular">{brl(Number(c.valor))}</TableCell>
                    <TableCell>
                      {c.pago ? (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Pago</Badge>
                      ) : atrasada ? (
                        <Badge className="bg-destructive/15 text-destructive border-destructive/30">Atrasada</Badge>
                      ) : (
                        <Badge variant="outline">A vencer</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!c.pago && (
                          <Button size="sm" variant="ghost" onClick={() => marcarPago.mutate(c)} title="Marcar como paga">
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDelTarget(c)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ContaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["contas_a_pagar"] })}
      />

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              "{delTarget?.descricao}" — esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => delTarget && del.mutate(delTarget.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function ContaDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: ContaAPagarRow | null;
  onSaved: () => void;
}) {
  const empresas = useEmpresas();
  const categorias = useCategorias();
  const isEdit = !!editing;

  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [empresaId, setEmpresaId] = useState("0");
  const [categoriaId, setCategoriaId] = useState("0");
  const [recorrencia, setRecorrencia] = useState("unica");
  const [observacao, setObservacao] = useState("");

  useMemo(() => {
    if (!open) return;
    if (editing) {
      setDescricao(editing.descricao);
      setValor(String(editing.valor));
      setVencimento(editing.vencimento.slice(0, 10));
      setEmpresaId(editing.empresa_id ? String(editing.empresa_id) : "0");
      setCategoriaId(editing.categoria_id ? String(editing.categoria_id) : "0");
      setRecorrencia(editing.recorrencia ?? "unica");
      setObservacao(editing.observacao ?? "");
    } else {
      setDescricao("");
      setValor("");
      setVencimento(new Date().toISOString().slice(0, 10));
      setEmpresaId("0");
      setCategoriaId("0");
      setRecorrencia("unica");
      setObservacao("");
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const valorNum = Number(valor.replace(",", "."));
      if (!descricao.trim() || !valorNum || !vencimento) throw new Error("Preencha descrição, valor e vencimento");

      const base = {
        descricao: descricao.trim(),
        valor: valorNum,
        vencimento,
        empresa_id: empresaId !== "0" ? Number(empresaId) : null,
        categoria_id: categoriaId !== "0" ? Number(categoriaId) : null,
        observacao: observacao.trim() || null,
      };

      if (isEdit && editing) {
        const r = await supabase.from("contas_a_pagar").update({ ...base, recorrencia }).eq("id", editing.id);
        if (r.error) throw r.error;
        return;
      }

      // Criação — gera N parcelas se recorrente
      const grupoId = recorrencia === "unica" ? null : crypto.randomUUID();
      const count = recorrencia === "mensal" ? 12 : recorrencia === "anual" ? 3 : 1;
      const baseDate = new Date(vencimento + "T00:00:00");
      const rows = Array.from({ length: count }, (_, i) => {
        const d = new Date(baseDate);
        if (recorrencia === "mensal") d.setMonth(d.getMonth() + i);
        if (recorrencia === "anual") d.setFullYear(d.getFullYear() + i);
        return {
          ...base,
          vencimento: d.toISOString().slice(0, 10),
          recorrencia,
          pago: false,
          grupo_id: grupoId,
          criado_por: null,
        };
      });
      const r = await supabase.from("contas_a_pagar").insert(rows);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Atualizada" : "Conta(s) criada(s)");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conta" : "Nova conta a pagar"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label className="text-xs">Vencimento</Label>
              <Input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Empresa</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">—</SelectItem>
                  {empresas.data?.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">—</SelectItem>
                  {categorias.data?.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Recorrência</Label>
            <Select value={recorrencia} onValueChange={setRecorrencia} disabled={isEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECORRENCIAS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Observação</Label>
            <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
