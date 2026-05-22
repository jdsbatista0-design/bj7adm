import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/bj7/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/documentos/vencimentos")({
  component: DocumentosVencimentos,
});

type VencendoRow = {
  id: number; titulo: string; tipo: string | null; categoria: string | null;
  contraparte_nome: string | null; vigencia_inicio: string | null; vigencia_fim: string | null;
  dias_para_vencer: number | null; valor_total: number | null; valor_mensal: number | null;
  renovacao_automatica: boolean | null; status: string | null; criticidade: string | null;
  empresas: string | null;
};

const fmtDate = (s: string | null | undefined) =>
  !s ? "—" : new Date(s).toLocaleDateString("pt-BR");
const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n));

export default function DocumentosVencimentos() {
  const [tab, setTab] = useState<"vencidos" | "urgente" | "proximos">("vencidos");

  const q = useQuery<VencendoRow[]>({
    queryKey: ["documentos", "vencendo-all"],
    queryFn: async () => {
      const r = await supabase.schema("documentos" as never)
        .from("v_vencendo")
        .select("*")
        .order("dias_para_vencer", { ascending: true });
      if (r.error) throw r.error;
      return (r.data ?? []) as VencendoRow[];
    },
    staleTime: 60 * 1000,
  });

  const buckets = useMemo(() => {
    const rows = q.data ?? [];
    return {
      vencidos: rows.filter(r => (r.dias_para_vencer ?? 0) < 0),
      urgente: rows.filter(r => {
        const d = r.dias_para_vencer ?? 0;
        return d >= 0 && d <= 7;
      }),
      proximos: rows.filter(r => {
        const d = r.dias_para_vencer ?? 0;
        return d > 7 && d <= 90;
      }),
    };
  }, [q.data]);

  return (
    <PageShell title="Vencimentos" description="Documentos vencidos e próximos do vencimento">
      {buckets.vencidos.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{buckets.vencidos.length} documento(s) vencido(s)</AlertTitle>
          <AlertDescription>Renove ou aditive imediatamente.</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as "vencidos" | "urgente" | "proximos")}>
        <TabsList>
          <TabsTrigger value="vencidos">Vencidos ({buckets.vencidos.length})</TabsTrigger>
          <TabsTrigger value="urgente">Urgente · 7d ({buckets.urgente.length})</TabsTrigger>
          <TabsTrigger value="proximos">Próximos · 8-90d ({buckets.proximos.length})</TabsTrigger>
        </TabsList>
        {(["vencidos", "urgente", "proximos"] as const).map((k) => (
          <TabsContent key={k} value={k}>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Contraparte</TableHead>
                      <TableHead>Empresa(s)</TableHead>
                      <TableHead>Vence em</TableHead>
                      <TableHead>Dias</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Renovação auto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {q.isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                        </TableRow>
                      ))
                    ) : buckets[k].length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          <CheckCircle2 className="h-5 w-5 inline mr-2" /> Nada por aqui
                        </TableCell>
                      </TableRow>
                    ) : buckets[k].map((r) => {
                      const days = r.dias_para_vencer ?? 0;
                      const cls = days < 0 ? "text-destructive font-semibold"
                        : days <= 7 ? "text-amber-600 font-semibold"
                          : "text-emerald-600";
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.titulo}</TableCell>
                          <TableCell><Badge variant="outline">{r.tipo ?? "—"}</Badge></TableCell>
                          <TableCell>{r.contraparte_nome ?? "—"}</TableCell>
                          <TableCell className="text-xs">{r.empresas ?? "—"}</TableCell>
                          <TableCell>{fmtDate(r.vigencia_fim)}</TableCell>
                          <TableCell className={cn(cls)}>{days < 0 ? `${-days} dias atrás` : `${days} dias`}</TableCell>
                          <TableCell>{fmtMoney(r.valor_total ?? r.valor_mensal)}</TableCell>
                          <TableCell>{r.renovacao_automatica ? <Badge variant="default">Sim</Badge> : <span className="text-xs text-muted-foreground">Não</span>}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <div className="text-xs text-muted-foreground mt-2">
              Para renovar/aditivar use o repositório (/documentos) → ícone "Versões".
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </PageShell>
  );
}
