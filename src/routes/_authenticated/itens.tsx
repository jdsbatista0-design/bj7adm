import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type DragEvent } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresas } from "@/hooks/use-refs";
import { PageShell } from "@/components/bj7/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Plus, Search, ListTodo, Target, Users, Workflow, AlertCircle, FileText, Lightbulb,
  Flame, Calendar, Eye, Trash2, GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  tipo: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/itens")({
  validateSearch: searchSchema,
  component: CockpitPage,
});

// ---------- Types ----------
type Tipo = "TAREFA" | "DECISAO" | "IDEIA" | "PROJETO" | "REUNIAO" | "LEMBRETE" | "NOTA";
type Estado = "BACKLOG" | "SEMANA" | "HOJE" | "EM_ANDAMENTO" | "BLOQUEADO" | "CONCLUIDO" | "ARQUIVADO";
type Eixo = "VISAO" | "SISTEMA" | "PESSOAS" | "RESULTADOS" | "CULTURA_SER";
type Energia = "ALTA" | "MEDIA" | "BAIXA";

type Item = {
  id: number;
  titulo: string;
  descricao: string | null;
  tipo: Tipo | null;
  eixo_bj7: Eixo | null;
  empresa_id: number | null;
  importante: boolean | null;
  urgente: boolean | null;
  energia: Energia | null;
  contexto: string | null;
  estado: Estado | null;
  prazo: string | null;
  data_reuniao: string | null;
  duracao_min: number | null;
  participantes: string[] | null;
  local_reuniao: string | null;
  opcoes_decisao: unknown;
  decisao_tomada: string | null;
  decisao_em: string | null;
  item_pai_id: number | null;
  tags: string[] | null;
  notas: string | null;
  concluido_em: string | null;
  recorrencia: string | null;
  criado_em?: string;
};

