import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/contexts/auth-context";
import { podeImportar } from "@/lib/permissions";
import { useEmpresas } from "@/hooks/use-refs";
import { toast } from "sonner";

import {
  hashFile,
  parseFile,
  validateRows,
  checkDuplicateImport,
  confirmImport,
  type Mapping,
  type ParseResult,
  type ValidatedRow,
  type CanonicalField,
} from "@/lib/stone-rebate";

import { PageShell } from "@/components/bj7/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/stone/importar-rebate")({
  component: ImportarRebatePage,
});

const FIELDS: { key: CanonicalField; label: string; required?: boolean }[] = [
  { key: "stonecode", label: "Stonecode", required: true },
  { key: "rebate_valor", label: "Rebate (valor)", required: true },
  { key: "mes_referencia", label: "Mês de referência", required: true },
  { key: "data_referencia", label: "Data referência" },
  { key: "nome_cliente", label: "Nome cliente" },
  { key: "documento", label: "Documento" },
  { key: "tpv", label: "TPV" },
  { key: "receita_bruta", label: "Receita bruta" },
  { key: "mdr", label: "MDR" },
  { key: "antecipacao", label: "Antecipação (RAV)" },
  { key: "aluguel", label: "Aluguel/Banking" },
  { key: "produto", label: "Produto" },
  { key: "bandeira", label: "Bandeira" },
  { key: "canal", label: "Canal" },
  { key: "cidade", label: "Cidade" },
  { key: "rota", label: "Rota" },
];

