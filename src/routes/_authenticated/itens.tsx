import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { from, asRows } from "@/integrations/supabase/db";
import type { TarefaRow, TarefaStatus } from "@/integrations/supabase/database";
import { useEmpresas, useUsuarios } from "@/hooks/use-refs";
import { PageShell } from "@/components/bj7/PageShell";
import { ItemCard } from "@/components/bj7/ItemCard";
import { useItemDrawer } from "@/components/bj7/ItemDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, ListTodo, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";

const searchSchema = z.object({
  hoje: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/itens")({
  validateSearch: searchSchema,
  component: CockpitPage,
});

const COLUMNS: { key: TarefaStatus; label: string; tone: string }[] = [
  { key: "aberta",       label: "Aberta",        tone: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
  { key: "em_andamento", label: "Em andamento",  tone: "bg-purple-500/10 text-purple-300 border-purple-500/30" },
  { key: "aguardando",   label: "Aguardando",    tone: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  { key: "concluida",    label: "Concluída",     tone: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
];

function CockpitPage() {
  const { hoje } = useSearch({ from: Route.id });
  const drawer = useItemDrawer();
  const qc = useQueryClient();
  const empresas = useEmpresas();
  const usuarios = useUsuarios();

  const [empresaId, setEmpresaId] = useState<string>("0");
  const [responsavelId, setResponsavelId] = useState<string>("0");
  const [prioridade, setPrioridade] = useState<string>("all");
  const [busca, setBusca] = useState("");

  const todayIso = new Date().toISOString().slice(0, 10);

  const q = useQuery({
    queryKey: ["tarefas", "cockpit", { empresaId, responsavelId, prioridade, hoje }],
    queryFn: async () => {
      let qb = from("tarefas").select("*").order("criada_em", { ascending: false }).limit(500);
      if (empresaId !== "0") qb = qb.eq("empresa_id", Number(empresaId));
      if (responsavelId !== "0") qb = qb.eq("responsavel_id", Number(responsavelId));
      if (prioridade !== "all") qb = qb.eq("prioridade", prioridade);
      if (hoje === "1") qb = qb.lte("prazo", todayIso + "T23:59:59").neq("status", "concluida");
      const r = await qb;
      if (r.error) throw r.error;
      return asRows("tarefas", r.data);
    },
  });

  const concluir = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.rpc("concluir_tarefa", { _id: id });
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Tarefa concluída");
      qc.invalidateQueries({ queryKey: ["tarefas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: TarefaStatus }) => {
      const r = await from("tarefas").update({ status }).eq("id", id);
      if (r.error) throw r.error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["tarefas"] });
      const prev = qc.getQueriesData<TarefaRow[]>({ queryKey: ["tarefas"] });
      prev.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData(key, data.map(t => t.id === id ? { ...t, status } : t));
      });
      return { prev };
    },
    onError: (e: Error, _vars, ctx) => {
      ctx?.prev.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tarefas"] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeId, setActiveId] = useState<number | null>(null);
  const activeTarefa = useMemo(
    () => (q.data ?? []).find(t => t.id === activeId) ?? null,
    [q.data, activeId]
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(Number(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id as TarefaStatus | undefined;
    const id = Number(e.active.id);
    if (!overId) return;
    const current = (q.data ?? []).find(t => t.id === id);
    if (!current || current.status === overId) return;
    if (overId === "concluida") {
      concluir.mutate(id);
    } else {
      mudarStatus.mutate({ id, status: overId });
    }
  }

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    const term = busca.trim().toLowerCase();
    if (!term) return list;
    return list.filter(t =>
      t.titulo.toLowerCase().includes(term) ||
      (t.descricao?.toLowerCase().includes(term) ?? false)
    );
  }, [q.data, busca]);

  const grouped = useMemo(() => {
    const map = new Map<TarefaStatus, TarefaRow[]>();
    COLUMNS.forEach(c => map.set(c.key, []));
    filtered.forEach(t => {
      const k = COLUMNS.find(c => c.key === t.status)?.key ?? "aberta";
      map.get(k)!.push(t);
    });
    return map;
  }, [filtered]);

  return (
    <PageShell
      title="Cockpit"
      description="Tarefas, decisões e ações — tudo em um lugar"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const next = hoje === "1" ? undefined : "1";
            window.history.replaceState(null, "", next ? "/itens?hoje=1" : "/itens");
            qc.invalidateQueries({ queryKey: ["tarefas", "cockpit"] });
          }}>
            <Calendar className="h-4 w-4 mr-2" />
            {hoje === "1" ? "Ver todas" : "Só hoje"}
          </Button>
          <Button size="sm" onClick={() => drawer.open({ entidade_tipo: "tarefa" })}>
            <Plus className="h-4 w-4 mr-2" /> Nova
          </Button>
        </div>
      }
    >
      {/* Filtros */}
      <div className="rounded-xl bg-card p-3 ring-1 ring-white/5">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar título ou descrição..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Todas as empresas</SelectItem>
              {empresas.data?.map(e => (
                <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={responsavelId} onValueChange={setResponsavelId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Todos os responsáveis</SelectItem>
              {usuarios.data?.map(u => (
                <SelectItem key={u.id} value={String(u.id)}>{u.nome ?? u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={prioridade} onValueChange={setPrioridade}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {q.error && (
        <div className="rounded-xl bg-destructive/10 text-destructive p-3 text-sm ring-1 ring-destructive/30">
          Erro ao carregar tarefas: {(q.error as Error).message}
        </div>
      )}

      {/* Kanban */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map(col => {
          const items = grouped.get(col.key) ?? [];
          return (
            <div key={col.key} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wide", col.tone)}>
                    {col.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
              </div>
              <div className="space-y-2 min-h-[80px]">
                {q.isLoading ? (
                  <>
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                  </>
                ) : items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/5 p-4 text-center text-xs text-muted-foreground">
                    <ListTodo className="h-4 w-4 mx-auto mb-1 opacity-50" />
                    Nada aqui
                  </div>
                ) : (
                  items.map(t => (
                    <div key={t.id} onClick={() => drawer.open({ tarefa: t })} className="cursor-pointer">
                      <ItemCard
                        item={{ kind: "tarefa", data: t }}
                        onConcluir={t.status !== "concluida" ? () => concluir.mutate(t.id) : undefined}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
