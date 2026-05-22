import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { lazy, Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const Procedimentos = lazy(() => import("./sistema.procedimentos"));
const Execucoes = lazy(() => import("./sistema.execucoes"));
const PorEixo = lazy(() => import("./sistema.por-eixo"));
const Templates = lazy(() => import("./sistema.templates"));

const TABS = ["procedimentos", "execucoes", "por-eixo", "templates"] as const;
type TabKey = (typeof TABS)[number];

const TAB_LABELS: Record<TabKey, string> = {
  procedimentos: "Procedimentos",
  execucoes: "Em Execução",
  "por-eixo": "Por Eixo BJ7",
  templates: "Templates",
};

const search = z.object({
  tab: fallback(z.enum(TABS), "procedimentos").default("procedimentos"),
});

export const Route = createFileRoute("/_authenticated/sistema/")({
  validateSearch: zodValidator(search),
  component: SistemaPage,
});

function SistemaPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();

  function setTab(next: TabKey) {
    void navigate({
      search: ((prev: { tab?: TabKey }) => ({ ...prev, tab: next })) as never,
    });
  }

  const fallbackUI = (
    <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
  );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="hidden sm:inline-flex">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>
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

        <TabsContent value="procedimentos" className="mt-4">
          <Suspense fallback={fallbackUI}>
            {tab === "procedimentos" && <Procedimentos />}
          </Suspense>
        </TabsContent>
        <TabsContent value="execucoes" className="mt-4">
          <Suspense fallback={fallbackUI}>
            {tab === "execucoes" && <Execucoes />}
          </Suspense>
        </TabsContent>
        <TabsContent value="por-eixo" className="mt-4">
          <Suspense fallback={fallbackUI}>
            {tab === "por-eixo" && <PorEixo />}
          </Suspense>
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <Suspense fallback={fallbackUI}>
            {tab === "templates" && <Templates />}
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
