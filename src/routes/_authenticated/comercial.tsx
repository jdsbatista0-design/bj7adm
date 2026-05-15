import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TarefaRow } from "@/integrations/supabase/database";
import { PageShell } from "@/components/bj7/PageShell";
import { ItemCard } from "@/components/bj7/ItemCard";
import { EmptyState } from "@/components/bj7/EmptyState";
import { Button } from "@/components/ui/button";
import { useItemDrawer } from "@/components/bj7/ItemDrawer";
import { Plus, Briefcase } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/comercial")({
  component: Comercial,
});

const TIPOS = ["lead", "oportunidade", "proposta", "followup"];

function Comercial() {
  const drawer = useItemDrawer();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["comercial"],
    queryFn: async () => {
      const r = await supabase
        .from("tarefas")
        .select("*")
        .in("entidade_tipo", TIPOS)
        .in("status", ["aberta", "em_andamento", "aguardando"])
        .order("prioridade", { ascending: false })
        .order("prazo", { ascending: true, nullsFirst: false })
        .limit(500);
      if (r.error) throw r.error;
      return (r.data ?? []) as TarefaRow[];
    },
  });

  const concluir = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.rpc("concluir_tarefa", { _id: id });
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comercial"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const items = q.data ?? [];

  return (
    <PageShell
      title="Comercial"
      description="Leads, oportunidades, propostas e follow-ups — armazenados como Items"
      actions={
        <Button size="sm" onClick={() => drawer.open({ entidade_tipo: "lead" })}>
          <Plus className="h-4 w-4 mr-1" /> Novo lead
        </Button>
      }
    >
      {items.length === 0 && !q.isLoading ? (
        <EmptyState
          icon={<Briefcase className="h-5 w-5" />}
          title="Nenhum item comercial ainda"
          description="Crie seu primeiro lead, oportunidade ou follow-up. Tudo aqui é um Item com prazo, dono e empresa."
          action={
            <Button size="sm" onClick={() => drawer.open({ entidade_tipo: "lead" })}>
              <Plus className="h-4 w-4 mr-1" /> Criar lead
            </Button>
          }
        />
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          {items.map((t) => (
            <ItemCard
              key={t.id}
              item={{ kind: "tarefa", data: t }}
              onConcluir={(id) => concluir.mutate(id)}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