const TIPO_META: Record<Tipo, { label: string; icon: typeof ListTodo; cls: string }> = {
  TAREFA:   { label: "Tarefa",   icon: ListTodo,    cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  DECISAO:  { label: "Decisão",  icon: Target,      cls: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  IDEIA:    { label: "Ideia",    icon: Lightbulb,   cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  PROJETO:  { label: "Projeto",  icon: Workflow,    cls: "bg-green-500/15 text-green-300 border-green-500/30" },
  REUNIAO:  { label: "Reunião",  icon: Users,       cls: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  LEMBRETE: { label: "Lembrete", icon: AlertCircle, cls: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  NOTA:     { label: "Nota",     icon: FileText,    cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
};

const KANBAN_COLS: Estado[] = ["BACKLOG", "SEMANA", "HOJE", "EM_ANDAMENTO", "CONCLUIDO"];
const TODOS_TIPOS = Object.keys(TIPO_META) as Tipo[];
const EIXOS: Eixo[] = ["VISAO","SISTEMA","PESSOAS","RESULTADOS","CULTURA_SER"];

function todayISO() { return new Date().toISOString().slice(0,10); }
function addDaysISO(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); }

// ---------- Page ----------
function CockpitPage() {
  const search = useSearch({ from: "/_authenticated/itens" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const empresas = useEmpresas();

  const initialTab: string = useMemo(() => {
    const t = search.tipo as string | undefined;
    if (!t) return "visao";
    const map: Record<string, string> = {
      TAREFA: "tarefas", DECISAO: "decisoes", REUNIAO: "reunioes",
      PROJETO: "projetos", IDEIA: "ideias", NOTA: "notas",
    };
    return map[t] ?? "visao";
  }, [search.tipo]);

  const [tab, setTab] = useState(initialTab);
  const [q, setQ] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<Set<Tipo>>(new Set());
  const [estadoFiltro, setEstadoFiltro] = useState<Set<Estado>>(new Set());
  const [eixo, setEixo] = useState<string>("TODOS");
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);

  const itensQ = useQuery({
    queryKey: ["cockpit", "itens"],
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const r = await supabase.from("itens").select("*").order("id", { ascending: false }).limit(5000);
      if (r.error) throw r.error;
      return (r.data ?? []) as Item[];
    },
  });

  const allItens = itensQ.data ?? [];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return allItens.filter((i) => {
      if (tipoFiltro.size > 0 && !tipoFiltro.has((i.tipo ?? "TAREFA") as Tipo)) return false;
      if (estadoFiltro.size > 0 && !estadoFiltro.has((i.estado ?? "BACKLOG") as Estado)) return false;
      if (eixo !== "TODOS" && i.eixo_bj7 !== eixo) return false;
      if (empresaId !== "all" && String(i.empresa_id) !== empresaId) return false;
      if (term) {
        const hay = `${i.titulo} ${i.descricao ?? ""} ${i.notas ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [allItens, q, tipoFiltro, estadoFiltro, eixo, empresaId]);

  // KPIs (over ALL itens, not filtered)
  const today = todayISO();
  const in7 = addDaysISO(7);
  const kpis = useMemo(() => {
    const hoje = allItens.filter((i) =>
      i.estado === "HOJE" ||
      (i.data_reuniao && i.data_reuniao.slice(0,10) === today) ||
      i.prazo === today
    ).length;
    const semana = allItens.filter((i) =>
      i.estado === "SEMANA" || (i.prazo && i.prazo >= today && i.prazo <= in7)
    ).length;
    const decisoes = allItens.filter((i) => i.tipo === "DECISAO" && i.estado !== "CONCLUIDO" && i.estado !== "ARQUIVADO").length;
    const atrasados = allItens.filter((i) =>
      i.prazo && i.prazo < today && i.estado !== "CONCLUIDO" && i.estado !== "ARQUIVADO"
    ).length;
    return { hoje, semana, decisoes, atrasados };
  }, [allItens, today, in7]);

  // Mutations
  const upsertMut = useMutation({
    mutationFn: async (payload: Partial<Item> & { id?: number }) => {
      if (payload.id) {
        const r = await supabase.from("itens").update(payload).eq("id", payload.id);
        if (r.error) throw r.error;
      } else {
        const r = await supabase.from("itens").insert(payload);
        if (r.error) throw r.error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cockpit", "itens"] });
      toast.success(editing ? "Item atualizado" : "Item criado");
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const moveMut = useMutation({
    mutationFn: async ({ id, estado, importante, urgente }: { id: number; estado?: Estado; importante?: boolean; urgente?: boolean }) => {
      const upd: Partial<Item> = {};
      if (estado !== undefined) {
        upd.estado = estado;
        if (estado === "CONCLUIDO") upd.concluido_em = new Date().toISOString();
      }
      if (importante !== undefined) upd.importante = importante;
      if (urgente !== undefined) upd.urgente = urgente;
      const r = await supabase.from("itens").update(upd).eq("id", id);
      if (r.error) throw r.error;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["cockpit", "itens"] });
      const prev = qc.getQueryData<Item[]>(["cockpit", "itens"]);
      if (prev) {
        qc.setQueryData<Item[]>(["cockpit", "itens"], prev.map((i) =>
          i.id === vars.id ? {
            ...i,
            ...(vars.estado !== undefined && { estado: vars.estado }),
            ...(vars.importante !== undefined && { importante: vars.importante }),
            ...(vars.urgente !== undefined && { urgente: vars.urgente }),
          } : i
        ));
      }
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["cockpit", "itens"], ctx.prev);
      toast.error("Falha: " + e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["cockpit", "itens"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.from("itens").delete().eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cockpit", "itens"] });
      toast.success("Item removido");
      setConfirmDelete(null);
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const openNew = (preset?: Partial<Item>) => {
    setEditing({ id: 0, titulo: "", descricao: null, tipo: "TAREFA", estado: "BACKLOG",
      eixo_bj7: null, empresa_id: null, importante: false, urgente: false, energia: null,
      contexto: null, prazo: null, data_reuniao: null, duracao_min: null, participantes: null,
      local_reuniao: null, opcoes_decisao: null, decisao_tomada: null, decisao_em: null,
      item_pai_id: null, tags: null, notas: null, concluido_em: null, recorrencia: null,
      ...preset,
    } as Item);
    setDialogOpen(true);
  };

  const openEdit = (i: Item) => { setEditing(i); setDialogOpen(true); };

  return (
    <PageShell
      title="Cockpit de Gestão"
      description="Tarefas, decisões, projetos, reuniões e ideias do Grupo BJ7"
      actions={
        <Button size="sm" onClick={() => openNew()}>
          <Plus className="h-4 w-4 mr-1" /> Novo Item
        </Button>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Hoje" value={kpis.hoje} icon={Flame} />
        <KpiCard label="Esta semana" value={kpis.semana} icon={Calendar} />
        <KpiCard label="Decisões em aberto" value={kpis.decisoes} icon={Target} />
        <KpiCard label="Atrasados" value={kpis.atrasados} icon={AlertCircle} tone="danger" />
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="p-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="h-9 pl-8" />
            </div>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas empresas</SelectItem>
                {(empresas.data ?? []).map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center mr-1">Tipo:</span>
            {TODOS_TIPOS.map((t) => {
              const meta = TIPO_META[t]; const active = tipoFiltro.has(t);
              return (
                <button key={t} type="button" onClick={() => {
                  setTipoFiltro((p) => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });
                }} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                  active ? meta.cls : "border-border text-muted-foreground opacity-60")}>
                  <meta.icon className="h-3 w-3" />{meta.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground">Eixo:</span>
            <RadioGroup value={eixo} onValueChange={setEixo} className="flex gap-2">
              {(["TODOS", ...EIXOS] as const).map((v) => (
                <div key={v} className="flex items-center gap-1.5">
                  <RadioGroupItem id={`eixo-${v}`} value={v} />
                  <Label htmlFor={`eixo-${v}`} className="text-xs cursor-pointer">{v.replace("_"," ")}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto">
          <TabsList className="mb-4 w-max">
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
            <TabsTrigger value="decisoes">Decisões</TabsTrigger>
            <TabsTrigger value="reunioes">Reuniões</TabsTrigger>
            <TabsTrigger value="projetos">Projetos</TabsTrigger>
            <TabsTrigger value="ideias">Ideias</TabsTrigger>
            <TabsTrigger value="notas">Notas</TabsTrigger>
            <TabsTrigger value="eisenhower">Matriz Eisenhower</TabsTrigger>
          </TabsList>
        </div>

        {itensQ.isLoading ? (
          <Skeleton className="h-96" />
        ) : (
          <>
            <TabsContent value="visao"><VisaoGeral itens={filtered} onClick={openEdit} onDelete={setConfirmDelete} /></TabsContent>
            <TabsContent value="tarefas">
              <KanbanTarefas itens={filtered.filter((i) => i.tipo === "TAREFA" || !i.tipo)}
                onMove={(id, estado) => moveMut.mutate({ id, estado })}
                onClick={openEdit} onAdd={(estado) => openNew({ tipo: "TAREFA", estado })} />
            </TabsContent>
            <TabsContent value="decisoes">
              <DecisoesView itens={filtered.filter((i) => i.tipo === "DECISAO")} onClick={openEdit} onDelete={setConfirmDelete} />
            </TabsContent>
            <TabsContent value="reunioes">
              <ReunioesView itens={filtered.filter((i) => i.tipo === "REUNIAO")} onClick={openEdit} onDelete={setConfirmDelete} />
            </TabsContent>
            <TabsContent value="projetos">
              <ProjetosView itens={filtered} all={allItens} onClick={openEdit} onDelete={setConfirmDelete} />
            </TabsContent>
            <TabsContent value="ideias">
              <IdeiasView itens={filtered.filter((i) => i.tipo === "IDEIA")} onClick={openEdit}
                onPromover={(i) => upsertMut.mutate({ id: i.id, tipo: "PROJETO" })} />
            </TabsContent>
            <TabsContent value="notas">
              <NotasView itens={filtered.filter((i) => i.tipo === "NOTA")} onClick={openEdit} onDelete={setConfirmDelete} />
            </TabsContent>
            <TabsContent value="eisenhower">
              <EisenhowerView itens={filtered.filter((i) => i.estado !== "CONCLUIDO" && i.estado !== "ARQUIVADO")}
                onMove={(id, importante, urgente) => moveMut.mutate({ id, importante, urgente })}
                onClick={openEdit} />
            </TabsContent>
          </>
        )}
      </Tabs>

      <ItemDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        item={editing}
        empresas={empresas.data ?? []}
        projetos={allItens.filter((i) => i.tipo === "PROJETO")}
        onSave={(data) => upsertMut.mutate(data)}
        saving={upsertMut.isPending}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.titulo}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

// ---------- KPI ----------
function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Flame; tone?: "danger" }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center",
          tone === "danger" && value > 0 ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground uppercase">{label}</div>
          <div className={cn("text-xl font-semibold tabular-nums", tone === "danger" && value > 0 && "text-destructive")}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Item Card ----------
function ItemCard({ item, onClick, onDelete, draggable }: { item: Item; onClick?: () => void; onDelete?: () => void; draggable?: boolean }) {
  const meta = TIPO_META[(item.tipo ?? "TAREFA") as Tipo];
  const overdue = item.prazo && item.prazo < todayISO() && item.estado !== "CONCLUIDO";
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(item.id)); e.dataTransfer.effectAllowed = "move"; }}
      onClick={onClick}
      className={cn("rounded-lg border bg-card p-2.5 cursor-pointer hover:bg-accent/50 transition group",
        overdue && "border-destructive/50")}
    >
      <div className="flex items-start gap-2">
        <Badge variant="outline" className={cn("text-[10px] shrink-0", meta.cls)}>
          <meta.icon className="h-3 w-3 mr-1" />{meta.label}
        </Badge>
        {item.importante && <Badge className="text-[10px] bg-yellow-500/15 text-yellow-300 border-yellow-500/30" variant="outline">★</Badge>}
        {item.urgente && <Badge variant="destructive" className="text-[10px]">!</Badge>}
        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="text-sm font-medium mt-1.5">{item.titulo}</div>
      {item.descricao && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.descricao}</p>}
      <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] text-muted-foreground">
        {item.prazo && <span className={cn(overdue && "text-destructive font-medium")}>📅 {item.prazo}</span>}
        {item.contexto && <span>@ {item.contexto}</span>}
        {item.energia && <span>⚡ {item.energia.toLowerCase()}</span>}
      </div>
    </div>
  );
}

// ---------- Visão Geral ----------
function VisaoGeral({ itens, onClick, onDelete }: { itens: Item[]; onClick: (i: Item) => void; onDelete: (i: Item) => void }) {
  const today = todayISO();
  const in7 = addDaysISO(7);
  const hoje = itens.filter((i) => i.estado === "HOJE" || i.prazo === today);
  const semana = itens.filter((i) => i.estado === "SEMANA" || (i.prazo && i.prazo > today && i.prazo <= in7));
  const andamento = itens.filter((i) => i.estado === "EM_ANDAMENTO");
  const backlog = itens.filter((i) => i.estado === "BACKLOG").slice(0, 10);

  const sections = [
    { title: "🔥 Hoje", items: hoje },
    { title: "📅 Esta Semana", items: semana },
    { title: "🎯 Em Andamento", items: andamento },
    { title: "📥 Backlog", items: backlog },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sections.map((s) => (
        <Card key={s.title}>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">{s.title} <span className="text-muted-foreground">({s.items.length})</span></h3>
            <div className="space-y-2">
              {s.items.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">Nada por aqui.</div>
              ) : s.items.map((i) => (
                <ItemCard key={i.id} item={i} onClick={() => onClick(i)} onDelete={() => onDelete(i)} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- Kanban Tarefas ----------
function KanbanTarefas({ itens, onMove, onClick, onAdd }: {
  itens: Item[]; onMove: (id: number, estado: Estado) => void; onClick: (i: Item) => void; onAdd: (estado: Estado) => void;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid grid-cols-5 gap-3 min-w-[1000px]">
        {KANBAN_COLS.map((col) => (
          <KanbanCol key={col} estado={col} itens={itens.filter((i) => (i.estado ?? "BACKLOG") === col)}
            onDrop={(id) => onMove(id, col)} onClick={onClick} onAdd={() => onAdd(col)} />
        ))}
      </div>
    </div>
  );
}

function KanbanCol({ estado, itens, onDrop, onClick, onAdd }: {
  estado: Estado; itens: Item[]; onDrop: (id: number) => void; onClick: (i: Item) => void; onAdd: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e: DragEvent) => { e.preventDefault(); setHover(false); const id = Number(e.dataTransfer.getData("text/plain")); if (id) onDrop(id); }}
      className={cn("rounded-lg bg-card border p-2 min-h-[300px]", hover && "ring-2 ring-primary")}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-xs font-semibold uppercase">{estado.replace("_"," ")}</h3>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground">{itens.length}</span>
          <button onClick={onAdd} className="text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="space-y-2">
        {itens.map((i) => <ItemCard key={i.id} item={i} onClick={() => onClick(i)} draggable />)}
      </div>
    </div>
  );
}

// ---------- Decisões ----------
function DecisoesView({ itens, onClick, onDelete }: { itens: Item[]; onClick: (i: Item) => void; onDelete: (i: Item) => void }) {
  if (itens.length === 0) return <EmptyMsg msg="Nenhuma decisão." />;
  return (
    <div className="space-y-3">
      {itens.map((i) => (
        <Card key={i.id} className={cn(!i.decisao_tomada && "border-yellow-500/40")}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{i.titulo}</h3>
                  {!i.decisao_tomada && <Badge variant="outline" className="bg-yellow-500/15 text-yellow-300 border-yellow-500/30">Pendente</Badge>}
                  {i.decisao_tomada && <Badge variant="outline" className="bg-green-500/15 text-green-300 border-green-500/30">Decidida</Badge>}
                </div>
                {i.descricao && <p className="text-sm text-muted-foreground mt-1">{i.descricao}</p>}
                {!!i.opcoes_decisao && (
                  <div className="mt-2 text-xs">
                    <div className="font-medium mb-1">Opções:</div>
                    <pre className="bg-muted p-2 rounded text-[11px] overflow-x-auto">{JSON.stringify(i.opcoes_decisao, null, 2)}</pre>
                  </div>
                )}
                {i.decisao_tomada && (
                  <div className="mt-2 p-2 bg-green-500/10 rounded text-sm">
                    <span className="font-medium">Decisão:</span> {i.decisao_tomada}
                    {i.decisao_em && <span className="text-muted-foreground"> em {i.decisao_em}</span>}
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => onClick(i)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- Reuniões ----------
function ReunioesView({ itens, onClick, onDelete }: { itens: Item[]; onClick: (i: Item) => void; onDelete: (i: Item) => void }) {
  const today = todayISO(); const in7 = addDaysISO(7);
  const groups = {
    hoje: [] as Item[], semana: [] as Item[], proximas: [] as Item[], passadas: [] as Item[],
  };
  for (const i of itens) {
    const d = i.data_reuniao?.slice(0,10);
    if (!d) { groups.proximas.push(i); continue; }
    if (d === today) groups.hoje.push(i);
    else if (d < today) groups.passadas.push(i);
    else if (d <= in7) groups.semana.push(i);
    else groups.proximas.push(i);
  }
  const sec: [string, Item[]][] = [["Hoje", groups.hoje], ["Esta semana", groups.semana], ["Próximas", groups.proximas], ["Passadas", groups.passadas]];
  return (
    <div className="space-y-4">
      {sec.map(([t, arr]) => arr.length > 0 && (
        <div key={t}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t}</h3>
          <div className="space-y-2">
            {arr.map((i) => (
              <Card key={i.id}>
                <CardContent className="p-3 flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium">{i.titulo}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                      {i.data_reuniao && <span>📅 {new Date(i.data_reuniao).toLocaleString("pt-BR")}</span>}
                      {i.duracao_min && <span>⏱ {i.duracao_min}min</span>}
                      {i.local_reuniao && <span>📍 {i.local_reuniao}</span>}
                      {i.participantes && i.participantes.length > 0 && <span>👥 {i.participantes.join(", ")}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onClick(i)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(i)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
      {itens.length === 0 && <EmptyMsg msg="Nenhuma reunião." />}
    </div>
  );
}

// ---------- Projetos ----------
function ProjetosView({ itens, all, onClick, onDelete }: { itens: Item[]; all: Item[]; onClick: (i: Item) => void; onDelete: (i: Item) => void }) {
  const projetos = itens.filter((i) => i.tipo === "PROJETO" && !i.item_pai_id);
  if (projetos.length === 0) return <EmptyMsg msg="Nenhum projeto." />;
  return (
    <div className="space-y-3">
      {projetos.map((p) => {
        const subs = all.filter((s) => s.item_pai_id === p.id);
        const concl = subs.filter((s) => s.estado === "CONCLUIDO").length;
        const pct = subs.length > 0 ? Math.round((concl / subs.length) * 100) : 0;
        return (
          <Card key={p.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-green-400" />
                    <h3 className="font-semibold">{p.titulo}</h3>
                    <Badge variant="outline" className="text-[10px]">{subs.length} sub-itens · {pct}%</Badge>
                  </div>
                  {p.descricao && <p className="text-sm text-muted-foreground mt-1">{p.descricao}</p>}
                  {subs.length > 0 && (
                    <div className="mt-2 h-1.5 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  {subs.length > 0 && (
                    <div className="mt-3 space-y-1.5 pl-4 border-l-2 border-border">
                      {subs.map((s) => (
                        <div key={s.id} onClick={() => onClick(s)}
                          className="text-sm cursor-pointer hover:bg-accent/50 px-2 py-1 rounded flex items-center gap-2">
                          <Checkbox checked={s.estado === "CONCLUIDO"} />
                          <span className={cn(s.estado === "CONCLUIDO" && "line-through text-muted-foreground")}>{s.titulo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onClick(p)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(p)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- Ideias ----------
function IdeiasView({ itens, onClick, onPromover }: { itens: Item[]; onClick: (i: Item) => void; onPromover: (i: Item) => void }) {
  if (itens.length === 0) return <EmptyMsg msg="Nenhuma ideia ainda. Capture a próxima!" />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {itens.map((i) => (
        <Card key={i.id} className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium cursor-pointer" onClick={() => onClick(i)}>{i.titulo}</h3>
                {i.descricao && <p className="text-sm text-muted-foreground mt-1">{i.descricao}</p>}
                <Button size="sm" variant="outline" className="mt-3" onClick={() => onPromover(i)}>
                  <Workflow className="h-3 w-3 mr-1" /> Promover a Projeto
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- Notas ----------
function NotasView({ itens, onClick, onDelete }: { itens: Item[]; onClick: (i: Item) => void; onDelete: (i: Item) => void }) {
  if (itens.length === 0) return <EmptyMsg msg="Nenhuma nota." />;
  return (
    <div className="space-y-2">
      {itens.map((i) => (
        <Card key={i.id}>
          <CardContent className="p-3 flex items-start justify-between gap-2">
            <div className="flex-1 cursor-pointer" onClick={() => onClick(i)}>
              <div className="font-medium">{i.titulo}</div>
              {i.notas && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{i.notas}</p>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => onDelete(i)}><Trash2 className="h-3 w-3" /></Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- Eisenhower ----------
function EisenhowerView({ itens, onMove, onClick }: {
  itens: Item[]; onMove: (id: number, importante: boolean, urgente: boolean) => void; onClick: (i: Item) => void;
}) {
  const quads = [
    { key: "q1", label: "Q1 · Importante + Urgente (fazer)", imp: true,  urg: true,  cls: "border-destructive/50 bg-destructive/5" },
    { key: "q2", label: "Q2 · Importante + Não Urgente (planejar)", imp: true,  urg: false, cls: "border-green-500/50 bg-green-500/5" },
    { key: "q3", label: "Q3 · Não Importante + Urgente (delegar)", imp: false, urg: true,  cls: "border-yellow-500/50 bg-yellow-500/5" },
    { key: "q4", label: "Q4 · Nem importante nem urgente (eliminar)", imp: false, urg: false, cls: "border-muted bg-muted/30" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {quads.map((q) => {
        const list = itens.filter((i) => !!i.importante === q.imp && !!i.urgente === q.urg);
        return (
          <div key={q.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { const id = Number(e.dataTransfer.getData("text/plain")); if (id) onMove(id, q.imp, q.urg); }}
            className={cn("rounded-lg border-2 p-3 min-h-[200px]", q.cls)}>
            <h3 className="text-sm font-semibold mb-3">{q.label} <span className="text-muted-foreground">({list.length})</span></h3>
            <div className="space-y-2">
              {list.map((i) => <ItemCard key={i.id} item={i} onClick={() => onClick(i)} draggable />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyMsg({ msg }: { msg: string }) {
  return <div className="text-center py-12 text-muted-foreground text-sm">{msg}</div>;
}

// ---------- Dialog ----------
function ItemDialog({ open, onOpenChange, item, empresas, projetos, onSave, saving }: {
  open: boolean; onOpenChange: (o: boolean) => void; item: Item | null;
  empresas: { id: number; nome: string }[]; projetos: Item[];
  onSave: (data: Partial<Item> & { id?: number }) => void; saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Item>>({});
  // reset on open
  useMemo(() => { if (item) setForm({ ...item }); }, [item]);

  if (!item) return null;
  const tipo = (form.tipo ?? "TAREFA") as Tipo;
  const isNew = !form.id;

  const update = (k: keyof Item, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const submit = () => {
    if (!form.titulo?.trim()) { toast.error("Título obrigatório"); return; }
    const payload: Partial<Item> & { id?: number } = { ...form };
    if (isNew) delete payload.id;
    onSave(payload);
  };

  const ctxSugs = ["Escritório", "Rua", "Casa", "Telefone"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo Item" : "Editar Item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => update("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TODOS_TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>{TIPO_META[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={(form.estado ?? "BACKLOG") as string} onValueChange={(v) => update("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["BACKLOG","SEMANA","HOJE","EM_ANDAMENTO","BLOQUEADO","CONCLUIDO","ARQUIVADO"] as Estado[]).map((e) => (
                    <SelectItem key={e} value={e}>{e.replace("_"," ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Título *</Label>
            <Input autoFocus value={form.titulo ?? ""} onChange={(e) => update("titulo", e.target.value)} />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao ?? ""} onChange={(e) => update("descricao", e.target.value || null)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Eixo BJ7</Label>
              <Select value={form.eixo_bj7 ?? "_NONE"} onValueChange={(v) => update("eixo_bj7", v === "_NONE" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_NONE">— Nenhum —</SelectItem>
                  {EIXOS.map((e) => <SelectItem key={e} value={e}>{e.replace("_"," ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empresa</Label>
              <Select value={form.empresa_id ? String(form.empresa_id) : "_NONE"}
                onValueChange={(v) => update("empresa_id", v === "_NONE" ? null : Number(v))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_NONE">— Nenhuma —</SelectItem>
                  {empresas.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox id="imp" checked={!!form.importante} onCheckedChange={(v) => update("importante", !!v)} />
              <Label htmlFor="imp">Importante</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="urg" checked={!!form.urgente} onCheckedChange={(v) => update("urgente", !!v)} />
              <Label htmlFor="urg">Urgente</Label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Energia</Label>
              <Select value={form.energia ?? "_NONE"} onValueChange={(v) => update("energia", v === "_NONE" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_NONE">— Nenhuma —</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="MEDIA">Média</SelectItem>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contexto</Label>
              <Input list="ctx-sugs" value={form.contexto ?? ""} onChange={(e) => update("contexto", e.target.value || null)} />
              <datalist id="ctx-sugs">{ctxSugs.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
          </div>

          <div>
            <Label>Prazo</Label>
            <Input type="date" value={form.prazo ?? ""} onChange={(e) => update("prazo", e.target.value || null)} />
          </div>

          <div>
            <Label>Tags (separadas por vírgula)</Label>
            <Input value={(form.tags ?? []).join(", ")} onChange={(e) => update("tags",
              e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea value={form.notas ?? ""} onChange={(e) => update("notas", e.target.value || null)} rows={3} />
          </div>

          {/* Conditional sections */}
          {tipo === "REUNIAO" && (
            <div className="rounded-lg border p-3 space-y-3">
              <h4 className="text-sm font-semibold">Detalhes da Reunião</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data/Hora</Label>
                  <Input type="datetime-local" value={form.data_reuniao ? form.data_reuniao.slice(0,16) : ""}
                    onChange={(e) => update("data_reuniao", e.target.value ? new Date(e.target.value).toISOString() : null)} />
                </div>
                <div>
                  <Label>Duração (min)</Label>
                  <Input type="number" value={form.duracao_min ?? ""} onChange={(e) => update("duracao_min", e.target.value ? Number(e.target.value) : null)} />
                </div>
              </div>
              <div>
                <Label>Participantes (separados por vírgula)</Label>
                <Input value={(form.participantes ?? []).join(", ")} onChange={(e) => update("participantes",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
              </div>
              <div>
                <Label>Local</Label>
                <Input value={form.local_reuniao ?? ""} onChange={(e) => update("local_reuniao", e.target.value || null)} />
              </div>
            </div>
          )}

          {tipo === "DECISAO" && (
            <div className="rounded-lg border p-3 space-y-3">
              <h4 className="text-sm font-semibold">Detalhes da Decisão</h4>
              <div>
                <Label>Opções (JSON: [{`{"opcao":"...","pros":["..."],"contras":["..."]}`}])</Label>
                <Textarea rows={4} value={form.opcoes_decisao ? JSON.stringify(form.opcoes_decisao, null, 2) : ""}
                  onChange={(e) => {
                    try { update("opcoes_decisao", e.target.value ? JSON.parse(e.target.value) : null); }
                    catch { /* ignore */ }
                  }} />
              </div>
              <div>
                <Label>Decisão tomada</Label>
                <Input value={form.decisao_tomada ?? ""} onChange={(e) => update("decisao_tomada", e.target.value || null)} />
              </div>
              <div>
                <Label>Decisão em</Label>
                <Input type="date" value={form.decisao_em ?? ""} onChange={(e) => update("decisao_em", e.target.value || null)} />
              </div>
            </div>
          )}

          {tipo === "PROJETO" && (
            <div className="rounded-lg border p-3">
              <Label>Item pai (para criar sub-itens)</Label>
              <Select value={form.item_pai_id ? String(form.item_pai_id) : "_NONE"}
                onValueChange={(v) => update("item_pai_id", v === "_NONE" ? null : Number(v))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_NONE">— Projeto raiz —</SelectItem>
                  {projetos.filter((p) => p.id !== form.id).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {tipo === "LEMBRETE" && (
            <div className="rounded-lg border p-3">
              <Label>Recorrência</Label>
              <Select value={form.recorrencia ?? "_NONE"} onValueChange={(v) => update("recorrencia", v === "_NONE" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_NONE">— Nenhuma —</SelectItem>
                  <SelectItem value="DIARIA">Diária</SelectItem>
                  <SelectItem value="SEMANAL">Semanal</SelectItem>
                  <SelectItem value="MENSAL">Mensal</SelectItem>
                  <SelectItem value="TRIMESTRAL">Trimestral</SelectItem>
                  <SelectItem value="ANUAL">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
