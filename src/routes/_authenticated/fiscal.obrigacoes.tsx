import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { from, asRows } from "@/integrations/supabase/db";
import { supabase } from "@/integrations/supabase/client";
import type { ObrigacaoFiscalRow } from "@/integrations/supabase/database";
import { useEmpresas } from "@/hooks/use-refs";
import { PageShell } from "@/components/bj7/PageShell";
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
import { Plus, CheckCircle2, Trash2, Pencil, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/fiscal/obrigacoes")({
  component: ObrigacoesPage,
});

type Tab = "proximas" | "vencidas" | "pagas" | "todas";

const TIPOS_COMUNS = ["DAS", "INSS", "FGTS", "IRRF", "ICMS", "ISS", "PIS", "COFINS", "Outras"];

function brl(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function ObrigacoesPage() {
  const qc = useQueryClient();
  const empresas = useEmpresas();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [tab, setTab] = useState<Tab>("proximas");
  const [empresaId, setEmpresaId] = useState("0");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ObrigacaoFiscalRow | null>(null);
  const [delTarget, setDelTarget] = useState<ObrigacaoFiscalRow | null>(null);

  const q = useQuery({
    queryKey: ["obrigacoes_fiscais", { tab, empresaId }],
    queryFn: async () => {
      let qb = from("obrigacoes_fiscais").select("*").order("vencimento", { ascending: true }).limit(2000);
      if (empresaId !== "0") qb = qb.eq("empresa_id", Number(empresaId));
      if (tab === "proximas") qb = qb.in("status", ["pendente", "aberta"]).gte("vencimento", todayIso);
      else if (tab === "vencidas") qb = qb.in("status", ["pendente", "aberta"]).lt("vencimento", todayIso);
      else if (tab === "pagas") qb = qb.in("status", ["paga", "cumprida"]);
      const r = await qb;
      if (r.error) throw r.error;
      return asRows("obrigacoes_fiscais", r.data);
    },
  });

  const empresaNome = (id: number | null) =>
    id ? empresas.data?.find(e => e.id === id)?.nome ?? `#${id}` : "—";

  const marcarPaga = useMutation({
    mutationFn: async (row: ObrigacaoFiscalRow) => {
      const r = await supabase.from("obrigacoes_fiscais").update({
        status: "paga",
        data_pagamento: todayIso,
        valor_pago: row.valor,
      }).eq("id", row.id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Obrigação marcada como paga");
      qc.invalidateQueries({ queryKey: ["obrigacoes_fiscais"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.from("obrigacoes_fiscais").delete().eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Excluída");
      setDelTarget(null);
      qc.invalidateQueries({ queryKey: ["obrigacoes_fiscais"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell
      title="Obrigações Fiscais"
      description="Calendário de tributos, guias e cumprimento"
      actions={
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nova obrigação
        </Button>
      }
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="proximas">Próximas</TabsTrigger>
            <TabsTrigger value="vencidas">Vencidas</TabsTrigger>
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
              <TableHead>Tipo</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Competência</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[160px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6" /></TableCell></TableRow>
              ))
            ) : (q.data?.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma obrigação encontrada
                </TableCell>
              </TableRow>
            ) : (
              q.data!.map(o => {
                const isPaga = o.status === "paga" || o.status === "cumprida";
                const atrasada = !isPaga && o.vencimento < todayIso;
                return (
                  <TableRow key={o.id}>
                    <TableCell className={cn("tabular", atrasada && "text-destructive font-medium")}>
                      {atrasada && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                      {formatDate(o.vencimento)}
                    </TableCell>
                    <TableCell className="font-medium">{o.tipo}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{empresaNome(o.empresa_id)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(o.competencia)}</TableCell>
                    <TableCell className="text-right tabular">{brl(Number(o.valor))}</TableCell>
                    <TableCell>
                      {isPaga ? (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Paga</Badge>
                      ) : atrasada ? (
                        <Badge className="bg-destructive/15 text-destructive border-destructive/30">Vencida</Badge>
                      ) : (
                        <Badge variant="outline">{o.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {o.guia_url && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={o.guia_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                          </Button>
                        )}
                        {!isPaga && (
                          <Button size="sm" variant="ghost" onClick={() => marcarPaga.mutate(o)}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(o); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDelTarget(o)}>
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

      <ObrigacaoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["obrigacoes_fiscais"] })}
      />

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir obrigação?</AlertDialogTitle>
            <AlertDialogDescription>"{delTarget?.tipo} — {formatDate(delTarget?.vencimento)}" — não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => delTarget && del.mutate(delTarget.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function ObrigacaoDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: ObrigacaoFiscalRow | null;
  onSaved: () => void;
}) {
  const empresas = useEmpresas();
  const isEdit = !!editing;

  const [tipo, setTipo] = useState("DAS");
  const [descricao, setDescricao] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [valor, setValor] = useState("");
  const [empresaId, setEmpresaId] = useState("0");
  const [guiaUrl, setGuiaUrl] = useState("");
  const [observacao, setObservacao] = useState("");

  useMemo(() => {
    if (!open) return;
    if (editing) {
      setTipo(editing.tipo);
      setDescricao(editing.descricao ?? "");
      setCompetencia(editing.competencia.slice(0, 10));
      setVencimento(editing.vencimento.slice(0, 10));
      setValor(editing.valor != null ? String(editing.valor) : "");
      setEmpresaId(editing.empresa_id ? String(editing.empresa_id) : "0");
      setGuiaUrl(editing.guia_url ?? "");
      setObservacao(editing.observacao ?? "");
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const compMes = today.slice(0, 7) + "-01";
      setTipo("DAS");
      setDescricao("");
      setCompetencia(compMes);
      setVencimento(today);
      setValor("");
      setEmpresaId("0");
      setGuiaUrl("");
      setObservacao("");
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!tipo.trim() || !competencia || !vencimento) throw new Error("Preencha tipo, competência e vencimento");
      const payload = {
        tipo: tipo.trim(),
        descricao: descricao.trim() || null,
        competencia,
        vencimento,
        valor: valor ? Number(valor.replace(",", ".")) : null,
        empresa_id: empresaId !== "0" ? Number(empresaId) : null,
        guia_url: guiaUrl.trim() || null,
        observacao: observacao.trim() || null,
      };
      if (isEdit && editing) {
        const r = await supabase.from("obrigacoes_fiscais").update(payload).eq("id", editing.id);
        if (r.error) throw r.error;
      } else {
        const r = await supabase.from("obrigacoes_fiscais").insert({ ...payload, status: "pendente" });
        if (r.error) throw r.error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Atualizada" : "Criada");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar obrigação" : "Nova obrigação fiscal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_COMUNS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Empresa</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">—</SelectItem>
                  {empresas.data?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Competência</Label>
              <Input type="date" value={competencia} onChange={e => setCompetencia(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Vencimento</Label>
              <Input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
            </div>
          </div>
          <div>
            <Label className="text-xs">URL da guia</Label>
            <Input value={guiaUrl} onChange={e => setGuiaUrl(e.target.value)} placeholder="https://..." />
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
