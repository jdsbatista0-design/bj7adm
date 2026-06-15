import { Link, useRouterState } from "@tanstack/react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import { Home, ListTodo, Wallet, Receipt, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

const ITEMS = [
  { to: "/itens",     label: "Cockpit",   icon: Home },
  { to: "/financeiro",label: "Financeiro",icon: Wallet },
  { to: "/fiscal/dashboard", label: "Fiscal",    icon: Receipt },
  { to: "/empresas",  label: "Empresas",  icon: ListTodo },
] as const;

export function BottomNav() {
  const isMobile = useIsMobile();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { toggleSidebar } = useSidebar();

  if (!isMobile) return null;

  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 border-t border-border bg-background/95 backdrop-blur grid grid-cols-5">
      {ITEMS.map((i) => {
        const active = i.to === "/itens" ? path === "/" || path.startsWith("/itens") : isActive(i.to);
        return (
          <Link
            key={i.to}
            to={i.to}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 text-[10px]",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <i.icon className="h-4 w-4" />
            <span>{i.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={toggleSidebar}
        className="flex flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground"
      >
        <Menu className="h-4 w-4" />
        <span>Mais</span>
      </button>
    </nav>
  );
}
