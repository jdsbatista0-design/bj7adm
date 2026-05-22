import {
  Home,
  Building2,
  Wallet,
  Receipt,
  Landmark,
  Banknote,
  DollarSign,
  Calendar,
  Percent,
  AlertCircle,
  Upload,
  FolderOpen,
  Workflow,
  Users,
  Target,
  Eye,
  MapPin,
  ListTodo,
  Settings,
  Inbox,
  FileText,
  type LucideIcon,
} from 'lucide-react';

/**
 * Configuração hierárquica do menu lateral do BJ7 Central.
 *
 * Estrutura:
 * - Itens de topo podem ser links diretos (com `to`) ou agrupadores (com `children`)
 * - Agrupadores podem ter sub-agrupadores aninhados (Open Finance dentro de Financeiro)
 * - `placeholder: true` indica rota ainda em construção (renderiza tela "Em construção")
 */

export type MenuItem = {
  label: string;
  icon: LucideIcon;
  to?: string;
  placeholder?: boolean;
  children?: MenuItem[];
};

export const MENU_CONFIG: MenuItem[] = [
  {
    label: 'Início',
    icon: Home,
    to: '/',
  },
  {
    label: 'Empresas',
    icon: Building2,
    to: '/empresas',
  },
  {
    label: 'Financeiro',
    icon: Wallet,
    children: [
      { label: 'Visão Financeira', icon: DollarSign, to: '/financeiro' },
      { label: 'DRE Consolidado', icon: Receipt, to: '/financeiro/dre', placeholder: true },
      { label: 'Categorias', icon: ListTodo, to: '/financeiro/categorias', placeholder: true },
      {
        label: 'Open Finance',
        icon: Landmark,
        children: [
          { label: 'Conectar Contas', icon: Banknote, to: '/open-finance/conectar' },
          { label: 'Caixa de Entrada', icon: Inbox, to: '/open-finance/caixa-entrada', placeholder: true },
          { label: 'Tesouraria', icon: DollarSign, to: '/financeiro/tesouraria', placeholder: true },
        ],
      },
    ],
  },
  {
    label: 'Fiscal',
    icon: FileText,
    children: [
      { label: 'Dashboard', icon: Eye, to: '/fiscal/dashboard', placeholder: true },
      { label: 'Calendário', icon: Calendar, to: '/fiscal/calendario' },
      { label: 'Faturamento (Simples)', icon: Percent, to: '/fiscal/faturamento-simples' },
      { label: 'Pendências Contábeis', icon: AlertCircle, to: '/fiscal/pendencias' },
      { label: 'Importações Fiscais', icon: Upload, to: '/fiscal/importacoes', placeholder: true },
    ],
  },
  {
    label: 'Documentos',
    icon: FolderOpen,
    children: [
      { label: 'Repositório', icon: FolderOpen, to: '/documentos', placeholder: true },
      { label: 'Vencimentos', icon: AlertCircle, to: '/documentos/vencimentos', placeholder: true },
      { label: 'Por Tipo', icon: ListTodo, to: '/documentos/por-tipo', placeholder: true },
    ],
  },
  {
    label: 'Sistema (BJ7)',
    icon: Workflow,
    children: [
      { label: 'Procedimentos', icon: ListTodo, to: '/sistema/procedimentos', placeholder: true },
      { label: 'Em Execução', icon: Eye, to: '/sistema/execucoes', placeholder: true },
      { label: 'Por Eixo BJ7', icon: Target, to: '/sistema/por-eixo', placeholder: true },
      { label: 'Templates', icon: FileText, to: '/sistema/templates', placeholder: true },
    ],
  },
  {
    label: 'Pessoas',
    icon: Users,
    children: [
      { label: 'Dashboard', icon: Eye, to: '/pessoas', placeholder: true },
      { label: 'Colaboradores', icon: Users, to: '/pessoas/colaboradores', placeholder: true },
      { label: 'PDI', icon: Target, to: '/pessoas/pdi', placeholder: true },
      { label: 'OKRs', icon: Target, to: '/pessoas/okrs', placeholder: true },
      { label: '1:1', icon: Users, to: '/pessoas/one-on-ones', placeholder: true },
      { label: 'Rotina de Rua', icon: MapPin, to: '/pessoas/rotina-rua', placeholder: true },
    ],
  },
  {
    label: 'Itens',
    icon: ListTodo,
    to: '/itens',
  },
  {
    label: 'Configurações',
    icon: Settings,
    to: '/config',
  },
];
