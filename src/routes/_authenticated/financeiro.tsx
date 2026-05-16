import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, SectionHeader } from "@/components/bj7/PageShell";
import { CategoriaPeriodoBreakdown } from "@/components/dashboard/CategoriaPeriodoBreakdown";
import { BookOpen, PlusCircle, CheckSquare, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: Financeiro,
});

function Financeiro() {
  return (
    <PageShell
      title="Financeiro"
      description="Lançamentos, revisão e visão por categoria/período"
    >
      <div className="grid sm:grid-cols-3 gap-3">
        <HubCard to="/lancamentos" icon={<BookOpen className="h-4 w-4" />} title="Lançamentos" desc="Conta corrente" />
        <HubCard to="/a-revisar" icon={<CheckSquare className="h-4 w-4" />} title="A revisar" desc="Fila de revisão" />
      </div>

      <section>
        <SectionHeader title="Visão por categoria & período" />
        <CategoriaPeriodoBreakdown />
      </section>
    </PageShell>
  );
}

function HubCard({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl bg-card p-4 ring-1 ring-white/5 hover:ring-primary/30 transition flex items-center justify-between"
      style={{ boxShadow: "var(--shadow-elegant)" }}
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-primary">{icon}</div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
