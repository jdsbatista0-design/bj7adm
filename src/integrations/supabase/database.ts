// Hand-written database types reflecting the existing BJ7 Central Supabase schema.
// Schema is owned externally — do not migrate from here.

export type TipoLancamento = "Receita" | "Despesa" | "Retirada" | "Empréstimo";

export interface EmpresaRow {
  id: number;
  nome: string;
  descricao: string | null;
  criado_em: string | null;
}
export interface UnidadeRow {
  id: number;
  nome: string;
  empresa_id: number;
  criado_em: string | null;
}
export interface CategoriaRow {
  id: number;
  nome: string;
  tipo_predominante: string | null;
  grupo: string | null;
  criado_em: string | null;
}
export interface LancamentoRow {
  id: number;
  data: string;
  ano: number;
  mes: number;
  empresa_id: number;
  unidade_id: number | null;
  categoria_id: number | null;
  tipo: string;
  subcategoria: string | null;
  descricao: string | null;
  valor: number;
  valor_sinal_original: number | null;
  status: string | null;
  origem_venda: string | null;
  contar_no_total: boolean;
  origem_classificacao: string | null;
  arquivo_origem: string | null;
  aba_origem: string | null;
  linha_origem: number | null;
  hash_origem: string | null;
  revisado: boolean;
  revisado_por: number | null;
  revisado_em: string | null;
  importacao_id: number | null;
  criado_em: string;
  atualizado_em: string | null;
  fonte_caminho: string | null;
  competencia: string | null;
}
export interface NotaFiscalRow {
  id: number;
  lancamento_id: number | null;
  ano: number | null;
  mes: number | null;
  data: string | null;
  numero: string | null;
  categoria_nota: string | null;
  valor: number | null;
  tomador: string | null;
  arquivo: string | null;
  criado_em: string | null;
}
export interface ApuracaoRebateRow {
  id: number;
  ano: number | null;
  mes: string | null;
  qtd_clientes: number | null;
  lucro_bruto: number | null;
  aliquota: number | null;
  rebate_lb: number | null;
  remuneracao_final: number | null;
  nota_fiscal: number | null;
  criado_em: string | null;
}
export interface EvolucaoBaseRow {
  id: number;
  ano: number | null;
  mes: string | null;
  qtd_clientes: number | null;
  novos_no_mes: number | null;
  sumiram_no_mes: number | null;
  lucro_bruto_total: number | null;
  criado_em: string | null;
}
export interface ClienteSumidoRow {
  id: number;
  sumiu_em: string | null;
  stone_code: string | null;
  nome_fantasia: string | null;
  ultimo_lucro: number | null;
  status_mes_anterior: string | null;
  atencao: boolean | null;
  criado_em: string | null;
}
export interface PapelRow {
  id: number;
  nome: string;
  ve_retiradas_padrao: boolean | null;
  ve_faturamento_padrao: boolean | null;
  ve_todas_empresas_padrao: boolean | null;
  pode_lancar: boolean | null;
  pode_editar_normal: boolean | null;
  pode_editar_revisado: boolean | null;
  pode_marcar_revisado: boolean | null;
  pode_gerir_usuarios: boolean | null;
  descricao: string | null;
}
export interface UsuarioRow {
  id: number;
  auth_uid: string | null;
  nome: string | null;
  email: string | null;
  papel_id: number | null;
  ve_retiradas: boolean | null;
  ve_faturamento: boolean | null;
  ve_todas_empresas: boolean | null;
  ativo: boolean | null;
  criado_em: string | null;
}
export interface UsuarioEmpresaRow {
  id: number;
  usuario_id: number;
  empresa_id: number;
}
export interface ImportacaoRow {
  id: number;
  arquivo: string | null;
  descricao: string | null;
  linhas_recebidas: number | null;
  linhas_inseridas: number | null;
  linhas_ignoradas: number | null;
  importado_por: number | null;
  importado_em: string | null;
}

