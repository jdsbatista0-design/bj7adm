import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type {
  StoneRebateImportRow,
  StoneRebateLinhaRow,
} from "@/integrations/supabase/database";

const RECORRENCIA_DB_FALLBACKS = ["unica", "mensal", "anual", "MENSAL", "UNICA", "ANUAL", "ÚNICA", "unico", "UNICO", "nenhuma", "NENHUMA"];
function isRecorrenciaDbError(error: unknown) {
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : String(error ?? "");
  return message.toLowerCase().includes("recorrencia");
}

// ---------- Tipos ----------
export type CanonicalField =
  | "stonecode"
  | "documento"
  | "nome_cliente"
  | "data_referencia"
  | "mes_referencia"
  | "tpv"
  | "receita_bruta"
  | "rebate_valor"
  | "mdr"
  | "antecipacao"
  | "aluguel"
  | "produto"
  | "bandeira"
  | "canal"
  | "cidade"
  | "rota";

export type Mapping = Partial<Record<CanonicalField, string>>;

export interface ParsedRow {
  linha_num: number;
  raw: Record<string, unknown>;
}

export interface ValidatedRow {
  linha_num: number;
  raw: Record<string, unknown>;
  stonecode: string | null;
  documento: string | null;
  nome_cliente: string | null;
  data_referencia: string | null;
  mes_referencia: string | null;
  tpv: number | null;
  receita_bruta: number | null;
  rebate_valor: number | null;
  mdr: number | null;
  antecipacao: number | null;
  aluguel: number | null;
  produto: string | null;
  bandeira: string | null;
  canal: string | null;
  cidade: string | null;
  rota: string | null;
  status: "ok" | "erro" | "duplicada";
  erro: string | null;
}

export interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  autoMapping: Mapping;
}

// ---------- Sinônimos para auto-detecção ----------
const SYNONYMS: Record<CanonicalField, string[]> = {
  stonecode: ["stonecode", "stone code", "código stone", "codigo stone", "stone_code", "merchant id", "merchant_id", "id stone"],
  documento: ["documento", "cnpj", "cpf", "cpf/cnpj", "doc"],
  nome_cliente: ["nome fantasia", "razão social", "razao social", "nome cliente", "cliente", "nome"],
  data_referencia: ["data", "data referencia", "data referência", "data ref", "date"],
  mes_referencia: ["mês referência", "mes referencia", "mês ref", "mes ref", "competência", "competencia", "mês", "mes"],
  tpv: ["tpv", "tpv m0", "tpv estimado", "volume", "faturamento bruto"],
  receita_bruta: ["receita bruta", "receita", "rec bruta"],
  rebate_valor: ["rebate", "rebate valor", "valor rebate", "comissão", "comissao", "rebate_lb", "rebate lb"],
  mdr: ["mdr", "rec mdr", "rec_mdr"],
  antecipacao: ["rav", "antecipação", "antecipacao", "rec rav", "rec_rav"],
  aluguel: ["aluguel", "rec banking", "banking"],
  produto: ["produto"],
  bandeira: ["bandeira"],
  canal: ["canal", "canal venda", "canal_venda"],
  cidade: ["cidade"],
  rota: ["rota", "polo"],
};

function norm(s: string): string {
  return s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function autoMap(headers: string[]): Mapping {
  const result: Mapping = {};
  const normHeaders = headers.map((h) => ({ raw: h, n: norm(h) }));
  for (const field of Object.keys(SYNONYMS) as CanonicalField[]) {
    const syns = SYNONYMS[field].map(norm);
    const hit = normHeaders.find((h) => syns.includes(h.n));
    if (hit) result[field] = hit.raw;
  }
  return result;
}

// ---------- Hash do arquivo ----------
export async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- Parsing ----------
export async function parseFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });
  const headers =
    json.length > 0 ? Object.keys(json[0]) : [];
  const rows: ParsedRow[] = json.map((raw, i) => ({
    linha_num: i + 2, // +2 = 1 header + 1 base
    raw,
  }));
  return { headers, rows, autoMapping: autoMap(headers) };
}

