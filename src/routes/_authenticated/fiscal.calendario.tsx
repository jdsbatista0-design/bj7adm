import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { from, asRows } from "@/integrations/supabase/db";
import { useEmpresas } from "@/hooks/use-refs";
import { PageShell } from "@/components/bj7/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CalendarPlus, Filter, Plus, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fiscal/calendario")({
  component: FiscalCalendarioPage,
});

type StatusObrigacao = "PENDENTE" | "EM_ANDAMENTO" | "CUMPRIDA" | "ATRASADA";
type Esfera = "FEDERAL" | "ESTADUAL" | "MUNICIPAL";

type CalendarioRow = {
  id: number;
  empresa_id: number | null;
  empresa: string | null;
  tipo_obrigacao_id?: number | null;
  obrigacao: string | null;
  descricao?: string | null;
  competencia: string | null;
  vencimento: string;
  status: string;
  valor_devido: number | null;
  valor_pago?: number | null;
  esfera?: string | null;
  criticidade?: string | null;
  dias_para_vencer?: number | null;
};

type TipoObrigacao = {
  id: number;
  nome: string;
  descricao?: string | null;
  esfera?: string | null;
};

const STATUS_OPTS: StatusObrigacao[] = [
  "PENDENTE",
  "EM_ANDAMENTO",
  "CUMPRIDA",
  "ATRASADA",
];
const ESFERA_OPTS: Esfera[] = ["FEDERAL", "ESTADUAL", "MUNICIPAL"];

const fmtBRL = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function StatusBadge({ status }: { status: string }) {
  const s = String(status ?? "").toUpperCase();
  const map: Record<string, string> = {
    PENDENTE: "bg-muted text-muted-foreground",
    EM_ANDAMENTO: "bg-warning/15 text-warning",
    CUMPRIDA: "bg-success/15 text-success",
    ATRASADA: "bg-destructive/15 text-destructive",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", map[s] ?? "")}>
      {s.replace("_", " ")}
    </Badge>
  );
}

