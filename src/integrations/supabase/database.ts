// Hand-written database types reflecting the existing BJ7 Central Supabase schema.
// Schema is owned externally — do not migrate from here.

export type TipoLancamento = "Receita" | "Despesa" | "Retirada" | "Empréstimo";

export interface EmpresaRow {
  id: number;
  nome: string;
}
export interface UnidadeRow {
  id: number;
  nome: string;
  empresa_id: number;
}
export interface CategoriaRow {
  id: number;
  nome: string;
  tipo_predominante: string | null;
  grupo: string | null;
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
}
export interface NotaFiscalRow {
  id: number;
  lancamento_id: number | null;
  numero: string | null;
  tomador: string | null;
  categoria: string | null;
  arquivo: string | null;
  data: string | null;
  valor: number | null;
}
export interface ApuracaoRebateRow {
  id: number;
  ano: number | null;
  mes: number | null;
  lucro_bruto: number | null;
  aliquota: number | null;
  rebate: number | null;
  remuneracao_final: number | null;
}
export interface EvolucaoBaseRow {
  id: number;
  ano: number | null;
  mes: number | null;
  qtd_clientes: number | null;
  novos_no_mes: number | null;
  sumiram_no_mes: number | null;
}
export interface ClienteSumidoRow {
  id: number;
  nome: string | null;
  ultimo_lucro: number | null;
  status: string | null;
  atencao: boolean | null;
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
  data: string | null;
  linhas_inseridas: number | null;
  linhas_ignoradas: number | null;
  criado_por: number | null;
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
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
