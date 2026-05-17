import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, SectionHeader } from "@/components/bj7/PageShell";
import {
  BarChart3,
  Building2,
  BookOpen,
  Wallet,
  CreditCard,
  Briefcase,
  Wrench,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: Relatorios,
});

type Report = {
  to: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "financeiro" | "operacional" | "comercial" | "ia";
  badge?: string;
};

const REPORTS: Report[] = [
  {
    to: "/",
    title: "Visão consolidada",
    description: "Receita, despesa, lucro e margem do grupo com comparativos e quebra por empresa.",
    icon: TrendingUp,
    group: "financeiro",
  },
  {
    to: "/empresas",
    title: "DRE por empresa",
    description: "Demonstrativo detalhado de cada empresa, agrupado pelo campo de grupo das categorias.",
    icon: Building2,
    group: "financeiro",
  },
  {
    to: "/financeiro",
    title: "Categorias × Período",
    description: "Quebra de lançamentos por categoria e período, com totais por mês/ano.",
    icon: BarChart3,
    group: "financeiro",
  },
  {
    to: "/lancamentos",
    title: "Lançamentos detalhados",
    description: "Listagem filtrável com gráficos de evolução, ranking de categorias e somatórios.",
    icon: BookOpen,
    group: "financeiro",
  },
  {
    to: "/stone",
    title: "Stone — rebate e adquirência",
    description: "Apuração de rebate, lucro bruto e remuneração final por competência.",
    icon: CreditCard,
    group: "operacional",
    badge: "Stone",
  },
  {
    to: "/operacao",
    title: "Operação",
    description: "Indicadores operacionais e tarefas abertas do dia a dia das empresas.",
    icon: Wrench,
    group: "operacional",
  },
  {
    to: "/comercial",
    title: "Comercial",
    description: "Funil, leads, propostas e follow-ups acompanhados pelo time.",
    icon: Briefcase,
    group: "comercial",
  },
  {
    to: "/inteligencia",
    title: "Inteligência & alertas",
    description: "Regras automáticas, alertas gerados e ações sugeridas pelo motor.",
    icon: Sparkles,
    group: "ia",
  },
  {
    to: "/a-revisar",
    title: "A revisar",
    description: "Lançamentos classificados pelo motor que ainda precisam de revisão humana.",
    icon: Wallet,
    group: "financeiro",
  },
];

const GROUPS: { key: Report["group"]; title: string; description: string }[] = [
  { key: "financeiro", title: "Financeiro", description: "DRE, lançamentos e quebras por categoria" },
  { key: "operacional", title: "Operacional", description: "Stone, operação e indicadores do dia a dia" },
  { key: "comercial", title: "Comercial", description: "Funil, leads e follow-ups" },
  { key: "ia", title: "Inteligência", description: "Regras, alertas e revisões automáticas" },
];

function Relatorios() {
  return (
    <PageShell
      title="Relatórios"
      description="Hub central — escolha o relatório que quer abrir"
    >
      <div className="space-y-10">
        {GROUPS.map((g) => {
          const items = REPORTS.filter((r) => r.group === g.key);
          if (items.length === 0) return null;
          return (
            <section key={g.key}>
              <SectionHeader title={g.title} description={g.description} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((r) => (
                  <ReportCard key={r.to} report={r} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}

function ReportCard({ report }: { report: Report }) {
  const Icon = report.icon;
  return (
    <Link
      to={report.to}
      className="group rounded-2xl bg-card p-4 ring-1 ring-white/5 transition hover:ring-primary/40 hover:-translate-y-0.5 flex flex-col gap-3"
      style={{ boxShadow: "var(--shadow-elegant)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center text-primary-foreground shrink-0"
          style={{ background: "var(--gradient-premium)" }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold tracking-tight">{report.title}</h3>
          {report.badge && (
            <span className="inline-flex items-center rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
              {report.badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{report.description}</p>
      </div>
    </Link>
  );
}
