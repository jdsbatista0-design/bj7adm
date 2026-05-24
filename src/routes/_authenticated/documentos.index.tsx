import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresas } from "@/hooks/use-refs";
import { PageShell } from "@/components/bj7/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus, Search, FileText, Download, Pencil, Trash2, GitBranch,
  AlertTriangle, FolderOpen, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/documentos/")({
  component: DocumentosIndex,
});

type Dashboard = {
  docs_ativos: number; docs_vencidos: number;
  vencendo_30d: number; vencendo_90d: number;
  compromisso_mensal_total: number;
};
type Tipo = { id: number; codigo: string; nome: string; categoria: string; ativo: boolean | null };
type DocRow = {
  id: number; tipo_id: number; titulo: string; descricao: string | null;
  numero_referencia: string | null; contraparte_nome: string | null;
  contraparte_cnpj: string | null; contraparte_cpf: string | null;
  vigencia_inicio: string | null; vigencia_fim: string | null;
  valor_total: number | null; valor_mensal: number | null; status: string;
  renovacao_automatica: boolean | null; documento_pai_id: number | null;
  versao: string | null;
  arquivo_path: string | null; arquivo_nome: string | null;
  arquivo_tamanho_kb: number | null; arquivo_mime: string | null;
  tags: string[] | null; notas: string | null;
  created_at: string | null;
};
type Empresa = { id: number; nome: string };

const STATUS_OPTS = ["ATIVO", "VENCIDO", "ENCERRADO", "RENOVADO", "CANCELADO"];
const PAPEIS = ["PRINCIPAL", "INTERVENIENTE", "GARANTIDORA", "ANUENTE"];

const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};
const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n));
const daysBetween = (target: string | null) => {
  if (!target) return null;
  const t = new Date(target).getTime();
  return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
};

