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

/**
 * Pagina uma query do supabase-js em batches de 1000 linhas usando .range(),
 * concatenando todos os resultados. Necessário porque o PostgREST aplica um
 * cap silencioso por request (tipicamente 1000) mesmo passando .limit(N)
 * grande — sem isso, períodos longos no dashboard "somem".
 *
 * Uso:
 *   const rows = await paginateAll((from, to) =>
 *     supabase.from("lancamentos").select("...").gte("data", x).range(from, to),
 *   );
 */
export async function paginateAll<T>(
  build: (fromIdx: number, toIdx: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
  opts: { pageSize?: number; hardLimit?: number } = {},
): Promise<T[]> {
  const PAGE = opts.pageSize ?? 1000;
  const HARD = opts.hardLimit ?? 500_000;
  const acc: T[] = [];
  let offset = 0;
  while (true) {
    const r = await build(offset, offset + PAGE - 1);
    if (r.error) throw new Error(r.error.message);
    const batch = (r.data ?? []) as T[];
    acc.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
    if (offset > HARD) break;
  }
  return acc;
}

