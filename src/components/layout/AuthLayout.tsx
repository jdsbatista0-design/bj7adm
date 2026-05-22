import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Home,
  Building2,
  Wallet,
  Upload,
  Settings,
  LogOut,
  ListTodo,
  Landmark,
  Receipt,
  FileText,
  Banknote,
  DollarSign,
  Calendar,
  Percent,
  AlertCircle,
  Inbox,
  ChevronRight,
  FolderOpen,
  Workflow,
  Users,
  Target,
  Eye,
  MapPin,
  Construction,
} from "lucide-react";
import { ItemDrawerProvider } from "@/components/bj7/ItemDrawer";
import type { CurrentUser } from "@/lib/permissions";

type LeafItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  search?: Record<string, string>;
  comingSoon?: boolean;
};

type GroupItem = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: (LeafItem | GroupItem)[];
};

type NavItem = LeafItem | GroupItem;

const isGroup = (i: NavItem): i is GroupItem => "children" in i;

const NAV: NavItem[] = [
  { title: "Início", url: "/", icon: Home },
  { title: "Empresas", url: "/empresas", icon: Building2 },
  { title: "Calendário", url: "/calendario", icon: Calendar },
  {
    title: "Financeiro",
    icon: Wallet,
    children: [
      { title: "Visão Financeira", url: "/financeiro", icon: DollarSign },
      { title: "Relatórios", url: "/relatorios", icon: FileText },
      { title: "DRE Consolidado", url: "/financeiro", icon: DollarSign, comingSoon: true },
      { title: "Categorias", url: "/financeiro", icon: Percent, comingSoon: true },
      {
        title: "Open Finance",
        icon: Landmark,
        children: [
          { title: "Conectar Contas", url: "/open-finance/conectar", icon: Landmark },
          { title: "Caixa de Entrada", url: "/open-finance/conectar", icon: Inbox, comingSoon: true },
          { title: "Tesouraria", url: "/open-finance/conectar", icon: Banknote, comingSoon: true },
        ],
      },
    ],
  },
  {
    title: "Fiscal",
    icon: Receipt,
    children: [
      { title: "Dashboard", url: "/fiscal/dashboard", icon: Receipt },
      { title: "Calendário", url: "/fiscal/calendario", icon: Calendar },
      { title: "Faturamento (Simples)", url: "/fiscal/faturamento-simples", icon: Percent },
      { title: "Pendências Contábeis", url: "/fiscal/pendencias", icon: AlertCircle },
      { title: "Importações Fiscais", url: "/fiscal/importacoes", icon: Upload },
    ],
  },
  {
    title: "Cockpit",
    icon: ListTodo,
    children: [
      { title: "Visão Geral", url: "/itens", icon: Eye },
      { title: "Tarefas", url: "/itens", icon: ListTodo, search: { tipo: "TAREFA" } },
      { title: "Decisões", url: "/itens", icon: Target, search: { tipo: "DECISAO" } },
      { title: "Reuniões", url: "/itens", icon: Users, search: { tipo: "REUNIAO" } },
      { title: "Projetos", url: "/itens", icon: Workflow, search: { tipo: "PROJETO" } },
      { title: "Ideias", url: "/itens", icon: AlertCircle, search: { tipo: "IDEIA" } },
      { title: "Notas", url: "/itens", icon: FileText, search: { tipo: "NOTA" } },
    ],
  },
  {
    title: "Documentos",
    icon: FolderOpen,
    children: [
      { title: "Repositório", url: "/documentos", icon: FolderOpen },
      { title: "Vencimentos", url: "/documentos/vencimentos", icon: AlertCircle },
      { title: "Por Tipo", url: "/documentos/por-tipo", icon: ListTodo },
    ],
  },
  {
    title: "Sistema (BJ7)",
    icon: Workflow,
    children: [
      { title: "Procedimentos", url: "/", icon: ListTodo, comingSoon: true },
      { title: "Em Execução", url: "/", icon: Eye, comingSoon: true },
      { title: "Por Eixo BJ7", url: "/", icon: Target, comingSoon: true },
      { title: "Templates", url: "/", icon: FileText, comingSoon: true },
    ],
  },
  {
    title: "Pessoas",
    icon: Users,
    children: [
      { title: "Dashboard", url: "/", icon: Eye, comingSoon: true },
      { title: "Colaboradores", url: "/", icon: Users, comingSoon: true },
      { title: "PDI", url: "/", icon: Target, comingSoon: true },
      { title: "OKRs", url: "/", icon: Target, comingSoon: true },
      { title: "1:1", url: "/", icon: Users, comingSoon: true },
      { title: "Rotina de Rua", url: "/", icon: MapPin, comingSoon: true },
    ],
  },
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
  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur px-3 sm:px-5">
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
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <span>{user.nome ?? user.email}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">{user.papel.nome}</span>
        </div>
      </div>
    </header>
  );
}