function FiscalCalendarioPage() {
  const qc = useQueryClient();
  const empresasQ = useEmpresas();

  // Filtros
  const [empresaIds, setEmpresaIds] = useState<number[]>([]);
  const [statuses, setStatuses] = useState<StatusObrigacao[]>([
    "PENDENTE",
    "EM_ANDAMENTO",
    "ATRASADA",
  ]);
  const [esferas, setEsferas] = useState<Esfera[]>([]);
  const [dataIni, setDataIni] = useState<string>(addDaysIso(-30));
  const [dataFim, setDataFim] = useState<string>(addDaysIso(60));

  // Modais
  const [payRow, setPayRow] = useState<CalendarioRow | null>(null);
  const [openNova, setOpenNova] = useState(false);

  const calendarioQ = useQuery({
    queryKey: [
      "fiscal",
      "v_calendario_proximo",
      "full",
      { empresaIds, statuses, esferas, dataIni, dataFim },
    ],
    queryFn: async () => {
      let q = supabase
        .schema("fiscal")
        .from("v_calendario_proximo")
        .select("*")
        .gte("vencimento", dataIni)
        .lte("vencimento", dataFim)
        .order("vencimento", { ascending: true });
      if (empresaIds.length > 0) q = q.in("empresa_id", empresaIds);
      if (statuses.length > 0) q = q.in("status", statuses);
      if (esferas.length > 0) q = q.in("esfera", esferas);
      const r = await q;
      if (r.error) throw r.error;
      return (r.data ?? []) as CalendarioRow[];
    },
  });

  const gerarMut = useMutation({
    mutationFn: async () => {
      const r = await supabase
        .schema("fiscal")
        .rpc("gerar_calendario_mensal", { p_meses_a_frente: 6 });
      if (r.error) throw r.error;
      return r.data;
    },
    onSuccess: () => {
      toast.success("Calendário gerado para os próximos 6 meses.");
      qc.invalidateQueries({ queryKey: ["fiscal"] });
    },
    onError: (e: Error) => toast.error("Falha ao gerar: " + e.message),
  });

  const empresasById = useMemo(() => {
    const map = new Map<number, string>();
    (empresasQ.data ?? []).forEach((e: { id: number; nome: string }) =>
      map.set(e.id, e.nome),
    );
    return map;
  }, [empresasQ.data]);

  return (
    <TooltipProvider delayDuration={300}>
      <PageShell
        title="Calendário Fiscal"
        description="Gestão de obrigações tributárias do Grupo BJ7"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => gerarMut.mutate()}
              disabled={gerarMut.isPending}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4 mr-1.5",
                  gerarMut.isPending && "animate-spin",
                )}
              />
              Gerar próximos meses
            </Button>
            <Button size="sm" onClick={() => setOpenNova(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Adicionar obrigação
            </Button>
          </>
        }
      >
        {/* Filtros */}
        <Card>
          <CardContent className="py-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label className="text-xs">Empresas</Label>
                <MultiSelectChips
                  label="Todas"
                  items={(empresasQ.data ?? []).map(
                    (e: { id: number; nome: string }) => ({
                      id: e.id,
                      label: e.nome,
                    }),
                  )}
                  selected={empresaIds}
                  onChange={setEmpresaIds}
                />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <MultiSelectChips
                  label="Todos"
                  items={STATUS_OPTS.map((s) => ({
                    id: s,
                    label: s.replace("_", " "),
                  }))}
                  selected={statuses}
                  onChange={(v) => setStatuses(v as StatusObrigacao[])}
                />
              </div>
              <div>
                <Label className="text-xs">Esfera</Label>
                <MultiSelectChips
                  label="Todas"
                  items={ESFERA_OPTS.map((s) => ({ id: s, label: s }))}
                  selected={esferas}
                  onChange={(v) => setEsferas(v as Esfera[])}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Vencimento de</Label>
                  <Input
                    type="date"
                    value={dataIni}
                    onChange={(e) => setDataIni(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">até</Label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            {calendarioQ.isLoading ? (
              <div className="p-4 space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : calendarioQ.error ? (
              <div className="p-4 text-sm text-destructive">
                Falha ao carregar: {(calendarioQ.error as Error).message}
              </div>
            ) : (calendarioQ.data ?? []).length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma obrigação encontrada com os filtros aplicados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Obrigação</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor devido</TableHead>
                      <TableHead className="w-[140px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(calendarioQ.data ?? []).map((row) => {
                      const atrasada =
                        String(row.status ?? "").toUpperCase() === "ATRASADA" ||
                        (String(row.status ?? "").toUpperCase() !== "CUMPRIDA" &&
                          row.vencimento &&
                          row.vencimento < todayIso());
                      return (
                        <TableRow
                          key={row.id}
                          className={cn(atrasada && "bg-destructive/5")}
                        >
                          <TableCell className="font-medium">
                            {row.empresa ?? "—"}
                          </TableCell>
                          <TableCell>
                            {row.descricao ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted underline-offset-2">
                                    {row.obrigacao}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  {row.descricao}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              row.obrigacao ?? "—"
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {row.competencia ?? "—"}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {fmtDate(row.vencimento)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={row.status} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.valor_devido != null
                              ? fmtBRL(row.valor_devido)
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPayRow(row)}
                              disabled={
                                String(row.status ?? "").toUpperCase() ===
                                "CUMPRIDA"
                              }
                            >
                              Registrar pagamento
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {payRow && (
          <RegistrarPagamentoModal
            row={payRow}
            onClose={() => setPayRow(null)}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["fiscal"] });
              setPayRow(null);
            }}
          />
        )}

        <NovaObrigacaoModal
          open={openNova}
          onClose={() => setOpenNova(false)}
          empresas={(empresasQ.data ?? []).map(
            (e: { id: number; nome: string }) => ({ id: e.id, nome: e.nome }),
          )}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["fiscal"] });
            setOpenNova(false);
          }}
        />
      </PageShell>
    </TooltipProvider>
  );
}

