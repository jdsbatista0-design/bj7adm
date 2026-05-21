import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type DragEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/contexts/auth-context";
import { useEmpresas } from "@/hooks/use-refs";
import type { TarefaRow, TarefaStatus, Prioridade } from "@/integrations/supabase/database";
import { PageShell } from "@/components/bj7/PageShell";
import { EmptyState } from "@/components/bj7/EmptyState";
import { PrioridadeBadge } from "@/components/bj7/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useItemDrawer } from "@/components/bj7/ItemDrawer";
import {
  Plus,
  Building2,
  Clock,
  CheckCircle2,
  Search,
  GripVertical,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/itens")({
  component: ItensPage,
});

type ColKey = Exclude<TarefaStatus, "cancelada">;

const COLUMNS: { key: ColKey; title: string; tone: string; dot: string }[] = [
  { key: "aberta", title: "Aberta", tone: "text-info", dot: "bg-info" },
  { key: "em_andamento", title: "Em andamento", tone: "text-primary", dot: "bg-primary" },
  { key: "aguardando", title: "Aguardando", tone: "text-warning", dot: "bg-warning" },
  { key: "concluida", title: "Concluída", tone: "text-success", dot: "bg-success" },
];

const PRIO_ORDER: Record<Prioridade, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

function ItensPage() {
  const user = useCurrentUser();
  const drawer = useItemDrawer();
  const empresas = useEmpresas();
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [prio, setPrio] = useState<string>("all");
  const [escopo, setEscopo] = useState<"todos" | "meus">("todos");

  const tarefasQ = useQuery({
    queryKey: ["itens", "tarefas"],
    queryFn: async () => {
      const r = await supabase
        .from("tarefas")
        .select("*")
        .neq("status", "cancelada")
        .order("prioridade", { ascending: true })
        .order("prazo", { ascending: true, nullsFirst: false })
        .limit(2000);
      if (r.error) throw r.error;
      return (r.data ?? []) as TarefaRow[];
    },
  });

  const empresaNomeById = useMemo(() => {
    const m = new Map<number, string>();
    (empresas.data ?? []).forEach((e) => m.set(e.id, e.nome));
    return m;
  }, [empresas.data]);

  const filtradas = useMemo(() => {
    const list = tarefasQ.data ?? [];
    const term = q.trim().toLowerCase();
    return list.filter((t) => {
      if (escopo === "meus" && t.responsavel_id !== user.id) return false;
      if (empresaId !== "all") {
        if (empresaId === "none") {
          if (t.empresa_id !== null) return false;
        } else if (String(t.empresa_id) !== empresaId) return false;
      }
      if (prio !== "all" && t.prioridade !== prio) return false;
      if (term) {
        const hay = `${t.titulo} ${t.descricao ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [tarefasQ.data, q, empresaId, prio, escopo, user.id]);

  const cols = useMemo(() => {
    const map: Record<ColKey, TarefaRow[]> = {
      aberta: [],
      em_andamento: [],
      aguardando: [],
      concluida: [],
    };
    for (const t of filtradas) {
      const k = t.status as ColKey;
      if (k in map) map[k].push(t);
    }
    for (const k of Object.keys(map) as ColKey[]) {
      map[k].sort((a, b) => {
        const pa = PRIO_ORDER[a.prioridade] ?? 9;
        const pb = PRIO_ORDER[b.prioridade] ?? 9;
        if (pa !== pb) return pa - pb;
        const ta = a.prazo ? new Date(a.prazo).getTime() : Number.POSITIVE_INFINITY;
        const tb = b.prazo ? new Date(b.prazo).getTime() : Number.POSITIVE_INFINITY;
        return ta - tb;
      });
    }
    return map;
  }, [filtradas]);

  const moveMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: ColKey }) => {
      if (status === "concluida") {
        const r = await supabase.rpc("concluir_tarefa", { _id: id });
        if (r.error) throw r.error;
        return;
      }
      const r = await supabase
        .from("tarefas")
        .update({ status, concluida_em: null })
        .eq("id", id);
      if (r.error) throw r.error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["itens", "tarefas"] });
      const prev = qc.getQueryData<TarefaRow[]>(["itens", "tarefas"]);
      if (prev) {
        qc.setQueryData<TarefaRow[]>(
          ["itens", "tarefas"],
          prev.map((t) => (t.id === id ? { ...t, status } : t)),
        );
      }
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["itens", "tarefas"], ctx.prev);
      toast.error("Falha ao mover: " + e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["itens", "tarefas"] }),
  });

  const total = filtradas.length;
  const meus = filtradas.filter((t) => t.responsavel_id === user.id).length;
  const atrasados = filtradas.filter(
    (t) => t.prazo && t.status !== "concluida" && new Date(t.prazo).getTime() < Date.now(),
  ).length;

  return (
    <PageShell
      title="Itens"
      description="Kanban de tarefas — arraste entre colunas para mudar o status"
      actions={
        <Button size="sm" onClick={() => drawer.open()}>
          <Plus className="h-4 w-4 mr-1" /> Nova tarefa
        </Button>
      }
    >
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Total filtrado" value={total} />
        <Stat label="Atribuídas a você" value={meus} />
        <Stat label="Atrasadas" value={atrasados} tone={atrasados > 0 ? "danger" : "muted"} />
      </div>

      {/* Filtros */}
      <div className="rounded-2xl bg-card p-3 ring-1 ring-white/5 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar título ou descrição…"
            className="h-9 pl-8"
          />
        </div>
        <Select value={escopo} onValueChange={(v) => setEscopo(v as "todos" | "meus")}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="meus">Minhas tarefas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={empresaId} onValueChange={setEmpresaId}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas empresas</SelectItem>
            <SelectItem value="none">— Sem empresa —</SelectItem>
            {(empresas.data ?? []).map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={prio} onValueChange={setPrio}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tarefasQ.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : total === 0 ? (
        <EmptyState
          title="Nenhuma tarefa encontrada"
          description="Ajuste os filtros ou crie uma nova tarefa."
          action={
            <Button size="sm" onClick={() => drawer.open()}>
              <Plus className="h-4 w-4 mr-1" /> Nova tarefa
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((c) => (
            <KanbanColumn
              key={c.key}
              column={c}
              tarefas={cols[c.key]}
              empresaNomeById={empresaNomeById}
              onDrop={(id) => moveMut.mutate({ id, status: c.key })}
              onCardClick={(t) => drawer.open({ tarefa: t })}
              onAddInColumn={() => drawer.open({})}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "danger";
}) {
  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-white/5">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div
        className={cn(
          "text-2xl font-semibold tabular-nums mt-0.5",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function KanbanColumn({
  column,
  tarefas,
  empresaNomeById,
  onDrop,
  onCardClick,
  onAddInColumn,
}: {
  column: { key: ColKey; title: string; tone: string; dot: string };
  tarefas: TarefaRow[];
  empresaNomeById: Map<number, string>;
  onDrop: (id: number) => void;
  onCardClick: (t: TarefaRow) => void;
  onAddInColumn: () => void;
}) {
  const [hover, setHover] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!hover) setHover(true);
  };
  const handleDragLeave = () => setHover(false);
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setHover(false);
    const raw = e.dataTransfer.getData("text/plain");
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) return;
    onDrop(id);
  };

  return (
    <div
      className={cn(
        "rounded-2xl bg-card ring-1 ring-white/5 flex flex-col min-h-[200px] transition",
        hover && "ring-2 ring-primary/60",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", column.dot)} />
          <h2 className={cn("text-sm font-semibold tracking-tight", column.tone)}>
            {column.title}
          </h2>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {tarefas.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onAddInColumn}
          className="text-muted-foreground hover:text-foreground transition"
          aria-label="Adicionar item"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-2 space-y-2 flex-1">
        {tarefas.length === 0 ? (
          <div className="text-[11px] text-muted-foreground text-center py-6">
            Arraste itens para cá
          </div>
        ) : (
          tarefas.map((t) => (
            <TaskCard
              key={t.id}
              tarefa={t}
              empresaNome={t.empresa_id ? empresaNomeById.get(t.empresa_id) ?? null : null}
              onClick={() => onCardClick(t)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function formatPrazo(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function TaskCard({ tarefa, empresaNome }: { tarefa: TarefaRow; empresaNome: string | null }) {
  const overdue =
    !!tarefa.prazo &&
    tarefa.status !== "concluida" &&
    new Date(tarefa.prazo).getTime() < Date.now();
  const done = tarefa.status === "concluida";

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("text/plain", String(tarefa.id));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "group rounded-xl bg-background/40 p-2.5 ring-1 ring-white/5 cursor-grab active:cursor-grabbing transition hover:ring-primary/30",
        overdue && "ring-destructive/40",
        done && "opacity-75",
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {done && <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />}
            <h3
              className={cn(
                "text-sm font-medium leading-snug",
                done && "line-through text-muted-foreground",
              )}
            >
              {tarefa.titulo}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            <PrioridadeBadge p={tarefa.prioridade} />
            {tarefa.entidade_tipo && (
              <span className="text-[10px] text-muted-foreground uppercase">
                {tarefa.entidade_tipo}
              </span>
            )}
            {empresaNome && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Building2 className="h-3 w-3" />
                {empresaNome}
              </span>
            )}
          </div>
          {tarefa.descricao && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{tarefa.descricao}</p>
          )}
          {tarefa.prazo && (
            <div
              className={cn(
                "flex items-center gap-1 text-[11px] mt-1.5 tabular-nums",
                overdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {overdue ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              {overdue ? "Atrasada · " : "Prazo · "}
              {formatPrazo(tarefa.prazo)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
