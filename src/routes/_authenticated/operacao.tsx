import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TarefaRow } from "@/integrations/supabase/database";
import { PageShell, SectionHeader } from "@/components/bj7/PageShell";
import { ItemCard } from "@/components/bj7/ItemCard";
import { EmptyState } from "@/components/bj7/EmptyState";
import { Button } from "@/components/ui/button";
import { useItemDrawer } from "@/components/bj7/ItemDrawer";
import { Plus, Wrench } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/operacao")({
  component: Operacao,
});

const COMERCIAIS = ["lead", "oportunidade", "proposta", "followup"];

function Operacao() {
  const drawer = useItemDrawer();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["operacao"],
    queryFn: async () => {
      const r = await supabase
        .from("tarefas")
        .select("*")
        .in("status", ["aberta", "em_andamento", "aguardando"])
        .order("prazo", { ascending: true, nullsFirst: false })
        .limit(500);
      if (r.error) throw r.error;
      return ((r.data ?? []) as TarefaRow[]).filter(
        (t) => !t.entidade_tipo || !COMERCIAIS.includes(t.entidade_tipo),
      );
    },
  });

  const colunas = useMemo(() => {
    const items = q.data ?? [];
    return {
      aberta: items.filter((t) => t.status === "aberta"),
      em_andamento: items.filter((t) => t.status === "em_andamento"),
      aguardando: items.filter((t) => t.status === "aguardando"),
    };
  }, [q.data]);

  const concluir = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.rpc("concluir_tarefa", { _id: id });
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operacao"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const total = (q.data ?? []).length;

  return (
    <PageShell
      title="Operação"
      description="Tarefas operacionais por status — gargalos visíveis"
      actions={
        <Button size="sm" onClick={() => drawer.open({ entidade_tipo: "tarefa" })}>
          <Plus className="h-4 w-4 mr-1" /> Tarefa
        </Button>
      }
    >
      {total === 0 && !q.isLoading ? (
        <EmptyState
          icon={<Wrench className="h-5 w-5" />}
          title="Nada na operação"
          description="Crie a primeira tarefa operacional."
          action={
            <Button size="sm" onClick={() => drawer.open({ entidade_tipo: "tarefa" })}>
              <Plus className="h-4 w-4 mr-1" /> Criar tarefa
            </Button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          <Coluna titulo="Aberta" items={colunas.aberta} onConcluir={(id) => concluir.mutate(id)} />
          <Coluna titulo="Em andamento" items={colunas.em_andamento} onConcluir={(id) => concluir.mutate(id)} />
          <Coluna titulo="Aguardando" items={colunas.aguardando} onConcluir={(id) => concluir.mutate(id)} />
        </div>
      )}
    </PageShell>
  );
}

function Coluna({
  titulo,
  items,
  onConcluir,
}: {
  titulo: string;
  items: TarefaRow[];
  onConcluir: (id: number) => void;
}) {
  return (
    <div className="rounded-2xl bg-card/40 ring-1 ring-white/5 p-3">
      <SectionHeader title={titulo} description={`${items.length} item(ns)`} />
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6">vazio</div>
        ) : (
          items.map((t) => (
            <ItemCard key={t.id} item={{ kind: "tarefa", data: t }} onConcluir={onConcluir} />
          ))
        )}
      </div>
    </div>
  );
}
