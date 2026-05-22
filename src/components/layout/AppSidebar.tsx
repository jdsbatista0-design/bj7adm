import { useState, useMemo } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { MENU_CONFIG, type MenuItem } from '@/config/menu';
import { cn } from '@/lib/utils';

/**
 * Menu lateral hierárquico do BJ7 Central.
 *
 * - Lê a estrutura de src/config/menu.ts
 * - Agrupadores colapsam/expandem ao clicar
 * - Item ativo destacado; agrupador pai expandido automaticamente
 * - Suporta sub-agrupadores aninhados (Open Finance dentro de Financeiro)
 */

type Props = {
  className?: string;
  onItemClick?: () => void; // útil para fechar drawer mobile ao clicar
};

export function AppSidebar({ className, onItemClick }: Props) {
  const location = useLocation();
  const currentPath = location.pathname;

  // Descobre quais agrupadores precisam estar abertos por padrão (porque contêm o item ativo)
  const initialOpenGroups = useMemo(() => {
    const open = new Set<string>();
    const findOpenGroups = (items: MenuItem[], parents: string[] = []) => {
      for (const item of items) {
        if (item.to && currentPath.startsWith(item.to) && item.to !== '/') {
          parents.forEach(p => open.add(p));
        }
        if (item.to === '/' && currentPath === '/') {
          parents.forEach(p => open.add(p));
        }
        if (item.children) {
          findOpenGroups(item.children, [...parents, item.label]);
        }
      }
    };
    findOpenGroups(MENU_CONFIG);
    return open;
  }, [currentPath]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(initialOpenGroups);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <nav
      className={cn(
        'flex flex-col gap-0.5 p-3 overflow-y-auto h-full bg-background border-r',
        className,
      )}
      aria-label="Navegação principal"
    >
      <div className="px-2 py-3 mb-2">
        <h1 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
          Cockpit BJ7
        </h1>
      </div>

      {MENU_CONFIG.map(item => (
        <MenuItemRender
          key={item.label}
          item={item}
          depth={0}
          currentPath={currentPath}
          openGroups={openGroups}
          toggleGroup={toggleGroup}
          onItemClick={onItemClick}
        />
      ))}
    </nav>
  );
}

type RenderProps = {
  item: MenuItem;
  depth: number;
  currentPath: string;
  openGroups: Set<string>;
  toggleGroup: (label: string) => void;
  onItemClick?: () => void;
};

function MenuItemRender({
  item,
  depth,
  currentPath,
  openGroups,
  toggleGroup,
  onItemClick,
}: RenderProps) {
  const Icon = item.icon;
  const hasChildren = !!item.children && item.children.length > 0;
  const isOpen = openGroups.has(item.label);

  const isActive = item.to
    ? item.to === '/'
      ? currentPath === '/'
      : currentPath === item.to || currentPath.startsWith(item.to + '/')
    : false;

  const paddingLeft = depth === 0 ? 'pl-3' : depth === 1 ? 'pl-7' : 'pl-11';

  // Item agrupador (com children)
  if (hasChildren) {
    return (
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => toggleGroup(item.label)}
          className={cn(
            'flex items-center gap-2 py-2 pr-2 rounded-md text-sm font-medium transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            'text-foreground/80',
            paddingLeft,
          )}
          aria-expanded={isOpen}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1 text-left">{item.label}</span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>

        {isOpen && (
          <div className="flex flex-col gap-0.5 mt-0.5">
            {item.children!.map(child => (
              <MenuItemRender
                key={child.label}
                item={child}
                depth={depth + 1}
                currentPath={currentPath}
                openGroups={openGroups}
                toggleGroup={toggleGroup}
                onItemClick={onItemClick}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Item de link (sem children)
  if (!item.to) return null;

  return (
    <Link
      to={item.to}
      onClick={onItemClick}
      className={cn(
        'flex items-center gap-2 py-2 pr-2 rounded-md text-sm transition-colors',
        paddingLeft,
        isActive
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-foreground/70 hover:bg-accent/50 hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{item.label}</span>
      {item.placeholder && (
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
          title="Em construção"
        >
          em breve
        </span>
      )}
    </Link>
  );
}
