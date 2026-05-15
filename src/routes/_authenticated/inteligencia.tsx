import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AlertaRow, RegraRow } from "@/integrations/supabase/database";
import { PageShell, SectionHeader } from "@/components/bj7/PageShell";
import { ItemCard } from "@/components/bj7/ItemCard";
import { EmptyState } from "@/components/bj7/EmptyState";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inteligencia")({
  component: Inteligencia,
});

function Inteligencia() {
  const qc = useQueryClient();

  const regrasQ = useQuery({
    queryKey: ["intel", "regras"],
    queryFn: async () => {
      const r = await supabase.from("regras").select("*").order("id");
      if (r.error) throw r.error;
      return (r.data ?? []) as RegraRow[];
    },
  });

  const alertasQ = useQuery({
    queryKey: ["intel", "alertas"],
    queryFn: async () => {
      const r = await supabase
        .from("alertas")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(50);
      if (r.error) throw r.error;
      return (r.data ?? []) as AlertaRow[];
    },
  });

  const motor = useMutation({
    mutationFn: async () => {
      const r = await supabase.rpc("executar_regras");
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Motor executado");
      qc.invalidateQueries({ queryKey: ["intel"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, ativo }: { id: number; ativo: boolean }) => {
      const r = await supabase.from("regras").update({ ativo }).eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intel", "regras"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const ack = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "resolver" | "snooze" }) => {
      const fn = action === "resolver" ? "resolver_alerta" : "snooze_alerta";
      const params = action === "snooze" ? { _id: id, _horas: 24 } : { _id: id };
      const r = await supabase.rpc(fn, params);
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intel", "alertas"] }),
  });

  return (
    <PageShell
      title="Inteligência"
      description="Regras automáticas que viram alertas + tarefas"
      actions={
        <Button size="sm" onClick={() => motor.mutate()} disabled={motor.isPending}>
          {motor.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Rodar motor
        </Button>
      }
    >
      <section>
        <SectionHeader title="Regras" description={`${regrasQ.data?.filter((r) => r.ativo).length ?? 0} ativas`} />
        {(regrasQ.data ?? []).length === 0 ? (
          <EmptyState
            title="Nenhuma regra cadastrada"
            description="Rode o SQL motor_regras.sql no Supabase para popular as 7 regras seed."
          />
        ) : (
          <div className="space-y-2">
            {(regrasQ.data ?? []).map((r) => (
              <div
                key={r.id}
                className="rounded-xl bg-card p-3 ring-1 ring-white/5 flex items-center gap-3"
              >
                <Switch
                  checked={r.ativo}
                  onCheckedChange={(v) => toggle.mutate({ id: r.id, ativo: v })}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.nome}</div>
                  {r.descricao && (
                    <div className="text-xs text-muted-foreground truncate">{r.descricao}</div>
                  )}
                </div>
                <span className="text-[10px] uppercase text-muted-foreground">{r.tipo}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Últimos alertas" description="Histórico recente" />
        {(alertasQ.data ?? []).length === 0 ? (
          <EmptyState title="Sem histórico" description="Rode o motor para gerar alertas." />
        ) : (
          <div className="space-y-2">
            {(alertasQ.data ?? []).slice(0, 15).map((a) => (
              <ItemCard
                key={a.id}
                item={{ kind: "alerta", data: a }}
                onResolver={
                  a.status === "aberto" ? (id) => ack.mutate({ id, action: "resolver" }) : undefined
                }
                onSnooze={
                  a.status === "aberto" ? (id) => ack.mutate({ id, action: "snooze" }) : undefined
                }
              />
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
