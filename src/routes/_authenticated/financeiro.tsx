import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { lazy, Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LancamentosView } from "@/components/financeiro/LancamentosView";

const AnaliseView = lazy(() =>
  import("@/components/financeiro/AnaliseView").then((m) => ({ default: m.AnaliseView })),
);
const RelatoriosView = lazy(() =>
  import("@/components/financeiro/RelatoriosView").then((m) => ({ default: m.RelatoriosView })),
);

const TABS = ["lancamentos", "analise", "relatorios"] as const;
type TabKey = (typeof TABS)[number];

const search = z.object({
  tab: fallback(z.enum(TABS), "lancamentos").default("lancamentos"),
  // Filtros de lançamentos preservados na URL
  ano: fallback(z.number().int(), 0).default(0),
  mes: fallback(z.number().int().min(0).max(12), 0).default(0),
  tipo: fallback(z.enum(["", "Receita", "Despesa", "Retirada", "Empréstimo"]), "").default(""),
  empresa: fallback(z.number().int(), 0).default(0),
  unidade: fallback(z.number().int(), 0).default(0),
  categoria: fallback(z.number().int(), 0).default(0),
  q: fallback(z.string(), "").default(""),
  revisado: fallback(z.enum(["", "sim", "nao"]), "").default(""),
  page: fallback(z.number().int().min(1), 1).default(1),
});

export const Route = createFileRoute("/_authenticated/financeiro")({
  validateSearch: zodValidator(search),
  component: FinanceiroPage,
});

const TAB_LABELS: Record<TabKey, string> = {
  lancamentos: "Lançamentos",
  analise: "Análise",
  relatorios: "Relatórios",
};

function FinanceiroPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();

  function setTab(next: TabKey) {
    void navigate({ search: ((prev: { tab?: TabKey }) => ({ ...prev, tab: next })) as never });
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Lançamentos, análise e relatórios do Grupo BJ7
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        {/* Desktop tabs */}
        <TabsList className="hidden sm:inline-flex">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* Mobile dropdown */}
        <div className="sm:hidden">
          <Select value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TAB_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="lancamentos" className="mt-4">
          <LancamentosView />
        </TabsContent>
        <TabsContent value="analise" className="mt-4">
          <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando análise…</div>}>
            {tab === "analise" && <AnaliseView />}
          </Suspense>
        </TabsContent>
        <TabsContent value="relatorios" className="mt-4">
          <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando relatórios…</div>}>
            {tab === "relatorios" && <RelatoriosView />}
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
