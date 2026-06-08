import { supabase } from "@/integrations/supabase/client";
import type { ContaAPagarRow } from "@/integrations/supabase/database";

export type TipoLancContaPagar = "Despesa" | "Receita" | "Retirada" | "Empréstimo";

export type PagarContaInput = {
  dataPagamento: string; // yyyy-mm-dd
  valorPago: number;
  empresaId?: number | null;
  categoriaId?: number | null;
  tipo?: TipoLancContaPagar;
};

function parseObservacaoForma(obs: string | null): string | null {
  if (!obs) return null;
  const m = obs.match(/Pgto:\s*([^\n|]+)/i);
  return m ? m[1].trim() : null;
}

/** Lê o tipo do lançamento (Despesa/Receita/...) embutido na observação. */
export function parseTipoFromObs(obs: string | null): TipoLancContaPagar {
  if (!obs) return "Despesa";
  const m = obs.match(/Tipo:\s*(Despesa|Receita|Retirada|Empréstimo|Emprestimo)/i);
  if (!m) return "Despesa";
  const raw = m[1].toLowerCase();
  if (raw === "receita") return "Receita";
  if (raw === "retirada") return "Retirada";
  if (raw.startsWith("empr")) return "Empréstimo";
  return "Despesa";
}

function descricaoEnriquecida(conta: ContaAPagarRow): string {
  const forma = parseObservacaoForma(conta.observacao);
  const base = conta.descricao || "Pagamento";
  return forma ? `${base} (${forma})` : base;
}

/**
 * Marca a conta como paga E cria o Lançamento (Despesa) correspondente.
 * Grava o lancamento_id na conta para conciliação.
 *
 * Best-effort transacional client-side:
 *   1) insere lancamento
 *   2) atualiza conta (pago/data_pagamento/valor_pago/lancamento_id)
 *   3) se a atualização falhar, apaga o lancamento criado
 */
export async function pagarConta(conta: ContaAPagarRow, input: PagarContaInput) {
  const empresaId = input.empresaId ?? conta.empresa_id;
  if (!empresaId) {
    throw new Error("Esta conta não tem empresa. Edite a conta e informe a empresa antes de pagar.");
  }
  const categoriaId = input.categoriaId ?? conta.categoria_id;
  const data = input.dataPagamento;
  const valor = Number(input.valorPago);
  if (!data) throw new Error("Informe a data do pagamento");
  if (!isFinite(valor) || valor === 0) throw new Error("Informe o valor pago");

  const [y, m] = data.split("-").map(Number);

  // 1) cria lançamento
  const insLanc = await supabase
    .from("lancamentos")
    .insert({
      data,
      ano: y,
      mes: m,
      empresa_id: empresaId,
      categoria_id: categoriaId ?? null,
      tipo: "Despesa",
      descricao: descricaoEnriquecida(conta),
      valor,
      contar_no_total: true,
      origem_classificacao: "contas_a_pagar",
      revisado: false,
    })
    .select("id")
    .single();
  if (insLanc.error) throw insLanc.error;
  const lancId = (insLanc.data as { id: number }).id;

  // 2) atualiza conta
  const updConta = await supabase
    .from("contas_a_pagar")
    .update({
      pago: true,
      data_pagamento: data,
      valor_pago: valor,
      lancamento_id: lancId,
    })
    .eq("id", conta.id);

  if (updConta.error) {
    // rollback do lançamento
    await supabase.from("lancamentos").delete().eq("id", lancId);
    throw updConta.error;
  }

  return { lancamentoId: lancId };
}

/**
 * Desfaz o pagamento: apaga o lançamento vinculado e limpa flags da conta.
 */
export async function estornarPagamento(conta: ContaAPagarRow) {
  if (conta.lancamento_id) {
    const del = await supabase.from("lancamentos").delete().eq("id", conta.lancamento_id);
    if (del.error) throw del.error;
  }
  const upd = await supabase
    .from("contas_a_pagar")
    .update({
      pago: false,
      data_pagamento: null,
      valor_pago: null,
      lancamento_id: null,
    })
    .eq("id", conta.id);
  if (upd.error) throw upd.error;
}

/**
 * Sincroniza o lançamento espelhado quando uma conta paga é editada.
 * Se a conta não está paga / sem lançamento, é no-op.
 */
export async function sincronizarLancamentoDeConta(conta: ContaAPagarRow) {
  if (!conta.lancamento_id || !conta.pago || !conta.data_pagamento) return;
  const empresaId = conta.empresa_id;
  if (!empresaId) return;
  const data = conta.data_pagamento.slice(0, 10);
  const [y, m] = data.split("-").map(Number);
  const r = await supabase
    .from("lancamentos")
    .update({
      data,
      ano: y,
      mes: m,
      empresa_id: empresaId,
      categoria_id: conta.categoria_id,
      descricao: descricaoEnriquecida(conta),
      valor: Number(conta.valor_pago ?? conta.valor),
    })
    .eq("id", conta.lancamento_id);
  if (r.error) throw r.error;
}

/**
 * Exclui a conta E, se houver, o lançamento espelhado.
 */
export async function excluirConta(conta: ContaAPagarRow) {
  if (conta.lancamento_id) {
    await supabase.from("lancamentos").delete().eq("id", conta.lancamento_id);
  }
  const r = await supabase.from("contas_a_pagar").delete().eq("id", conta.id);
  if (r.error) throw r.error;
}
