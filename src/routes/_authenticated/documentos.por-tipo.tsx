import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/bj7/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_authenticated/documentos/por-tipo")({
  component: DocumentosPorTipo,
});

type Tipo = { id: number; codigo: string; nome: string; categoria: string };
type DocLite = {
  id: number; tipo_id: number; titulo: string; status: string;
  contraparte_nome: string | null; vigencia_fim: string | null;
};

const fmtDate = (s: string | null) => !s ? "—" : new Date(s).toLocaleDateString("pt-BR");

export default function DocumentosPorTipo() {
  const tiposQ = useQuery<Tipo[]>({
    queryKey: ["documentos", "tipos"],
    queryFn: async () => {
      const r = await supabase.schema("documentos" as never).from("tipos").select("id, codigo, nome, categoria").order("categoria").order("nome");
      if (r.error) throw r.error;
      return (r.data ?? []) as Tipo[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const docsQ = useQuery<DocLite[]>({
    queryKey: ["documentos", "lite-all"],
    queryFn: async () => {
      const r = await supabase.schema("documentos" as never)
        .from("documentos")
        .select("id, tipo_id, titulo, status, contraparte_nome, vigencia_fim")
        .order("titulo");
      if (r.error) throw r.error;
      return (r.data ?? []) as DocLite[];
    },
    staleTime: 60 * 1000,
  });

  const grouped = useMemo(() => {
    const tipos = tiposQ.data ?? [];
    const docs = docsQ.data ?? [];
    const byCategoria = new Map<string, { tipo: Tipo; docs: DocLite[] }[]>();
    for (const t of tipos) {
      const arr = byCategoria.get(t.categoria) ?? [];
      arr.push({ tipo: t, docs: docs.filter(d => d.tipo_id === t.id) });
      byCategoria.set(t.categoria, arr);
    }
    return [...byCategoria.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tiposQ.data, docsQ.data]);

  const loading = tiposQ.isLoading || docsQ.isLoading;

  return (
    <PageShell title="Por Tipo" description="Documentos agrupados por categoria e tipo">
      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {grouped.map(([categoria, items]) => {
            const totalDocs = items.reduce((s, x) => s + x.docs.length, 0);
            return (
              <AccordionItem key={categoria} value={categoria} className="border rounded">
                <AccordionTrigger className="px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{categoria}</span>
                    <Badge variant="secondary">{totalDocs}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <Accordion type="multiple" className="space-y-1">
                    {items.map(({ tipo, docs }) => (
                      <AccordionItem key={tipo.id} value={String(tipo.id)} className="border-b last:border-b-0">
                        <AccordionTrigger className="text-sm py-2">
                          <div className="flex items-center gap-2">
                            <span>{tipo.nome}</span>
                            <Badge variant="outline" className="text-[10px]">{docs.length}</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {docs.length === 0 ? (
                            <div className="text-xs text-muted-foreground py-2">Nenhum documento</div>
                          ) : (
                            <div className="space-y-1">
                              {docs.map(d => (
                                <Card key={d.id}><CardContent className="p-2 flex items-center justify-between text-sm">
                                  <div>
                                    <div className="font-medium">{d.titulo}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {d.contraparte_nome ?? "—"} • vence {fmtDate(d.vigencia_fim)}
                                    </div>
                                  </div>
                                  <Badge variant={d.status === "ATIVO" ? "default" : "secondary"}>{d.status}</Badge>
                                </CardContent></Card>
                              ))}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </PageShell>
  );
}
