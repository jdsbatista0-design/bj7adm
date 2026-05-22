import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, Eye, MapPin, ListTodo } from "lucide-react";
import { PageShell } from "@/components/bj7/PageShell";

type Dash = {
  colaboradores_ativos: number;
  pdis_abertos: number;
  okrs_em_andamento: number;
  one_on_ones_30d: number;
  visitas_30d: number;
};

export default function DashboardView() {
  const { data, isLoading } = useQuery({
    queryKey: ["pessoas_dashboard"],
    queryFn: async (): Promise<Dash | null> => {
      const { data, error } = await supabase.from("pessoas_dashboard").select("*").maybeSingle();
      if (error) throw error;
      return data as Dash | null;
    },
  });

  const items = [
    { label: "Colaboradores ativos", value: data?.colaboradores_ativos, icon: Users },
    { label: "PDIs abertos", value: data?.pdis_abertos, icon: ListTodo },
    { label: "OKRs em andamento", value: data?.okrs_em_andamento, icon: Target },
    { label: "1:1s (30d)", value: data?.one_on_ones_30d, icon: Eye },
    { label: "Visitas em rua (30d)", value: data?.visitas_30d, icon: MapPin },
  ];

  return (
    <PageShell title="Dashboard Pessoas" description="Visão geral do time">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((it) => (
          <Card key={it.label}>
            <CardHeader className="pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">{it.label}</CardTitle>
              <it.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{isLoading ? "…" : (it.value ?? 0)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
