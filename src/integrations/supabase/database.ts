// Hand-written database types reflecting the existing BJ7 Central Supabase schema.
// Schema is owned externally — do not migrate from here.

export type TipoLancamento = "Receita" | "Despesa" | "Retirada" | "Empréstimo";

export interface Database {
  public: {
    Tables: {
      empresas: {
        Row: { id: number; nome: string };
        Insert: { id?: number; nome: string };
        Update: { id?: number; nome?: string };
      };
      unidades: {
        Row: { id: number; nome: string; empresa_id: number };
        Insert: { id?: number; nome: string; empresa_id: number };
        Update: { id?: number; nome?: string; empresa_id?: number };
      };
      categorias: {
        Row: {
          id: number;
          nome: string;
          tipo_predominante: string | null;
          grupo: string | null;
        };
        Insert: {
          id?: number;
          nome: string;
          tipo_predominante?: string | null;
          grupo?: string | null;
        };
        Update: {
          id?: number;
          nome?: string;
          tipo_predominante?: string | null;
          grupo?: string | null;
        };
      };
      lancamentos: {
        Row: {
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
        };
        Insert: {
          id?: number;
          data: string;
          ano: number;
          mes: number;
          empresa_id: number;
          unidade_id?: number | null;
          categoria_id?: number | null;
          tipo: string;
          subcategoria?: string | null;
          descricao?: string | null;
          valor: number;
          valor_sinal_original?: number | null;
          status?: string | null;
          origem_venda?: string | null;
          contar_no_total?: boolean;
          origem_classificacao?: string | null;
          arquivo_origem?: string | null;
          aba_origem?: string | null;
          linha_origem?: number | null;
          hash_origem?: string | null;
          revisado?: boolean;
          revisado_por?: number | null;
          revisado_em?: string | null;
          importacao_id?: number | null;
          criado_em?: string;
          atualizado_em?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["lancamentos"]["Insert"]>;
      };
      notas_fiscais: {
        Row: {
          id: number;
          lancamento_id: number | null;
          numero: string | null;
          tomador: string | null;
          categoria: string | null;
          arquivo: string | null;
          data: string | null;
          valor: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["notas_fiscais"]["Row"]> & {
          id?: number;
        };
        Update: Partial<Database["public"]["Tables"]["notas_fiscais"]["Row"]>;
      };
      apuracao_rebate: {
        Row: {
          id: number;
          ano: number | null;
          mes: number | null;
          lucro_bruto: number | null;
          aliquota: number | null;
          rebate: number | null;
          remuneracao_final: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["apuracao_rebate"]["Row"]> & {
          id?: number;
        };
        Update: Partial<Database["public"]["Tables"]["apuracao_rebate"]["Row"]>;
      };
      evolucao_base_clientes: {
        Row: {
          id: number;
          ano: number | null;
          mes: number | null;
          qtd_clientes: number | null;
          novos_no_mes: number | null;
          sumiram_no_mes: number | null;
        };
        Insert: Partial<
          Database["public"]["Tables"]["evolucao_base_clientes"]["Row"]
        > & { id?: number };
        Update: Partial<Database["public"]["Tables"]["evolucao_base_clientes"]["Row"]>;
      };
      clientes_sumidos: {
        Row: {
          id: number;
          nome: string | null;
          ultimo_lucro: number | null;
          status: string | null;
          atencao: boolean | null;
        };
        Insert: Partial<Database["public"]["Tables"]["clientes_sumidos"]["Row"]> & {
          id?: number;
        };
        Update: Partial<Database["public"]["Tables"]["clientes_sumidos"]["Row"]>;
      };
      papeis: {
        Row: {
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
        };
        Insert: Partial<Database["public"]["Tables"]["papeis"]["Row"]> & {
          id?: number;
          nome: string;
        };
        Update: Partial<Database["public"]["Tables"]["papeis"]["Row"]>;
      };
      usuarios: {
        Row: {
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
        };
        Insert: Partial<Database["public"]["Tables"]["usuarios"]["Row"]> & {
          id?: number;
        };
        Update: Partial<Database["public"]["Tables"]["usuarios"]["Row"]>;
      };
      usuario_empresas: {
        Row: { id: number; usuario_id: number; empresa_id: number };
        Insert: { id?: number; usuario_id: number; empresa_id: number };
        Update: Partial<{ id: number; usuario_id: number; empresa_id: number }>;
      };
      importacoes: {
        Row: {
          id: number;
          arquivo: string | null;
          data: string | null;
          linhas_inseridas: number | null;
          linhas_ignoradas: number | null;
          criado_por: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["importacoes"]["Row"]> & {
          id?: number;
        };
        Update: Partial<Database["public"]["Tables"]["importacoes"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
