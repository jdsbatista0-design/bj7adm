import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Papa from "papaparse";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { from, asRows } from "@/integrations/supabase/db";
import { useCurrentUser } from "@/contexts/auth-context";
import { podeImportar } from "@/lib/permissions";
import { gerarHashOrigem } from "@/lib/csv-hash";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/importacoes")({
  component: ImportacoesPage,
});

interface CsvRow {
  data: string;
  tipo: string;
  empresa_id: number;
  unidade_id: number | null;
  categoria_id: number | null;
  subcategoria: string | null;
  descricao: string | null;
  valor: number;
  arquivo_origem: string;
  aba_origem: string | null;
  linha_origem: number;
}

interface ParseResult {
  rows: (CsvRow & { hash_origem: string })[];
  errors: string[];
}

function ImportacoesPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [summary, setSummary] = useState<{ inseridos: number; ignorados: number } | null>(null);

  // Todos os hooks (useQuery/useMutation) precisam ser chamados ANTES de
  // qualquer return condicional — o guard de permissão fica mais abaixo.
  const historico = useQuery({
    queryKey: ["importacoes"],
    queryFn: async () => {
      const r = await from("importacoes").select("*").order("importado_em", { ascending: false }).limit(50);
      if (r.error) throw r.error;
      return asRows("importacoes", r.data);
    },
  });

  useEffect(() => {
    if (!podeImportar(user)) void navigate({ to: "/" });
  }, [user, navigate]);

  function handleParse(f: File) {
    setFile(f);
    setSummary(null);
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const errors: string[] = [];
        const rows: (CsvRow & { hash_origem: string })[] = [];
        res.data.forEach((row, idx) => {
          const linhaCsv = idx + 2; // header é linha 1
          try {
            const data = (row["data"] ?? "").trim();
            const tipo = (row["tipo"] ?? "").trim();
            const empresa_id = Number(row["empresa_id"]);
            const valor = Number(String(row["valor"] ?? "").replace(",", "."));
            if (!data || !tipo || !empresa_id || !Number.isFinite(valor)) {
              errors.push(`Linha ${linhaCsv}: data/tipo/empresa_id/valor obrigatórios`);
              return;
            }
            const arquivo_origem = (row["arquivo_origem"] ?? f.name).trim() || f.name;
            const aba_origem = (row["aba_origem"] ?? "").trim() || null;
            // `??` não captura string vazia: se a coluna existe mas vem "",
            // precisa cair no número da linha do CSV em vez de virar 0.
            const linhaOrigemRaw = String(row["linha_origem"] ?? "").trim();
            const linha_origem = linhaOrigemRaw ? Number(linhaOrigemRaw) : linhaCsv;
            const descricao = (row["descricao"] ?? "").trim() || null;
            const csvRow: CsvRow = {
              data,
              tipo,
              empresa_id,
              unidade_id: row["unidade_id"] ? Number(row["unidade_id"]) : null,
              categoria_id: row["categoria_id"] ? Number(row["categoria_id"]) : null,
              subcategoria: (row["subcategoria"] ?? "").trim() || null,
              descricao,
              valor,
              arquivo_origem,
              aba_origem,
              linha_origem,
            };
            const hash_origem = gerarHashOrigem({
              arquivo_origem,
              aba_origem,
              linha_origem,
              data,
              valor,
              descricao,
            });
            rows.push({ ...csvRow, hash_origem });
          } catch (e) {
            errors.push(`Linha ${linhaCsv}: ${e instanceof Error ? e.message : "erro"}`);
          }
        });
        setParseResult({ rows, errors });
      },
      error: (err) => toast.error(err.message),
    });
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!parseResult || !file) throw new Error("Nenhum arquivo carregado");
      const allHashes = parseResult.rows.map((r) => r.hash_origem);
      // Dedup em lotes de 500
      const existingHashes = new Set<string>();
      for (let i = 0; i < allHashes.length; i += 500) {
        const batch = allHashes.slice(i, i + 500);
        const r = await from("lancamentos").select("hash_origem").in("hash_origem", batch);
        if (r.error) throw r.error;
        ((r.data ?? []) as { hash_origem: string }[]).forEach((row) => existingHashes.add(row.hash_origem));
      }

      const novos = parseResult.rows.filter((r) => !existingHashes.has(r.hash_origem));
      const ignorados = parseResult.rows.length - novos.length;

      // Inserir importacao
      const imp = await from("importacoes")
        .insert({
          arquivo: file.name,
          importado_em: new Date().toISOString(),
          linhas_recebidas: parseResult.rows.length,
          linhas_inseridas: novos.length,
          linhas_ignoradas: ignorados,
          importado_por: user.id,
        })
        .select("id")
        .single();
      if (imp.error) throw imp.error;
      const importacao_id = (imp.data as { id: number }).id;

      // Inserir lançamentos em lotes
      for (let i = 0; i < novos.length; i += 200) {
        const batch = novos.slice(i, i + 200).map((r) => {
          const d = new Date(r.data);
          return {
            data: r.data,
            ano: d.getUTCFullYear(),
            mes: d.getUTCMonth() + 1,
            tipo: r.tipo,
            empresa_id: r.empresa_id,
            unidade_id: r.unidade_id,
            categoria_id: r.categoria_id,
            subcategoria: r.subcategoria,
            descricao: r.descricao,
            valor: r.valor,
            arquivo_origem: r.arquivo_origem,
            aba_origem: r.aba_origem,
            linha_origem: r.linha_origem,
            hash_origem: r.hash_origem,
            revisado: false,
            contar_no_total: true,
            origem_classificacao: "csv",
            importacao_id,
            criado_em: new Date().toISOString(),
          };
        });
        const ins = await from("lancamentos").insert(batch);
        if (ins.error) throw ins.error;
      }

      return { inseridos: novos.length, ignorados };
    },
    onSuccess: (s) => {
      setSummary(s);
      qc.invalidateQueries({ queryKey: ["importacoes"] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      toast.success(`${s.inseridos} novos, ${s.ignorados} duplicados`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro na importação"),
  });

  // Guard de permissão: depois de TODOS os hooks (rules of hooks).
  if (!podeImportar(user)) return null;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Importações</h1>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Teste de hash</AlertTitle>
        <AlertDescription>
          Após a primeira importação, exporte algumas linhas existentes e tente reimportar.
          Se o sistema disser <strong>"X ignorados por duplicata"</strong>, a fórmula de hash bate com a do Python.
          Se inserir tudo de novo, a fórmula divergiu e precisa ajustar <code>src/lib/csv-hash.ts</code>.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo CSV</CardTitle>
          <CardDescription>
            Cabeçalhos esperados: <code>data, tipo, empresa_id, unidade_id, categoria_id, subcategoria, descricao, valor, arquivo_origem, aba_origem, linha_origem</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Arquivo CSV</Label>
            <Input type="file" accept=".csv,text/csv" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleParse(f);
            }} />
          </div>

          {parseResult && (
            <div className="text-sm space-y-1">
              <div>Total de linhas válidas: <strong>{parseResult.rows.length}</strong></div>
              {parseResult.errors.length > 0 && (
                <details className="text-destructive">
                  <summary>{parseResult.errors.length} linha(s) com erro</summary>
                  <ul className="text-xs mt-1 space-y-0.5">
                    {parseResult.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </details>
              )}
              <Button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending || parseResult.rows.length === 0}
                className="mt-2"
              >
                {importMutation.isPending ? "Importando..." : `Importar ${parseResult.rows.length} linhas`}
              </Button>
            </div>
          )}

          {summary && (
            <Alert>
              <AlertTitle>Resumo</AlertTitle>
              <AlertDescription>
                <strong>{summary.inseridos}</strong> novos · <strong>{summary.ignorados}</strong> ignorados por duplicata.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead className="text-right">Inseridos</TableHead>
              <TableHead className="text-right">Ignorados</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {historico.data?.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{formatDate(i.data)}</TableCell>
                  <TableCell className="text-sm">{i.arquivo ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{i.linhas_inseridas ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{i.linhas_ignoradas ?? 0}</TableCell>
                </TableRow>
              ))}
              {(historico.data?.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sem importações.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
