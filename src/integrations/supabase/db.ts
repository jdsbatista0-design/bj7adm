/**
 * Wrappers around the untyped supabase client that return strongly-typed rows.
 * Use these in components instead of calling `supabase.from(...)` directly,
 * so the TS compiler can check field access.
 */
import { supabase } from "./client";
import type {
  EmpresaRow,
  UnidadeRow,
  CategoriaRow,
  LancamentoRow,
  NotaFiscalRow,
  ApuracaoRebateRow,
  EvolucaoBaseRow,
  ClienteSumidoRow,
  PapelRow,
  UsuarioRow,
  UsuarioEmpresaRow,
  ImportacaoRow,
} from "./database";

type RowMap = {
  empresas: EmpresaRow;
  unidades: UnidadeRow;
  categorias: CategoriaRow;
  lancamentos: LancamentoRow;
  notas_fiscais: NotaFiscalRow;
  apuracao_rebate: ApuracaoRebateRow;
  evolucao_base_clientes: EvolucaoBaseRow;
  clientes_sumidos: ClienteSumidoRow;
  papeis: PapelRow;
  usuarios: UsuarioRow;
  usuario_empresas: UsuarioEmpresaRow;
  importacoes: ImportacaoRow;
};

/** Strongly-typed `from()` — returns the raw query builder, you cast results. */
export function from<T extends keyof RowMap>(table: T) {
  return supabase.from(table as string);
}

/** Cast helper for select results. */
export function asRows<T extends keyof RowMap>(
  _table: T,
  data: unknown,
): RowMap[T][] {
  return (data ?? []) as RowMap[T][];
}

export function asRow<T extends keyof RowMap>(
  _table: T,
  data: unknown,
): RowMap[T] | null {
  return (data ?? null) as RowMap[T] | null;
}
