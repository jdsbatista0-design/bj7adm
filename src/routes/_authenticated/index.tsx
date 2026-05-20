import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/bj7/PageShell";
import { Wallet, Building2, KanbanSquare, Upload, Settings, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: HomeHub,
});

const HUBS: {
  to: string;
  search?: Record<string, string>;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}[] = [
  {
    to: "/financeiro",
    search: { tab: "lancamentos" },
    title: "Financeiro",
    desc: "Lançamentos, análise e relatórios",
    icon: Wallet,
    accent: "from-emerald-500/20 to-emerald-500/0",
  },
  {
    to: "/empresas",
    title: "Empresas",
    desc: "Cadastro e DRE por empresa",
    icon: Building2,
    accent: "from-sky-500/20 to-sky-500/0",
  },
  {
    to: "/itens",
    title: "Itens",
    desc: "Backlog operacional",
    icon: KanbanSquare,
    accent: "from-violet-500/20 to-violet-500/0",
  },
  {
    to: "/importacoes",
    title: "Importações",
    desc: "Carga de planilhas e arquivos",
    icon: Upload,
    accent: "from-amber-500/20 to-amber-500/0",
  },
  {
    to: "/config",
    title: "Configurações",
    desc: "Usuários, papéis e regras",
    icon: Settings,
    accent: "from-zinc-500/20 to-zinc-500/0",
  },
];

function HomeHub() {
  return (
    <PageShell
      title="Início"
      description="Acesse rapidamente os módulos do BJ7 Central"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {HUBS.map((h) => (
          <Link
            key={h.to}
            to={h.to}
            search={h.search as never}
            className="group relative overflow-hidden rounded-2xl bg-card p-5 ring-1 ring-white/5 hover:ring-primary/40 transition-all"
            style={{ boxShadow: "var(--shadow-elegant)" }}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${h.accent} opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none`}
            />
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-muted/70 flex items-center justify-center text-primary">
                  <h.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-semibold">{h.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {h.desc}
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
