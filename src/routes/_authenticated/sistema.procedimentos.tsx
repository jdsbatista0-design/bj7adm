import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Plus, Search, Workflow, Pencil, Play, BookOpen,
  CheckCircle2, Circle, ChevronRight, Building2, ListOrdered,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sistema/procedimentos")({
  component: SistemaProcedimentos,
});

type Proc = {
  id: number; codigo: string | null; titulo: string; descricao: string | null;
  eixo_bj7: string | null; empresa_id: number | null; status: string;
  categoria: string | null; conteudo: string | null; created_at: string | null;
};
type DashRow = {
  id: number; codigo: string | null; titulo: string; eixo_bj7: string | null;
  status: string | null; empresa: string | null; total_etapas: number | null;
  execucoes_concluidas: number | null; execucoes_em_andamento: number | null;
  ultima_execucao: string | null; responsaveis: string | null;
};
type Etapa = {
  id: number; titulo: string; descricao: string | null;
  ordem: number | null; obrigatoria: boolean | null; responsavel: string | null;
};

const EIXOS = ["PESSOAS", "PROCESSOS", "PRODUTO", "CLIENTE", "FINANCEIRO", "MARKETING", "ESTRATEGIA"];
const STATUS = ["ATIVO", "RASCUNHO", "ARQUIVADO", "TEMPLATE"];

