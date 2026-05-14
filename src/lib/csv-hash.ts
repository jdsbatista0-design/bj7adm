import md5 from "crypto-js/md5";

/**
 * Reproduz EXATAMENTE a fórmula de hash usada na carga inicial em Python:
 *
 *   texto = f"{arquivo_origem}|{aba_origem}|{linha_origem}|{data}|{valor}|{descricao}"
 *   hash_origem = md5(texto).hexdigest()
 *
 * Regras:
 * - Campos vazios (null/undefined) viram a string literal "None" (estilo Python).
 * - Data em formato ISO YYYY-MM-DD.
 * - Valor como número decimal (preserva ".0" se inteiro).
 * - MD5 hex de 32 caracteres, lowercase.
 */
export function gerarHashOrigem(input: {
  arquivo_origem: string | null | undefined;
  aba_origem: string | null | undefined;
  linha_origem: number | string | null | undefined;
  data: string | null | undefined;
  valor: number | string | null | undefined;
  descricao: string | null | undefined;
}): string {
  const partes = [
    pyRepr(input.arquivo_origem),
    pyRepr(input.aba_origem),
    pyReprNumber(input.linha_origem),
    pyRepr(input.data),
    pyReprFloat(input.valor),
    pyRepr(input.descricao),
  ];
  const texto = partes.join("|");
  return md5(texto).toString();
}

function pyRepr(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "None";
  return String(v);
}

function pyReprNumber(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "None";
  return String(v);
}

/** Reproduz `str(float)` do Python: inteiros viram "3700.0", decimais mantêm. */
function pyReprFloat(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "None";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "None";
  if (Number.isInteger(n)) return `${n}.0`;
  return String(n);
}
