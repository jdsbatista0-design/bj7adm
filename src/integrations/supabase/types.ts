export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      apuracao_rebate: {
        Row: {
          aliquota: number | null
          ano: number | null
          criado_em: string | null
          id: number
          lucro_bruto: number | null
          mes: string | null
          nota_fiscal: number | null
          qtd_clientes: number | null
          rebate_lb: number | null
          remuneracao_final: number | null
        }
        Insert: {
          aliquota?: number | null
          ano?: number | null
          criado_em?: string | null
          id?: number
          lucro_bruto?: number | null
          mes?: string | null
          nota_fiscal?: number | null
          qtd_clientes?: number | null
          rebate_lb?: number | null
          remuneracao_final?: number | null
        }
        Update: {
          aliquota?: number | null
          ano?: number | null
          criado_em?: string | null
          id?: number
          lucro_bruto?: number | null
          mes?: string | null
          nota_fiscal?: number | null
          qtd_clientes?: number | null
          rebate_lb?: number | null
          remuneracao_final?: number | null
        }
        Relationships: []
      }
      categorias: {
        Row: {
          criado_em: string | null
          grupo: string | null
          id: number
          nome: string
          tipo_predominante: string | null
        }
        Insert: {
          criado_em?: string | null
          grupo?: string | null
          id?: number
          nome: string
          tipo_predominante?: string | null
        }
        Update: {
          criado_em?: string | null
          grupo?: string | null
          id?: number
          nome?: string
          tipo_predominante?: string | null
        }
        Relationships: []
      }
      clientes_sumidos: {
        Row: {
          atencao: boolean | null
          criado_em: string | null
          id: number
          nome_fantasia: string | null
          status_mes_anterior: string | null
          stone_code: string | null
          sumiu_em: string | null
          ultimo_lucro: number | null
        }
        Insert: {
          atencao?: boolean | null
          criado_em?: string | null
          id?: number
          nome_fantasia?: string | null
          status_mes_anterior?: string | null
          stone_code?: string | null
          sumiu_em?: string | null
          ultimo_lucro?: number | null
        }
        Update: {
          atencao?: boolean | null
          criado_em?: string | null
          id?: number
          nome_fantasia?: string | null
          status_mes_anterior?: string | null
          stone_code?: string | null
          sumiu_em?: string | null
          ultimo_lucro?: number | null
        }
        Relationships: []
      }
      empresas: {
        Row: {
          ativa: boolean | null
          criado_em: string | null
          descricao: string | null
          id: number
          nome: string
        }
        Insert: {
          ativa?: boolean | null
          criado_em?: string | null
          descricao?: string | null
          id?: number
          nome: string
        }
        Update: {
          ativa?: boolean | null
          criado_em?: string | null
          descricao?: string | null
          id?: number
          nome?: string
        }
        Relationships: []
      }
      evolucao_base_clientes: {
        Row: {
          ano: number | null
          criado_em: string | null
          id: number
          lucro_bruto_total: number | null
          mes: string | null
          novos_no_mes: number | null
          qtd_clientes: number | null
          sumiram_no_mes: number | null
        }
        Insert: {
          ano?: number | null
          criado_em?: string | null
          id?: number
          lucro_bruto_total?: number | null
          mes?: string | null
          novos_no_mes?: number | null
          qtd_clientes?: number | null
          sumiram_no_mes?: number | null
        }
        Update: {
          ano?: number | null
          criado_em?: string | null
          id?: number
          lucro_bruto_total?: number | null
          mes?: string | null
          novos_no_mes?: number | null
          qtd_clientes?: number | null
          sumiram_no_mes?: number | null
        }
        Relationships: []
      }
      importacoes: {
        Row: {
          arquivo: string | null
          descricao: string | null
          id: number
          importado_em: string | null
          importado_por: number | null
          linhas_ignoradas: number | null
          linhas_inseridas: number | null
          linhas_recebidas: number | null
        }
        Insert: {
          arquivo?: string | null
          descricao?: string | null
          id?: number
          importado_em?: string | null
          importado_por?: number | null
          linhas_ignoradas?: number | null
          linhas_inseridas?: number | null
          linhas_recebidas?: number | null
        }
        Update: {
          arquivo?: string | null
          descricao?: string | null
          id?: number
          importado_em?: string | null
          importado_por?: number | null
          linhas_ignoradas?: number | null
          linhas_inseridas?: number | null
          linhas_recebidas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "importacoes_importado_por_fkey"
            columns: ["importado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos: {
        Row: {
          aba_origem: string | null
          ano: number
          arquivo_origem: string | null
          atualizado_em: string | null
          auditado_em: string | null
          auditado_por_banco: boolean | null
          categoria_id: number | null
          competencia: string | null
          contar_no_total: boolean
          criado_em: string
          data: string
          descricao: string | null
          empresa_id: number | null
          fonte_caminho: string | null
          hash_origem: string | null
          id: number
          importacao_id: number | null
          linha_origem: number | null
          mes: number
          origem_classificacao: string | null
          origem_venda: string | null
          pluggy_transaction_id: string | null
          revisado: boolean
          revisado_em: string | null
          revisado_por: number | null
          status: string | null
          subcategoria: string | null
          tipo: string
          unidade_id: number | null
          valor: number
          valor_sinal_original: number | null
        }
        Insert: {
          aba_origem?: string | null
          ano?: number
          arquivo_origem?: string | null
          atualizado_em?: string | null
          auditado_em?: string | null
          auditado_por_banco?: boolean | null
          categoria_id?: number | null
          competencia?: string | null
          contar_no_total?: boolean
          criado_em?: string
          data?: string
          descricao?: string | null
          empresa_id?: number | null
          fonte_caminho?: string | null
          hash_origem?: string | null
          id?: number
          importacao_id?: number | null
          linha_origem?: number | null
          mes?: number
          origem_classificacao?: string | null
          origem_venda?: string | null
          pluggy_transaction_id?: string | null
          revisado?: boolean
          revisado_em?: string | null
          revisado_por?: number | null
          status?: string | null
          subcategoria?: string | null
          tipo?: string
          unidade_id?: number | null
          valor?: number
          valor_sinal_original?: number | null
        }
        Update: {
          aba_origem?: string | null
          ano?: number
          arquivo_origem?: string | null
          atualizado_em?: string | null
          auditado_em?: string | null
          auditado_por_banco?: boolean | null
          categoria_id?: number | null
          competencia?: string | null
          contar_no_total?: boolean
          criado_em?: string
          data?: string
          descricao?: string | null
          empresa_id?: number | null
          fonte_caminho?: string | null
          hash_origem?: string | null
          id?: number
          importacao_id?: number | null
          linha_origem?: number | null
          mes?: number
          origem_classificacao?: string | null
          origem_venda?: string | null
          pluggy_transaction_id?: string | null
          revisado?: boolean
          revisado_em?: string | null
          revisado_por?: number | null
          status?: string | null
          subcategoria?: string | null
          tipo?: string
          unidade_id?: number | null
          valor?: number
          valor_sinal_original?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          ano: number | null
          arquivo: string | null
          categoria_nota: string | null
          criado_em: string | null
          data: string | null
          id: number
          lancamento_id: number | null
          mes: number | null
          numero: string | null
          tomador: string | null
          valor: number | null
        }
        Insert: {
          ano?: number | null
          arquivo?: string | null
          categoria_nota?: string | null
          criado_em?: string | null
          data?: string | null
          id?: number
          lancamento_id?: number | null
          mes?: number | null
          numero?: string | null
          tomador?: string | null
          valor?: number | null
        }
        Update: {
          ano?: number | null
          arquivo?: string | null
          categoria_nota?: string | null
          criado_em?: string | null
          data?: string | null
          id?: number
          lancamento_id?: number | null
          mes?: number | null
          numero?: string | null
          tomador?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      papeis: {
        Row: {
          descricao: string | null
          id: number
          nome: string
          pode_editar_normal: boolean | null
          pode_editar_revisado: boolean | null
          pode_gerir_usuarios: boolean | null
          pode_lancar: boolean | null
          pode_marcar_revisado: boolean | null
          ve_faturamento_padrao: boolean | null
          ve_retiradas_padrao: boolean | null
          ve_todas_empresas_padrao: boolean | null
        }
        Insert: {
          descricao?: string | null
          id?: number
          nome: string
          pode_editar_normal?: boolean | null
          pode_editar_revisado?: boolean | null
          pode_gerir_usuarios?: boolean | null
          pode_lancar?: boolean | null
          pode_marcar_revisado?: boolean | null
          ve_faturamento_padrao?: boolean | null
          ve_retiradas_padrao?: boolean | null
          ve_todas_empresas_padrao?: boolean | null
        }
        Update: {
          descricao?: string | null
          id?: number
          nome?: string
          pode_editar_normal?: boolean | null
          pode_editar_revisado?: boolean | null
          pode_gerir_usuarios?: boolean | null
          pode_lancar?: boolean | null
          pode_marcar_revisado?: boolean | null
          ve_faturamento_padrao?: boolean | null
          ve_retiradas_padrao?: boolean | null
          ve_todas_empresas_padrao?: boolean | null
        }
        Relationships: []
      }
      unidades: {
        Row: {
          criado_em: string | null
          empresa_id: number
          id: number
          nome: string
        }
        Insert: {
          criado_em?: string | null
          empresa_id: number
          id?: number
          nome: string
        }
        Update: {
          criado_em?: string | null
          empresa_id?: number
          id?: number
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_empresas: {
        Row: {
          empresa_id: number
          id: number
          usuario_id: number
        }
        Insert: {
          empresa_id: number
          id?: number
          usuario_id: number
        }
        Update: {
          empresa_id?: number
          id?: number
          usuario_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "usuario_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_empresas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean | null
          auth_uid: string | null
          criado_em: string | null
          email: string | null
          id: number
          nome: string | null
          papel_id: number | null
          ve_faturamento: boolean | null
          ve_retiradas: boolean | null
          ve_todas_empresas: boolean | null
        }
        Insert: {
          ativo?: boolean | null
          auth_uid?: string | null
          criado_em?: string | null
          email?: string | null
          id?: number
          nome?: string | null
          papel_id?: number | null
          ve_faturamento?: boolean | null
          ve_retiradas?: boolean | null
          ve_todas_empresas?: boolean | null
        }
        Update: {
          ativo?: boolean | null
          auth_uid?: string | null
          criado_em?: string | null
          email?: string | null
          id?: number
          nome?: string | null
          papel_id?: number | null
          ve_faturamento?: boolean | null
          ve_retiradas?: boolean | null
          ve_todas_empresas?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_papel_id_fkey"
            columns: ["papel_id"]
            isOneToOne: false
            referencedRelation: "papeis"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_can_see_empresa: {
        Args: { _empresa_id: number }
        Returns: boolean
      }
      current_user_can_see_tipo: { Args: { _tipo: string }; Returns: boolean }
      current_user_empresa_ids: { Args: never; Returns: number[] }
      current_user_perms: {
        Args: never
        Returns: {
          pode_editar_normal: boolean
          pode_editar_revisado: boolean
          pode_gerir_usuarios: boolean
          pode_lancar: boolean
          pode_marcar_revisado: boolean
          usuario_id: number
          ve_faturamento: boolean
          ve_retiradas: boolean
          ve_todas_empresas: boolean
        }[]
      }
      ensure_self_usuario: {
        Args: never
        Returns: {
          ativo: boolean | null
          auth_uid: string | null
          criado_em: string | null
          email: string | null
          id: number
          nome: string | null
          papel_id: number | null
          ve_faturamento: boolean | null
          ve_retiradas: boolean | null
          ve_todas_empresas: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "usuarios"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
