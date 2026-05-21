import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresas } from "@/hooks/use-refs";
import { PageShell } from "@/components/bj7/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, CheckCircle2, ArrowRightLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fiscal/pendencias")({
  component: FiscalPendenciasPage,
});

type Direcao = "CONTAB_PARA_NOS" | "NOS_PARA_CONTAB";
type Prioridade = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";
type Status = "ABERTA" | "EM_ANDAMENTO" | "RESOLVIDA" | "CANCELADA";

type Pendencia = {
  id: number;
  empresa_id: number | null;
  empresa?: string | null;
  titulo: string;
  descricao: string | null;
  direcao: Direcao;
  prazo: string | null;
  prioridade: Prioridade;
  status: Status;
  criada_em?: string | null;
  resolvida_em?: string | null;
};

const DIRECAO_OPTS: Direcao[] = ["CONTAB_PARA_NOS", "NOS_PARA_CONTAB"];
const PRIORIDADE_OPTS: Prioridade[] = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];
const STATUS_OPTS: Status[] = ["ABERTA", "EM_ANDAMENTO", "RESOLVIDA", "CANCELADA"];

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const todayIso = () => new Date().toISOString().slice(0, 10);

function DirecaoBadge({ d }: { d: Direcao }) {
  const map: Record<Direcao, string> = {
    CONTAB_PARA_NOS: "bg-blue-500/15 text-blue-600",
    NOS_PARA_CONTAB: "bg-amber-500/15 text-amber-600",
  };
  const label = d === "CONTAB_PARA_NOS" ? "Contab → BJ7" : "BJ7 → Contab";
  return (
    <Badge variant="outline" className={cn("font-medium gap-1", map[d])}>
      <ArrowRightLeft className="h-3 w-3" /> {label}
    </Badge>
  );
}

function PrioridadeBadge({ p }: { p: Prioridade }) {
  const map: Record<Prioridade, string> = {
    BAIXA: "bg-muted text-muted-foreground",
    MEDIA: "bg-blue-500/15 text-blue-600",
    ALTA: "bg-amber-500/15 text-amber-600",
    URGENTE: "bg-destructive/15 text-destructive",
  };
  return <Badge variant="outline" className={cn("font-medium", map[p])}>{p}</Badge>;
}

function StatusBadge({ s }: { s: Status }) {
  const map: Record<Status, string> = {
    ABERTA: "bg-muted text-muted-foreground",
    EM_ANDAMENTO: "bg-blue-500/15 text-blue-600",
    RESOLVIDA: "bg-success/15 text-success",
    CANCELADA: "bg-destructive/15 text-destructive",
  };
  return <Badge variant="outline" className={cn("font-medium", map[s])}>{s.replace("_", " ")}</Badge>;
}