// ===== Multi-select dropdown com checkboxes =====
function MultiSelectChips<T extends string | number>({
  label,
  items,
  selected,
  onChange,
}: {
  label: string;
  items: { id: T; label: string }[];
  selected: T[];
  onChange: (v: T[]) => void;
}) {
  const toggle = (id: T) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };
  const text =
    selected.length === 0
      ? label
      : selected.length === 1
        ? items.find((i) => i.id === selected[0])?.label ?? `${selected.length}`
        : `${selected.length} selecionados`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between font-normal"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Filter className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{text}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 max-h-72 overflow-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Selecionar</span>
          {selected.length > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onChange([])}
            >
              Limpar
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((it) => (
          <DropdownMenuCheckboxItem
            key={String(it.id)}
            checked={selected.includes(it.id)}
            onCheckedChange={() => toggle(it.id)}
            onSelect={(e) => e.preventDefault()}
          >
            {it.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ===== Modal: Registrar pagamento =====
function RegistrarPagamentoModal({
  row,
  onClose,
  onSaved,
}: {
  row: CalendarioRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dataPagamento, setDataPagamento] = useState(todayIso());
  const [valorPago, setValorPago] = useState<string>(
    row.valor_devido != null ? String(row.valor_devido) : "",
  );
  const [observacoes, setObservacoes] = useState("");
  const [lancamentoId, setLancamentoId] = useState<string>("");

  const lancamentosQ = useQuery({
    queryKey: ["lancamentos-fiscal-link", row.empresa_id, valorPago],
    queryFn: async () => {
      if (!row.empresa_id) return [];
      const v = Number(valorPago);
      let q = from("lancamentos")
        .select("id, data, descricao, valor, tipo")
        .eq("empresa_id", row.empresa_id)
        .order("data", { ascending: false })
        .limit(50);
      if (v > 0) {
        const tol = Math.max(v * 0.1, 1);
        q = q.gte("valor", -(v + tol)).lte("valor", v + tol);
      }
      const r = await q;
      if (r.error) throw r.error;
      return asRows("lancamentos", r.data);
    },
    enabled: !!row.empresa_id,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const valor = Number(valorPago);
      if (!dataPagamento) throw new Error("Informe a data do pagamento");
      if (!(valor > 0)) throw new Error("Valor pago deve ser maior que zero");
      const payload: Record<string, unknown> = {
        data_pagamento: dataPagamento,
        valor_pago: valor,
        observacoes: observacoes || null,
        lancamento_id: lancamentoId ? Number(lancamentoId) : null,
      };
      const r = await supabase
        .schema("fiscal")
        .from("obrigacoes_calendario")
        .update(payload)
        .eq("id", row.id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Pagamento registrado.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-0.5">
            <div>
              <span className="text-muted-foreground">Empresa:</span>{" "}
              {row.empresa ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Obrigação:</span>{" "}
              {row.obrigacao ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Vencimento:</span>{" "}
              {fmtDate(row.vencimento)} ·{" "}
              <span className="text-muted-foreground">Devido:</span>{" "}
              {row.valor_devido != null ? fmtBRL(row.valor_devido) : "—"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data do pagamento</Label>
              <Input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
            </div>
            <div>
              <Label>Valor pago</Label>
              <Input
                type="number"
                step="0.01"
                value={valorPago}
                onChange={(e) => setValorPago(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Vincular a lançamento (opcional)</Label>
            <Select
              value={lancamentoId || "none"}
              onValueChange={(v) => setLancamentoId(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">Nenhum</SelectItem>
                {lancamentosQ.isLoading && (
                  <div className="p-2 text-xs text-muted-foreground">
                    Carregando…
                  </div>
                )}
                {(lancamentosQ.data ?? []).map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {fmtDate(l.data)} · {fmtBRL(l.valor)} ·{" "}
                    {l.descricao ?? l.tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Filtrado pela empresa e valor próximo (±10%).
            </p>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Notas internas, número de autenticação, etc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Modal: Adicionar obrigação manual =====
function NovaObrigacaoModal({
  open,
  onClose,
  empresas,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  empresas: { id: number; nome: string }[];
  onSaved: () => void;
}) {
  const [empresaId, setEmpresaId] = useState<string>("");
  const [tipoId, setTipoId] = useState<string>("");
  const [competencia, setCompetencia] = useState("");
  const [vencimento, setVencimento] = useState(todayIso());
  const [valorDevido, setValorDevido] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const tiposQ = useQuery({
    queryKey: ["fiscal", "tipos_obrigacao"],
    queryFn: async () => {
      const r = await supabase
        .schema("fiscal")
        .from("tipos_obrigacao")
        .select("id, nome, descricao, esfera")
        .order("nome", { ascending: true });
      if (r.error) throw r.error;
      return (r.data ?? []) as TipoObrigacao[];
    },
    enabled: open,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Selecione a empresa");
      if (!tipoId) throw new Error("Selecione o tipo de obrigação");
      if (!vencimento) throw new Error("Informe o vencimento");
      const payload: Record<string, unknown> = {
        empresa_id: Number(empresaId),
        tipo_obrigacao_id: Number(tipoId),
        competencia: competencia || null,
        vencimento,
        valor_devido: valorDevido ? Number(valorDevido) : null,
        observacoes: observacoes || null,
        status: "PENDENTE",
        origem: "manual",
      };
      const r = await supabase
        .schema("fiscal")
        .from("obrigacoes_calendario")
        .insert(payload);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Obrigação criada.");
      setEmpresaId("");
      setTipoId("");
      setCompetencia("");
      setVencimento(todayIso());
      setValorDevido("");
      setObservacoes("");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <CalendarPlus className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Adicionar obrigação manual
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Empresa</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de obrigação</Label>
              <Select value={tipoId} onValueChange={setTipoId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={tiposQ.isLoading ? "Carregando…" : "Selecione"}
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(tiposQ.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.nome}
                      {t.esfera ? ` · ${t.esfera}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Competência</Label>
              <Input
                placeholder="2026-05"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
              />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </div>
            <div>
              <Label>Valor devido</Label>
              <Input
                type="number"
                step="0.01"
                value={valorDevido}
                onChange={(e) => setValorDevido(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? "Salvando…" : "Criar obrigação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
