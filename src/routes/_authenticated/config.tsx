import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/bj7/PageShell";
import { useCurrentUser } from "@/contexts/auth-context";
import { podeGerirUsuarios, podeImportar } from "@/lib/permissions";
import {
  Users, Upload, Sparkles, ArrowRight, Banknote, ListTodo, StickyNote, Percent,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/config")({
  component: Config,
});

function Config() {
  const user = useCurrentUser();
  const items = [
    { to: "/itens", icon: <ListTodo className="h-4 w-4" />, title: "Cockpit", desc: "Tarefas, decisões e ações do dia", show: true },
    { to: "/financeiro/contas-a-pagar", icon: <Banknote className="h-4 w-4" />, title: "Contas a Pagar", desc: "Obrigações financeiras e recorrências", show: true },
    { to: "/financeiro/categorias", icon: <Percent className="h-4 w-4" />, title: "Categorias", desc: "Plano de categorias (receita, despesa, retirada)", show: true },
    
    { to: "/usuarios", icon: <Users className="h-4 w-4" />, title: "Usuários", desc: "Gestão de pessoas, papéis e empresas", show: podeGerirUsuarios(user) },
    { to: "/fiscal/importacoes", icon: <Upload className="h-4 w-4" />, title: "Importações", desc: "Histórico de importações de planilhas", show: podeImportar(user) },
    { to: "/inteligencia", icon: <Sparkles className="h-4 w-4" />, title: "Regras automáticas", desc: "Motor de alertas e ações", show: true },
  ].filter((i) => i.show);

  return (
    <PageShell title="Configurações" description="Cadastros, permissões e parâmetros do sistema">
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className="rounded-2xl bg-card p-4 ring-1 ring-white/5 hover:ring-primary/30 transition flex items-center justify-between"
            style={{ boxShadow: "var(--shadow-elegant)" }}
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-primary">
                {i.icon}
              </div>
              <div>
                <div className="text-sm font-semibold">{i.title}</div>
                <div className="text-xs text-muted-foreground">{i.desc}</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
