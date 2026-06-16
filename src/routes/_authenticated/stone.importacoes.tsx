import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/contexts/auth-context";
import { podeImportar } from "@/lib/permissions";
import { listImports, listLinhas, reverterImport } from "@/lib/stone-rebate";
import type { StoneRebateImportRow, StoneRebateLinhaRow } from "@/integrations/supabase/database";
import { toast } from "sonner";

import { PageShell } from "@/components/bj7/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Upload, Undo2, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/stone/importacoes")({
  component: ImportacoesPage,
});

function brl(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ImportacoesPage() {
  const user = useCurrentUser();
  const canManage = podeImportar(user);
  const qc = useQueryClient();
  const [detalhe, setDetalhe] = useState<StoneRebateImportRow | null>(null);

  const q = useQuery({
    queryKey: ["stone-imports"],
    queryFn: listImports,
  });

  const revertMut = useMutation({
    mutationFn: (id: number) => reverterImport(id),
    onSuccess: () => {
      toast.success("Importação revertida");
      void qc.invalidateQueries({ queryKey: ["stone-imports"] });
    },
    onError: (e: Error) => toast.error("Erro ao reverter: " + e.message),
  });

  return (
    <PageShell
      title="Importações de Rebate Stone"
      description="Histórico de arquivos importados. Reverter desfaz tudo: dados de clientes, conta a receber e lançamento (se já recebida)."
      actions={
        canManage ? (
          <Button asChild>
            <Link to="/stone/importar-rebate"><Upload className="h-4 w-4 mr-2" /> Nova importação</Link>
          </Button>
        ) : null
      }
    >
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">#</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>Mês ref</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">OK</TableHead>
                <TableHead className="text-right">Erro</TableHead>
                <TableHead className="text-right">Dup</TableHead>
                <TableHead className="text-right">Rebate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quando</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading && (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!q.isLoading && (q.data?.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhuma importação ainda.</TableCell></TableRow>
              )}
              {q.data?.map((imp) => (
                <TableRow key={imp.id}>
                  <TableCell className="text-xs text-muted-foreground">{imp.id}</TableCell>
                  <TableCell className="text-xs max-w-[280px] truncate" title={imp.arquivo_nome}>{imp.arquivo_nome}</TableCell>
                  <TableCell className="text-xs">{imp.mes_referencia?.slice(0, 7) ?? "—"}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{imp.total_linhas}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums text-emerald-300">{imp.linhas_ok}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums text-destructive">{imp.linhas_erro}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums text-amber-300">{imp.linhas_duplicadas}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{brl(imp.valor_total_rebate)}</TableCell>
                  <TableCell><StatusBadge imp={imp} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(imp.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => setDetalhe(imp)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {canManage && imp.status !== "revertido" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive">
                            <Undo2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reverter importação #{imp.id}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Isso vai apagar as linhas, os dados de cliente desta importação ({imp.linhas_ok}),
                              a conta a receber gerada e, se já recebida, o lançamento no DRE. Não pode ser desfeito.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => revertMut.mutate(imp.id)}
                            >
                              Reverter
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DetalheDrawer imp={detalhe} onClose={() => setDetalhe(null)} />
    </PageShell>
  );
}

function StatusBadge({ imp }: { imp: StoneRebateImportRow }) {
  if (imp.status === "revertido") return <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">Revertido</Badge>;
  if (imp.status === "erro") return <Badge variant="outline" className="border-destructive/40 text-destructive">Erro</Badge>;
  if (imp.lancamento_id) return <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">Recebido</Badge>;
  if (imp.conta_a_pagar_id) return <Badge variant="outline" className="border-blue-500/40 text-blue-300">A receber</Badge>;
  return <Badge variant="outline">{imp.status}</Badge>;
}

function DetalheDrawer({ imp, onClose }: { imp: StoneRebateImportRow | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["stone-imports", imp?.id, "linhas"],
    queryFn: () => (imp ? listLinhas(imp.id) : Promise.resolve([] as StoneRebateLinhaRow[])),
    enabled: !!imp,
  });

  return (
    <Sheet open={!!imp} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        {imp && (
          <>
            <SheetHeader>
              <SheetTitle>Importação #{imp.id}</SheetTitle>
              <SheetDescription>{imp.arquivo_nome}</SheetDescription>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Mini label="Total" value={String(imp.total_linhas)} />
              <Mini label="OK" value={String(imp.linhas_ok)} />
              <Mini label="Erro" value={String(imp.linhas_erro)} />
              <Mini label="Dup" value={String(imp.linhas_duplicadas)} />
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Rebate total: <span className="text-foreground tabular-nums">{brl(imp.valor_total_rebate)}</span> · Conta a receber: {imp.conta_a_pagar_id ? `#${imp.conta_a_pagar_id}` : "—"} · Lançamento: {imp.lancamento_id ? `#${imp.lancamento_id}` : "—"}
            </div>

            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Stonecode</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Rebate</TableHead>
                    <TableHead>Status / Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.isLoading && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>}
                  {q.data?.map((l) => (
                    <TableRow key={l.id} className={l.status_conciliacao === "erro" ? "bg-destructive/5" : l.status_conciliacao === "duplicada" ? "bg-amber-500/5" : ""}>
                      <TableCell className="text-xs text-muted-foreground">{l.linha_num}</TableCell>
                      <TableCell className="text-xs">{l.stonecode ?? "—"}</TableCell>
                      <TableCell className="text-xs truncate max-w-[180px]">{l.nome_cliente ?? "—"}</TableCell>
                      <TableCell className="text-xs">{l.mes_referencia?.slice(0, 7) ?? "—"}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{brl(l.rebate_valor)}</TableCell>
                      <TableCell className="text-xs">
                        {l.status_conciliacao === "ok"
                          ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">ok</Badge>
                          : <span className="text-destructive">{l.erro_importacao ?? l.status_conciliacao}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