function brl(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function lastDayOfMonth(iso: string): string {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  const d = new Date(y, m, 0);
  return d.toISOString().slice(0, 10);
}

function ImportarRebatePage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  useEffect(() => {
    if (!podeImportar(user)) void navigate({ to: "/" });
  }, [user, navigate]);

  const empresasQ = useEmpresas();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<string>("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [vencimento, setVencimento] = useState<string>("");
  const [observacao, setObservacao] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // ===== Step 1: upload =====
  async function handleFile(f: File) {
    setLoading(true);
    try {
      const h = await hashFile(f);
      const dup = await checkDuplicateImport(h);
      if (dup) {
        toast.error(`Arquivo já importado em ${new Date(dup.created_at).toLocaleString("pt-BR")} (#${dup.id})`);
        return;
      }
      const p = await parseFile(f);
      if (p.rows.length === 0) {
        toast.error("Planilha vazia");
        return;
      }
      setFile(f);
      setHash(h);
      setParsed(p);
      setMapping(p.autoMapping);
      setStep(2);
    } catch (e) {
      toast.error("Falha ao ler arquivo: " + ((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  }

  // ===== Step 2/3 validation =====
  const validation = useMemo(() => {
    if (!parsed) return null;
    return validateRows(parsed.rows, mapping);
  }, [parsed, mapping]);

  // Auto-set vencimento default = último dia do mês
  useEffect(() => {
    if (validation?.mesReferencia && !vencimento) {
      setVencimento(lastDayOfMonth(validation.mesReferencia));
    }
  }, [validation, vencimento]);

  const missingRequired = useMemo(() => {
    return FIELDS.filter((f) => f.required && !mapping[f.key]);
  }, [mapping]);

  async function handleConfirm() {
    if (!file || !parsed || !validation) return;
    if (!empresaId) {
      toast.error("Escolha a empresa de destino");
      return;
    }
    if (!vencimento) {
      toast.error("Informe o vencimento");
      return;
    }
    if (validation.okCount === 0) {
      toast.error("Nenhuma linha válida para importar");
      return;
    }
    setLoading(true);
    try {
      const result = await confirmImport({
        file,
        hash,
        mapping,
        validated: validation.valid,
        totalRebate: validation.totalRebate,
        mesReferencia: validation.mesReferencia,
        empresaId,
        usuarioId: user.id,
        vencimentoContaAReceber: vencimento,
        observacao: observacao || undefined,
      });
      toast.success(`Importação #${result.id} concluída — conta a receber criada`);
      void navigate({ to: "/stone/importacoes" });
    } catch (e) {
      toast.error("Erro na importação: " + ((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  }

  if (!podeImportar(user)) return null;

  return (
    <PageShell
      title="Importar Rebate Stone"
      subtitle="Envie o arquivo de rebate (.xlsx ou .csv). O sistema cria 1 conta a receber e, ao ser marcada como recebida, vira receita no DRE."
    >
      <div className="space-y-4">
        {/* Stepper */}
        <div className="flex items-center gap-2 text-sm">
          {[
            { n: 1, label: "Upload" },
            { n: 2, label: "Mapeamento" },
            { n: 3, label: "Confirmação" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium border ${
                  step === s.n
                    ? "bg-primary text-primary-foreground border-primary"
                    : step > s.n
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {step > s.n ? "✓" : s.n}
              </div>
              <span className={step === s.n ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
              {i < 2 && <div className="w-8 h-px bg-border mx-1" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Escolha o arquivo</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:bg-muted/30 transition">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Clique para escolher um .xlsx, .xls ou .csv
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                  disabled={loading}
                />
                {loading && (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Processando...
                  </span>
                )}
              </label>
              <p className="text-xs text-muted-foreground mt-3">
                O arquivo é validado contra importações anteriores (hash SHA-256) para evitar duplicação.
              </p>
            </CardContent>
          </Card>
        )}

        {step === 2 && parsed && validation && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> {file?.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {parsed.rows.length.toLocaleString("pt-BR")} linhas · {parsed.headers.length} colunas detectadas
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setStep(1); setFile(null); setParsed(null); }}>
                Trocar arquivo
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Mapeamento de colunas</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Detectamos as colunas automaticamente. Ajuste se necessário. Campos marcados são obrigatórios.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {FIELDS.map((f) => (
                    <div key={f.key} className="flex items-center gap-2">
                      <Label className="text-xs w-40 shrink-0">
                        {f.label}
                        {f.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      <Select
                        value={mapping[f.key] ?? "__none__"}
                        onValueChange={(v) =>
                          setMapping((p) => ({ ...p, [f.key]: v === "__none__" ? undefined : v }))
                        }
                      >
                        <SelectTrigger className="h-8 flex-1">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— ignorar —</SelectItem>
                          {parsed.headers.map((h) => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat label="Total" value={validation.total.toLocaleString("pt-BR")} />
                <Stat label="OK" value={validation.okCount.toLocaleString("pt-BR")} tone="ok" />
                <Stat label="Duplicadas" value={validation.dupCount.toLocaleString("pt-BR")} tone="warn" />
                <Stat label="Com erro" value={validation.errCount.toLocaleString("pt-BR")} tone="err" />
              </div>

              <div className="flex justify-between items-center">
                <div className="text-xs text-muted-foreground">
                  Mês detectado:{" "}
                  <span className="font-medium text-foreground">
                    {validation.mesReferencia ? validation.mesReferencia.slice(0, 7) : "—"}
                  </span>
                  {" · "}Rebate total OK:{" "}
                  <span className="font-medium text-foreground tabular-nums">{brl(validation.totalRebate)}</span>
                </div>
                <Button
                  disabled={missingRequired.length > 0 || validation.okCount === 0}
                  onClick={() => setStep(3)}
                >
                  Continuar
                </Button>
              </div>
              {missingRequired.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Mapeie: {missingRequired.map((f) => f.label).join(", ")}
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium mb-2">Pré-visualização (primeiras 20)</h3>
                <div className="overflow-x-auto border border-border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">#</TableHead>
                        <TableHead>Stonecode</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Mês</TableHead>
                        <TableHead className="text-right">Rebate</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validation.valid.slice(0, 20).map((v) => (
                        <TableRow key={v.linha_num} className={v.status === "erro" ? "bg-destructive/5" : v.status === "duplicada" ? "bg-amber-500/5" : ""}>
                          <TableCell className="text-xs text-muted-foreground">{v.linha_num}</TableCell>
                          <TableCell className="text-xs">{v.stonecode ?? "—"}</TableCell>
                          <TableCell className="text-xs truncate max-w-[200px]">{v.nome_cliente ?? "—"}</TableCell>
                          <TableCell className="text-xs">{v.mes_referencia?.slice(0, 7) ?? "—"}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{brl(v.rebate_valor)}</TableCell>
                          <TableCell>
                            {v.status === "ok" ? (
                              <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">ok</Badge>
                            ) : v.status === "duplicada" ? (
                              <Badge variant="outline" className="border-amber-500/40 text-amber-300" title={v.erro ?? ""}>dup</Badge>
                            ) : (
                              <Badge variant="outline" className="border-destructive/40 text-destructive" title={v.erro ?? ""}>erro</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && validation && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Confirmação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat label="Linhas OK" value={validation.okCount.toLocaleString("pt-BR")} tone="ok" />
                <Stat label="Duplicadas" value={validation.dupCount.toLocaleString("pt-BR")} tone="warn" />
                <Stat label="Erros" value={validation.errCount.toLocaleString("pt-BR")} tone="err" />
                <Stat label="Total rebate" value={brl(validation.totalRebate)} tone="ok" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Empresa de destino</Label>
                  <Select
                    value={empresaId ? String(empresaId) : ""}
                    onValueChange={(v) => setEmpresaId(Number(v))}
                  >
                    <SelectTrigger><SelectValue placeholder="Escolha a empresa" /></SelectTrigger>
                    <SelectContent>
                      {(empresasQ.data ?? []).map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Vencimento da conta a receber</Label>
                  <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Observação (opcional)</Label>
                <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Notas internas sobre essa importação" />
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
                <div className="font-medium flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Resumo do que será feito</div>
                <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                  <li>Gravar {validation.valid.length} linhas em <code>stone_rebate_linhas</code> (incluindo erros para auditoria)</li>
                  <li>Atualizar {validation.okCount} clientes em <code>rebate_clientes_stone</code> (upsert por stonecode + mês)</li>
                  <li>Criar 1 conta a receber de <strong>{brl(validation.totalRebate)}</strong> com vencimento em {vencimento || "—"}</li>
                  <li>Quando essa conta for marcada como recebida → vira lançamento de Receita no DRE</li>
                </ul>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}>Voltar</Button>
                <Button onClick={handleConfirm} disabled={loading || !empresaId || !vencimento}>
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</> : "Confirmar e importar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-xs text-muted-foreground">
          <Link to="/stone/importacoes" className="underline">Ver histórico de importações</Link>
        </div>
      </div>
    </PageShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "err" }) {
  const cls =
    tone === "ok" ? "border-emerald-500/30 text-emerald-300"
    : tone === "warn" ? "border-amber-500/30 text-amber-300"
    : tone === "err" ? "border-destructive/30 text-destructive"
    : "border-border";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