// Cores por eixo — identidade visual do normativo
const EIXO_CLS: Record<string, { bg: string; text: string; border: string }> = {
  PESSOAS:    { bg: "bg-blue-500/10",    text: "text-blue-500",    border: "border-blue-500/30" },
  PROCESSOS:  { bg: "bg-orange-500/10",  text: "text-orange-500",  border: "border-orange-500/30" },
  PRODUTO:    { bg: "bg-violet-500/10",  text: "text-violet-500",  border: "border-violet-500/30" },
  CLIENTE:    { bg: "bg-teal-500/10",    text: "text-teal-500",    border: "border-teal-500/30" },
  FINANCEIRO: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/30" },
  MARKETING:  { bg: "bg-pink-500/10",    text: "text-pink-500",    border: "border-pink-500/30" },
  ESTRATEGIA: { bg: "bg-amber-500/10",   text: "text-amber-500",   border: "border-amber-500/30" },
};
const eixoCls = (e: string | null) =>
  EIXO_CLS[e ?? ""] ?? { bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/30" };

const STATUS_CLS: Record<string, string> = {
  ATIVO:     "bg-emerald-500/15 text-emerald-500",
  RASCUNHO:  "bg-zinc-500/15 text-zinc-400",
  ARQUIVADO: "bg-zinc-500/10 text-zinc-500",
  TEMPLATE:  "bg-violet-500/15 text-violet-500",
};

const sb = () => supabase.schema("sistema" as never);

export default function SistemaProcedimentos() {
  const qc = useQueryClient();
  const empresasQ = useEmpresas();
  const [search, setSearch] = useState("");
  const [eixoF, setEixoF] = useState("");
  const [statusF, setStatusF] = useState("ATIVO");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Proc | null>(null);
  const [reader, setReader] = useState<DashRow | null>(null);
  const [startOpen, setStartOpen] = useState(false);

  const dashQ = useQuery({
    queryKey: ["sistema:proc-dashboard"],
    queryFn: async () => {
      const r = await sb().from("v_procedimentos_dashboard").select("*").order("titulo");
      if (r.error) throw r.error;
      return (r.data ?? []) as DashRow[];
    },
  });

  const filtered = useMemo(() => {
    const items = dashQ.data ?? [];
    const s = search.trim().toLowerCase();
    return items.filter((d) =>
      (!eixoF || d.eixo_bj7 === eixoF) &&
      (!statusF || d.status === statusF) &&
      (!s || `${d.titulo} ${d.codigo ?? ""} ${d.empresa ?? ""}`.toLowerCase().includes(s)),
    );
  }, [dashQ.data, search, eixoF, statusF]);

  const saveM = useMutation({
    mutationFn: async (p: Partial<Proc>) => {
      if (editing?.id) {
        const r = await sb().from("procedimentos").update(p).eq("id", editing.id);
        if (r.error) throw r.error;
      } else {
        const r = await sb().from("procedimentos").insert(p);
        if (r.error) throw r.error;
      }
    },
    onSuccess: () => {
      toast.success("Procedimento salvo");
      setFormOpen(false); setEditing(null);
      qc.invalidateQueries({ queryKey: ["sistema:proc-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startM = useMutation({
    mutationFn: async (procId: number) => {
      const r = await sb().rpc("iniciar_execucao", { p_procedimento_id: procId });
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Execução iniciada");
      setStartOpen(false);
      qc.invalidateQueries({ queryKey: ["sistema:proc-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openEditor(dashRow: DashRow) {
    const r = await sb().from("procedimentos").select("*").eq("id", dashRow.id).single();
    if (r.error) { toast.error(r.error.message); return; }
    setEditing(r.data as Proc);
    setFormOpen(true);
  }

  return (
    <PageShell
      title="Normativo BJ7"
      description="Manual de processos e normas operacionais do grupo"
      actions={
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo procedimento
        </Button>
      }
    >
      {/* Filtros */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar procedimento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={eixoF || "_all"} onValueChange={(v) => setEixoF(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos os eixos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos os eixos</SelectItem>
              {EIXOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusF || "_all"} onValueChange={(v) => setStatusF(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todos status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos status</SelectItem>
              {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Contador */}
      {!dashQ.isLoading && (
        <p className="text-xs text-muted-foreground px-1">
          {filtered.length} {filtered.length === 1 ? "procedimento" : "procedimentos"}
          {statusF && statusF !== "_all" ? ` com status ${statusF}` : ""}
        </p>
      )}

      {/* Grid de cards */}
      {dashQ.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          <Workflow className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum procedimento encontrado</p>
          <p className="text-xs mt-1 opacity-70">Tente outro filtro ou crie um novo procedimento</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => {
            const cls = eixoCls(d.eixo_bj7);
            const isArquivado = d.status === "ARQUIVADO";
            return (
              <button
                key={d.id}
                onClick={() => setReader(d)}
                className={cn(
                  "group text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/30 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring",
                  isArquivado && "opacity-50",
                )}
              >
                {/* Topo: eixo + status */}
                <div className="flex items-center justify-between mb-3">
                  <span className={cn(
                    "text-[11px] font-semibold tracking-wide uppercase rounded-md px-2 py-0.5",
                    cls.bg, cls.text,
                  )}>
                    {d.eixo_bj7 ?? "Sem eixo"}
                  </span>
                  <span className={cn(
                    "text-[10px] font-medium rounded-full px-2 py-0.5",
                    STATUS_CLS[d.status ?? ""] ?? "bg-zinc-500/10 text-zinc-400",
                  )}>
                    {d.status === "TEMPLATE" ? "Template" :
                     d.status === "ATIVO" ? "Ativo" :
                     d.status === "RASCUNHO" ? "Rascunho" : "Arquivado"}
                  </span>
                </div>

                {/* Título */}
                <div className="mb-1">
                  <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {d.titulo}
                  </h3>
                  {d.codigo && (
                    <span className="text-[10px] font-mono text-muted-foreground">{d.codigo}</span>
                  )}
                </div>

                {/* Rodapé: empresa + etapas + seta */}
                <div className={cn("mt-3 pt-3 border-t flex items-center justify-between", cls.border)}>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    {d.empresa && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {d.empresa}
                      </span>
                    )}
                    {(d.total_etapas ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <ListOrdered className="h-3 w-3" />
                        {d.total_etapas} {d.total_etapas === 1 ? "etapa" : "etapas"}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Leitor lateral */}
      <ProcReader
        row={reader}
        onClose={() => setReader(null)}
        onEdit={(row) => { setReader(null); openEditor(row); }}
        onStart={() => setStartOpen(true)}
      />

      {/* Dialog de iniciar execução */}
      {startOpen && reader && (
        <IniciarDialog
          titulo={reader.titulo}
          onClose={() => setStartOpen(false)}
          onStart={() => startM.mutate(reader.id)}
          saving={startM.isPending}
        />
      )}

      {/* Formulário de criação/edição */}
      <ProcFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        empresas={(empresasQ.data ?? []) as Array<{ id: number; nome: string }>}
        onSubmit={(p) => saveM.mutate(p)}
        saving={saveM.isPending}
      />
    </PageShell>
  );
}

// ─── Leitor lateral ───────────────────────────────────────────────────────────

function ProcReader({
  row, onClose, onEdit, onStart,
}: {
  row: DashRow | null;
  onClose: () => void;
  onEdit: (row: DashRow) => void;
  onStart: () => void;
}) {
  const procQ = useQuery({
    queryKey: ["sistema:proc-detail", row?.id],
    enabled: !!row,
    queryFn: async () => {
      const r = await sb().from("procedimentos")
        .select("id, descricao, conteudo, empresa_id")
        .eq("id", row!.id)
        .single();
      if (r.error) throw r.error;
      return r.data as { id: number; descricao: string | null; conteudo: string | null; empresa_id: number | null };
    },
  });

  const etapasQ = useQuery({
    queryKey: ["sistema:etapas", row?.id],
    enabled: !!row,
    queryFn: async () => {
      const r = await sb().from("etapas")
        .select("id, titulo, descricao, ordem, obrigatoria, responsavel")
        .eq("procedimento_id", row!.id)
        .order("ordem");
      if (r.error) throw r.error;
      return (r.data ?? []) as Etapa[];
    },
  });

  const cls = eixoCls(row?.eixo_bj7 ?? null);
  const canExecute = row?.status === "ATIVO" || row?.status === "TEMPLATE";
  const conteudo = procQ.data?.conteudo?.trim();
  const descricao = procQ.data?.descricao?.trim();

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto flex flex-col gap-0 p-0">
        {!row ? null : (
          <>
            {/* Header colorido por eixo */}
            <div className={cn("px-6 pt-6 pb-4 border-b", cls.bg, cls.border)}>
              <SheetHeader>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={cn("text-[11px] font-semibold tracking-widest uppercase", cls.text)}>
                    {row.eixo_bj7 ?? "Sem eixo"}
                  </span>
                  <span className={cn(
                    "text-[10px] font-medium rounded-full px-2 py-0.5",
                    STATUS_CLS[row.status ?? ""] ?? "bg-zinc-500/10 text-zinc-400",
                  )}>
                    {row.status}
                  </span>
                </div>
                <SheetTitle className="text-xl font-bold leading-tight text-left">
                  {row.titulo}
                </SheetTitle>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {row.codigo && <span className="font-mono">{row.codigo}</span>}
                  {row.empresa && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {row.empresa}
                    </span>
                  )}
                </div>
              </SheetHeader>
            </div>

            {/* Corpo */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Descrição */}
              {(procQ.isLoading) ? (
                <Skeleton className="h-16 w-full" />
              ) : descricao ? (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Sobre este procedimento
                  </h4>
                  <p className="text-sm leading-relaxed">{descricao}</p>
                </div>
              ) : null}

              {/* Conteúdo / Como fazer */}
              {procQ.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : conteudo ? (
                <div>
                  <Separator className="mb-5" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" />
                    Como fazer
                  </h4>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap rounded-lg bg-muted/40 px-4 py-3 border border-border/50 font-mono text-xs">
                    {conteudo}
                  </div>
                </div>
              ) : !descricao ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum conteúdo documentado ainda.</p>
                  <button
                    onClick={() => onEdit(row)}
                    className="text-primary text-xs mt-1 hover:underline"
                  >
                    Adicionar conteúdo
                  </button>
                </div>
              ) : null}

              {/* Etapas */}
              {etapasQ.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (etapasQ.data ?? []).length > 0 ? (
                <div>
                  <Separator className="mb-5" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <ListOrdered className="h-3.5 w-3.5" />
                    Etapas do processo — {etapasQ.data?.length} {etapasQ.data?.length === 1 ? "passo" : "passos"}
                  </h4>
                  <div className="space-y-2">
                    {etapasQ.data?.map((etapa, idx) => (
                      <div
                        key={etapa.id}
                        className="flex gap-3 rounded-lg border border-border/60 bg-card px-4 py-3"
                      >
                        <div className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold mt-0.5",
                          cls.bg, cls.text,
                        )}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{etapa.titulo}</span>
                            {etapa.obrigatoria && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0">OBRIGATÓRIA</Badge>
                            )}
                          </div>
                          {etapa.descricao && (
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                              {etapa.descricao}
                            </p>
                          )}
                          {etapa.responsavel && (
                            <p className="text-[10px] text-muted-foreground/70 mt-1">
                              Responsável: {etapa.responsavel}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Stats de execução */}
              {((row.execucoes_concluidas ?? 0) > 0 || (row.execucoes_em_andamento ?? 0) > 0) && (
                <div>
                  <Separator className="mb-5" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Histórico de execuções
                  </h4>
                  <div className="flex gap-4 text-sm">
                    {(row.execucoes_em_andamento ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Circle className="h-3.5 w-3.5 text-amber-500" />
                        <span>{row.execucoes_em_andamento} em andamento</span>
                      </div>
                    )}
                    {(row.execucoes_concluidas ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>{row.execucoes_concluidas} concluídas</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé: ações */}
            <div className="border-t px-6 py-4 flex items-center justify-between gap-2 bg-background">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(row)}
                className="gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Button>
              {canExecute && (
                <Button size="sm" onClick={onStart} className="gap-1.5">
                  <Play className="h-3.5 w-3.5" />
                  Iniciar execução
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Dialog de iniciar execução ───────────────────────────────────────────────

function IniciarDialog({
  titulo, onClose, onStart, saving,
}: {
  titulo: string;
  onClose: () => void;
  onStart: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar execução</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Você está iniciando uma nova execução de:<br />
          <span className="font-semibold text-foreground">{titulo}</span>
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onStart} disabled={saving}>
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Iniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Formulário de criação/edição ─────────────────────────────────────────────

function ProcFormDialog({
  open, onOpenChange, initial, empresas, onSubmit, saving,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  initial: Proc | null;
  empresas: Array<{ id: number; nome: string }>;
  onSubmit: (p: Partial<Proc>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Proc>>({});
  useMemo(() => { setForm(initial ?? { status: "ATIVO" }); }, [initial, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar procedimento" : "Novo procedimento"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Código</Label>
              <Input
                placeholder="ex: FIN-001"
                value={form.codigo ?? ""}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input
                placeholder="ex: Financeiro, RH…"
                value={form.categoria ?? ""}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Título *</Label>
            <Input
              placeholder="Nome do processo ou norma"
              value={form.titulo ?? ""}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            />
          </div>
          <div>
            <Label>Descrição curta</Label>
            <Textarea
              rows={2}
              placeholder="Em 1-2 frases: para que serve esse procedimento e quando usar"
              value={form.descricao ?? ""}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Eixo BJ7</Label>
              <Select value={form.eixo_bj7 ?? "_none"} onValueChange={(v) => setForm({ ...form, eixo_bj7: v === "_none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {EIXOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empresa</Label>
              <Select
                value={form.empresa_id ? String(form.empresa_id) : "_none"}
                onValueChange={(v) => setForm({ ...form, empresa_id: v === "_none" ? null : Number(v) })}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {empresas.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status ?? "ATIVO"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Conteúdo — como fazer (passo a passo, normas, orientações)</Label>
            <p className="text-[11px] text-muted-foreground mb-1">
              Escreva como se estivesse ensinando alguém do zero. Pode usar formatação simples.
            </p>
            <Textarea
              rows={10}
              className="font-mono text-xs"
              placeholder={`Exemplo:\n1. Acesse o sistema X\n2. Clique em Novo Lançamento\n3. Preencha os campos obrigatórios: data, valor, categoria\n   - Categoria deve seguir o plano de contas vigente\n4. Salve e confirme com o responsável financeiro\n\nOBS: Todo lançamento acima de R$ 5.000 precisa de aprovação do sócio.`}
              value={form.conteudo ?? ""}
              onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || !form.titulo} onClick={() => onSubmit(form)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
