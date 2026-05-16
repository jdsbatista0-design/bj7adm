import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { paginateAll } from "@/integrations/supabase/db";
import { supabase } from "@/integrations/supabase/client";
import type { AlertaRow, LancamentoRow, TarefaRow } from "@/integrations/supabase/database";
import { useEmpresas } from "@/hooks/use-refs";
import { useCurrentUser } from "@/contexts/auth-context";
import { PageShell } from "@/components/bj7/PageShell";
import { formatBRL, toLocalIsoDate } from "@/lib/format";
import { Building2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresas/")({
  component: EmpresasIndex,
});

function EmpresasIndex() {
  const empresas = useEmpresas();
  const user = useCurrentUser();

  const startMonth = useMemo(() => {
    const d = new Date();
    return toLocalIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
  }, []);

  const lancQ = useQuery({
    queryKey: ["empresas-list", "lanc", startMonth, user.id],
    queryFn: async () => {
      if (!user.ve_todas_empresas && user.empresas_ids.length === 0) return [] as LancamentoRow[];
      return paginateAll<LancamentoRow>((fromIdx, toIdx) => {
        let q = supabase
          .from("lancamentos")
          .select("empresa_id,tipo,valor,contar_no_total,data")
          .gte("data", startMonth)
          .eq("contar_no_total", true)
          .in("tipo", ["Receita", "Despesa"]);
        if (!user.ve_todas_empresas) {
          q = q.in("empresa_id", user.empresas_ids);
        }
        return q.order("id", { ascending: true }).range(fromIdx, toIdx);
      });
    },
  });

  const alertasQ = useQuery({
    queryKey: ["empresas-list", "alertas"],
    queryFn: async () => {
      const r = await supabase.from("alertas").select("*").eq("status", "aberto").limit(500);
      if (r.error) throw r.error;
      return (r.data ?? []) as AlertaRow[];
    },
  });

  const tarefasQ = useQuery({
    queryKey: ["empresas-list", "tarefas"],
    queryFn: async () => {
      const r = await supabase
        .from("tarefas")
        .select("*")
        .in("status", ["aberta", "em_andamento", "aguardando"])
        .limit(2000);
      if (r.error) throw r.error;
      return (r.data ?? []) as TarefaRow[];
    },
  });

  const por = useMemo(() => {
    const map = new Map<number, { rec: number; desp: number; alertas: number; tarefas: number }>();
    for (const l of (lancQ.data ?? []) as LancamentoRow[]) {
      const e = map.get(l.empresa_id) ?? { rec: 0, desp: 0, alertas: 0, tarefas: 0 };
      const v = Math.abs(Number(l.valor) || 0);
      if (l.tipo === "Receita") e.rec += v;
      else e.desp += v;
      map.set(l.empresa_id, e);
    }
    for (const a of alertasQ.data ?? []) {
      if (a.empresa_id == null) continue;
      const e = map.get(a.empresa_id) ?? { rec: 0, desp: 0, alertas: 0, tarefas: 0 };
      e.alertas += 1;
      map.set(a.empresa_id, e);
    }
    for (const t of tarefasQ.data ?? []) {
      if (t.empresa_id == null) continue;
      const e = map.get(t.empresa_id) ?? { rec: 0, desp: 0, alertas: 0, tarefas: 0 };
      e.tarefas += 1;
      map.set(t.empresa_id, e);
    }
    return map;
  }, [lancQ.data, alertasQ.data, tarefasQ.data]);

  return (
    <PageShell title="Empresas" description="Saúde, receita e items abertos por empresa do grupo">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(empresas.data ?? []).map((e) => {
          const a = por.get(e.id) ?? { rec: 0, desp: 0, alertas: 0, tarefas: 0 };
          const margem = a.rec > 0 ? ((a.rec - a.desp) / a.rec) * 100 : 0;
          return (
            <Link
              key={e.id}
              to="/empresas/$id"
              params={{ id: String(e.id) }}
              className="rounded-2xl bg-card p-4 ring-1 ring-white/5 hover:ring-primary/30 transition"
              style={{ boxShadow: "var(--shadow-elegant)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="text-sm font-semibold truncate">{e.nome}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Mini label="Receita mês" value={formatBRL(a.rec)} />
                <Mini label="Despesa mês" value={formatBRL(a.desp)} />
                <Mini label="Margem" value={a.rec > 0 ? `${margem.toFixed(0)}%` : "—"} />
                <Mini label="Items abertos" value={`${a.alertas + a.tarefas}`} />
              </div>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold tabular truncate">{value}</div>
    </div>
  );
}
