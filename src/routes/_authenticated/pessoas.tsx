import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { lazy, Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Dashboard = lazy(() => import("@/components/pessoas/DashboardView"));
const Colaboradores = lazy(() => import("@/components/pessoas/ColaboradoresView"));
const Pdi = lazy(() => import("@/components/pessoas/PdiView"));
const Okrs = lazy(() => import("@/components/pessoas/OkrsView"));
const OneOnOne = lazy(() => import("@/components/pessoas/OneOnOneView"));
const Rua = lazy(() => import("@/components/pessoas/RotinaRuaView"));

const TABS = ["dashboard", "colaboradores", "pdi", "okrs", "1on1", "rua"] as const;
type TabKey = (typeof TABS)[number];

const LABELS: Record<TabKey, string> = {
  dashboard: "Dashboard",
  colaboradores: "Colaboradores",
  pdi: "PDI",
  okrs: "OKRs",
  "1on1": "1:1",
  rua: "Rotina de Rua",
};

const search = z.object({
  tab: fallback(z.enum(TABS), "dashboard").default("dashboard"),
});

export const Route = createFileRoute("/_authenticated/pessoas")({
  validateSearch: zodValidator(search),
  component: PessoasPage,
});

function PessoasPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  function setTab(next: TabKey) {
    void navigate({ search: ((prev: { tab?: TabKey }) => ({ ...prev, tab: next })) as never });
  }
  const fb = <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="hidden sm:inline-flex">
          {TABS.map((t) => <TabsTrigger key={t} value={t}>{LABELS[t]}</TabsTrigger>)}
        </TabsList>
        <div className="sm:hidden">
          <Select value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{TABS.map((t) => <SelectItem key={t} value={t}>{LABELS[t]}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <TabsContent value="dashboard" className="mt-4"><Suspense fallback={fb}>{tab === "dashboard" && <Dashboard />}</Suspense></TabsContent>
        <TabsContent value="colaboradores" className="mt-4"><Suspense fallback={fb}>{tab === "colaboradores" && <Colaboradores />}</Suspense></TabsContent>
        <TabsContent value="pdi" className="mt-4"><Suspense fallback={fb}>{tab === "pdi" && <Pdi />}</Suspense></TabsContent>
        <TabsContent value="okrs" className="mt-4"><Suspense fallback={fb}>{tab === "okrs" && <Okrs />}</Suspense></TabsContent>
        <TabsContent value="1on1" className="mt-4"><Suspense fallback={fb}>{tab === "1on1" && <OneOnOne />}</Suspense></TabsContent>
        <TabsContent value="rua" className="mt-4"><Suspense fallback={fb}>{tab === "rua" && <Rua />}</Suspense></TabsContent>
      </Tabs>
    </div>
  );
}