function FiscalPendenciasPage() {
  const qc = useQueryClient();
  const empresasQ = useEmpresas();

  const [fStatus, setFStatus] = useState<string>("ABERTAS");
  const [fDirecao, setFDirecao] = useState<string>("TODAS");
  const [fEmpresa, setFEmpresa] = useState<string>("TODAS");
  const [fPrioridade, setFPrioridade] = useState<string>("TODAS");
  const [openNova, setOpenNova] = useState(false);

  const empresasById = useMemo(() => {
    const m = new Map<number, string>();
    (empresasQ.data ?? []).forEach((e: { id: number; nome: string }) => m.set(e.id, e.nome));
    return m;
  }, [empresasQ.data]);

  const pendQ = useQuery({
    queryKey: ["fiscal", "pendencias_contabilidade", { fStatus, fDirecao, fEmpresa, fPrioridade }],
    queryFn: async () => {
      let q = supabase.schema("fiscal").from("pendencias_contabilidade").select("*").order("prazo", { ascending: true, nullsFirst: false });
      if (fStatus === "ABERTAS") q = q.in("status", ["ABERTA", "EM_ANDAMENTO"]);
      else if (fStatus !== "TODAS") q = q.eq("status", fStatus);
      if (fDirecao !== "TODAS") q = q.eq("direcao", fDirecao);
      if (fEmpresa !== "TODAS") q = q.eq("empresa_id", Number(fEmpresa));
      if (fPrioridade !== "TODAS") q = q.eq("prioridade", fPrioridade);
      const r = await q;
      if (r.error) throw r.error;
      return (r.data ?? []) as Pendencia[];
    },
  });

  const resolverMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.schema("fiscal").from("pendencias_contabilidade")
        .update({ status: "RESOLVIDA", resolvida_em: new Date().toISOString() }).eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Pendência marcada como resolvida.");
      qc.invalidateQueries({ queryKey: ["fiscal", "pendencias_contabilidade"] });
    },
    onError: (e: Error) => toast.error("Falha: " + e.message),
  });

  return (
    <PageShell
      title="Pendências Contábeis"
      description="Hub de comunicação entre BJ7 e contabilidade"
      actions={
        <Button size="sm" onClick={() => setOpenNova(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Nova pendência
        </Button>
      }
    >
      <Card>
        <CardContent className="py-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABERTAS">Abertas + Em andamento</SelectItem>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  {STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Direção</Label>
              <Select value={fDirecao} onValueChange={setFDirecao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  <SelectItem value="CONTAB_PARA_NOS">Contab → BJ7</SelectItem>
                  <SelectItem value="NOS_PARA_CONTAB">BJ7 → Contab</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Empresa</Label>
              <Select value={fEmpresa} onValueChange={setFEmpresa}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  {(empresasQ.data ?? []).map((e: { id: number; nome: string }) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={fPrioridade} onValueChange={setFPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  {PRIORIDADE_OPTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {pendQ.isLoading ? (
            <div className="p-4 space-y-2">{[0,1,2,3].map(i => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : pendQ.error ? (
            <div className="p-4 text-sm text-destructive">Falha ao carregar: {(pendQ.error as Error).message}</div>
          ) : (pendQ.data ?? []).length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma pendência encontrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Direção</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[160px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pendQ.data ?? []).map((p) => {
                    const aberta = p.status === "ABERTA" || p.status === "EM_ANDAMENTO";
                    const vencida = aberta && p.prazo && p.prazo < todayIso();
                    return (
                      <TableRow key={p.id} className={cn(vencida && "bg-destructive/10")}>
                        <TableCell className="font-medium">{p.empresa ?? (p.empresa_id != null ? empresasById.get(p.empresa_id) : null) ?? "—"}</TableCell>
                        <TableCell>
                          <div className="font-medium">{p.titulo}</div>
                          {p.descricao && <div className="text-xs text-muted-foreground line-clamp-1">{p.descricao}</div>}
                        </TableCell>
                        <TableCell><DirecaoBadge d={p.direcao} /></TableCell>
                        <TableCell className={cn("tabular-nums", vencida && "text-destructive font-medium")}>{fmtDate(p.prazo)}</TableCell>
                        <TableCell><PrioridadeBadge p={p.prioridade} /></TableCell>
                        <TableCell><StatusBadge s={p.status} /></TableCell>
                        <TableCell>
                          {aberta ? (
                            <Button size="sm" variant="outline" onClick={() => resolverMut.mutate(p.id)} disabled={resolverMut.isPending}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Resolver
                            </Button>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <NovaPendenciaModal
        open={openNova}
        onClose={() => setOpenNova(false)}
        empresas={(empresasQ.data ?? []).map((e: { id: number; nome: string }) => ({ id: e.id, nome: e.nome }))}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["fiscal", "pendencias_contabilidade"] });
          setOpenNova(false);
        }}
      />
    </PageShell>
  );
}

function NovaPendenciaModal({
  open, onClose, empresas, onSaved,
}: {
  open: boolean; onClose: () => void;
  empresas: { id: number; nome: string }[];
  onSaved: () => void;
}) {
  const [empresaId, setEmpresaId] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [direcao, setDirecao] = useState<Direcao>("CONTAB_PARA_NOS");
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade>("MEDIA");

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        empresa_id: empresaId ? Number(empresaId) : null,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        direcao,
        prazo: prazo || null,
        prioridade,
        status: "ABERTA" as Status,
      };
      if (!payload.titulo) throw new Error("Informe o título.");
      const r = await supabase.schema("fiscal").from("pendencias_contabilidade").insert(payload);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Pendência criada.");
      setEmpresaId(""); setTitulo(""); setDescricao(""); setPrazo(""); setPrioridade("MEDIA"); setDirecao("CONTAB_PARA_NOS");
      onSaved();
    },
    onError: (e: Error) => toast.error("Falha: " + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova pendência</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Empresa</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {empresas.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Enviar guia DAS de janeiro" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Direção</Label>
              <Select value={direcao} onValueChange={(v) => setDirecao(v as Direcao)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTAB_PARA_NOS">Contab → BJ7</SelectItem>
                  <SelectItem value="NOS_PARA_CONTAB">BJ7 → Contab</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as Prioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADE_OPTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