function pathMatches(url: string, path: string) {
  return url === "/" ? path === "/" : path === url || path.startsWith(url + "/");
}

function groupHasActive(item: GroupItem, path: string): boolean {
  return item.children.some((c) =>
    isGroup(c) ? groupHasActive(c, path) : pathMatches(c.url, path),
  );
}

function AppSidebar({ user, onSignOut }: { user: CurrentUser; onSignOut: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

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
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) =>
                isGroup(item) ? (
                  <NavGroup key={item.title} item={item} path={path} collapsed={collapsed} />
                ) : (
                  <NavLeaf key={item.url} item={item} path={path} />
                ),
              )}
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

function NavLeaf({ item, path }: { item: LeafItem; path: string }) {
  const active = pathMatches(item.url, path) && !item.comingSoon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.comingSoon ? `${item.title} (em breve)` : item.title}
        className={
          item.comingSoon
            ? "opacity-60"
            : active
              ? "bg-primary/15 text-primary hover:bg-primary/20 data-[active=true]:bg-primary/15 data-[active=true]:text-primary"
              : ""
        }
      >
        <Link to={item.url as never} search={item.search as never} className="flex items-center gap-2">
          <item.icon className="h-4 w-4" />
          <span className="flex-1">{item.title}</span>
          {item.comingSoon && (
            <Construction className="h-3 w-3 text-muted-foreground" />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavGroup({ item, path, collapsed }: { item: GroupItem; path: string; collapsed: boolean }) {
  const hasActive = groupHasActive(item, path);
  const [open, setOpen] = useState(hasActive);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={item.title}>
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} className="group/collapsible">
            <item.icon className="h-4 w-4" />
            <span className="flex-1 text-left">{item.title}</span>
            <ChevronRight
              className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child) =>
              isGroup(child) ? (
                <NavSubGroup key={child.title} item={child} path={path} />
              ) : (
                <NavSubLeaf key={child.url + child.title} item={child} path={path} />
              ),
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function NavSubLeaf({ item, path }: { item: LeafItem; path: string }) {
  const active = pathMatches(item.url, path) && !item.comingSoon;
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        asChild
        isActive={active}
        className={
          item.comingSoon
            ? "opacity-60"
            : active
              ? "bg-primary/15 text-primary hover:bg-primary/20 data-[active=true]:bg-primary/15 data-[active=true]:text-primary"
              : ""
        }
      >
        <Link to={item.url as never} search={item.search as never} className="flex items-center gap-2">
          <item.icon className="h-3.5 w-3.5" />
          <span className="flex-1">{item.title}</span>
          {item.comingSoon && (
            <Construction className="h-3 w-3 text-muted-foreground" />
          )}
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function NavSubGroup({ item, path }: { item: GroupItem; path: string }) {
  const hasActive = groupHasActive(item, path);
  const [open, setOpen] = useState(hasActive);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <SidebarMenuSubItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton className="cursor-pointer">
            <item.icon className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">{item.title}</span>
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
            />
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child) =>
              isGroup(child) ? (
                <NavSubGroup key={child.title} item={child} path={path} />
              ) : (
                <NavSubLeaf key={child.url + child.title} item={child} path={path} />
              ),
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}
