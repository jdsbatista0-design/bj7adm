import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/bj7/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle2, Circle, PlayCircle, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sistema/execucoes")({
  component: SistemaExecucoes,
});

type ExecRow = {
  id: number; procedimento: string | null; eixo_bj7: string | null;
  status: string | null; empresa: string | null;
  total_etapas: number | null; etapas_concluidas: number | null;
  iniciada_em: string | null; referencia: string | null;
};
type EtapaInfo = { titulo: string; ordem: number | null; obrigatoria: boolean | null };
type EtapaExec = {
  id: number; execucao_id: number; etapa_id: number; status: string;
  observacoes: string | null; iniciada_em: string | null; concluida_em: string | null;
  etapas?: EtapaInfo | EtapaInfo[] | null;
};
const getEtapa = (e: EtapaExec): EtapaInfo | null => {
  const x = e.etapas;
  if (!x) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
};

const sb = () => supabase.schema("sistema" as never);
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleString("pt-BR") : "—";

export default function SistemaExecucoes() {
  const qc = useQueryClient();
  const [openExec, setOpenExec] = useState<number | null>(null);

  const execQ = useQuery({
    queryKey: ["sistema:execucoes"],
    queryFn: async () => {
      const r = await sb().from("v_execucoes_em_andamento").select("*").order("iniciada_em", { ascending: false });
      if (r.error) throw r.error;
      return (r.data ?? []) as ExecRow[];
    },
  });

  return (
    <PageShell title="Execuções em andamento" description="Procedimentos em curso e progresso das etapas">
      <Card>
        <CardContent className="p-0">
          {execQ.isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (execQ.data ?? []).length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <PlayCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhuma execução em andamento.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Procedimento</TableHead>
                  <TableHead>Eixo</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Iniciada</TableHead>
                  <TableHead className="min-w-[200px]">Progresso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(execQ.data ?? []).map((r) => {
                  const pct = r.total_etapas && r.total_etapas > 0
                    ? Math.round(((r.etapas_concluidas ?? 0) / r.total_etapas) * 100)
                    : 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.procedimento ?? "—"}</TableCell>
                      <TableCell>{r.eixo_bj7 ? <Badge variant="secondary">{r.eixo_bj7}</Badge> : "—"}</TableCell>
                      <TableCell className="text-sm">{r.empresa ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.referencia ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(r.iniciada_em)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="flex-1" />
                          <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
                            {r.etapas_concluidas ?? 0}/{r.total_etapas ?? 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell><Badge>{r.status ?? "—"}</Badge></TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setOpenExec(r.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {openExec && <ExecDetail execId={openExec} onClose={() => setOpenExec(null)} onChange={() => qc.invalidateQueries({ queryKey: ["sistema:execucoes"] })} />}
    </PageShell>
  );
}

function ExecDetail({ execId, onClose, onChange }: { execId: number; onClose: () => void; onChange: () => void }) {
  const qc = useQueryClient();
  const etQ = useQuery({
    queryKey: ["sistema:etapas-exec", execId],
    queryFn: async () => {
      const r = await sb().from("etapas_executadas")
        .select("id, execucao_id, etapa_id, status, observacoes, iniciada_em, concluida_em, etapas(titulo, ordem, obrigatoria)")
        .eq("execucao_id", execId)
        .order("etapa_id");
      if (r.error) throw r.error;
      const rows = (r.data ?? []) as EtapaExec[];
      return rows.sort((a, b) => (getEtapa(a)?.ordem ?? 0) - (getEtapa(b)?.ordem ?? 0));
    },
  });

  const updateM = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const patch: Record<string, unknown> = { status };
      if (status === "CONCLUIDA") patch.concluida_em = new Date().toISOString();
      if (status === "EM_ANDAMENTO") patch.iniciada_em = new Date().toISOString();
      const r = await sb().from("etapas_executadas").update(patch).eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sistema:etapas-exec", execId] });
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Etapas da Execução #{execId}</DialogTitle></DialogHeader>
        {etQ.isLoading ? <Skeleton className="h-40" /> : (
          <div className="space-y-2">
            {(etQ.data ?? []).map((e) => (
              <div key={e.id} className="flex items-center gap-3 border border-border rounded-md p-3">
                {e.status === "CONCLUIDA" ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{getEtapa(e)?.titulo ?? `Etapa ${e.etapa_id}`}</div>
                  {getEtapa(e)?.obrigatoria && <Badge variant="outline" className="mt-1 text-[10px]">OBRIGATÓRIA</Badge>}
                </div>
                <Badge variant={e.status === "CONCLUIDA" ? "default" : "outline"}>{e.status}</Badge>
                {e.status !== "CONCLUIDA" && (
                  <Button size="sm" onClick={() => updateM.mutate({ id: e.id, status: "CONCLUIDA" })}>Concluir</Button>
                )}
              </div>
            ))}
            {(etQ.data ?? []).length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Sem etapas registradas.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
