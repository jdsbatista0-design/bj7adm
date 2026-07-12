// Catálogo canônico de menus do sistema. Cada `key` corresponde à URL da rota
// e é o identificador usado na tabela public.menu_permissoes.
export interface MenuNode {
  key: string;
  label: string;
  children?: MenuNode[];
}

export const MENU_CATALOG: MenuNode[] = [
  { key: "/itens", label: "Cockpit" },
  { key: "/empresas", label: "Empresas" },
  { key: "/calendario", label: "Calendário" },
  {
    key: "/financeiro",
    label: "Financeiro",
    children: [
      { key: "/financeiro", label: "Visão Financeira" },
      { key: "/financeiro/contas-a-pagar", label: "Contas a Pagar" },
      { key: "/financeiro/dre-consolidado", label: "DRE Consolidado" },
      { key: "/financeiro/categorias", label: "Categorias" },
      { key: "/open-finance/conectar", label: "Open Finance" },
    ],
  },
  {
    key: "/documentos",
    label: "Documentos",
    children: [
      { key: "/documentos", label: "Repositório" },
      { key: "/documentos/vencimentos", label: "Vencimentos" },
      { key: "/documentos/por-tipo", label: "Por Tipo" },
    ],
  },
  { key: "/juridico/processos", label: "Jurídico" },
  { key: "/marketing/campanhas", label: "Marketing" },
  { key: "/sistema", label: "Sistema (BJ7)" },
  { key: "/pessoas", label: "Pessoas" },
  {
    key: "/stone",
    label: "Stone",
    children: [
      { key: "/clientes-stone", label: "Clientes Stone" },
      { key: "/stone/importar-rebate", label: "Importar Rebate" },
      { key: "/stone/importacoes", label: "Importações" },
    ],
  },
  { key: "/config", label: "Configurações" },
  { key: "/usuarios", label: "Usuários (admin)" },
];

export function flattenMenuKeys(nodes: MenuNode[] = MENU_CATALOG): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    out.push(n.key);
    if (n.children) out.push(...flattenMenuKeys(n.children));
  }
  return Array.from(new Set(out));
}
