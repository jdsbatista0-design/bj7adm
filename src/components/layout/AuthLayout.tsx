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
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  BookOpen,
  BarChart3,
  Upload,
  Settings,
  LogOut,
  Plus,
} from "lucide-react";
import { ItemDrawerProvider, useItemDrawer } from "@/components/bj7/ItemDrawer";
import type { CurrentUser } from "@/lib/permissions";

const NAV: { title: string; url: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { title: "Central", url: "/", icon: LayoutDashboard },
  { title: "Hoje", url: "/hoje", icon: Sun },
  { title: "Comercial", url: "/comercial", icon: Briefcase },
  { title: "Operação", url: "/operacao", icon: Wrench },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
  { title: "Empresas", url: "/empresas", icon: Building2 },
  { title: "Inteligência", url: "/inteligencia", icon: Sparkles },
  { title: "Configurações", url: "/config", icon: Settings },
];

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
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
    <ItemDrawerProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar user={user} onSignOut={() => signOut()} />
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar user={user} />
            <main className="flex-1">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ItemDrawerProvider>
  );
}

function TopBar({ user }: { user: CurrentUser }) {
  const drawer = useItemDrawer();
  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between border-b border-white/5 bg-background/80 backdrop-blur px-3 sm:px-5">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger />
        <div className="hidden sm:flex items-center gap-2">
          <div className="h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold text-primary-foreground"
               style={{ background: "var(--gradient-premium)", boxShadow: "var(--shadow-glow)" }}>
            BJ
          </div>
          <span className="text-sm font-semibold tracking-tight">BJ7 Central</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => drawer.open()}
          className="h-8"
          style={{ background: "var(--gradient-premium)", color: "var(--primary-foreground)" }}
        >
          <Plus className="h-4 w-4 mr-1" /> Item
        </Button>
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground border-l border-white/5 pl-3 ml-1">
          <span>{user.nome ?? user.email}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">{user.papel.nome}</span>
        </div>
      </div>
    </header>
  );
}

function AppSidebar({ user, onSignOut }: { user: CurrentUser; onSignOut: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const isActive = (url: string) =>
    url === "/" ? path === "/" : path === url || path.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 text-primary-foreground"
               style={{ background: "var(--gradient-premium)" }}>
            BJ
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-xs font-semibold tracking-tight">BJ7 Central</div>
              <div className="text-[10px] text-muted-foreground truncate">Business OS</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Cockpit</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-white/5">
        {!collapsed && (
          <div className="px-2 py-1.5 mb-1">
            <div className="text-[11px] font-medium truncate">{user.nome ?? user.email}</div>
            <div className="text-[10px] text-muted-foreground">{user.papel.nome}</div>
          </div>
        )}
        <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={onSignOut}>
          <LogOut className="h-4 w-4 mr-2" /> {!collapsed && "Sair"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
