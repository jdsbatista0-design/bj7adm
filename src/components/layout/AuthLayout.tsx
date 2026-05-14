import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  BookOpen,
  Store,
  PlusCircle,
  CheckSquare,
  Upload,
  Users,
  LogOut,
} from "lucide-react";
import { podeImportar, podeGerirUsuarios, podeVerStone, podeLancar, podeMarcarRevisado } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/permissions";

export function AuthLayout() {
  const { state, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.status === "anon") void navigate({ to: "/login" });
  }, [state.status, navigate]);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (state.status === "anon") return null;

  if (state.status === "no-record") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 px-4 text-center">
        <h1 className="text-xl font-semibold">Acesso não liberado</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Seu login ({state.email}) está autenticado, mas não há um registro ativo em <code>usuarios</code> com esse
          e-mail. Peça a um Admin/Sócio para te cadastrar.
        </p>
        <Button variant="outline" onClick={() => signOut()}>Sair</Button>
      </div>
    );
  }

  const user = state.user;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar user={user} onSignOut={() => signOut()} />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b px-4 bg-background">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm font-medium">BJ7 Central</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">{user.nome ?? user.email}</span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{user.papel.nome}</span>
            </div>
          </header>
          <main className="flex-1 bg-muted/20">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppSidebar({ user, onSignOut }: { user: CurrentUser; onSignOut: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const items = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, show: true },
    { title: "Razão", url: "/razao", icon: BookOpen, show: true },
    { title: "Stone", url: "/stone", icon: Store, show: podeVerStone(user) },
    { title: "Lançar", url: "/lancar", icon: PlusCircle, show: podeLancar(user) },
    { title: "A Revisar", url: "/a-revisar", icon: CheckSquare, show: podeMarcarRevisado(user) },
    { title: "Importações", url: "/importacoes", icon: Upload, show: podeImportar(user) },
    { title: "Usuários", url: "/usuarios", icon: Users, show: podeGerirUsuarios(user) },
  ].filter((i) => i.show);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-3">
        <span className="text-sm font-semibold">BJ7</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = item.url === "/" ? path === "/" : path.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <Button variant="ghost" size="sm" className="justify-start" onClick={onSignOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
