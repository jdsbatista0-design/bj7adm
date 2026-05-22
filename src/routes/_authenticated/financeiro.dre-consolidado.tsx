import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { PageShell } from "@/components/bj7/PageShell";

const RelatoriosView = lazy(() =>
  import("@/components/financeiro/RelatoriosView").then((m) => ({
    default: m.RelatoriosView,
  })),
);

export const Route = createFileRoute("/_authenticated/financeiro/dre-consolidado")({
  component: DreConsolidadoPage,
});

function DreConsolidadoPage() {
  return (
    <PageShell
      title="DRE Consolidado"
      description="Demonstrativo de Resultados consolidado do Grupo BJ7 — análise por grupo, categoria e mês"
    >
      <Suspense
        fallback={
          <div className="p-6 text-sm text-muted-foreground">Carregando relatórios…</div>
        }
      >
        <RelatoriosView />
      </Suspense>
    </PageShell>
  );
}
