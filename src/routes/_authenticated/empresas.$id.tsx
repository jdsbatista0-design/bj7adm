import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { from, paginateAll } from "@/integrations/supabase/db";
import { useEmpresas } from "@/hooks/use-refs";
import { PageShell, SectionHeader } from "@/components/bj7/PageShell";
import { KpiCard } from "@/components/bj7/KpiCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatBRL, MESES_PT, toLocalIsoDate } from "@/lib/format";
import { toast } from "sonner";
import {
  ArrowLeft,
  Wallet,
  TrendingDown,
  PiggyBank,
  Percent,
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  Save,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresas/$id")({
  component: EmpresaDetalhe,
});

// =========================================================================
// Tipagens locais — colunas cadastrais novas ainda não estão no types.ts.
// =========================================================================
type EmpresaFull = {
  id: number;
  nome: string;
  ativa?: boolean | null;
  razao_social?: string | null;
  cnpj?: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  endereco_rua?: string | null;
  endereco_numero?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_uf?: string | null;
  endereco_cep?: string | null;
  telefone?: string | null;
  email_principal?: string | null;
  contato_nome?: string | null;
  contato_cargo?: string | null;
  inativada_em?: string | null;
  inativada_motivo?: string | null;
};

type RegimeAtual = {
  empresa_id: number;
  regime: string;
  data_inicio: string | null;
  observacoes: string | null;
};

type LancRow = {
  id: number;
  data: string;
  tipo: string;
  valor: number;
  descricao: string | null;
};

type ObrigacaoRow = {
  id: number | string;
  obrigacao: string;
  competencia: string | null;
  vencimento: string;
  valor: number | null;
  status: string;
  criticidade: string;
};

// =========================================================================
// Helpers
// =========================================================================
function isoDate(d: Date) {
  return toLocalIsoDate(d);
}

