import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/bj7/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sistema/por-eixo")({
  component: SistemaPorEixo,
});

type Row = { eixo_bj7: string | null; total_procedimentos: number | null };
type Dash = {
  id: number; titulo: string; codigo: string | null; eixo_bj7: string | null;
  status: string | null; empresa: string | null;
  execucoes_em_andamento: number | null; execucoes_concluidas: number | null;
};

const sb = () => supabase.schema("sistema" as never);

export default function SistemaPorEixo() {
  const eixoQ = useQuery({
    queryKey: ["sistema:por-eixo"],
    queryFn: async () => {
      const r = await sb().from("v_por_eixo").select("*").order("total_procedimentos", { ascending: false });
      if (r.error) throw r.error;
      return (r.data ?? []) as Row[];
    },
  });
  const procQ = useQuery({
    queryKey: ["sistema:proc-dashboard"],
    queryFn: async () => {
      const r = await sb().from("v_procedimentos_dashboard").select("*").order("titulo");
      if (r.error) throw r.error;
      return (r.data ?? []) as Dash[];
    },
  });

  const byEixo = (e: string | null) => (procQ.data ?? []).filter((p) => (p.eixo_bj7 ?? "(sem eixo)") === (e ?? "(sem eixo)"));

  return (
    <PageShell title="Procedimentos por Eixo BJ7" description="Distribuição dos procedimentos por eixo estratégico">
      {eixoQ.isLoading ? (
        <Skeleton className="h-64" />
      ) : (eixoQ.data ?? []).length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-40" /> Nenhum eixo configurado.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(eixoQ.data ?? []).map((e) => {
            const procs = byEixo(e.eixo_bj7);
            return (
              <Card key={e.eixo_bj7 ?? "_"}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{e.eixo_bj7 ?? "(sem eixo)"}</span>
                    <Badge variant="secondary">{e.total_procedimentos ?? 0}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                  {procs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum procedimento visível.</p>}
                  {procs.map((p) => (
                    <div key={p.id} className="border border-border rounded-md px-2.5 py-2">
                      <div className="text-sm font-medium leading-tight">{p.titulo}</div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        {p.codigo && <span className="font-mono">{p.codigo}</span>}
                        {p.empresa && <span>· {p.empresa}</span>}
                        {(p.execucoes_em_andamento ?? 0) > 0 && (
                          <Badge variant="outline" className="ml-auto text-[10px]">{p.execucoes_em_andamento} ativo(s)</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
