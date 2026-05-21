import { createFileRoute } from "@tanstack/react-router";
import { useState, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw, Link2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useEmpresas } from "@/hooks/use-refs";
import { PageShell } from "@/components/bj7/PageShell";

// react-pluggy-connect depends on `zoid`, which touches `window` at module
// scope. Load it lazily on the client so it never executes during SSR.
const PluggyConnect = lazy(() =>
  import("react-pluggy-connect").then((m) => ({ default: m.PluggyConnect })),
);
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/open-finance/conectar")({
  component: OpenFinanceConectarPage,
});

type ConnectionRow = {
  id: number | string;
  empresa_id: number;
  pluggy_item_id: string | null;
  pluggy_connector_id: number | null;
  connector_name: string | null;
  status: string | null;
  consent_expires_at: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_error: string | null;
};

function statusVariant(status: string | null): {
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
} {
  switch ((status ?? "").toUpperCase()) {
    case "UPDATED":
      return { variant: "default", className: "bg-emerald-600 hover:bg-emerald-600 text-white" };
    case "UPDATING":
      return { variant: "default", className: "bg-blue-600 hover:bg-blue-600 text-white" };
    case "LOGIN_ERROR":
    case "ERROR":
      return { variant: "destructive", className: "" };
    case "OUTDATED":
      return { variant: "default", className: "bg-yellow-500 hover:bg-yellow-500 text-black" };
    case "WAITING_USER_INPUT":
      return { variant: "default", className: "bg-orange-500 hover:bg-orange-500 text-white" };
    default:
      return { variant: "secondary", className: "" };
  }
}

function formatLastSync(iso: string | null): string {
  if (!iso) return "Nunca";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "—";
  }
}

type WidgetState = {
  token: string;
  empresaId: number;
} | null;

function OpenFinanceConectarPage() {
  const empresas = useEmpresas();
  const queryClient = useQueryClient();

  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("");
  const [conectando, setConectando] = useState(false);
  const [syncingId, setSyncingId] = useState<string | number | null>(null);
  const [reconectandoId, setReconectandoId] = useState<string | number | null>(null);
  const [widget, setWidget] = useState<WidgetState>(null);

  const empresaNomeById = (id: number): string => {
    const e = (empresas.data ?? []).find((x) => x.id === id);
    return e?.nome ?? `#${id}`;
  };

  const conexoesQ = useQuery({
    queryKey: ["openfinance-connections"],
    queryFn: async () => {
      const r = await supabase
        .from("openfinance_connections")
        .select("*")
        .order("id", { ascending: false });
      if (r.error) throw r.error;
      return (r.data ?? []) as unknown as ConnectionRow[];
    },
  });

  const recarregarConexoes = () => {
    void queryClient.invalidateQueries({ queryKey: ["openfinance-connections"] });
  };

  function closeWidget() {
    setWidget(null);
    setConectando(false);
    setReconectandoId(null);
  }

  async function handleConectar() {
    if (!empresaSelecionada) return;
    setConectando(true);
    try {
      const empresaId = Number(empresaSelecionada);
      const { data, error } = await supabase.functions.invoke("pluggy-auth", {
        body: { empresa_id: empresaId },
      });
      if (error) throw error;
      const accessToken = (data as { accessToken?: string } | null)?.accessToken;
      if (!accessToken) throw new Error("Resposta sem accessToken");
      setWidget({ token: accessToken, empresaId });
    } catch (e) {
      toast.error("Erro ao iniciar conexão: " + ((e as Error)?.message || "desconhecido"));
      setConectando(false);
    }
  }

  async function handleSync(row: ConnectionRow) {
    setSyncingId(row.id);
    try {
      const { error } = await supabase.functions.invoke("pluggy-sync", {
        body: { item_id: row.pluggy_item_id, connection_id: row.id },
      });
      if (error) throw error;
      toast.success("Sincronização iniciada");
      recarregarConexoes();
    } catch (e) {
      toast.error("Erro ao sincronizar: " + ((e as Error)?.message || "desconhecido"));
    } finally {
      setSyncingId(null);
    }
  }

  async function handleReconectar(row: ConnectionRow) {
    setReconectandoId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("pluggy-auth", {
        body: { empresa_id: row.empresa_id, item_id: row.pluggy_item_id },
      });
      if (error) throw error;
      const accessToken = (data as { accessToken?: string } | null)?.accessToken;
      if (!accessToken) throw new Error("Resposta sem accessToken");
      setWidget({ token: accessToken, empresaId: row.empresa_id });
    } catch (e) {
      toast.error("Erro ao reconectar: " + ((e as Error)?.message || "desconhecido"));
      setReconectandoId(null);
    }
  }

  return (
    <PageShell
      title="Conectar Conta Bancária via Open Finance"
      description="Autorize o BJ7 Central a ler o extrato bancário das empresas do grupo"
    >
      <Card>
        <CardHeader>
          <CardTitle>Nova conexão</CardTitle>
          <CardDescription>
            Selecione uma empresa do grupo e abra o widget seguro do Pluggy para autorizar o acesso
            ao extrato bancário.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 max-w-md">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Empresa
              </label>
              <Select
                value={empresaSelecionada}
                onValueChange={setEmpresaSelecionada}
                disabled={empresas.isLoading || conectando}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {(empresas.data ?? []).map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleConectar}
              disabled={!empresaSelecionada || conectando}
              className="sm:w-auto"
            >
              {conectando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Conectar conta bancária
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Conexões existentes</CardTitle>
          <CardDescription>
            Bancos já autorizados, status de sincronização e ações por conexão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {conexoesQ.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : conexoesQ.error ? (
            <div className="text-sm text-destructive">
              Erro ao carregar conexões: {(conexoesQ.error as Error).message}
            </div>
          ) : (conexoesQ.data ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma conexão cadastrada.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último sync</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(conexoesQ.data ?? []).map((row) => {
                  const sv = statusVariant(row.status);
                  return (
                    <TableRow key={String(row.id)}>
                      <TableCell className="font-medium">{empresaNomeById(row.empresa_id)}</TableCell>
                      <TableCell>{row.connector_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={sv.variant} className={sv.className}>
                          {row.status ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatLastSync(row.last_sync_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={syncingId === row.id}
                            onClick={() => handleSync(row)}
                          >
                            {syncingId === row.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-1 h-3 w-3" />
                            )}
                            Sincronizar agora
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={reconectandoId === row.id}
                            onClick={() => handleReconectar(row)}
                          >
                            {reconectandoId === row.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Link2 className="mr-1 h-3 w-3" />
                            )}
                            Reconectar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {widget && PluggyConnect ? (
        <PluggyConnect
          connectToken={widget.token}
          includeSandbox={false}
          onSuccess={async (itemData: { item: { id: string; connector?: { id?: number; name?: string } } }) => {
            try {
              const { error } = await supabase.functions.invoke("pluggy-register-item", {
                body: {
                  empresa_id: widget.empresaId,
                  item_id: itemData?.item?.id,
                  connector_id: itemData?.item?.connector?.id,
                  connector_name: itemData?.item?.connector?.name,
                },
              });
              if (error) throw error;
              toast.success("Conta conectada com sucesso!");
              recarregarConexoes();
            } catch (e) {
              toast.error("Erro ao registrar conexão: " + ((e as Error)?.message || "desconhecido"));
            }
          }}
          onError={(error: { message?: string }) => {
            toast.error("Erro ao conectar: " + (error?.message || "desconhecido"));
          }}
          onClose={closeWidget}
        />
      ) : null}
    </PageShell>
  );
}