function fmtDateBR(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function fmtCompetencia(v: string | null | undefined) {
  if (!v) return "—";
  const m = /^(\d{4})-(\d{2})/.exec(v);
  if (!m) return v;
  const mes = Number(m[2]) - 1;
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${meses[mes] ?? "?"}/${m[1].slice(2)}`;
}

function maskCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// =========================================================================
// Página
// =========================================================================
type PeriodoKey =
  | "mes_atual"
  | "mes_anterior"
  | "ult_3m"
  | "ult_6m"
  | "ult_12m"
  | "ano_atual";

const PERIODOS: { key: PeriodoKey; label: string }[] = [
  { key: "mes_atual", label: "Mês atual" },
  { key: "mes_anterior", label: "Mês anterior" },
  { key: "ult_3m", label: "Últimos 3 meses" },
  { key: "ult_6m", label: "Últimos 6 meses" },
  { key: "ult_12m", label: "Últimos 12 meses" },
  { key: "ano_atual", label: "Ano atual" },
];

function rangesFor(p: PeriodoKey) {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  let start: Date;
  let end: Date;
  if (p === "mes_atual") { start = new Date(y, m, 1); end = new Date(y, m + 1, 1); }
  else if (p === "mes_anterior") { start = new Date(y, m - 1, 1); end = new Date(y, m, 1); }
  else if (p === "ult_3m") { start = new Date(y, m - 2, 1); end = new Date(y, m + 1, 1); }
  else if (p === "ult_6m") { start = new Date(y, m - 5, 1); end = new Date(y, m + 1, 1); }
  else if (p === "ult_12m") { start = new Date(y, m - 11, 1); end = new Date(y, m + 1, 1); }
  else { start = new Date(y, 0, 1); end = new Date(y + 1, 0, 1); }
  const ms = end.getTime() - start.getTime();
  const endPrev = new Date(start.getTime());
  const startPrev = new Date(start.getTime() - ms);
  return { start: isoDate(start), end: isoDate(end), startPrev: isoDate(startPrev), endPrev: isoDate(endPrev) };
}

const ORDEM_DRE: { grupo: string; label: string; tipo: "receita" | "subtracao" | "neutro" }[] = [
  { grupo: "receita_bruta", label: "Receita Bruta", tipo: "receita" },
  { grupo: "receita_locacao", label: "Receita de Locação", tipo: "receita" },
  { grupo: "desp_impostos", label: "(-) Impostos", tipo: "subtracao" },
  { grupo: "desp_pessoal", label: "(-) Pessoal", tipo: "subtracao" },
  { grupo: "desp_pessoal_terceiro", label: "(-) Pessoal Terceirizado", tipo: "subtracao" },
  { grupo: "desp_comissao", label: "(-) Comissões/Bonificações", tipo: "subtracao" },
  { grupo: "desp_beneficios_veiculo", label: "(-) Veículos e Benefícios", tipo: "subtracao" },
  { grupo: "desp_aluguel", label: "(-) Aluguel", tipo: "subtracao" },
  { grupo: "desp_utilities", label: "(-) Água/Luz/Gás/Internet", tipo: "subtracao" },
  { grupo: "desp_administrativa", label: "(-) Administrativas", tipo: "subtracao" },
  { grupo: "desp_servicos", label: "(-) Serviços Terceiros", tipo: "subtracao" },
  { grupo: "desp_marketing", label: "(-) Marketing", tipo: "subtracao" },
  { grupo: "desp_seguranca", label: "(-) Segurança e Seguros", tipo: "subtracao" },
  { grupo: "desp_financeira", label: "(-) Despesas Financeiras", tipo: "subtracao" },
  { grupo: "desp_nao_classificada", label: "(-) Não Classificado", tipo: "subtracao" },
  { grupo: "investimento_capex", label: "(-) CAPEX/Investimentos", tipo: "subtracao" },
];

type DreRow = { grupo: string; tipo: string; valor_total: number; mes_ref: string };

function EmpresaDetalhe() {
  const { id } = Route.useParams();
  const empresaId = Number(id);
  const empresasList = useEmpresas();
  const empresaRef = empresasList.data?.find((e) => e.id === empresaId);

  // ---- empresa completa (incluindo campos cadastrais novos) ----
  const empresaQ = useQuery({
    queryKey: ["empresa", empresaId, "full"],
    queryFn: async () => {
      const r = await supabase.from("empresas").select("*").eq("id", empresaId).maybeSingle();
      if (r.error) throw r.error;
      return (r.data ?? null) as EmpresaFull | null;
    },
  });

  // ---- regime atual ----
  const regimeQ = useQuery({
    queryKey: ["empresa", empresaId, "regime-atual"],
    queryFn: async () => {
      const r = await supabase
        .schema("fiscal")
        .from("regimes_empresas")
        .select("empresa_id, regime, data_inicio, observacoes, data_fim")
        .eq("empresa_id", empresaId)
        .is("data_fim", null)
        .order("data_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (r.error) throw r.error;
      return (r.data ?? null) as RegimeAtual | null;
    },
  });

  const empresa = empresaQ.data;
  const regime = regimeQ.data;
  const ativa = empresa?.ativa !== false;
  const status: "ATIVA_COM_REGIME" | "SEM_REGIME" | "INATIVA" = !ativa
    ? "INATIVA"
    : regime?.regime
      ? "ATIVA_COM_REGIME"
      : "SEM_REGIME";

  return (
    <PageShell
      title={empresa?.nome ?? empresaRef?.nome ?? `Empresa #${empresaId}`}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/empresas">
              <ArrowLeft className="h-4 w-4 mr-1" /> Empresas
            </Link>
          </Button>
          <AcoesMenu />
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 -mt-2">
        <StatusBadge status={status} />
        {regime?.regime && <Badge variant="outline">{regime.regime}</Badge>}
      </div>
      <Tabs defaultValue="visao" className="w-full">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex">
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="cadastrais">Dados Cadastrais</TabsTrigger>
            <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="visao" className="mt-4">
          <VisaoGeralTab empresaId={empresaId} />
        </TabsContent>

        <TabsContent value="cadastrais" className="mt-4">
          <CadastraisTab empresaId={empresaId} empresa={empresa} loading={empresaQ.isLoading} />
        </TabsContent>

        <TabsContent value="fiscal" className="mt-4">
          <StubTab title="Fiscal" />
        </TabsContent>

        <TabsContent value="financeiro" className="mt-4">
          <FinanceiroTab empresaId={empresaId} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <StubTab title="Histórico" />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

// =========================================================================
// Header bits
// =========================================================================
function StatusBadge({ status }: { status: "ATIVA_COM_REGIME" | "SEM_REGIME" | "INATIVA" }) {
  if (status === "ATIVA_COM_REGIME") {
    return (
      <Badge className="bg-success/15 text-success border border-success/30 hover:bg-success/20">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Ativa
      </Badge>
    );
  }
  if (status === "SEM_REGIME") {
    return (
      <Badge className="bg-warning/15 text-warning border border-warning/30 hover:bg-warning/20">
        <AlertTriangle className="h-3 w-3 mr-1" /> Sem regime
      </Badge>
    );
  }
  return <Badge variant="secondary" className="text-muted-foreground">Inativa</Badge>;
}

function AcoesMenu() {
  const notImpl = () => toast.info("Disponível na Fase 2");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreHorizontal className="h-4 w-4 mr-1" /> Ações
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Ações da empresa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={notImpl}>Editar dados</DropdownMenuItem>
        <DropdownMenuItem onSelect={notImpl}>Trocar regime</DropdownMenuItem>
        <DropdownMenuItem onSelect={notImpl}>Remover regime</DropdownMenuItem>
        <DropdownMenuItem onSelect={notImpl}>Inativar / Reativar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =========================================================================
// TAB: Visão Geral
// =========================================================================
function VisaoGeralTab({ empresaId }: { empresaId: number }) {
  const anoStart = `${new Date().getFullYear()}-01-01`;

  const lancsAnoQ = useQuery({
    queryKey: ["empresa", empresaId, "lancs-ano", anoStart],
    queryFn: () =>
      paginateAll<{ tipo: string; valor: number; contar_no_total: boolean }>((fromIdx, toIdx) =>
        from("lancamentos")
          .select("tipo,valor,contar_no_total")
          .eq("empresa_id", empresaId)
          .eq("contar_no_total", true)
          .gte("data", anoStart)
          .order("id", { ascending: true })
          .range(fromIdx, toIdx),
      ),
  });

  const ultimosQ = useQuery({
    queryKey: ["empresa", empresaId, "ultimos5"],
    queryFn: async () => {
      const r = await supabase
        .from("lancamentos")
        .select("id,data,tipo,valor,descricao")
        .eq("empresa_id", empresaId)
        .order("data", { ascending: false })
        .order("id", { ascending: false })
        .limit(5);
      if (r.error) throw r.error;
      return (r.data ?? []) as LancRow[];
    },
  });

  const proximasQ = useQuery({
    queryKey: ["empresa", empresaId, "proximas5"],
    queryFn: async () => {
      const r = await supabase
        .schema("fiscal")
        .from("v_calendario_proximo")
        .select("*")
        .eq("empresa_id", empresaId)
        .neq("status", "CUMPRIDA")
        .order("vencimento", { ascending: true })
        .limit(5);
      if (r.error) throw r.error;
      return (r.data ?? []) as ObrigacaoRow[];
    },
  });

  const totais = useMemo(() => {
    let rec = 0, desp = 0;
    for (const l of lancsAnoQ.data ?? []) {
      const v = Math.abs(Number(l.valor) || 0);
      if (l.tipo === "Receita") rec += v;
      else if (l.tipo === "Despesa") desp += v;
    }
    return { rec, desp, resultado: rec - desp };
  }, [lancsAnoQ.data]);

  const obrigacoesPendentes = proximasQ.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title="Resumo do ano" description={String(new Date().getFullYear())} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Receita (ano)" value={formatBRL(totais.rec)} icon={<Wallet className="h-4 w-4" />} status="neutral" />
          <KpiCard label="Despesa (ano)" value={formatBRL(totais.desp)} icon={<TrendingDown className="h-4 w-4" />} status="neutral" />
          <KpiCard
            label="Resultado"
            value={formatBRL(totais.resultado)}
            icon={<PiggyBank className="h-4 w-4" />}
            status={totais.resultado < 0 ? "critico" : "ok"}
          />
          <KpiCard
            label="Obrigações pendentes"
            value={String(obrigacoesPendentes)}
            icon={<AlertTriangle className="h-4 w-4" />}
            status={obrigacoesPendentes > 0 ? "atencao" : "ok"}
          />
        </div>
      </section>

      <section>
        <SectionHeader title="Últimos 5 lançamentos" />
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimosQ.isLoading && (
                  <TableRow><TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                )}
                {!ultimosQ.isLoading && (ultimosQ.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem lançamentos.</TableCell></TableRow>
                )}
                {(ultimosQ.data ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="tabular-nums">{fmtDateBR(l.data)}</TableCell>
                    <TableCell><Badge variant="outline">{l.tipo}</Badge></TableCell>
                    <TableCell className="max-w-[420px] truncate">{l.descricao ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(Number(l.valor) || 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader title="Próximas 5 obrigações fiscais" />
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obrigação</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proximasQ.isLoading && (
                  <TableRow><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                )}
                {!proximasQ.isLoading && (proximasQ.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nada pendente.</TableCell></TableRow>
                )}
                {(proximasQ.data ?? []).map((o) => (
                  <TableRow key={String(o.id)}>
                    <TableCell>{o.obrigacao}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{fmtCompetencia(o.competencia)}</TableCell>
                    <TableCell className="tabular-nums">{fmtDateBR(o.vencimento)}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.valor != null ? formatBRL(Number(o.valor)) : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// =========================================================================
// TAB: Dados Cadastrais
// =========================================================================
const CAMPOS_TEXT: { key: keyof EmpresaFull; label: string; mask?: (v: string) => string; placeholder?: string; col?: string }[] = [
  { key: "nome", label: "Nome", col: "md:col-span-2" },
  { key: "razao_social", label: "Razão social", col: "md:col-span-2" },
  { key: "cnpj", label: "CNPJ", mask: maskCnpj, placeholder: "00.000.000/0000-00" },
  { key: "inscricao_estadual", label: "Inscrição Estadual" },
  { key: "inscricao_municipal", label: "Inscrição Municipal" },
  { key: "telefone", label: "Telefone" },
  { key: "email_principal", label: "E-mail principal", col: "md:col-span-2" },
  { key: "endereco_rua", label: "Rua", col: "md:col-span-2" },
  { key: "endereco_numero", label: "Número" },
  { key: "endereco_bairro", label: "Bairro" },
  { key: "endereco_cidade", label: "Cidade" },
  { key: "endereco_uf", label: "UF" },
  { key: "endereco_cep", label: "CEP" },
  { key: "contato_nome", label: "Contato responsável" },
  { key: "contato_cargo", label: "Cargo do contato" },
];

function CadastraisTab({
  empresaId,
  empresa,
  loading,
}: {
  empresaId: number;
  empresa: EmpresaFull | null | undefined;
  loading: boolean;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<EmpresaFull>>({});

  useEffect(() => {
    if (empresa) setForm(empresa);
  }, [empresa]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {};
      for (const c of CAMPOS_TEXT) {
        const v = (form[c.key] as string | null | undefined) ?? null;
        payload[c.key as string] = v === "" ? null : v;
      }
      const r = await supabase.from("empresas").update(payload).eq("id", empresaId);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Dados cadastrais salvos");
      qc.invalidateQueries({ queryKey: ["empresa", empresaId] });
      qc.invalidateQueries({ queryKey: ["empresas"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CAMPOS_TEXT.map((c) => (
            <div key={String(c.key)} className={`space-y-1 ${c.col ?? ""}`}>
              <Label htmlFor={`f-${String(c.key)}`} className="text-xs">{c.label}</Label>
              <Input
                id={`f-${String(c.key)}`}
                value={(form[c.key] as string | null | undefined) ?? ""}
                placeholder={c.placeholder}
                maxLength={c.key === "endereco_uf" ? 2 : 255}
                onChange={(e) => {
                  const raw = e.target.value;
                  const val = c.mask ? c.mask(raw) : raw;
                  setForm((p) => ({ ...p, [c.key]: val }));
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================================
// TAB: Stub (Fiscal / Histórico — Fase 2)
// =========================================================================
function StubTab({ title }: { title: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        Aba <strong className="text-foreground">{title}</strong> será implementada na Fase 2.
      </CardContent>
    </Card>
  );
}

// =========================================================================
// TAB: Financeiro — DRE detalhada + evolução 12m (lógica original preservada)
// =========================================================================
function FinanceiroTab({ empresaId }: { empresaId: number }) {
  const [periodoKey, setPeriodoKey] = useState<PeriodoKey>("mes_atual");
  const periodo = useMemo(() => rangesFor(periodoKey), [periodoKey]);

  const dreQ = useQuery({
    queryKey: ["empresa", empresaId, "dre", periodo.start, periodo.end],
    queryFn: () =>
      paginateAll<DreRow>((fromIdx, toIdx) =>
        from("dre_view" as never)
          .select("grupo,tipo,valor_total,mes_ref,empresa_id")
          .eq("empresa_id", empresaId)
          .gte("mes_ref", periodo.start)
          .lt("mes_ref", periodo.end)
          .order("mes_ref", { ascending: true })
          .range(fromIdx, toIdx),
      ),
  });

  const dreAntQ = useQuery({
    queryKey: ["empresa", empresaId, "dre-ant", periodo.startPrev, periodo.endPrev],
    queryFn: () =>
      paginateAll<DreRow>((fromIdx, toIdx) =>
        from("dre_view" as never)
          .select("grupo,tipo,valor_total,empresa_id,mes_ref")
          .eq("empresa_id", empresaId)
          .gte("mes_ref", periodo.startPrev)
          .lt("mes_ref", periodo.endPrev)
          .order("mes_ref", { ascending: true })
          .range(fromIdx, toIdx),
      ),
  });

  const evolQ = useQuery({
    queryKey: ["empresa", empresaId, "evol12m"],
    queryFn: () => {
      const hoje = new Date();
      const start = isoDate(new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1));
      return paginateAll<DreRow>((fromIdx, toIdx) =>
        from("dre_view" as never)
          .select("tipo,valor_total,mes_ref,empresa_id")
          .eq("empresa_id", empresaId)
          .gte("mes_ref", start)
          .order("mes_ref", { ascending: true })
          .range(fromIdx, toIdx),
      );
    },
  });

  const dre = useMemo(() => {
    const rows = dreQ.data ?? [];
    const rowsAnt = dreAntQ.data ?? [];
    const sumGrupo = (rs: DreRow[], grupo: string) =>
      rs.filter((r) => r.grupo === grupo).reduce((s, r) => s + Number(r.valor_total || 0), 0);
    const sumTipo = (rs: DreRow[], tipo: string) =>
      rs.filter((r) => r.tipo === tipo).reduce((s, r) => s + Number(r.valor_total || 0), 0);

    const receita = sumTipo(rows, "Receita");
    const receitaAnt = sumTipo(rowsAnt, "Receita");
    const despesa = sumTipo(rows, "Despesa");
    const despesaAnt = sumTipo(rowsAnt, "Despesa");
    const lucro = receita - despesa;
    const lucroAnt = receitaAnt - despesaAnt;
    const margem = receita > 0 ? (lucro / receita) * 100 : 0;
    const margemAnt = receitaAnt > 0 ? (lucroAnt / receitaAnt) * 100 : 0;
    const trend = (cur: number, ant: number) => (ant > 0 ? (cur - ant) / ant : null);

    const linhas = ORDEM_DRE.map((d) => {
      const valor = sumGrupo(rows, d.grupo);
      const valorAnt = sumGrupo(rowsAnt, d.grupo);
      return {
        ...d,
        valor,
        valorAnt,
        pctReceita: receita > 0 ? (valor / receita) * 100 : 0,
        variacao: trend(valor, valorAnt),
      };
    }).filter((l) => l.valor > 0 || l.valorAnt > 0);

    return {
      receita, despesa, lucro, margem,
      receitaAnt, despesaAnt, lucroAnt, margemAnt,
      trendRec: trend(receita, receitaAnt),
      trendDesp: trend(despesa, despesaAnt),
      trendLucro: trend(lucro, lucroAnt),
      trendMargemPp: margem - margemAnt,
      linhas,
    };
  }, [dreQ.data, dreAntQ.data]);

  const evolucao = useMemo(() => {
    const rows = evolQ.data ?? [];
    const buckets = new Map<string, { receita: number; despesa: number }>();
    const hoje = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, { receita: 0, despesa: 0 });
    }
    for (const r of rows) {
      const key = (r.mes_ref ?? "").slice(0, 7);
      const b = buckets.get(key);
      if (!b) continue;
      const v = Number(r.valor_total || 0);
      if (r.tipo === "Receita") b.receita += v;
      else if (r.tipo === "Despesa") b.despesa += v;
    }
    return Array.from(buckets.entries()).map(([key, v]) => {
      const [y, m] = key.split("-").map(Number);
      return {
        mes: `${MESES_PT[m - 1]}/${String(y).slice(2)}`,
        receita: Math.round(v.receita),
        despesa: Math.round(v.despesa),
        lucro: Math.round(v.receita - v.despesa),
      };
    });
  }, [evolQ.data]);

  const loading = dreQ.isLoading || dreAntQ.isLoading;
  const labelPeriodo = PERIODOS.find((p) => p.key === periodoKey)?.label ?? "";

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select value={periodoKey} onValueChange={(v) => setPeriodoKey(v as PeriodoKey)}>
          <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => (<SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <section>
        <SectionHeader title="Resumo do período" description={labelPeriodo} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Receita" value={formatBRL(dre.receita)} trend={dre.trendRec} icon={<Wallet className="h-4 w-4" />} status="neutral" />
          <KpiCard label="Despesa" value={formatBRL(dre.despesa)} trend={dre.trendDesp} icon={<TrendingDown className="h-4 w-4" />} status={dre.trendDesp != null && dre.trendDesp > 0.1 ? "atencao" : "neutral"} />
          <KpiCard label="Lucro" value={formatBRL(dre.lucro)} trend={dre.trendLucro} icon={<PiggyBank className="h-4 w-4" />} status={dre.lucro < 0 ? "critico" : "ok"} />
          <KpiCard
            label="Margem"
            value={dre.receita > 0 ? `${dre.margem.toFixed(1)}%` : "—"}
            hint={dre.receita > 0 ? `${dre.trendMargemPp >= 0 ? "+" : ""}${dre.trendMargemPp.toFixed(1)} pp vs anterior` : undefined}
            icon={<Percent className="h-4 w-4" />}
            status={dre.margem < 0 ? "critico" : dre.margem < 10 ? "atencao" : "ok"}
          />
        </div>
      </section>

      <section>
        <SectionHeader title="DRE detalhada" description="Agrupado por grupo da categoria" />
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right w-28">% Receita</TableHead>
                  <TableHead className="text-right w-32">vs Anterior</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (<TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>)}
                {!loading && dre.linhas.length === 0 && (<TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem dados no período selecionado.</TableCell></TableRow>)}
                {!loading && dre.linhas.map((l) => {
                  const cor = l.tipo === "receita" ? "text-success" : l.valor > 0 ? "" : "text-muted-foreground";
                  const varCor =
                    l.variacao == null ? "text-muted-foreground"
                      : l.variacao > 0.05 ? (l.tipo === "receita" ? "text-success" : "text-destructive")
                      : l.variacao < -0.05 ? (l.tipo === "receita" ? "text-destructive" : "text-success")
                      : "text-muted-foreground";
                  return (
                    <TableRow key={l.grupo}>
                      <TableCell className="text-sm">{l.label}</TableCell>
                      <TableCell className={`text-right tabular-nums ${cor}`}>{formatBRL(l.valor)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{dre.receita > 0 ? `${l.pctReceita.toFixed(1)}%` : "—"}</TableCell>
                      <TableCell className={`text-right text-xs tabular-nums ${varCor}`}>{l.variacao == null ? "—" : `${l.variacao >= 0 ? "+" : ""}${(l.variacao * 100).toFixed(1)}%`}</TableCell>
                    </TableRow>
                  );
                })}
                {!loading && dre.linhas.length > 0 && (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Resultado Operacional</TableCell>
                    <TableCell className={`text-right tabular-nums ${dre.lucro < 0 ? "text-destructive" : "text-success"}`}>{formatBRL(dre.lucro)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{dre.receita > 0 ? `${dre.margem.toFixed(1)}%` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{dre.receita > 0 ? `${dre.trendMargemPp >= 0 ? "+" : ""}${dre.trendMargemPp.toFixed(1)} pp` : "—"}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader title="Evolução últimos 12 meses" />
        <Card>
          <CardContent className="p-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucao} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 70%)" opacity={0.3} />
                  <XAxis dataKey="mes" tick={{ fill: "hsl(220 9% 46%)", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "hsl(220 9% 46%)", fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v as number)} />
                  <Tooltip
                    contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(220 13% 70%)", borderRadius: 8, fontSize: 12, color: "hsl(220 13% 18%)" }}
                    labelStyle={{ color: "hsl(220 13% 18%)", fontWeight: 600 }}
                    itemStyle={{ color: "hsl(220 13% 18%)" }}
                    formatter={(v: number) => formatBRL(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "hsl(220 13% 18%)" }} />
                  <Line type="monotone" dataKey="receita" name="Receita" stroke="hsl(142 71% 55%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="despesa" name="Despesa" stroke="hsl(0 84% 65%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="lucro" name="Lucro" stroke="hsl(217 91% 65%)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
