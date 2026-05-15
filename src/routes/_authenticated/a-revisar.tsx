import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { from, asRows } from "@/integrations/supabase/db";
import type { LancamentoRow } from "@/integrations/supabase/database";
import { useCurrentUser } from "@/contexts/auth-context";
import { tiposVisiveis, podeMarcarRevisado, podeEditarLancamento } from "@/lib/permissions";
import { useEmpresas, useCategorias } from "@/hooks/use-refs";
import { formatBRL, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, CheckCircle2 } from "lucide-react";
import { LancamentoDialog, useLancamentoDialog } from "@/components/lancamento/LancamentoDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/a-revisar")({
  component: ARevisarPage,
});

function ARevisarPage() {
  const user = useCurrentUser();
  const empresas = useEmpresas();
  const categorias = useCategorias();
  const dlg = useLancamentoDialog();
  const qc = useQueryClient();
  const tipos = tiposVisiveis(user);

  const list = useQuery({
    queryKey: ["a-revisar", user.id],
    queryFn: async () => {
      let q = from("lancamentos").select("*").eq("revisado", false).in("tipo", tipos);
      if (!user.ve_todas_empresas) {
        if (user.empresas_ids.length === 0) return [] as LancamentoRow[];
        q = q.in("empresa_id", user.empresas_ids);
      }
      q = q.order("data", { ascending: false }).limit(500);
      const r = await q;
      if (r.error) throw r.error;
      return asRows("lancamentos", r.data);
    },
  });

  const marcar = useMutation({
    mutationFn: async (l: LancamentoRow) => {
      const r = await from("lancamentos")
        .update({ revisado: true, revisado_por: user.id, revisado_em: new Date().toISOString() })
        .eq("id", l.id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["a-revisar"] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      toast.success("Marcado como revisado");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const empresaNome = (id: number) => empresas.data?.find((e) => e.id === id)?.nome ?? "—";
  const categoriaNome = (id: number | null) => categorias.data?.find((c) => c.id === id)?.nome ?? "—";

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">A revisar</h1>
        <p className="text-sm text-muted-foreground">
          {list.data?.length ?? 0} lançamento(s) ainda não revisado(s).
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Data</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!list.isLoading && (list.data?.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tudo revisado 🎉</TableCell></TableRow>
              )}
              {list.data?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{formatDate(l.data)}</TableCell>
                  <TableCell className="text-sm">{empresaNome(l.empresa_id)}</TableCell>
                  <TableCell><Badge variant="outline">{l.tipo}</Badge></TableCell>
                  <TableCell className="text-sm">{categoriaNome(l.categoria_id)}</TableCell>
                  <TableCell className="text-sm max-w-[280px] truncate" title={l.descricao ?? ""}>{l.descricao ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(Number(l.valor))}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" disabled={!podeEditarLancamento(user, l)} onClick={() => dlg.openEdit(l)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {podeMarcarRevisado(user) && (
                        <Button size="icon" variant="ghost" onClick={() => marcar.mutate(l)} title="Marcar revisado">
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <LancamentoDialog open={dlg.open} onOpenChange={dlg.setOpen} lancamento={dlg.editing} />
    </div>
  );
}