export type Severidade = "info" | "warn" | "critical";
export type AlertaStatus = "aberto" | "ack" | "resolvido" | "snoozed";
export type TarefaStatus =
  | "aberta"
  | "em_andamento"
  | "aguardando"
  | "concluida"
  | "cancelada";
export type Prioridade = "baixa" | "media" | "alta" | "urgente";

export interface AlertaRow {
  id: number;
  regra_id: number | null;
  tipo: string;
  severidade: Severidade;
  titulo: string;
  descricao: string | null;
  entidade_tipo: string | null;
  entidade_id: string | null;
  empresa_id: number | null;
  payload: Record<string, unknown>;
  dedupe_key: string;
  status: AlertaStatus;
  snooze_ate: string | null;
  criado_em: string;
  ack_por: number | null;
  ack_em: string | null;
  resolvido_em: string | null;
}

export interface TarefaRow {
  id: number;
  titulo: string;
  descricao: string | null;
  responsavel_id: number | null;
  criado_por: number | null;
  prioridade: Prioridade;
  prazo: string | null;
  status: TarefaStatus;
  entidade_tipo: string | null;
  entidade_id: string | null;
  empresa_id: number | null;
  origem: "manual" | "regra" | "alerta" | "sistema";
  alerta_id: number | null;
  dedupe_key: string | null;
  criada_em: string;
  concluida_em: string | null;
}

export interface RegraRow {
  id: number;
  nome: string;
  descricao: string | null;
  tipo: string;
  config: Record<string, unknown>;
  severidade: Severidade;
  gera_tarefa: boolean;
  ativo: boolean;
  criado_em: string;
}

// ===== Views =====

export interface VResumoDreRow {
  empresa_id: number;
  empresa: string | null;
  ano: number;
  receita_operacional: number | null;
  despesa_operacional: number | null;
  ebitda_operacional: number | null;
  despesa_nao_operacional: number | null;
  investimentos: number | null;
  movimentacao_patrimonial: number | null;
  lucro_liquido_pre_capex: number | null;
}

export interface DreConsolidadaRow {
  empresa_id: number;
  mes_ref: string; // YYYY-MM-DD (first day of month)
  tipo: string;
  grupo: string | null;
  natureza_dre: string | null;
  entra_dre: boolean | null;
  entra_dre_operacional: boolean | null;
  qtd_lancamentos: number;
  valor_total: number;
}

export interface DreOperacionalRow {
  empresa_id: number;
  empresa: string | null;
  ano: number;
  mes: number;
  mes_ref: string;
  natureza: string | null;
  grupo: string | null;
  categoria: string | null;
  qtd_lancamentos: number;
  valor_total: number;
}

type Tbl<Row, Insert = Partial<Row> & { id?: number }, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      empresas: Tbl<EmpresaRow, { id?: number; nome: string }, Partial<EmpresaRow>>;
      unidades: Tbl<UnidadeRow>;
      categorias: Tbl<CategoriaRow>;
      lancamentos: Tbl<LancamentoRow>;
      notas_fiscais: Tbl<NotaFiscalRow>;
      apuracao_rebate: Tbl<ApuracaoRebateRow>;
      evolucao_base_clientes: Tbl<EvolucaoBaseRow>;
      clientes_sumidos: Tbl<ClienteSumidoRow>;
      papeis: Tbl<PapelRow>;
      usuarios: Tbl<UsuarioRow>;
      usuario_empresas: Tbl<
        UsuarioEmpresaRow,
        { id?: number; usuario_id: number; empresa_id: number },
        Partial<UsuarioEmpresaRow>
      >;
      importacoes: Tbl<ImportacaoRow>;
    };
    Views: {
      v_resumo_dre: { Row: VResumoDreRow };
      dre_consolidada: { Row: DreConsolidadaRow };
      dre_operacional: { Row: DreOperacionalRow };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
