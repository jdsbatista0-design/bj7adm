import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { from, asRows } from "@/integrations/supabase/db";
import { supabase } from "@/integrations/supabase/client";
import type { JuridicoProcessoRow } from "@/integrations/supabase/database";
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
import { Plus, Trash2, Pencil, Scale, AlertTriangle, Gavel } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/juridico/processos")({
  component: ProcessosPage,
});

type Tab = "ativos" | "encerrados" | "todos";

const TIPOS = ["Trabalhista", "Civil", "Tributário", "Cível", "Administrativo", "Criminal", "Outro"];
const STATUS = ["em_andamento", "suspenso", "encerrado", "acordo"];
const POLOS = ["Ativo", "Passivo"];

function brl(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function ProcessosPage() {
  const qc = useQueryClient();
  const empresas = useEmpresas();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [tab, setTab] = useState<Tab>("ativos");
  const [empresaId, setEmpresaId] = useState("0");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JuridicoProcessoRow | null>(null);
  const [delTarget, setDelTarget] = useState<JuridicoProcessoRow | null>(null);

  const q = useQuery({
    queryKey: ["juridico_processos", { tab, empresaId }],
    queryFn: async () => {
      let qb = from("juridico_processos").select("*").order("proxima_audiencia", { ascending: true, nullsFirst: false }).limit(2000);
      if (empresaId !== "0") qb = qb.eq("empresa_id", Number(empresaId));
      if (tab === "ativos") qb = qb.in("status", ["em_andamento", "suspenso"]);
      else if (tab === "encerrados") qb = qb.in("status", ["encerrado", "acordo"]);
      const r = await qb;
      if (r.error) throw r.error;
      return asRows("juridico_processos", r.data);
    },
  });

  const empresaNome = (id: number | null) =>
    id ? empresas.data?.find(e => e.id === id)?.nome ?? `#${id}` : "—";

  const kpis = useMemo(() => {
    const rows = q.data ?? [];
    const ativos = rows.filter(r => r.status === "em_andamento" || r.status === "suspenso");
    return {
      ativos: ativos.length,
      provisao: ativos.reduce((s, r) => s + Number(r.valor_provisao ?? 0), 0),
      causa: ativos.reduce((s, r) => s + Number(r.valor_causa ?? 0), 0),
      proxAud: rows.filter(r => r.proxima_audiencia && r.proxima_audiencia >= todayIso).length,
    };
  }, [q.data, todayIso]);

  const del = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.from("juridico_processos").delete().eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Processo excluído");
      setDelTarget(null);
      qc.invalidateQueries({ queryKey: ["juridico_processos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell
      title="Processos jurídicos"
      description="Acompanhe ações, audiências e provisões de contingências"
      actions={
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo processo
        </Button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Ativos" value={String(kpis.ativos)} icon={Scale} />
        <Kpi label="Próx. audiências" value={String(kpis.proxAud)} icon={Gavel} />
        <Kpi label="Provisão total" value={brl(kpis.provisao)} icon={AlertTriangle} />
        <Kpi label="Valor de causa" value={brl(kpis.causa)} icon={Scale} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="ativos">Ativos</TabsTrigger>
            <TabsTrigger value="encerrados">Encerrados</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
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
              <TableHead>Número</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Contraparte</TableHead>
              <TableHead>Polo</TableHead>
              <TableHead>Próx. audiência</TableHead>
              <TableHead className="text-right">Provisão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-6" /></TableCell></TableRow>
              ))
            ) : (q.data?.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum processo encontrado
                </TableCell>
              </TableRow>
            ) : (
              q.data!.map(p => {
                const isEnc = p.status === "encerrado" || p.status === "acordo";
                const audProxima = p.proxima_audiencia && p.proxima_audiencia >= todayIso;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.numero ?? "—"}</TableCell>
                    <TableCell>{p.tipo}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{empresaNome(p.empresa_id)}</TableCell>
                    <TableCell className="text-xs">{p.contraparte ?? "—"}</TableCell>
                    <TableCell>
                      {p.polo ? <Badge variant="outline" className="text-[10px]">{p.polo}</Badge> : "—"}
                    </TableCell>
                    <TableCell className={cn("tabular text-xs", audProxima && "text-amber-300 font-medium")}>
                      {formatDate(p.proxima_audiencia)}
                    </TableCell>
                    <TableCell className="text-right tabular">{brl(Number(p.valor_provisao))}</TableCell>
                    <TableCell>
                      {isEnc ? (
                        <Badge className="bg-muted text-muted-foreground">{p.status}</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">{p.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDelTarget(p)}>
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

      <ProcessoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["juridico_processos"] })}
      />

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir processo?</AlertDialogTitle>
            <AlertDialogDescription>"{delTarget?.numero ?? delTarget?.tipo}" — não pode ser desfeito.</AlertDialogDescription>
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

function ProcessoDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: JuridicoProcessoRow | null;
  onSaved: () => void;
}) {
  const empresas = useEmpresas();
  const isEdit = !!editing;

  const [numero, setNumero] = useState("");
  const [tipo, setTipo] = useState("Trabalhista");
  const [descricao, setDescricao] = useState("");
  const [contraparte, setContraparte] = useState("");
  const [advogado, setAdvogado] = useState("");
  const [vara, setVara] = useState("");
  const [polo, setPolo] = useState("Passivo");
  const [status, setStatus] = useState("em_andamento");
  const [valorCausa, setValorCausa] = useState("");
  const [valorProvisao, setValorProvisao] = useState("");
  const [proxAud, setProxAud] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [empresaId, setEmpresaId] = useState("0");
  const [observacao, setObservacao] = useState("");

  useMemo(() => {
    if (!open) return;
    if (editing) {
      setNumero(editing.numero ?? "");
      setTipo(editing.tipo);
      setDescricao(editing.descricao ?? "");
      setContraparte(editing.contraparte ?? "");
      setAdvogado(editing.advogado ?? "");
      setVara(editing.vara ?? "");
      setPolo(editing.polo ?? "Passivo");
      setStatus(editing.status);
      setValorCausa(editing.valor_causa != null ? String(editing.valor_causa) : "");
      setValorProvisao(editing.valor_provisao != null ? String(editing.valor_provisao) : "");
      setProxAud(editing.proxima_audiencia?.slice(0, 10) ?? "");
      setDataInicio(editing.data_inicio?.slice(0, 10) ?? "");
      setEmpresaId(editing.empresa_id ? String(editing.empresa_id) : "0");
      setObservacao(editing.observacao ?? "");
    } else {
      setNumero(""); setTipo("Trabalhista"); setDescricao(""); setContraparte("");
      setAdvogado(""); setVara(""); setPolo("Passivo"); setStatus("em_andamento");
      setValorCausa(""); setValorProvisao(""); setProxAud("");
      setDataInicio(new Date().toISOString().slice(0, 10));
      setEmpresaId("0"); setObservacao("");
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!tipo.trim()) throw new Error("Informe o tipo");
      const payload = {
        numero: numero.trim() || null,
        tipo: tipo.trim(),
        descricao: descricao.trim() || null,
        contraparte: contraparte.trim() || null,
        advogado: advogado.trim() || null,
        vara: vara.trim() || null,
        polo: polo || null,
        status,
        valor_causa: valorCausa ? Number(valorCausa.replace(",", ".")) : null,
        valor_provisao: valorProvisao ? Number(valorProvisao.replace(",", ".")) : null,
        proxima_audiencia: proxAud || null,
        data_inicio: dataInicio || null,
        empresa_id: empresaId !== "0" ? Number(empresaId) : null,
        observacao: observacao.trim() || null,
      };
      if (isEdit && editing) {
        const r = await supabase.from("juridico_processos").update(payload).eq("id", editing.id);
        if (r.error) throw r.error;
      } else {
        const r = await supabase.from("juridico_processos").insert(payload);
        if (r.error) throw r.error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Atualizado" : "Criado");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar processo" : "Novo processo jurídico"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Número do processo</Label>
              <Input value={numero} onChange={e => setNumero(e.target.value)} placeholder="0000000-00.0000.0.00.0000" />
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
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Polo</Label>
              <Select value={polo} onValueChange={setPolo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{POLOS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Contraparte</Label>
              <Input value={contraparte} onChange={e => setContraparte(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Advogado responsável</Label>
              <Input value={advogado} onChange={e => setAdvogado(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Vara / Foro</Label>
              <Input value={vara} onChange={e => setVara(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Valor causa (R$)</Label>
              <Input value={valorCausa} onChange={e => setValorCausa(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label className="text-xs">Provisão (R$)</Label>
              <Input value={valorProvisao} onChange={e => setValorProvisao(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label className="text-xs">Próx. audiência</Label>
              <Input type="date" value={proxAud} onChange={e => setProxAud(e.target.value)} />
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