// ---------- Conversões ----------
function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  // remove currency / spaces
  s = s.replace(/[R$\s]/g, "");
  // pt-BR: 1.234,56 → 1234.56
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(s);
  return isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function toIsoDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  // yyyy-mm-dd already
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // mm/yyyy → 1st day
  const m2 = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[2]}-${m2[1].padStart(2, "0")}-01`;
  // yyyy-mm
  const m3 = s.match(/^(\d{4})-(\d{2})$/);
  if (m3) return `${s}-01`;
  return null;
}

function toMonthFirstDay(v: unknown): string | null {
  const d = toIsoDate(v);
  if (!d) return null;
  return `${d.slice(0, 7)}-01`;
}

// ---------- Validação ----------
export function validateRows(
  rows: ParsedRow[],
  mapping: Mapping,
): { valid: ValidatedRow[]; total: number; okCount: number; errCount: number; dupCount: number; totalRebate: number; mesReferencia: string | null } {
  const get = (raw: Record<string, unknown>, f: CanonicalField) =>
    mapping[f] ? raw[mapping[f]!] : null;

  const seen = new Set<string>();
  const valid: ValidatedRow[] = [];
  let totalRebate = 0;
  let okCount = 0,
    errCount = 0,
    dupCount = 0;
  const mesesSet = new Set<string>();

  for (const r of rows) {
    const stonecode = toStr(get(r.raw, "stonecode"));
    const rebate = toNumber(get(r.raw, "rebate_valor"));
    const mes = toMonthFirstDay(get(r.raw, "mes_referencia") ?? get(r.raw, "data_referencia"));
    const data = toIsoDate(get(r.raw, "data_referencia"));

    let status: "ok" | "erro" | "duplicada" = "ok";
    let erro: string | null = null;

    if (!stonecode) {
      status = "erro";
      erro = "Stonecode ausente";
    } else if (rebate == null) {
      status = "erro";
      erro = "Valor de rebate inválido";
    } else if (!mes) {
      status = "erro";
      erro = "Mês de referência inválido";
    } else {
      const key = `${stonecode}|${mes}`;
      if (seen.has(key)) {
        status = "duplicada";
        erro = "Duplicada no arquivo";
      } else {
        seen.add(key);
      }
    }

    if (status === "ok") {
      okCount++;
      totalRebate += rebate ?? 0;
      if (mes) mesesSet.add(mes);
    } else if (status === "duplicada") dupCount++;
    else errCount++;

    valid.push({
      linha_num: r.linha_num,
      raw: r.raw,
      stonecode,
      documento: toStr(get(r.raw, "documento")),
      nome_cliente: toStr(get(r.raw, "nome_cliente")),
      data_referencia: data,
      mes_referencia: mes,
      tpv: toNumber(get(r.raw, "tpv")),
      receita_bruta: toNumber(get(r.raw, "receita_bruta")),
      rebate_valor: rebate,
      mdr: toNumber(get(r.raw, "mdr")),
      antecipacao: toNumber(get(r.raw, "antecipacao")),
      aluguel: toNumber(get(r.raw, "aluguel")),
      produto: toStr(get(r.raw, "produto")),
      bandeira: toStr(get(r.raw, "bandeira")),
      canal: toStr(get(r.raw, "canal")),
      cidade: toStr(get(r.raw, "cidade")),
      rota: toStr(get(r.raw, "rota")),
      status,
      erro,
    });
  }

  // Mês de referência majoritário
  let mesRef: string | null = null;
  if (mesesSet.size > 0) {
    const counts = new Map<string, number>();
    for (const v of valid) {
      if (v.mes_referencia) counts.set(v.mes_referencia, (counts.get(v.mes_referencia) ?? 0) + 1);
    }
    mesRef = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  return {
    valid,
    total: rows.length,
    okCount,
    errCount,
    dupCount,
    totalRebate,
    mesReferencia: mesRef,
  };
}

// ---------- Persistência ----------
export interface ConfirmImportInput {
  file: File;
  hash: string;
  mapping: Mapping;
  validated: ValidatedRow[];
  totalRebate: number;
  mesReferencia: string | null;
  empresaId: number;
  usuarioId: number | null;
  vencimentoContaAReceber: string; // yyyy-mm-dd
  observacao?: string;
}

const CATEGORIA_REBATE_NOME = "Receita Stone - Rebate";

async function getOrCreateCategoriaRebate(): Promise<number> {
  const q = await supabase
    .from("categorias")
    .select("id")
    .eq("nome", CATEGORIA_REBATE_NOME)
    .maybeSingle();
  if (q.error) throw q.error;
  if (q.data) return (q.data as { id: number }).id;
  const ins = await supabase
    .from("categorias")
    .insert({ nome: CATEGORIA_REBATE_NOME, tipo_predominante: "Receita", grupo: "Receita Operacional" })
    .select("id")
    .single();
  if (ins.error) throw ins.error;
  return (ins.data as { id: number }).id;
}

function mesLabel(iso: string | null): string {
  if (!iso) return "—";
  const [y, m] = iso.slice(0, 7).split("-");
  return `${m}/${y}`;
}

export async function checkDuplicateImport(hash: string): Promise<StoneRebateImportRow | null> {
  const r = await supabase
    .from("stone_rebate_imports")
    .select("*")
    .eq("arquivo_hash", hash)
    .neq("status", "revertido")
    .maybeSingle();
  if (r.error) throw r.error;
  return (r.data as StoneRebateImportRow | null) ?? null;
}

export async function confirmImport(input: ConfirmImportInput): Promise<StoneRebateImportRow> {
  const okRows = input.validated.filter((v) => v.status === "ok");
  const erroRows = input.validated.filter((v) => v.status === "erro");
  const dupRows = input.validated.filter((v) => v.status === "duplicada");

  // 1) header
  const headerIns = await supabase
    .from("stone_rebate_imports")
    .insert({
      arquivo_nome: input.file.name,
      arquivo_hash: input.hash,
      usuario_id: input.usuarioId,
      empresa_id: input.empresaId,
      mes_referencia: input.mesReferencia,
      periodo_inicio: input.mesReferencia,
      periodo_fim: input.mesReferencia,
      status: "importado",
      total_linhas: input.validated.length,
      linhas_ok: okRows.length,
      linhas_erro: erroRows.length,
      linhas_duplicadas: dupRows.length,
      valor_total_rebate: input.totalRebate,
      observacao: input.observacao ?? null,
      mapeamento_json: input.mapping,
    })
    .select("*")
    .single();
  if (headerIns.error) throw headerIns.error;
  const header = headerIns.data as StoneRebateImportRow;

  try {
    // 2) linhas (chunks de 500)
    const linhasPayload = input.validated.map((v) => ({
      import_id: header.id,
      linha_num: v.linha_num,
      stonecode: v.stonecode,
      documento: v.documento,
      nome_cliente: v.nome_cliente,
      data_referencia: v.data_referencia,
      mes_referencia: v.mes_referencia,
      tpv: v.tpv,
      receita_bruta: v.receita_bruta,
      rebate_valor: v.rebate_valor,
      mdr: v.mdr,
      antecipacao: v.antecipacao,
      aluguel: v.aluguel,
      produto: v.produto,
      bandeira: v.bandeira,
      canal: v.canal,
      cidade: v.cidade,
      rota: v.rota,
      status_conciliacao: v.status,
      erro_importacao: v.erro,
      dados_originais_json: v.raw as Record<string, unknown>,
    }));
    for (let i = 0; i < linhasPayload.length; i += 500) {
      const chunk = linhasPayload.slice(i, i + 500);
      const r = await supabase.from("stone_rebate_linhas").insert(chunk);
      if (r.error) throw r.error;
    }

    // 3) upsert rebate_clientes_stone (apenas linhas OK; gravamos lucro_bruto = rebate_valor)
    if (okRows.length > 0) {
      const upsertPayload = okRows.map((v) => ({
        empresa_id: input.empresaId,
        mes_referencia: v.mes_referencia!,
        stonecode: v.stonecode!,
        nome_fantasia: v.nome_cliente,
        cidade: v.cidade,
        canal_venda: v.canal,
        tpv_estimado: v.tpv,
        tpv_m0: v.tpv,
        rec_mdr: v.mdr,
        rec_rav: v.antecipacao,
        rec_banking: v.aluguel,
        lucro_bruto: v.rebate_valor,
      }));
      for (let i = 0; i < upsertPayload.length; i += 500) {
        const chunk = upsertPayload.slice(i, i + 500);
        const r = await supabase
          .from("rebate_clientes_stone")
          .upsert(chunk, { onConflict: "stonecode,mes_referencia" });
        if (r.error) throw r.error;
      }
    }

    // 4) conta a receber (1 por importação)
    const categoriaId = await getOrCreateCategoriaRebate();
    let contaId: number | null = null;
    let contaLastError: unknown = null;
    for (const recorrencia of RECORRENCIA_DB_FALLBACKS) {
      const contaIns = await supabase
        .from("contas_a_pagar")
        .insert({
        descricao: `Rebate Stone — ${mesLabel(input.mesReferencia)} (${input.file.name})`,
        valor: input.totalRebate,
        vencimento: input.vencimentoContaAReceber,
        empresa_id: input.empresaId,
        categoria_id: categoriaId,
        recorrencia,
        pago: false,
        observacao: `Tipo: Receita | Origem: stone_rebate | import_id: ${header.id}`,
        })
        .select("id")
        .single();
      if (!contaIns.error) {
        contaId = (contaIns.data as { id: number }).id;
        break;
      }
      if (!isRecorrenciaDbError(contaIns.error)) throw contaIns.error;
      contaLastError = contaIns.error;
    }
    if (!contaId) throw contaLastError instanceof Error ? contaLastError : new Error("Não foi possível criar a conta a receber do rebate.");

    // 5) link no header
    const upd = await supabase
      .from("stone_rebate_imports")
      .update({ conta_a_pagar_id: contaId })
      .eq("id", header.id);
    if (upd.error) throw upd.error;

    return { ...header, conta_a_pagar_id: contaId };
  } catch (e) {
    // Rollback best-effort
    await supabase.from("stone_rebate_imports").update({ status: "erro" }).eq("id", header.id);
    throw e;
  }
}

// ---------- Reversão ----------
export async function reverterImport(importId: number): Promise<void> {
  const headerQ = await supabase
    .from("stone_rebate_imports")
    .select("*")
    .eq("id", importId)
    .single();
  if (headerQ.error) throw headerQ.error;
  const h = headerQ.data as StoneRebateImportRow;

  // 1) deletar lançamento (se já houver, vindo da conta a pagar marcada como paga)
  // O lançamento real fica em contas_a_pagar.lancamento_id; pegamos via conta.
  if (h.conta_a_pagar_id) {
    const contaQ = await supabase
      .from("contas_a_pagar")
      .select("id, lancamento_id")
      .eq("id", h.conta_a_pagar_id)
      .maybeSingle();
    if (!contaQ.error && contaQ.data) {
      const lancId = (contaQ.data as { lancamento_id: number | null }).lancamento_id;
      if (lancId) {
        await supabase.from("lancamentos").delete().eq("id", lancId);
      }
      await supabase.from("contas_a_pagar").delete().eq("id", h.conta_a_pagar_id);
    }
  }

  // 2) deletar dados em rebate_clientes_stone vinculados a este import
  //    (identificamos pelas linhas — stonecode + mes_referencia)
  const linhasQ = await supabase
    .from("stone_rebate_linhas")
    .select("stonecode, mes_referencia, status_conciliacao")
    .eq("import_id", importId);
  if (!linhasQ.error && linhasQ.data) {
    const okLinhas = (linhasQ.data as Array<{ stonecode: string | null; mes_referencia: string | null; status_conciliacao: string }>).filter(
      (l) => l.status_conciliacao === "ok" && l.stonecode && l.mes_referencia,
    );
    // batch delete por mes_referencia (uma chamada por mês)
    const byMes = new Map<string, string[]>();
    for (const l of okLinhas) {
      const arr = byMes.get(l.mes_referencia!) ?? [];
      arr.push(l.stonecode!);
      byMes.set(l.mes_referencia!, arr);
    }
    for (const [mes, codes] of byMes) {
      await supabase
        .from("rebate_clientes_stone")
        .delete()
        .eq("mes_referencia", mes)
        .in("stonecode", codes);
    }
  }

  // 3) deletar linhas (CASCADE também faria, mas explícito)
  await supabase.from("stone_rebate_linhas").delete().eq("import_id", importId);

  // 4) marcar header como revertido
  const upd = await supabase
    .from("stone_rebate_imports")
    .update({ status: "revertido", conta_a_pagar_id: null, lancamento_id: null })
    .eq("id", importId);
  if (upd.error) throw upd.error;
}

export async function listImports(): Promise<StoneRebateImportRow[]> {
  const r = await supabase
    .from("stone_rebate_imports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (r.error) throw r.error;
  return (r.data ?? []) as StoneRebateImportRow[];
}

export async function listLinhas(importId: number): Promise<StoneRebateLinhaRow[]> {
  const r = await supabase
    .from("stone_rebate_linhas")
    .select("*")
    .eq("import_id", importId)
    .order("linha_num");
  if (r.error) throw r.error;
  return (r.data ?? []) as StoneRebateLinhaRow[];
}
