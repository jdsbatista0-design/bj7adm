import { createFileRoute, Link } from "@tanstack/react-router";
import { useCurrentUser } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  const user = useCurrentUser();
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Olá, {user.nome ?? user.email}. Papel: <strong>{user.papel.nome}</strong>
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Permissões carregadas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>Vê faturamento: {String(user.ve_faturamento)}</div>
          <div>Vê retiradas: {String(user.ve_retiradas)}</div>
          <div>Vê todas empresas: {String(user.ve_todas_empresas)}</div>
          <div>Empresas vinculadas: {user.ve_todas_empresas ? "todas" : user.empresas_ids.join(", ") || "nenhuma"}</div>
          <div className="pt-2 text-muted-foreground">
            KPIs e drill-down chegam no próximo passo. Por enquanto teste{" "}
            <Link to="/" className="underline">o login com diferentes papéis</Link>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
