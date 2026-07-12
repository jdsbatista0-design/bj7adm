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
      alertas: {
        Row: {
          ack_em: string | null
          ack_por: number | null
          criado_em: string
          dedupe_key: string
          descricao: string | null
          empresa_id: number | null
          entidade_id: string | null
          entidade_tipo: string | null
          id: number
          payload: Json
          regra_id: number | null
          resolvido_em: string | null
          severidade: string
          snooze_ate: string | null
          status: string
          tipo: string
          titulo: string
        }
        Insert: {
          ack_em?: string | null
          ack_por?: number | null
          criado_em?: string
          dedupe_key: string
          descricao?: string | null
          empresa_id?: number | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: number
          payload?: Json
          regra_id?: number | null
          resolvido_em?: string | null
          severidade?: string
          snooze_ate?: string | null
          status?: string
          tipo: string
          titulo: string
        }
        Update: {
          ack_em?: string | null
          ack_por?: number | null
          criado_em?: string
          dedupe_key?: string
          descricao?: string | null
          empresa_id?: number | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: number
          payload?: Json
          regra_id?: number | null
          resolvido_em?: string | null
          severidade?: string
          snooze_ate?: string | null
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_ack_por_fkey"
            columns: ["ack_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_dre"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "alertas_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "regras"
            referencedColumns: ["id"]
          },
        ]
      }
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
      categoria_sugestoes: {
        Row: {
          atualizado_em: string
          categoria_id: number | null
          hash_descricao: string
          hits: number
          id: number
          origem: string
          score: number
        }
        Insert: {
          atualizado_em?: string
          categoria_id?: number | null
          hash_descricao: string
          hits?: number
          id?: number
          origem?: string
          score?: number
        }
        Update: {
          atualizado_em?: string
          categoria_id?: number | null
          hash_descricao?: string
          hits?: number
          id?: number
          origem?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "categoria_sugestoes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
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
      contas_a_pagar: {
        Row: {
          atualizado_em: string
          categoria_id: number | null
          criado_em: string
          criado_por: string | null
          data_pagamento: string | null
          descricao: string
          empresa_id: number | null
          grupo_id: string | null
          id: number
          lancamento_id: number | null
          observacao: string | null
          pago: boolean
          recorrencia: string
          valor: number
          valor_pago: number | null
          vencimento: string
        }
        Insert: {
          atualizado_em?: string
          categoria_id?: number | null
          criado_em?: string
          criado_por?: string | null
          data_pagamento?: string | null
          descricao: string
          empresa_id?: number | null
          grupo_id?: string | null
          id?: number
          lancamento_id?: number | null
          observacao?: string | null
          pago?: boolean
          recorrencia?: string
          valor?: number
          valor_pago?: number | null
          vencimento?: string
        }
        Update: {
          atualizado_em?: string
          categoria_id?: number | null
          criado_em?: string
          criado_por?: string | null
          data_pagamento?: string | null
          descricao?: string
          empresa_id?: number | null
          grupo_id?: string | null
          id?: number
          lancamento_id?: number | null
          observacao?: string | null
          pago?: boolean
          recorrencia?: string
          valor?: number
          valor_pago?: number | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_a_pagar_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_a_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_a_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_dre"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "contas_a_pagar_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
        ]
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
      interacoes: {
        Row: {
          autor_id: number | null
          conteudo: string | null
          criada_em: string
          entidade_id: string
          entidade_tipo: string
          id: number
          payload: Json | null
          tipo: string
        }
        Insert: {
          autor_id?: number | null
          conteudo?: string | null
          criada_em?: string
          entidade_id: string
          entidade_tipo: string
          id?: number
          payload?: Json | null
          tipo?: string
        }
        Update: {
          autor_id?: number | null
          conteudo?: string | null
          criada_em?: string
          entidade_id?: string
          entidade_tipo?: string
          id?: number
          payload?: Json | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "interacoes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      itens: {
        Row: {
          concluido_em: string | null
          contexto: string | null
          criado_em: string | null
          data_reuniao: string | null
          decisao_em: string | null
          decisao_tomada: string | null
          descricao: string | null
          duracao_min: number | null
          eixo_bj7: string | null
          empresa_id: number | null
          energia: string | null
          estado: string | null
          id: number
          importante: boolean | null
          item_pai_id: number | null
          local_reuniao: string | null
          notas: string | null
          opcoes_decisao: Json | null
          participantes: string[] | null
          prazo: string | null
          recorrencia: string | null
          tags: string[] | null
          tipo: string | null
          titulo: string
          urgente: boolean | null
        }
        Insert: {
          concluido_em?: string | null
          contexto?: string | null
          criado_em?: string | null
          data_reuniao?: string | null
          decisao_em?: string | null
          decisao_tomada?: string | null
          descricao?: string | null
          duracao_min?: number | null
          eixo_bj7?: string | null
          empresa_id?: number | null
          energia?: string | null
          estado?: string | null
          id?: number
          importante?: boolean | null
          item_pai_id?: number | null
          local_reuniao?: string | null
          notas?: string | null
          opcoes_decisao?: Json | null
          participantes?: string[] | null
          prazo?: string | null
          recorrencia?: string | null
          tags?: string[] | null
          tipo?: string | null
          titulo: string
          urgente?: boolean | null
        }
        Update: {
          concluido_em?: string | null
          contexto?: string | null
          criado_em?: string | null
          data_reuniao?: string | null
          decisao_em?: string | null
          decisao_tomada?: string | null
          descricao?: string | null
          duracao_min?: number | null
          eixo_bj7?: string | null
          empresa_id?: number | null
          energia?: string | null
          estado?: string | null
          id?: number
          importante?: boolean | null
          item_pai_id?: number | null
          local_reuniao?: string | null
          notas?: string | null
          opcoes_decisao?: Json | null
          participantes?: string[] | null
          prazo?: string | null
          recorrencia?: string | null
          tags?: string[] | null
          tipo?: string | null
          titulo?: string
          urgente?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_dre"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "itens_item_pai_id_fkey"
            columns: ["item_pai_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
        ]
      }
      juridico_processos: {
        Row: {
          advogado: string | null
          atualizado_em: string
          contraparte: string | null
          criado_em: string
          data_encerramento: string | null
          data_inicio: string | null
          descricao: string | null
          empresa_id: number | null
          id: number
          numero: string | null
          observacao: string | null
          polo: string | null
          proxima_audiencia: string | null
          resultado: string | null
          status: string
          tipo: string
          valor_causa: number | null
          valor_provisao: number | null
          vara: string | null
        }
        Insert: {
          advogado?: string | null
          atualizado_em?: string
          contraparte?: string | null
          criado_em?: string
          data_encerramento?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id?: number | null
          id?: number
          numero?: string | null
          observacao?: string | null
          polo?: string | null
          proxima_audiencia?: string | null
          resultado?: string | null
          status?: string
          tipo?: string
          valor_causa?: number | null
          valor_provisao?: number | null
          vara?: string | null
        }
        Update: {
          advogado?: string | null
          atualizado_em?: string
          contraparte?: string | null
          criado_em?: string
          data_encerramento?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id?: number | null
          id?: number
          numero?: string | null
          observacao?: string | null
          polo?: string | null
          proxima_audiencia?: string | null
          resultado?: string | null
          status?: string
          tipo?: string
          valor_causa?: number | null
          valor_provisao?: number | null
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "juridico_processos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "juridico_processos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_dre"
            referencedColumns: ["empresa_id"]
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
            foreignKeyName: "lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_dre"
            referencedColumns: ["empresa_id"]
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
      mkt_campanhas: {
        Row: {
          atualizado_em: string
          canal: string
          conversoes: number | null
          criado_em: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string | null
          empresa_id: number | null
          gasto_realizado: number | null
          id: number
          leads_gerados: number | null
          nome: string
          objetivo: string | null
          observacao: string | null
          orcamento: number | null
          resultado: string | null
          status: string
        }
        Insert: {
          atualizado_em?: string
          canal?: string
          conversoes?: number | null
          criado_em?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: number | null
          gasto_realizado?: number | null
          id?: number
          leads_gerados?: number | null
          nome: string
          objetivo?: string | null
          observacao?: string | null
          orcamento?: number | null
          resultado?: string | null
          status?: string
        }
        Update: {
          atualizado_em?: string
          canal?: string
          conversoes?: number | null
          criado_em?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: number | null
          gasto_realizado?: number | null
          id?: number
          leads_gerados?: number | null
          nome?: string
          objetivo?: string | null
          observacao?: string | null
          orcamento?: number | null
          resultado?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_campanhas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_campanhas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_dre"
            referencedColumns: ["empresa_id"]
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
      notas_rapidas: {
        Row: {
          arquivada: boolean
          atualizado_em: string
          conteudo: string
          criado_em: string
          criado_por: string | null
          empresa_id: number | null
          fixada: boolean
          id: number
          tipo: string
        }
        Insert: {
          arquivada?: boolean
          atualizado_em?: string
          conteudo: string
          criado_em?: string
          criado_por?: string | null
          empresa_id?: number | null
          fixada?: boolean
          id?: number
          tipo?: string
        }
        Update: {
          arquivada?: boolean
          atualizado_em?: string
          conteudo?: string
          criado_em?: string
          criado_por?: string | null
          empresa_id?: number | null
          fixada?: boolean
          id?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_rapidas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_rapidas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_dre"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      obrigacoes_fiscais: {
        Row: {
          atualizado_em: string
          competencia: string
          criado_em: string
          data_pagamento: string | null
          descricao: string | null
          empresa_id: number | null
          guia_url: string | null
          id: number
          observacao: string | null
          status: string
          tipo: string
          valor: number | null
          valor_pago: number | null
          vencimento: string
        }
        Insert: {
          atualizado_em?: string
          competencia: string
          criado_em?: string
          data_pagamento?: string | null
          descricao?: string | null
          empresa_id?: number | null
          guia_url?: string | null
          id?: number
          observacao?: string | null
          status?: string
          tipo: string
          valor?: number | null
          valor_pago?: number | null
          vencimento: string
        }
        Update: {
          atualizado_em?: string
          competencia?: string
          criado_em?: string
          data_pagamento?: string | null
          descricao?: string | null
          empresa_id?: number | null
          guia_url?: string | null
          id?: number
          observacao?: string | null
          status?: string
          tipo?: string
          valor?: number | null
          valor_pago?: number | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "obrigacoes_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obrigacoes_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_dre"
            referencedColumns: ["empresa_id"]
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
      pessoas_colaboradores: {
        Row: {
          area: string | null
          ativo: boolean
          atualizado_em: string | null
          cargo: string | null
          criado_em: string
          data_admissao: string | null
          email: string | null
          empresa_id: number | null
          gestor_id: number | null
          id: number
          nome: string
          observacoes: string | null
        }
        Insert: {
          area?: string | null
          ativo?: boolean
          atualizado_em?: string | null
          cargo?: string | null
          criado_em?: string
          data_admissao?: string | null
          email?: string | null
          empresa_id?: number | null
          gestor_id?: number | null
          id?: number
          nome: string
          observacoes?: string | null
        }
        Update: {
          area?: string | null
          ativo?: boolean
          atualizado_em?: string | null
          cargo?: string | null
          criado_em?: string
          data_admissao?: string | null
          email?: string | null
          empresa_id?: number | null
          gestor_id?: number | null
          id?: number
          nome?: string
          observacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_colaboradores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_colaboradores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_dre"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "pessoas_colaboradores_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "pessoas_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas_okrs: {
        Row: {
          atualizado_em: string | null
          ciclo: string
          colaborador_id: number | null
          criado_em: string
          id: number
          key_result: string
          objetivo: string
          progresso: number
          status: string
        }
        Insert: {
          atualizado_em?: string | null
          ciclo: string
          colaborador_id?: number | null
          criado_em?: string
          id?: number
          key_result: string
          objetivo: string
          progresso?: number
          status?: string
        }
        Update: {
          atualizado_em?: string | null
          ciclo?: string
          colaborador_id?: number | null
          criado_em?: string
          id?: number
          key_result?: string
          objetivo?: string
          progresso?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_okrs_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "pessoas_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas_one_on_ones: {
        Row: {
          acoes: string | null
          criado_em: string
          data: string
          gestor_id: number | null
          id: number
          liderado_id: number | null
          topicos: string | null
        }
        Insert: {
          acoes?: string | null
          criado_em?: string
          data?: string
          gestor_id?: number | null
          id?: number
          liderado_id?: number | null
          topicos?: string | null
        }
        Update: {
          acoes?: string | null
          criado_em?: string
          data?: string
          gestor_id?: number | null
          id?: number
          liderado_id?: number | null
          topicos?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_one_on_ones_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "pessoas_colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_one_on_ones_liderado_id_fkey"
            columns: ["liderado_id"]
            isOneToOne: false
            referencedRelation: "pessoas_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas_pdis: {
        Row: {
          atualizado_em: string | null
          colaborador_id: number | null
          criado_em: string
          descricao: string | null
          id: number
          prazo: string | null
          status: string
          titulo: string
        }
        Insert: {
          atualizado_em?: string | null
          colaborador_id?: number | null
          criado_em?: string
          descricao?: string | null
          id?: number
          prazo?: string | null
          status?: string
          titulo: string
        }
        Update: {
          atualizado_em?: string | null
          colaborador_id?: number | null
          criado_em?: string
          descricao?: string | null
          id?: number
          prazo?: string | null
          status?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_pdis_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "pessoas_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas_rotina_rua: {
        Row: {
          cliente: string | null
          colaborador_id: number | null
          criado_em: string
          data: string
          id: number
          local: string | null
          observacoes: string | null
        }
        Insert: {
          cliente?: string | null
          colaborador_id?: number | null
          criado_em?: string
          data?: string
          id?: number
          local?: string | null
          observacoes?: string | null
        }
        Update: {
          cliente?: string | null
          colaborador_id?: number | null
          criado_em?: string
          data?: string
          id?: number
          local?: string | null
          observacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_rotina_rua_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "pessoas_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      regras: {
        Row: {
          ativo: boolean
          config: Json
          criado_em: string
          descricao: string | null
          gera_tarefa: boolean
          id: number
          nome: string
          severidade: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          config?: Json
          criado_em?: string
          descricao?: string | null
          gera_tarefa?: boolean
          id?: number
          nome: string
          severidade?: string
          tipo?: string
        }
        Update: {
          ativo?: boolean
          config?: Json
          criado_em?: string
          descricao?: string | null
          gera_tarefa?: boolean
          id?: number
          nome?: string
          severidade?: string
          tipo?: string
        }
        Relationships: []
      }
      stone_rebate_imports: {
        Row: {
          arquivo_hash: string
          arquivo_nome: string
          conta_a_pagar_id: number | null
          created_at: string
          empresa_id: number | null
          id: number
          lancamento_id: number | null
          linhas_duplicadas: number
          linhas_erro: number
          linhas_ok: number
          mapeamento_json: Json | null
          mes_referencia: string | null
          observacao: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          status: string
          total_linhas: number
          usuario_id: number | null
          valor_total_rebate: number
        }
        Insert: {
          arquivo_hash: string
          arquivo_nome: string
          conta_a_pagar_id?: number | null
          created_at?: string
          empresa_id?: number | null
          id?: number
          lancamento_id?: number | null
          linhas_duplicadas?: number
          linhas_erro?: number
          linhas_ok?: number
          mapeamento_json?: Json | null
          mes_referencia?: string | null
          observacao?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string
          total_linhas?: number
          usuario_id?: number | null
          valor_total_rebate?: number
        }
        Update: {
          arquivo_hash?: string
          arquivo_nome?: string
          conta_a_pagar_id?: number | null
          created_at?: string
          empresa_id?: number | null
          id?: number
          lancamento_id?: number | null
          linhas_duplicadas?: number
          linhas_erro?: number
          linhas_ok?: number
          mapeamento_json?: Json | null
          mes_referencia?: string | null
          observacao?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string
          total_linhas?: number
          usuario_id?: number | null
          valor_total_rebate?: number
        }
        Relationships: [
          {
            foreignKeyName: "stone_rebate_imports_conta_a_pagar_id_fkey"
            columns: ["conta_a_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_a_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stone_rebate_imports_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stone_rebate_imports_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_dre"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "stone_rebate_imports_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stone_rebate_imports_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      stone_rebate_linhas: {
        Row: {
          aluguel: number | null
          antecipacao: number | null
          bandeira: string | null
          canal: string | null
          cidade: string | null
          created_at: string
          dados_originais_json: Json | null
          data_referencia: string | null
          documento: string | null
          erro_importacao: string | null
          id: number
          import_id: number | null
          linha_num: number
          mdr: number | null
          mes_referencia: string | null
          nome_cliente: string | null
          produto: string | null
          rebate_valor: number | null
          receita_bruta: number | null
          rota: string | null
          status_conciliacao: string | null
          stonecode: string | null
          tpv: number | null
        }
        Insert: {
          aluguel?: number | null
          antecipacao?: number | null
          bandeira?: string | null
          canal?: string | null
          cidade?: string | null
          created_at?: string
          dados_originais_json?: Json | null
          data_referencia?: string | null
          documento?: string | null
          erro_importacao?: string | null
          id?: number
          import_id?: number | null
          linha_num: number
          mdr?: number | null
          mes_referencia?: string | null
          nome_cliente?: string | null
          produto?: string | null
          rebate_valor?: number | null
          receita_bruta?: number | null
          rota?: string | null
          status_conciliacao?: string | null
          stonecode?: string | null
          tpv?: number | null
        }
        Update: {
          aluguel?: number | null
          antecipacao?: number | null
          bandeira?: string | null
          canal?: string | null
          cidade?: string | null
          created_at?: string
          dados_originais_json?: Json | null
          data_referencia?: string | null
          documento?: string | null
          erro_importacao?: string | null
          id?: number
          import_id?: number | null
          linha_num?: number
          mdr?: number | null
          mes_referencia?: string | null
          nome_cliente?: string | null
          produto?: string | null
          rebate_valor?: number | null
          receita_bruta?: number | null
          rota?: string | null
          status_conciliacao?: string | null
          stonecode?: string | null
          tpv?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stone_rebate_linhas_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "stone_rebate_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          alerta_id: number | null
          concluida_em: string | null
          criada_em: string
          criado_por: number | null
          dedupe_key: string | null
          descricao: string | null
          empresa_id: number | null
          entidade_id: string | null
          entidade_tipo: string | null
          id: number
          origem: string
          prazo: string | null
          prioridade: string
          responsavel_id: number | null
          status: string
          titulo: string
        }
        Insert: {
          alerta_id?: number | null
          concluida_em?: string | null
          criada_em?: string
          criado_por?: number | null
          dedupe_key?: string | null
          descricao?: string | null
          empresa_id?: number | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: number
          origem?: string
          prazo?: string | null
          prioridade?: string
          responsavel_id?: number | null
          status?: string
          titulo: string
        }
        Update: {
          alerta_id?: number | null
          concluida_em?: string | null
          criada_em?: string
          criado_por?: number | null
          dedupe_key?: string | null
          descricao?: string | null
          empresa_id?: number | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: number
          origem?: string
          prazo?: string | null
          prioridade?: string
          responsavel_id?: number | null
          status?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_alerta_id_fkey"
            columns: ["alerta_id"]
            isOneToOne: false
            referencedRelation: "alertas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_dre"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "unidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_dre"
            referencedColumns: ["empresa_id"]
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
            foreignKeyName: "usuario_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_dre"
            referencedColumns: ["empresa_id"]
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
      dre_consolidada: {
        Row: {
          empresa_id: number | null
          entra_dre: boolean | null
          entra_dre_operacional: boolean | null
          grupo: string | null
          mes_ref: string | null
          natureza_dre: string | null
          qtd_lancamentos: number | null
          tipo: string | null
          valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_dre"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      dre_operacional: {
        Row: {
          ano: number | null
          categoria: string | null
          empresa: string | null
          empresa_id: number | null
          grupo: string | null
          mes: number | null
          mes_ref: string | null
          natureza: string | null
          qtd_lancamentos: number | null
          valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_dre"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      pessoas_dashboard: {
        Row: {
          colaboradores_ativos: number | null
          okrs_em_andamento: number | null
          one_on_ones_30d: number | null
          pdis_abertos: number | null
          visitas_30d: number | null
        }
        Relationships: []
      }
      rebate_clientes_stone: {
        Row: {
          canal_venda: string | null
          cidade: string | null
          data_credenciamento: string | null
          empresa_id: number | null
          formato: string | null
          lucro_bruto: number | null
          mes_referencia: string | null
          nome_fantasia: string | null
          polo: string | null
          rec_adesao: number | null
          rec_banking: number | null
          rec_mdr: number | null
          rec_rav: number | null
          status: string | null
          stonecode: string | null
          tipo_vendedor: string | null
          tpv_estimado: number | null
          tpv_m0: number | null
          vendedor: string | null
          vendedor_canonico: string | null
        }
        Insert: {
          canal_venda?: string | null
          cidade?: string | null
          data_credenciamento?: never
          empresa_id?: never
          formato?: never
          lucro_bruto?: number | null
          mes_referencia?: never
          nome_fantasia?: string | null
          polo?: never
          rec_adesao?: never
          rec_banking?: never
          rec_mdr?: number | null
          rec_rav?: number | null
          status?: string | null
          stonecode?: never
          tipo_vendedor?: never
          tpv_estimado?: number | null
          tpv_m0?: number | null
          vendedor?: never
          vendedor_canonico?: never
        }
        Update: {
          canal_venda?: string | null
          cidade?: string | null
          data_credenciamento?: never
          empresa_id?: never
          formato?: never
          lucro_bruto?: number | null
          mes_referencia?: never
          nome_fantasia?: string | null
          polo?: never
          rec_adesao?: never
          rec_banking?: never
          rec_mdr?: number | null
          rec_rav?: number | null
          status?: string | null
          stonecode?: never
          tipo_vendedor?: never
          tpv_estimado?: number | null
          tpv_m0?: number | null
          vendedor?: never
          vendedor_canonico?: never
        }
        Relationships: []
      }
      v_cliente_lifetime: {
        Row: {
          cidade: string | null
          desde: string | null
          lucro_medio_mes: number | null
          lucro_total: number | null
          meses_ativo: number | null
          nome_fantasia: string | null
          provavel_churn: boolean | null
          stonecode: string | null
          total_adesao: number | null
          total_banking: number | null
          total_mdr: number | null
          total_rav: number | null
          tpv_total: number | null
          ultimo_mes: string | null
          vendedor_atual: string | null
        }
        Relationships: []
      }
      v_evolucao_mensal: {
        Row: {
          clientes_ativos: number | null
          lucro_bj7: number | null
          lucro_bruto: number | null
          lucro_stone_matriz: number | null
          mes_referencia: string | null
          rec_adesao: number | null
          rec_banking: number | null
          rec_mdr: number | null
          rec_rav: number | null
          tpv_m0: number | null
          vendedores_bj7_ativos: number | null
        }
        Relationships: []
      }
      v_ranking_vendedor: {
        Row: {
          ate: string | null
          clientes_unicos: number | null
          desde: string | null
          lucro_medio_por_cliente_mes: number | null
          lucro_total: number | null
          lucro_ult_6m: number | null
          meses_total: number | null
          tipo_vendedor: string | null
          vendedor_canonico: string | null
        }
        Relationships: []
      }
      v_resumo_dre: {
        Row: {
          ano: number | null
          despesa_nao_operacional: number | null
          despesa_operacional: number | null
          ebitda_operacional: number | null
          empresa: string | null
          empresa_id: number | null
          investimentos: number | null
          lucro_liquido_pre_capex: number | null
          movimentacao_patrimonial: number | null
          receita_operacional: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      concluir_tarefa: { Args: { _id: number }; Returns: undefined }
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
