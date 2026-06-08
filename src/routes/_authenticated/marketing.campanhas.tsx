import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { from, asRows } from "@/integrations/supabase/db";
import { supabase } from "@/integrations/supabase/client";
import type { MktCampanhaRow } from "@/integrations/supabase/database";
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
import { Plus, Trash2, Pencil, Megaphone, TrendingUp, DollarSign, Target } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/marketing/campanhas")({
  component: CampanhasPage,
});

type Tab = "ativas" | "encerradas" | "todas";

const CANAIS = ["Google Ads", "Meta Ads", "LinkedIn", "Email", "Orgânico", "Influencer", "Evento", "Outro"];
const STATUS = ["planejada", "ativa", "pausada", "encerrada"];

function brl(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function CampanhasPage() {
  const qc = useQueryClient();
  const empresas = useEmpresas();

  const [tab, setTab] = useState<Tab>("ativas");
  const [empresaId, setEmpresaId] = useState("0");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MktCampanhaRow | null>(null);
  const [delTarget, setDelTarget] = useState<MktCampanhaRow | null>(null);

  const q = useQuery({
    queryKey: ["mkt_campanhas", { tab, empresaId }],
    queryFn: async () => {
      let qb = from("mkt_campanhas").select("*").order("data_inicio", { ascending: false, nullsFirst: false }).limit(2000);
      if (empresaId !== "0") qb = qb.eq("empresa_id", Number(empresaId));
      if (tab === "ativas") qb = qb.in("status", ["ativa", "planejada", "pausada"]);
      else if (tab === "encerradas") qb = qb.eq("status", "encerrada");
      const r = await qb;
      if (r.error) throw r.error;
      return asRows("mkt_campanhas", r.data);
    },
  });

  const empresaNome = (id: number | null) =>
    id ? empresas.data?.find(e => e.id === id)?.nome ?? `#${id}` : "—";

  const kpis = useMemo(() => {
    const rows = q.data ?? [];
    const orc = rows.reduce((s, r) => s + Number(r.orcamento ?? 0), 0);
    const gasto = rows.reduce((s, r) => s + Number(r.gasto_realizado ?? 0), 0);
    const leads = rows.reduce((s, r) => s + Number(r.leads_gerados ?? 0), 0);
    const conv = rows.reduce((s, r) => s + Number(r.conversoes ?? 0), 0);
    const cpl = leads > 0 ? gasto / leads : 0;
    return { orc, gasto, leads, conv, cpl };
  }, [q.data]);

  const del = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.from("mkt_campanhas").delete().eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Campanha excluída");
      setDelTarget(null);
      qc.invalidateQueries({ queryKey: ["mkt_campanhas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell
      title="Campanhas de marketing"
      description="Acompanhe canais, orçamento, leads e conversões"
      actions={
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nova campanha
        </Button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Orçamento" value={brl(kpis.orc)} icon={DollarSign} />
        <Kpi label="Gasto" value={brl(kpis.gasto)} icon={TrendingUp} />
        <Kpi label="Leads" value={String(kpis.leads)} icon={Target} />
        <Kpi label="Conversões" value={String(kpis.conv)} icon={Megaphone} />
        <Kpi label="CPL médio" value={brl(kpis.cpl)} icon={DollarSign} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="ativas">Em curso</TabsTrigger>
            <TabsTrigger value="encerradas">Encerradas</TabsTrigger>
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
              <TableHead>Nome</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Orçamento</TableHead>
              <TableHead className="text-right">Gasto</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Conv.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={10}><Skeleton className="h-6" /></TableCell></TableRow>
              ))
            ) : (q.data?.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma campanha encontrada
                </TableCell>
              </TableRow>
            ) : (
              q.data!.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{c.canal}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{empresaNome(c.empresa_id)}</TableCell>
                  <TableCell className="text-xs">
                    {formatDate(c.data_inicio)} → {formatDate(c.data_fim)}
                  </TableCell>
                  <TableCell className="text-right tabular">{brl(Number(c.orcamento))}</TableCell>
                  <TableCell className="text-right tabular">{brl(Number(c.gasto_realizado))}</TableCell>
                  <TableCell className="text-right tabular">{c.leads_gerados ?? 0}</TableCell>
                  <TableCell className="text-right tabular">{c.conversoes ?? 0}</TableCell>
                  <TableCell>
                    {c.status === "ativa" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Ativa</Badge>
                    ) : c.status === "encerrada" ? (
                      <Badge className="bg-muted text-muted-foreground">Encerrada</Badge>
                    ) : (
                      <Badge variant="outline">{c.status}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDelTarget(c)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CampanhaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["mkt_campanhas"] })}
      />

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>"{delTarget?.nome}" — não pode ser desfeito.</AlertDialogDescription>
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

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-white/5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular">{value}</div>
    </div>
  );
}

function CampanhaDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: MktCampanhaRow | null;
  onSaved: () => void;
}) {
  const empresas = useEmpresas();
  const isEdit = !!editing;

  const [nome, setNome] = useState("");
  const [canal, setCanal] = useState("Google Ads");
  const [status, setStatus] = useState("planejada");
  const [objetivo, setObjetivo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [orcamento, setOrcamento] = useState("");
  const [gasto, setGasto] = useState("");
  const [leads, setLeads] = useState("");
  const [conv, setConv] = useState("");
  const [empresaId, setEmpresaId] = useState("0");
  const [observacao, setObservacao] = useState("");

  useMemo(() => {
    if (!open) return;
    if (editing) {
      setNome(editing.nome);
      setCanal(editing.canal);
      setStatus(editing.status);
      setObjetivo(editing.objetivo ?? "");
      setDataInicio(editing.data_inicio?.slice(0, 10) ?? "");
      setDataFim(editing.data_fim?.slice(0, 10) ?? "");
      setOrcamento(editing.orcamento != null ? String(editing.orcamento) : "");
      setGasto(editing.gasto_realizado != null ? String(editing.gasto_realizado) : "");
      setLeads(editing.leads_gerados != null ? String(editing.leads_gerados) : "");
      setConv(editing.conversoes != null ? String(editing.conversoes) : "");
      setEmpresaId(editing.empresa_id ? String(editing.empresa_id) : "0");
      setObservacao(editing.observacao ?? "");
    } else {
      setNome(""); setCanal("Google Ads"); setStatus("planejada");
      setObjetivo("");
      setDataInicio(new Date().toISOString().slice(0, 10));
      setDataFim(""); setOrcamento(""); setGasto(""); setLeads("");
      setConv(""); setEmpresaId("0"); setObservacao("");
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Informe o nome da campanha");
      const payload = {
        nome: nome.trim(),
        canal,
        status,
        objetivo: objetivo.trim() || null,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        orcamento: orcamento ? Number(orcamento.replace(",", ".")) : null,
        gasto_realizado: gasto ? Number(gasto.replace(",", ".")) : null,
        leads_gerados: leads ? Number(leads) : null,
        conversoes: conv ? Number(conv) : null,
        empresa_id: empresaId !== "0" ? Number(empresaId) : null,
        observacao: observacao.trim() || null,
      };
      if (isEdit && editing) {
        const r = await supabase.from("mkt_campanhas").update(payload).eq("id", editing.id);
        if (r.error) throw r.error;
      } else {
        const r = await supabase.from("mkt_campanhas").insert(payload);
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
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar campanha" : "Nova campanha"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Black Friday Google Ads" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Canal</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CANAIS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
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
            <Label className="text-xs">Objetivo</Label>
            <Input value={objetivo} onChange={e => setObjetivo(e.target.value)} placeholder="Gerar X leads, vender Y..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Orçamento</Label>
              <Input value={orcamento} onChange={e => setOrcamento(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label className="text-xs">Gasto</Label>
              <Input value={gasto} onChange={e => setGasto(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label className="text-xs">Leads</Label>
              <Input value={leads} onChange={e => setLeads(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">Conversões</Label>
              <Input value={conv} onChange={e => setConv(e.target.value)} placeholder="0" />
            </div>
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
