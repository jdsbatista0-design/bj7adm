import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ContaAPagarRow } from "@/integrations/supabase/database";
import { useEmpresas, useCategorias } from "@/hooks/use-refs";
import { toast } from "sonner";
import { pagarConta, estornarPagamento, sincronizarLancamentoDeConta, parseTipoFromObs, type TipoLancContaPagar } from "@/lib/contas-a-pagar";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertCircle, CalendarClock, Repeat2, Wallet, CheckCircle2 } from "lucide-react";

type FrequenciaPreset =
  | "unica"
  | "semanal"
  | "quinzenal"
  | "mensal"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual";

type Modo = "repetir" | "parcelado";

const FREQ_PRESETS: { value: FrequenciaPreset; label: string; meses?: number; dias?: number }[] = [
  { value: "unica", label: "Única" },
  { value: "semanal", label: "Semanal", dias: 7 },
  { value: "quinzenal", label: "Quinzenal", dias: 15 },
  { value: "mensal", label: "Mensal", meses: 1 },
  { value: "bimestral", label: "Bimestral", meses: 2 },
  { value: "trimestral", label: "Trimestral", meses: 3 },
  { value: "semestral", label: "Semestral", meses: 6 },
  { value: "anual", label: "Anual", meses: 12 },
];

const FORMAS_PGTO = ["Boleto", "Pix", "Cartão", "Débito", "Dinheiro", "Transferência"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function addMonths(iso: string, months: number) {
  const d = new Date(iso + "T00:00:00");
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  // proteção contra "31 fev"
  if (d.getMonth() !== ((targetMonth % 12) + 12) % 12) d.setDate(0);
  return d.toISOString().slice(0, 10);
}
function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function parseValor(s: string) {
  if (!s) return 0;
  // aceita "1.234,56" ou "1234.56"
  const norm = s.replace(/\./g, "").replace(",", ".");
  const n = Number(norm);
  return isFinite(n) ? n : 0;
}
function formatDateBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function ContaAPagarDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: ContaAPagarRow | null;
  onSaved: () => void;
}) {
  const empresas = useEmpresas();
  const categorias = useCategorias();
  const isEdit = !!editing;

  // Campos
  const [tipo, setTipo] = useState<TipoLancContaPagar>("Despesa");
  const [descricao, setDescricao] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(todayIso());
  const [empresaId, setEmpresaId] = useState("0");
  const [categoriaId, setCategoriaId] = useState("0");
  const [formaPgto, setFormaPgto] = useState<string>("");
  const [observacao, setObservacao] = useState("");

  // Recorrência
  const [freq, setFreq] = useState<FrequenciaPreset>("unica");
  const [parcelas, setParcelas] = useState<number>(1);
  const [modo, setModo] = useState<Modo>("repetir");

  // Já pago
  const [jaPago, setJaPago] = useState(false);
  const [dataPgto, setDataPgto] = useState(todayIso());

  useEffect(() => {
    if (!open) return;
    if (editing) {
      // tentar extrair fornecedor/forma/tipo da observação
      const obs = editing.observacao ?? "";
      const fMatch = obs.match(/Fornecedor:\s*([^\n|]+)/i);
      const pMatch = obs.match(/Pgto:\s*([^\n|]+)/i);
      setTipo(parseTipoFromObs(obs));
      setDescricao(editing.descricao);
      setFornecedor(fMatch?.[1].trim() ?? "");
      setFormaPgto(pMatch?.[1].trim() ?? "");
      setValor(String(editing.valor).replace(".", ","));
      setVencimento(editing.vencimento.slice(0, 10));
      setEmpresaId(editing.empresa_id ? String(editing.empresa_id) : "0");
      setCategoriaId(editing.categoria_id ? String(editing.categoria_id) : "0");
      setObservacao(
        obs
          .replace(/Tipo:[^|\n]*\|?\s*/i, "")
          .replace(/Fornecedor:[^|\n]*\|?\s*/i, "")
          .replace(/Pgto:[^|\n]*\|?\s*/i, "")
          .trim(),
      );
      setFreq((editing.recorrencia as FrequenciaPreset) ?? "unica");
      setParcelas(1);
      setModo("repetir");
      setJaPago(editing.pago);
      setDataPgto(editing.data_pagamento?.slice(0, 10) ?? todayIso());
    } else {
      setTipo("Despesa");
      setDescricao("");
      setFornecedor("");
      setValor("");
      setVencimento(todayIso());
      setEmpresaId("0");
      setCategoriaId("0");
      setFormaPgto("");
      setObservacao("");
      setFreq("unica");
      setParcelas(1);
      setModo("repetir");
      setJaPago(false);
      setDataPgto(todayIso());
    }
  }, [open, editing]);

  // Ordena categorias coerentes com o tipo selecionado primeiro
  const categoriasOrdenadas = useMemo(() => {
    const list = categorias.data ?? [];
    const match = (tp: string | null) => {
      const t = (tp ?? "").toLowerCase();
      if (tipo === "Despesa") return t.includes("desp");
      if (tipo === "Receita") return t.includes("rec");
      if (tipo === "Retirada") return t.includes("retir");
      if (tipo === "Empréstimo") return t.includes("empr");
      return false;
    };
    return [...list].sort((a, b) => {
      const da = match(a.tipo_predominante) ? 0 : 1;
      const db = match(b.tipo_predominante) ? 0 : 1;
      if (da !== db) return da - db;
      return a.nome.localeCompare(b.nome);
    });
  }, [categorias.data, tipo]);

  // Gera as datas das parcelas (preview)
  const parcelasGeradas = useMemo(() => {
    const preset = FREQ_PRESETS.find(p => p.value === freq)!;
    const n = freq === "unica" ? 1 : Math.max(1, Math.min(120, parcelas || 1));
    const arr: string[] = [];
    for (let i = 0; i < n; i++) {
      if (preset.meses) arr.push(addMonths(vencimento, preset.meses * i));
      else if (preset.dias) arr.push(addDays(vencimento, preset.dias * i));
      else arr.push(vencimento);
    }
    return arr;
  }, [freq, parcelas, vencimento]);

  const valorNum = parseValor(valor);
  const valorPorParcela =
    freq === "unica" || parcelasGeradas.length <= 1
      ? valorNum
      : modo === "parcelado"
      ? Math.round((valorNum / parcelasGeradas.length) * 100) / 100
      : valorNum;
  const valorTotal =
    freq === "unica" || parcelasGeradas.length <= 1
      ? valorNum
      : modo === "parcelado"
      ? valorNum
      : valorNum * parcelasGeradas.length;

  // Atalhos de vencimento
  const atalhosVenc = [
    { label: "Hoje", iso: todayIso() },
    { label: "+7d", iso: addDays(todayIso(), 7) },
    { label: "+15d", iso: addDays(todayIso(), 15) },
    { label: "+30d", iso: addDays(todayIso(), 30) },
    { label: "Próx. mês", iso: addMonths(todayIso(), 1) },
  ];

  const erros: string[] = [];
  if (open) {
    if (!descricao.trim()) erros.push("Informe a descrição");
    if (!valorNum) erros.push("Informe o valor");
    if (!vencimento) erros.push("Informe o vencimento");
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!descricao.trim() || !valorNum || !vencimento) {
        throw new Error("Preencha descrição, valor e vencimento");
      }
      if (jaPago && empresaId === "0") {
        throw new Error("Para confirmar é preciso informar a empresa (vai virar Lançamento)");
      }

      const obsExtra = [
        `Tipo: ${tipo}`,
        fornecedor.trim() && `${tipo === "Receita" ? "Pagador" : "Fornecedor"}: ${fornecedor.trim()}`,
        formaPgto && `Pgto: ${formaPgto}`,
        observacao.trim(),
      ].filter(Boolean).join(" | ");

      const base = {
        descricao: descricao.trim(),
        empresa_id: empresaId !== "0" ? Number(empresaId) : null,
        categoria_id: categoriaId !== "0" ? Number(categoriaId) : null,
        observacao: obsExtra || null,
      };

      if (isEdit && editing) {
        // 1) atualiza campos básicos da conta
        const r = await supabase.from("contas_a_pagar").update({
          ...base,
          valor: valorNum,
          vencimento,
          recorrencia: null,
        }).eq("id", editing.id);
        if (r.error) throw r.error;

        // 2) sincroniza status de pagamento
        const eraPago = editing.pago;
        if (jaPago && !eraPago) {
          // virou paga agora → cria lançamento
          await pagarConta({ ...editing, ...base, valor: valorNum, vencimento } as ContaAPagarRow, {
            dataPagamento: dataPgto,
            valorPago: valorNum,
            empresaId: Number(empresaId),
            categoriaId: categoriaId !== "0" ? Number(categoriaId) : null,
            tipo,
          });
        } else if (!jaPago && eraPago) {
          // estornou
          await estornarPagamento(editing);
        } else if (jaPago && eraPago) {
          // continua paga → sincroniza espelho
          const atualizada: ContaAPagarRow = {
            ...editing, ...base,
            valor: valorNum,
            vencimento,
            pago: true,
            data_pagamento: dataPgto,
            valor_pago: valorNum,
          } as ContaAPagarRow;
          // atualiza também data_pagamento/valor_pago no banco
          const upd = await supabase.from("contas_a_pagar").update({
            data_pagamento: dataPgto,
            valor_pago: valorNum,
          }).eq("id", editing.id);
          if (upd.error) throw upd.error;
          await sincronizarLancamentoDeConta(atualizada);
        }
        return;
      }

      // CRIAÇÃO de parcelas
      const grupoId = parcelasGeradas.length > 1 ? crypto.randomUUID() : null;
      const totalParcelas = parcelasGeradas.length;

      const rows = parcelasGeradas.map((iso, i) => {
        const sufixo = totalParcelas > 1 ? ` (${i + 1}/${totalParcelas})` : "";
        return {
          ...base,
          descricao: base.descricao + sufixo,
          valor: valorPorParcela,
          vencimento: iso,
          recorrencia: null,
          grupo_id: grupoId,
          pago: false,
          data_pagamento: null,
          valor_pago: null,
          criado_por: null,
        };
      });

      const ins = await supabase.from("contas_a_pagar").insert(rows).select("*");
      if (ins.error) throw ins.error;

      // Se marcou "já paga" → pagar a 1ª parcela (cria lançamento)
      if (jaPago && ins.data && ins.data.length > 0) {
        const primeira = ins.data[0] as ContaAPagarRow;
        await pagarConta(primeira, {
          dataPagamento: dataPgto,
          valorPago: valorPorParcela,
          empresaId: Number(empresaId),
          categoriaId: categoriaId !== "0" ? Number(categoriaId) : null,
          tipo,
        });
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Atualizada" : parcelasGeradas.length > 1 ? `${parcelasGeradas.length} parcelas criadas` : "Conta criada");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const showPreview = !isEdit && parcelasGeradas.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? "Editar lançamento"
              : tipo === "Receita"
              ? "Novo lançamento — a receber"
              : tipo === "Despesa"
              ? "Novo lançamento — a pagar"
              : `Novo lançamento — ${tipo}`}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Cadastre uma conta a pagar/receber. Ao marcar como concluída, vira um Lançamento no DRE automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* === Tipo === */}
          <ToggleGroup
            type="single"
            value={tipo}
            onValueChange={(v) => v && setTipo(v as TipoLancContaPagar)}
            className="flex flex-wrap justify-start gap-1"
          >
            {(["Despesa", "Receita", "Retirada", "Empréstimo"] as TipoLancContaPagar[]).map((t) => (
              <ToggleGroupItem
                key={t}
                value={t}
                className="h-8 px-3 text-xs data-[state=on]:bg-primary/15 data-[state=on]:text-primary data-[state=on]:border-primary/30"
              >
                {t === "Despesa" ? "A pagar" : t === "Receita" ? "A receber" : t}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {/* === Bloco 1: O quê === */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Wallet className="h-3.5 w-3.5" /> {tipo === "Receita" ? "O que receber" : "O que pagar"}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Descrição *</Label>
                <Input
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder={tipo === "Receita" ? "Ex.: Mensalidade cliente X" : "Ex.: Aluguel sala comercial"}
                  autoFocus={!isEdit}
                />
              </div>
              <div>
                <Label className="text-xs">{tipo === "Receita" ? "Pagador / Cliente" : "Fornecedor / Beneficiário"}</Label>
                <Input
                  value={fornecedor}
                  onChange={e => setFornecedor(e.target.value)}
                  placeholder={tipo === "Receita" ? "Ex.: Cliente Y" : "Ex.: Imobiliária X"}
                />
              </div>
              <div>
                <Label className="text-xs">Forma de pagamento</Label>
                <Select value={formaPgto || "_none"} onValueChange={(v) => setFormaPgto(v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {FORMAS_PGTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Empresa</Label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">—</SelectItem>
                    {empresas.data?.map(e => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    <SelectItem value="0">—</SelectItem>
                    {categoriasOrdenadas.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* === Bloco 2: Quando e quanto === */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <CalendarClock className="h-3.5 w-3.5" /> Quando e quanto
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor (R$) *</Label>
                <Input
                  inputMode="decimal"
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  placeholder="0,00"
                  className="tabular-nums"
                />
                {valorNum > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">{brl(valorNum)}</p>
                )}
              </div>
              <div>
                <Label className="text-xs">{freq === "unica" ? "Vencimento *" : "1º vencimento *"}</Label>
                <Input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {atalhosVenc.map(a => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => setVencimento(a.iso)}
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border border-white/10 hover:bg-white/5 transition",
                        vencimento === a.iso && "bg-primary/15 border-primary/30 text-primary"
                      )}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* === Bloco 3: Recorrência === */}
          {!isEdit && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <Repeat2 className="h-3.5 w-3.5" /> Recorrência
              </div>
              <ToggleGroup
                type="single"
                value={freq}
                onValueChange={(v) => v && setFreq(v as FrequenciaPreset)}
                className="flex flex-wrap justify-start gap-1"
              >
                {FREQ_PRESETS.map(p => (
                  <ToggleGroupItem
                    key={p.value}
                    value={p.value}
                    className="h-7 px-2.5 text-xs data-[state=on]:bg-primary/15 data-[state=on]:text-primary data-[state=on]:border-primary/30"
                  >
                    {p.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              {freq !== "unica" && (
                <div className="grid sm:grid-cols-2 gap-3 p-3 rounded-lg bg-muted/30 ring-1 ring-white/5">
                  <div>
                    <Label className="text-xs">Nº de parcelas</Label>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={parcelas}
                      onChange={e => setParcelas(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Valor representa</Label>
                    <Select value={modo} onValueChange={v => setModo(v as Modo)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="repetir">Valor por parcela (repetir)</SelectItem>
                        <SelectItem value="parcelado">Valor total (dividir em N)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {parcelasGeradas.length}× de <strong className="text-foreground tabular-nums">{brl(valorPorParcela)}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Total: <strong className="text-foreground tabular-nums">{brl(valorTotal)}</strong>
                    </span>
                  </div>
                </div>
              )}

              {showPreview && (
                <div className="rounded-lg ring-1 ring-white/5 bg-card/50 p-2 max-h-[140px] overflow-y-auto">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 pb-1">Prévia das parcelas</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                    {parcelasGeradas.map((iso, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-muted/30">
                        <span className="text-muted-foreground">{i + 1}/{parcelasGeradas.length}</span>
                        <span className="tabular-nums">{formatDateBR(iso)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* === Bloco 4: Já pago === */}
          <section className="space-y-3">
            <div className="flex items-center justify-between rounded-lg ring-1 ring-white/5 bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className={cn("h-4 w-4", jaPago ? "text-emerald-400" : "text-muted-foreground")} />
                <div>
                  <p className="text-sm font-medium">{tipo === "Receita" ? "Já foi recebido" : "Já está pago"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {isEdit
                      ? "Marque ou desmarque o status"
                      : tipo === "Receita"
                      ? "Marca a 1ª parcela como já recebida"
                      : "Marca a 1ª parcela como já paga"}
                  </p>
                </div>
              </div>
              <Switch checked={jaPago} onCheckedChange={setJaPago} />
            </div>
            {jaPago && (
              <div>
                <Label className="text-xs">{tipo === "Receita" ? "Data do recebimento" : "Data do pagamento"}</Label>
                <Input type="date" value={dataPgto} onChange={e => setDataPgto(e.target.value)} />
              </div>
            )}
          </section>

          {/* === Bloco 5: Observação === */}
          <div>
            <Label className="text-xs">Observação</Label>
            <Textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={2}
              placeholder="Notas internas, número do boleto, instruções…"
            />
          </div>

          {erros.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/20 rounded-md p-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{erros.join(" · ")}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <div className="flex-1 flex items-center">
            {!isEdit && parcelasGeradas.length > 1 && (
              <Badge variant="outline" className="text-[10px]">
                {parcelasGeradas.length} parcelas · {brl(valorTotal)}
              </Badge>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || erros.length > 0}
          >
            {save.isPending ? "Salvando..." : isEdit ? "Salvar" : "Criar conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
