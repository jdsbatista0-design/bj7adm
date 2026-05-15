import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { from, asRows } from "@/integrations/supabase/db";
import { useCurrentUser } from "@/contexts/auth-context";
import { podeVerStone } from "@/lib/permissions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate, MESES_PT } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/stone")({
  component: StonePage,
});

function StonePage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  useEffect(() => {
    if (!podeVerStone(user)) void navigate({ to: "/" });
  }, [user, navigate]);
  if (!podeVerStone(user)) return null;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Stone</h1>
      <Tabs defaultValue="notas">
        <TabsList>
          <TabsTrigger value="notas">Notas Fiscais</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução da base</TabsTrigger>
          <TabsTrigger value="sumidos">Clientes sumidos</TabsTrigger>
          <TabsTrigger value="rebate">Apuração rebate</TabsTrigger>
        </TabsList>
        <TabsContent value="notas"><NotasTab /></TabsContent>
        <TabsContent value="evolucao"><EvolucaoTab /></TabsContent>
        <TabsContent value="sumidos"><SumidosTab /></TabsContent>
        <TabsContent value="rebate"><RebateTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function NotasTab() {
  const q = useQuery({
    queryKey: ["notas_fiscais"],
    queryFn: async () => {
      const r = await from("notas_fiscais").select("*").order("data", { ascending: false }).limit(500);
      if (r.error) throw r.error;
      return asRows("notas_fiscais", r.data);
    },
  });
  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead className="w-24">Data</TableHead>
          <TableHead>Número</TableHead>
          <TableHead>Tomador</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Arquivo</TableHead>
          <TableHead className="text-right">Valor</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {q.isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sem notas.</TableCell></TableRow>}
          {q.data?.map((n) => (
            <TableRow key={n.id}>
              <TableCell>{formatDate(n.data)}</TableCell>
              <TableCell>{n.numero ?? "—"}</TableCell>
              <TableCell className="text-sm">{n.tomador ?? "—"}</TableCell>
              <TableCell className="text-sm">{n.categoria ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{n.arquivo ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(Number(n.valor ?? 0))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

function EvolucaoTab() {
  const q = useQuery({
    queryKey: ["evolucao_base"],
    queryFn: async () => {
      const r = await from("evolucao_base_clientes").select("*").order("ano").order("mes");
      if (r.error) throw r.error;
      return asRows("evolucao_base_clientes", r.data);
    },
  });
  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Período</TableHead>
          <TableHead className="text-right">Qtd. clientes</TableHead>
          <TableHead className="text-right">Novos</TableHead>
          <TableHead className="text-right">Sumiram</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {q.data?.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{MESES_PT[(e.mes ?? 1) - 1]}/{e.ano}</TableCell>
              <TableCell className="text-right tabular-nums">{e.qtd_clientes ?? 0}</TableCell>
              <TableCell className="text-right tabular-nums text-emerald-700">+{e.novos_no_mes ?? 0}</TableCell>
              <TableCell className="text-right tabular-nums text-destructive">-{e.sumiram_no_mes ?? 0}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

function SumidosTab() {
  const q = useQuery({
    queryKey: ["clientes_sumidos"],
    queryFn: async () => {
      const r = await from("clientes_sumidos").select("*").order("ultimo_lucro", { ascending: false });
      if (r.error) throw r.error;
      return asRows("clientes_sumidos", r.data);
    },
  });
  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Último lucro</TableHead>
          <TableHead className="w-24">Atenção</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {q.data?.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="text-sm">{c.nome ?? "—"}</TableCell>
              <TableCell><Badge variant="outline">{c.status ?? "—"}</Badge></TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(Number(c.ultimo_lucro ?? 0))}</TableCell>
              <TableCell>{c.atencao ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">⚠️</Badge> : null}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

function RebateTab() {
  const q = useQuery({
    queryKey: ["apuracao_rebate"],
    queryFn: async () => {
      const r = await from("apuracao_rebate").select("*").order("ano").order("mes");
      if (r.error) throw r.error;
      return asRows("apuracao_rebate", r.data);
    },
  });
  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Período</TableHead>
          <TableHead className="text-right">Lucro bruto</TableHead>
          <TableHead className="text-right">Alíquota</TableHead>
          <TableHead className="text-right">Rebate</TableHead>
          <TableHead className="text-right">Remuneração final</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {q.data?.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{MESES_PT[(r.mes ?? 1) - 1]}/{r.ano}</TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(Number(r.lucro_bruto ?? 0))}</TableCell>
              <TableCell className="text-right tabular-nums">{((r.aliquota ?? 0) * 100).toFixed(2)}%</TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(Number(r.rebate ?? 0))}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">{formatBRL(Number(r.remuneracao_final ?? 0))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}
