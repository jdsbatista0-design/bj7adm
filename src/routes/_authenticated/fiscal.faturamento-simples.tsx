import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresas } from "@/hooks/use-refs";
import { PageShell } from "@/components/bj7/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, AlertTriangle } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, ReferenceLine,
} from "recharts";

export const Route = createFileRoute("/_authenticated/fiscal/faturamento-simples")({
  component: FaturamentoSimplesPage,
});

// Limite Simples Nacional (2024+): R$ 4,8mi/ano
const LIMITE_SIMPLES = 4_800_000;

type Lancamento = {
  id: number;
  empresa_id: number;
  competencia: string; // YYYY-MM-01
  receita_bruta: number;
  observacoes: string | null;
  criado_em?: string | null;
};

const fmtBRL = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

function fmtComp(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function last12Months(): string[] {
  const arr: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    arr.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-01`);
  }
  return arr;
}

function FaturamentoSimplesPage() {
  const qc = useQueryClient();
  const empresasQ = useEmpresas();
  const [openNovo, setOpenNovo] = useState(false);

  // Filtra empresas do Simples por nome (BJ7 Stone e BJ7 Mídia)
  const empresasSimples = useMemo(() => {
    const all = (empresasQ.data ?? []) as { id: number; nome: string; regime_tributario?: string | null }[];
    const byRegime = all.filter((e) => (e.regime_tributario ?? "").toUpperCase().includes("SIMPLES"));
    if (byRegime.length > 0) return byRegime;
    return all.filter((e) => /stone|m[ií]dia/i.test(e.nome));
  }, [empresasQ.data]);

  const months = useMemo(() => last12Months(), []);

  const fatQ = useQuery({
    queryKey: ["fiscal", "faturamento_simples_mensal", empresasSimples.map((e) => e.id), months[0]],
    enabled: empresasSimples.length > 0,
    queryFn: async () => {
      const r = await supabase
        .schema("fiscal")
        .from("faturamento_simples_mensal")
        .select("*")
        .in("empresa_id", empresasSimples.map((e) => e.id))
        .gte("competencia", months[0])
        .order("competencia", { ascending: true });
      if (r.error) throw r.error;
      return (r.data ?? []) as Lancamento[];
    },
  });

  return (
    <PageShell
      title="Faturamento Simples Nacional"
      description="Cadastro mensal de receita bruta — BJ7 Stone e BJ7 Mídia"
      actions={
        <Button size="sm" onClick={() => setOpenNovo(true)} disabled={empresasSimples.length === 0}>
          <Plus className="h-4 w-4 mr-1.5" /> Lançar mês
        </Button>
      }
    >
      {empresasQ.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : empresasSimples.length === 0 ? (
        <Alert>
          <AlertTitle>Nenhuma empresa do Simples encontrada</AlertTitle>
          <AlertDescription>Cadastre o regime tributário como "SIMPLES NACIONAL" nas empresas BJ7 Stone e BJ7 Mídia.</AlertDescription>
        </Alert>
      ) : fatQ.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : fatQ.error ? (
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>{(fatQ.error as Error).message}</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          {empresasSimples.map((emp) => (
            <EmpresaCard
              key={emp.id}
              empresa={emp}
              lancamentos={(fatQ.data ?? []).filter((l) => l.empresa_id === emp.id)}
              months={months}
            />
          ))}
        </div>
      )}

      <NovoLancamentoModal
        open={openNovo}
        onClose={() => setOpenNovo(false)}
        empresas={empresasSimples}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["fiscal", "faturamento_simples_mensal"] });
          setOpenNovo(false);
        }}
      />
    </PageShell>
  );
}

function EmpresaCard({
  empresa, lancamentos, months,
}: {
  empresa: { id: number; nome: string };
  lancamentos: Lancamento[];
  months: string[];
}) {
  const byMonth = new Map(lancamentos.map((l) => [l.competencia.slice(0, 10), l]));
  const chartData = months.map((m) => ({
    mes: fmtComp(m),
    receita: Number(byMonth.get(m)?.receita_bruta ?? 0),
  }));
  const acumulado12m = chartData.reduce((s, x) => s + x.receita, 0);
  const pct = (acumulado12m / LIMITE_SIMPLES) * 100;
  const alerta = pct >= 80;
  const tabelaRows = [...months].reverse().map((m) => ({ comp: m, lanc: byMonth.get(m) }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{empresa.nome}</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Acumulado 12m:</span>
          <Badge variant={alerta ? "destructive" : "outline"} className="font-medium">
            {fmtBRL(acumulado12m)} ({pct.toFixed(1)}%)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerta && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção — Limite do Simples Nacional</AlertTitle>
            <AlertDescription>
              Faturamento acumulado dos últimos 12 meses ({fmtBRL(acumulado12m)}) atingiu {pct.toFixed(1)}% do limite de {fmtBRL(LIMITE_SIMPLES)}.
            </AlertDescription>
          </Alert>
        )}

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <RTooltip
                formatter={(v: number) => [fmtBRL(v), "Receita bruta"]}
                contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
              />
              <ReferenceLine y={LIMITE_SIMPLES / 12} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: "Média mensal do limite", fontSize: 10, fill: "hsl(var(--destructive))" }} />
              <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead className="text-right">Receita bruta</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tabelaRows.map((r) => (
                <TableRow key={r.comp}>
                  <TableCell className="font-medium">{fmtComp(r.comp)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.lanc ? fmtBRL(r.lanc.receita_bruta) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.lanc?.observacoes ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function NovoLancamentoModal({
  open, onClose, empresas, onSaved,
}: {
  open: boolean; onClose: () => void;
  empresas: { id: number; nome: string }[];
  onSaved: () => void;
}) {
  const defaultComp = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const [empresaId, setEmpresaId] = useState<string>(empresas[0] ? String(empresas[0].id) : "");
  const [competencia, setCompetencia] = useState(defaultComp);
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Selecione a empresa.");
      const v = Number(valor.replace(",", "."));
      if (!Number.isFinite(v) || v < 0) throw new Error("Informe um valor válido.");
      const comp = `${competencia}-01`;
      const payload = {
        empresa_id: Number(empresaId),
        competencia: comp,
        receita_bruta: v,
        observacoes: obs.trim() || null,
      };
      const r = await supabase.schema("fiscal").from("faturamento_simples_mensal").insert(payload);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Lançamento salvo.");
      setValor(""); setObs("");
      onSaved();
    },
    onError: (e: Error) => toast.error("Falha: " + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Lançar receita bruta mensal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Empresa</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {empresas.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Competência</Label>
              <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            </div>
            <div>
              <Label>Receita bruta (R$)</Label>
              <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
