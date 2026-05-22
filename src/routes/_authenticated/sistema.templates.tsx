import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresas } from "@/hooks/use-refs";
import { PageShell } from "@/components/bj7/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { FileText, Play, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sistema/templates")({
  component: SistemaTemplates,
});

type Proc = {
  id: number; codigo: string | null; titulo: string; descricao: string | null;
  eixo_bj7: string | null; categoria: string | null; status: string;
};

const sb = () => supabase.schema("sistema" as never);

export default function SistemaTemplates() {
  const qc = useQueryClient();
  const empresasQ = useEmpresas();
  const [start, setStart] = useState<Proc | null>(null);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [referencia, setReferencia] = useState<string>("");

  const tQ = useQuery({
    queryKey: ["sistema:templates"],
    queryFn: async () => {
      const r = await sb().from("procedimentos")
        .select("id, codigo, titulo, descricao, eixo_bj7, categoria, status")
        .eq("status", "TEMPLATE")
        .order("titulo");
      if (r.error) throw r.error;
      return (r.data ?? []) as Proc[];
    },
  });

  const startM = useMutation({
    mutationFn: async () => {
      if (!start) return;
      const r = await sb().rpc("iniciar_execucao", {
        p_procedimento_id: start.id,
        p_referencia: referencia || null,
        p_empresa_id: empresaId ? Number(empresaId) : null,
      });
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Execução iniciada a partir do template");
      setStart(null); setEmpresaId(""); setReferencia("");
      qc.invalidateQueries({ queryKey: ["sistema:execucoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cloneM = useMutation({
    mutationFn: async (p: Proc) => {
      const r = await sb().from("procedimentos").insert({
        codigo: p.codigo ? `${p.codigo}-copy` : null,
        titulo: `${p.titulo} (cópia)`,
        descricao: p.descricao,
        eixo_bj7: p.eixo_bj7,
        categoria: p.categoria,
        status: "RASCUNHO",
      });
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Template clonado como rascunho");
      qc.invalidateQueries({ queryKey: ["sistema:proc-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell title="Templates de Procedimentos" description="Modelos prontos para iniciar novas execuções">
      {tQ.isLoading ? (
        <Skeleton className="h-40" />
      ) : (tQ.data ?? []).length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Nenhum template criado. Marque um procedimento com status TEMPLATE para vê-lo aqui.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(tQ.data ?? []).map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-start justify-between gap-2">
                  <span>{t.titulo}</span>
                  {t.eixo_bj7 && <Badge variant="secondary" className="text-[10px]">{t.eixo_bj7}</Badge>}
                </CardTitle>
                {t.codigo && <p className="text-[11px] font-mono text-muted-foreground">{t.codigo}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                {t.descricao && <p className="text-xs text-muted-foreground line-clamp-3">{t.descricao}</p>}
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => setStart(t)}>
                    <Play className="h-3 w-3 mr-1" /> Usar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => cloneM.mutate(t)} disabled={cloneM.isPending}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!start} onOpenChange={(o) => !o && setStart(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Iniciar execução: {start?.titulo}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Empresa</Label>
              <Select value={empresaId || "_none"} onValueChange={(v) => setEmpresaId(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem empresa</SelectItem>
                  {((empresasQ.data ?? []) as Array<{ id: number; nome: string }>).map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Referência</Label>
              <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="ex: 2026-05" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStart(null)}>Cancelar</Button>
            <Button onClick={() => startM.mutate()} disabled={startM.isPending}>Iniciar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