export default function DocumentosIndex() {
  const qc = useQueryClient();
  const empresasQ = useEmpresas();

  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [empresaFilter, setEmpresaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<DocRow | null>(null);
  const [versoesDoc, setVersoesDoc] = useState<DocRow | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string; mime: string | null } | null>(null);

  const dashQ = useQuery<Dashboard>({
    queryKey: ["documentos", "dashboard"],
    queryFn: async () => {
      const r = await supabase.schema("documentos" as never).from("v_dashboard").select("*").limit(1);
      if (r.error) throw r.error;
      return ((r.data?.[0] as Dashboard) ?? { docs_ativos: 0, docs_vencidos: 0, vencendo_30d: 0, vencendo_90d: 0, compromisso_mensal_total: 0 });
    },
    staleTime: 5 * 60 * 1000,
  });

  const tiposQ = useQuery<Tipo[]>({
    queryKey: ["documentos", "tipos"],
    queryFn: async () => {
      const r = await supabase.schema("documentos" as never).from("tipos").select("*").order("categoria").order("nome");
      if (r.error) throw r.error;
      return (r.data ?? []) as Tipo[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const docsQ = useQuery<{ rows: DocRow[]; count: number }>({
    queryKey: ["documentos", "list", { search, tipoFilter, empresaFilter, statusFilter, page }],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      // Se filtro de empresa ativo: buscar IDs vinculados no banco antes de paginar.
      // Isso garante count e paginação corretos (filtro no servidor, não no frontend).
      let allowedIds: number[] | null = null;
      if (empresaFilter !== "all") {
        const empId = Number(empresaFilter);
        const idsRes = await supabase
          .schema("documentos" as never)
          .from("documento_empresas")
          .select("documento_id")
          .eq("empresa_id", empId);
        if (idsRes.error) throw idsRes.error;
        allowedIds = (idsRes.data ?? []).map(
          (r: { documento_id: number }) => r.documento_id,
        );
        if (allowedIds.length === 0) return { rows: [], count: 0 };
      }

      let q = supabase.schema("documentos" as never)
        .from("documentos")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`titulo.ilike.${s},contraparte_nome.ilike.${s},numero_referencia.ilike.${s}`);
      }
      if (tipoFilter !== "all") q = q.eq("tipo_id", Number(tipoFilter));
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (allowedIds !== null) q = q.in("id", allowedIds);
      const r = await q;
      if (r.error) throw r.error;
      return { rows: (r.data ?? []) as DocRow[], count: r.count ?? 0 };
    },
    staleTime: 30 * 1000,
  });

  // Empresas vinculadas (para coluna "Empresa(s)")
  const docIds = useMemo(() => (docsQ.data?.rows ?? []).map(d => d.id), [docsQ.data]);
  const empresasLinksQ = useQuery({
    queryKey: ["documentos", "empresas-links", docIds],
    enabled: docIds.length > 0,
    queryFn: async () => {
      const r = await supabase.schema("documentos" as never)
        .from("documento_empresas")
        .select("documento_id, empresa_id, papel")
        .in("documento_id", docIds);
      if (r.error) throw r.error;
      return (r.data ?? []) as { documento_id: number; empresa_id: number; papel: string | null }[];
    },
  });

  const empresasById = useMemo(() => {
    const m = new Map<number, string>();
    (empresasQ.data ?? []).forEach((e) => m.set((e as Empresa).id, (e as Empresa).nome));
    return m;
  }, [empresasQ.data]);

  const tiposById = useMemo(() => {
    const m = new Map<number, Tipo>();
    (tiposQ.data ?? []).forEach((t) => m.set(t.id, t));
    return m;
  }, [tiposQ.data]);

  const empresasByDoc = useMemo(() => {
    const m = new Map<number, string[]>();
    (empresasLinksQ.data ?? []).forEach((l) => {
      const arr = m.get(l.documento_id) ?? [];
      arr.push(empresasById.get(l.empresa_id) ?? `#${l.empresa_id}`);
      m.set(l.documento_id, arr);
    });
    return m;
  }, [empresasLinksQ.data, empresasById]);

  const filteredRows = docsQ.data?.rows ?? [];

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.schema("documentos" as never).from("documentos").delete().eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Documento excluído");
      qc.invalidateQueries({ queryKey: ["documentos"] });
      setDeletingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openPreview = async (d: DocRow) => {
    if (!d.arquivo_path) { toast.error("Sem arquivo"); return; }
    const { data, error } = await supabase.storage.from("documentos-bj7").createSignedUrl(d.arquivo_path, 300);
    if (error) { toast.error(error.message); return; }
    setPreviewDoc({ url: data.signedUrl, name: d.arquivo_nome ?? d.titulo, mime: d.arquivo_mime });
  };
  const downloadDoc = async (path: string | null, name: string | null) => {
    if (!path) { toast.error("Sem arquivo"); return; }
    const { data, error } = await supabase.storage.from("documentos-bj7").createSignedUrl(path, 60, { download: name ?? true });
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const totalPages = Math.ceil((docsQ.data?.count ?? 0) / pageSize);

  return (
    <PageShell
      title="Repositório de Documentos"
      description="Contratos, certidões, comprovantes e outros"
      actions={
        <Button onClick={() => { setEditing(null); setOpenCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar documento
        </Button>
      }
    >
      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <KpiCard label="Documentos ativos" value={dashQ.data?.docs_ativos} icon={<FileText className="h-4 w-4" />} loading={dashQ.isLoading} />
        <KpiCard label="Vencidos" value={dashQ.data?.docs_vencidos} tone="danger" icon={<AlertTriangle className="h-4 w-4" />} loading={dashQ.isLoading} />
        <KpiCard label="Vencendo (30d)" value={dashQ.data?.vencendo_30d} tone="warning" loading={dashQ.isLoading} />
        <KpiCard label="Compromisso mensal" value={fmtMoney(dashQ.data?.compromisso_mensal_total)} loading={dashQ.isLoading} />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-3 grid gap-2 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar título, contraparte, nº ref" className="pl-8"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {(tiposQ.data ?? []).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={empresaFilter} onValueChange={(v) => { setEmpresaFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {(empresasQ.data ?? []).map((e) => {
                const emp = e as Empresa;
                return <SelectItem key={emp.id} value={String(emp.id)}>{emp.nome}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Contraparte</TableHead>
                <TableHead>Empresa(s)</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docsQ.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredRows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum documento</TableCell></TableRow>
              ) : (
                filteredRows.map((d) => {
                  const tipo = tiposById.get(d.tipo_id);
                  const days = daysBetween(d.vigencia_fim);
                  const venceCor = days == null ? "" : days < 0 ? "text-destructive" : days <= 30 ? "text-amber-600" : "text-emerald-600";
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.titulo}</TableCell>
                      <TableCell><Badge variant="outline">{tipo?.nome ?? "—"}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tipo?.categoria ?? "—"}</TableCell>
                      <TableCell>{d.contraparte_nome ?? "—"}</TableCell>
                      <TableCell className="text-xs">{(empresasByDoc.get(d.id) ?? []).join(", ") || "—"}</TableCell>
                      <TableCell className={cn("text-xs", venceCor)}>
                        {d.vigencia_fim ? `${fmtDate(d.vigencia_fim)}${days != null ? ` (${days < 0 ? `${-days}d atrás` : `${days}d`})` : ""}` : "—"}
                      </TableCell>
                      <TableCell>{fmtMoney(d.valor_total ?? d.valor_mensal)}</TableCell>
                      <TableCell><Badge variant={d.status === "ATIVO" ? "default" : "secondary"}>{d.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {d.arquivo_path && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => openPreview(d)} title="Visualizar">
                                <FileText className="h-4 w-4 text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => downloadDoc(d.arquivo_path, d.arquivo_nome)} title="Baixar">
                                <Download className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(d); setOpenCreate(true); }} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setVersoesDoc(d)} title="Versões/Aditivos">
                            <GitBranch className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeletingId(d.id)} title="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>{docsQ.data?.count ?? 0} documento(s)</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <span>Pág. {page + 1}{totalPages ? ` / ${totalPages}` : ""}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
        </div>
      </div>

      {/* Modal criar/editar */}
      <DocumentoFormModal
        open={openCreate}
        onOpenChange={(o) => { setOpenCreate(o); if (!o) setEditing(null); }}
        editing={editing}
        tipos={tiposQ.data ?? []}
        empresas={(empresasQ.data ?? []) as Empresa[]}
        parentDoc={null}
      />

      {/* Versões */}
      <Dialog open={!!versoesDoc} onOpenChange={(o) => !o && setVersoesDoc(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Versões / Aditivos — {versoesDoc?.titulo}</DialogTitle></DialogHeader>
          {versoesDoc && <VersoesPanel doc={versoesDoc} onAddAditivo={() => {
            setEditing(null); setOpenCreate(true);
          }} parentForCreate={versoesDoc} setEditing={setEditing} setOpenCreate={setOpenCreate} />}
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteMut.mutate(deletingId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview de arquivo */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="text-sm truncate">{previewDoc?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-muted">
            {previewDoc && (
              previewDoc.mime?.startsWith("image/") ? (
                <img src={previewDoc.url} alt={previewDoc.name} className="w-full h-full object-contain" />
              ) : (
                <iframe src={previewDoc.url} className="w-full h-full" title={previewDoc.name} />
              )
            )}
          </div>
          <div className="px-4 py-2 border-t flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => previewDoc && window.open(previewDoc.url, "_blank", "noopener,noreferrer")}>
              Abrir em nova aba
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function KpiCard({ label, value, tone, icon, loading }: {
  label: string; value: number | string | undefined; tone?: "danger" | "warning"; icon?: React.ReactNode; loading?: boolean;
}) {
  const toneCls = tone === "danger" ? "text-destructive" : tone === "warning" ? "text-amber-600" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1">{icon} {label}</div>
        {loading ? <Skeleton className="h-7 w-20 mt-2" /> : (
          <div className={cn("text-2xl font-semibold mt-1", toneCls)}>{value ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}

function VersoesPanel({
  doc, parentForCreate, setEditing, setOpenCreate,
}: {
  doc: DocRow; parentForCreate: DocRow; onAddAditivo: () => void;
  setEditing: (d: DocRow | null) => void; setOpenCreate: (o: boolean) => void;
}) {
  const versoesQ = useQuery<DocRow[]>({
    queryKey: ["documentos", "versoes", doc.id],
    queryFn: async () => {
      const rootId = doc.documento_pai_id ?? doc.id;
      const r = await supabase.schema("documentos" as never)
        .from("documentos")
        .select("*")
        .or(`id.eq.${rootId},documento_pai_id.eq.${rootId}`)
        .order("created_at");
      if (r.error) throw r.error;
      return (r.data ?? []) as DocRow[];
    },
  });

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Documentos relacionados (versão atual + aditivos)
      </div>
      {versoesQ.isLoading ? <Skeleton className="h-24 w-full" /> : (
        <div className="space-y-2">
          {(versoesQ.data ?? []).map((v) => (
            <div key={v.id} className="flex items-center justify-between border rounded p-2 text-sm">
              <div>
                <div className="font-medium">{v.titulo} <Badge variant="outline" className="ml-1 text-xs">v{v.versao ?? "—"}</Badge></div>
                <div className="text-xs text-muted-foreground">{fmtDate(v.vigencia_inicio)} → {fmtDate(v.vigencia_fim)} • {v.status}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(v); setOpenCreate(true); }}>Abrir</Button>
            </div>
          ))}
        </div>
      )}
      <Button size="sm" onClick={() => {
        setEditing({ ...parentForCreate, id: 0, documento_pai_id: parentForCreate.id, versao: null, arquivo_path: null, arquivo_nome: null } as DocRow);
        setOpenCreate(true);
      }}>
        <Plus className="h-4 w-4 mr-1" /> Adicionar aditivo
      </Button>
    </div>
  );
}

// =================== Modal create/edit ===================
function DocumentoFormModal({
  open, onOpenChange, editing, tipos, empresas,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  editing: DocRow | null;
  tipos: Tipo[]; empresas: Empresa[]; parentDoc: DocRow | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!editing && editing.id > 0;
  const isAditivo = !!editing && editing.id === 0 && editing.documento_pai_id != null;

  const [form, setForm] = useState({
    tipo_id: editing?.tipo_id ?? 0,
    titulo: editing?.titulo ?? "",
    descricao: editing?.descricao ?? "",
    numero_referencia: editing?.numero_referencia ?? "",
    contraparte_nome: editing?.contraparte_nome ?? "",
    contraparte_cnpj: editing?.contraparte_cnpj ?? "",
    vigencia_inicio: editing?.vigencia_inicio ?? "",
    vigencia_fim: editing?.vigencia_fim ?? "",
    renovacao_automatica: editing?.renovacao_automatica ?? false,
    valor_total: editing?.valor_total ?? "" as number | string | "",
    valor_mensal: editing?.valor_mensal ?? "" as number | string | "",
    status: editing?.status ?? "ATIVO",
    notas: editing?.notas ?? "",
    tags: (editing?.tags ?? []).join(", "),
    documento_pai_id: editing?.documento_pai_id ?? null,
    versao: editing?.versao ?? "1.0",
  });
  const [empresasSel, setEmpresasSel] = useState<{ empresa_id: number; papel: string }[]>([]);
  const [file, setFile] = useState<File | null>(null);

  useMemo(() => {
    if (open && editing && editing.id > 0) {
      supabase.schema("documentos" as never)
        .from("documento_empresas")
        .select("empresa_id, papel")
        .eq("documento_id", editing.id)
        .then((r) => {
          if (!r.error && r.data) {
            setEmpresasSel(r.data.map((x) => ({ empresa_id: (x as { empresa_id: number }).empresa_id, papel: (x as { papel: string | null }).papel ?? "PRINCIPAL" })));
          }
        });
    } else if (open && !editing) {
      setEmpresasSel([]);
    } else if (open && isAditivo) {
      setEmpresasSel([]);
    }
  }, [open, editing, isAditivo]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.tipo_id) throw new Error("Selecione o tipo");
      if (!form.titulo.trim()) throw new Error("Título obrigatório");

      let arquivo_path = editing?.arquivo_path ?? null;
      let arquivo_nome = editing?.arquivo_nome ?? null;
      let arquivo_tamanho_kb = editing?.arquivo_tamanho_kb ?? null;
      let arquivo_mime = editing?.arquivo_mime ?? null;

      if (file) {
        const tipo = tipos.find(t => t.id === form.tipo_id);
        const empresaPath = empresasSel[0]?.empresa_id ?? "grupo";
        const path = `${empresaPath}/${tipo?.codigo ?? "doc"}/${crypto.randomUUID()}_${file.name.replace(/[^\w.\-]/g, "_")}`;
        const up = await supabase.storage.from("documentos-bj7").upload(path, file, { contentType: file.type });
        if (up.error) throw up.error;
        arquivo_path = path;
        arquivo_nome = file.name;
        arquivo_tamanho_kb = Math.round(file.size / 1024);
        arquivo_mime = file.type;
      }

      const payload = {
        tipo_id: form.tipo_id,
        titulo: form.titulo,
        descricao: form.descricao || null,
        numero_referencia: form.numero_referencia || null,
        contraparte_nome: form.contraparte_nome || null,
        contraparte_cnpj: form.contraparte_cnpj || null,
        vigencia_inicio: form.vigencia_inicio || null,
        vigencia_fim: form.vigencia_fim || null,
        renovacao_automatica: form.renovacao_automatica,
        valor_total: form.valor_total === "" ? null : Number(form.valor_total),
        valor_mensal: form.valor_mensal === "" ? null : Number(form.valor_mensal),
        status: form.status,
        notas: form.notas || null,
        tags: form.tags.trim() ? form.tags.split(",").map(s => s.trim()).filter(Boolean) : null,
        documento_pai_id: form.documento_pai_id,
        versao: form.versao || "1.0",
        arquivo_path, arquivo_nome, arquivo_tamanho_kb, arquivo_mime,
      };

      let docId: number;
      if (isEdit) {
        const r = await supabase.schema("documentos" as never).from("documentos").update(payload).eq("id", editing!.id).select("id").single();
        if (r.error) throw r.error;
        docId = (r.data as { id: number }).id;
        // refresh empresa links: delete then insert
        await supabase.schema("documentos" as never).from("documento_empresas").delete().eq("documento_id", docId);
      } else {
        const r = await supabase.schema("documentos" as never).from("documentos").insert(payload).select("id").single();
        if (r.error) throw r.error;
        docId = (r.data as { id: number }).id;
      }
      if (empresasSel.length > 0) {
        const rows = empresasSel.map(es => ({ documento_id: docId, empresa_id: es.empresa_id, papel: es.papel }));
        const rIns = await supabase.schema("documentos" as never).from("documento_empresas").insert(rows);
        if (rIns.error) throw rIns.error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Documento atualizado" : "Documento criado");
      qc.invalidateQueries({ queryKey: ["documentos"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar documento" : isAditivo ? "Adicionar aditivo" : "Novo documento"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Tipo *</Label>
            <Select value={form.tipo_id ? String(form.tipo_id) : ""} onValueChange={(v) => setForm(f => ({ ...f, tipo_id: Number(v) }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {tipos.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.categoria} • {t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => setForm(f => ({ ...f, titulo: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div>
            <Label>Número de referência</Label>
            <Input value={form.numero_referencia} onChange={(e) => setForm(f => ({ ...f, numero_referencia: e.target.value }))} placeholder="CT-2024-001" />
          </div>
          <div>
            <Label>Versão</Label>
            <Input value={form.versao ?? ""} onChange={(e) => setForm(f => ({ ...f, versao: e.target.value }))} />
          </div>
          <div>
            <Label>Contraparte (nome)</Label>
            <Input value={form.contraparte_nome} onChange={(e) => setForm(f => ({ ...f, contraparte_nome: e.target.value }))} />
          </div>
          <div>
            <Label>Contraparte (CNPJ/CPF)</Label>
            <Input value={form.contraparte_cnpj} onChange={(e) => setForm(f => ({ ...f, contraparte_cnpj: e.target.value }))} />
          </div>
          <div>
            <Label>Vigência início</Label>
            <Input type="date" value={form.vigencia_inicio ?? ""} onChange={(e) => setForm(f => ({ ...f, vigencia_inicio: e.target.value }))} />
          </div>
          <div>
            <Label>Vigência fim</Label>
            <Input type="date" value={form.vigencia_fim ?? ""} onChange={(e) => setForm(f => ({ ...f, vigencia_fim: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Switch checked={form.renovacao_automatica} onCheckedChange={(c) => setForm(f => ({ ...f, renovacao_automatica: c }))} />
            <Label>Renovação automática</Label>
          </div>
          <div>
            <Label>Valor total (R$)</Label>
            <Input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm(f => ({ ...f, valor_total: e.target.value }))} />
          </div>
          <div>
            <Label>Valor mensal (R$)</Label>
            <Input type="number" step="0.01" value={form.valor_mensal} onChange={(e) => setForm(f => ({ ...f, valor_mensal: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label>Tags (separadas por vírgula)</Label>
            <Input value={form.tags} onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="urgente, juridico" />
          </div>
          <div className="md:col-span-2">
            <Label>Empresas vinculadas</Label>
            <div className="space-y-2 border rounded p-2">
              {empresasSel.map((es, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Select value={String(es.empresa_id)} onValueChange={(v) => {
                    const arr = [...empresasSel]; arr[idx] = { ...arr[idx], empresa_id: Number(v) }; setEmpresasSel(arr);
                  }}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{empresas.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={es.papel} onValueChange={(v) => {
                    const arr = [...empresasSel]; arr[idx] = { ...arr[idx], papel: v }; setEmpresasSel(arr);
                  }}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>{PAPEIS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => setEmpresasSel(empresasSel.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setEmpresasSel([...empresasSel, { empresa_id: empresas[0]?.id ?? 0, papel: "PRINCIPAL" }])}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar empresa
              </Button>
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Arquivo (PDF/imagem)</Label>
            <Input type="file" accept=".pdf,image/*,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {editing?.arquivo_nome && !file && <div className="text-xs text-muted-foreground mt-1">Atual: {editing.arquivo_nome}</div>}
          </div>
          <div className="md:col-span-2">
            <Label>Notas</Label>
            <Textarea value={form.notas} onChange={(e) => setForm(f => ({ ...f, notas: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
