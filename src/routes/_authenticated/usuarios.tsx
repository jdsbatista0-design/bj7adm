import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { from, asRows, asRow } from "@/integrations/supabase/db";
import type { UsuarioRow, PapelRow, UsuarioEmpresaRow } from "@/integrations/supabase/database";
import { useCurrentUser } from "@/contexts/auth-context";
import { podeGerirUsuarios } from "@/lib/permissions";
import { useEmpresas } from "@/hooks/use-refs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, UserPlus, Link2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { MENU_CATALOG, type MenuNode } from "@/lib/menu-catalog";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsuariosPage,
});

function UsuariosPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const empresas = useEmpresas();
  const [editing, setEditing] = useState<UsuarioRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [conviteOpen, setConviteOpen] = useState(false);

  // Todos os hooks ficam ANTES de qualquer return condicional (rules of hooks).
  const usuarios = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const r = await from("usuarios").select("*").order("nome");
      if (r.error) throw r.error;
      return asRows("usuarios", r.data);
    },
  });

  const papeis = useQuery({
    queryKey: ["papeis"],
    queryFn: async () => {
      const r = await from("papeis").select("*").order("id");
      if (r.error) throw r.error;
      return asRows("papeis", r.data);
    },
  });

  useEffect(() => {
    if (!podeGerirUsuarios(user)) void navigate({ to: "/" });
  }, [user, navigate]);

  if (!podeGerirUsuarios(user)) return null;

  const papelNome = (id: number | null) => papeis.data?.find((p) => p.id === id)?.nome ?? "—";

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(u: UsuarioRow) {
    setEditing(u);
    setDialogOpen(true);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            {usuarios.data?.length ?? 0} usuário(s) cadastrado(s).
          </p>
        </div>
        <Button onClick={openNew}>
          <UserPlus className="h-4 w-4 mr-1" /> Novo usuário
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Vínculo auth</TableHead>
                <TableHead className="w-20">Ativo</TableHead>
                <TableHead className="w-20 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {!usuarios.isLoading && (usuarios.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum usuário cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {usuarios.data?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="text-sm">{u.nome ?? "—"}</TableCell>
                  <TableCell className="text-sm">{u.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{papelNome(u.papel_id)}</Badge>
                  </TableCell>
                  <TableCell>
                    {u.auth_uid ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        vinculado
                      </Badge>
                    ) : (
                      <Badge variant="secondary">pendente (1º login)</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.ativo === false ? (
                      <Badge variant="secondary">inativo</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        sim
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(u)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Novos usuários precisam ser criados também em <strong>Auth &rarr; Users</strong> no
        Supabase. O vínculo do <code>auth_uid</code> é feito automaticamente no primeiro login
        (função <code>ensure_self_usuario</code>), desde que o e-mail aqui seja idêntico ao do Auth.
      </p>

      <UsuarioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        usuario={editing}
        papeis={papeis.data ?? []}
        empresas={empresas.data ?? []}
        currentUserId={user.id}
      />
    </div>
  );
}

interface UsuarioDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  usuario: UsuarioRow | null;
  papeis: PapelRow[];
  empresas: { id: number; nome: string }[];
  currentUserId: number;
}

function UsuarioDialog({
  open,
  onOpenChange,
  usuario,
  papeis,
  empresas,
  currentUserId,
}: UsuarioDialogProps) {
  const qc = useQueryClient();
  const isEdit = !!usuario;
  const isSelf = !!usuario && usuario.id === currentUserId;

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papelId, setPapelId] = useState<number | null>(null);
  const [veRetiradas, setVeRetiradas] = useState(false);
  const [veFaturamento, setVeFaturamento] = useState(false);
  const [veTodasEmpresas, setVeTodasEmpresas] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [empresaIds, setEmpresaIds] = useState<number[]>([]);

  const vinculos = useQuery({
    queryKey: ["usuario_empresas", usuario?.id],
    queryFn: async () => {
      if (!usuario) return [] as UsuarioEmpresaRow[];
      const r = await from("usuario_empresas").select("*").eq("usuario_id", usuario.id);
      if (r.error) throw r.error;
      return asRows("usuario_empresas", r.data);
    },
    enabled: open && !!usuario,
  });

  useEffect(() => {
    if (!open) return;
    if (usuario) {
      setNome(usuario.nome ?? "");
      setEmail(usuario.email ?? "");
      setPapelId(usuario.papel_id);
      setVeRetiradas(!!usuario.ve_retiradas);
      setVeFaturamento(!!usuario.ve_faturamento);
      setVeTodasEmpresas(!!usuario.ve_todas_empresas);
      setAtivo(usuario.ativo ?? true);
      // empresaIds vem do query de vínculos (effect abaixo)
    } else {
      setNome("");
      setEmail("");
      setPapelId(papeis[0]?.id ?? null);
      setVeRetiradas(false);
      setVeFaturamento(false);
      setVeTodasEmpresas(false);
      setAtivo(true);
      setEmpresaIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, usuario?.id]);

  useEffect(() => {
    if (open && usuario && vinculos.data) {
      setEmpresaIds(vinculos.data.map((v) => v.empresa_id));
    }
  }, [open, usuario, vinculos.data]);

  const save = useMutation({
    mutationFn: async () => {
      const emailNorm = email.trim().toLowerCase();
      if (!emailNorm) throw new Error("E-mail obrigatório");
      if (!papelId) throw new Error("Selecione um papel");

      const payload = {
        nome: nome.trim() || null,
        email: emailNorm,
        papel_id: papelId,
        ve_retiradas: veRetiradas,
        ve_faturamento: veFaturamento,
        ve_todas_empresas: veTodasEmpresas,
        ativo,
      };

      let usuarioId: number;
      if (isEdit && usuario) {
        const r = await from("usuarios").update(payload).eq("id", usuario.id).select("*").single();
        if (r.error) throw r.error;
        usuarioId = usuario.id;
      } else {
        const r = await from("usuarios").insert(payload).select("*").single();
        if (r.error) throw r.error;
        const inserted = asRow("usuarios", r.data);
        if (!inserted) throw new Error("Falha ao criar usuário");
        usuarioId = inserted.id;
      }

      // Sincroniza vínculos de empresa: limpa e regrava a seleção atual.
      const del = await from("usuario_empresas").delete().eq("usuario_id", usuarioId);
      if (del.error) throw del.error;

      if (!veTodasEmpresas && empresaIds.length > 0) {
        const ins = await from("usuario_empresas").insert(
          empresaIds.map((empresa_id) => ({ usuario_id: usuarioId, empresa_id })),
        );
        if (ins.error) throw ins.error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      qc.invalidateQueries({ queryKey: ["usuario_empresas"] });
      toast.success(isEdit ? "Usuário atualizado" : "Usuário criado");
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  function toggleEmpresa(id: number) {
    setEmpresaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar usuário" : "Novo usuário"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do usuário"
              />
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@bj7..."
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Papel</Label>
            <Select
              value={papelId != null ? String(papelId) : ""}
              onValueChange={(v) => setPapelId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o papel" />
              </SelectTrigger>
              <SelectContent>
                {papeis.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label className="font-normal">Vê faturamento (Receita / Stone)</Label>
              <Switch checked={veFaturamento} onCheckedChange={setVeFaturamento} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Vê retiradas</Label>
              <Switch checked={veRetiradas} onCheckedChange={setVeRetiradas} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Vê todas as empresas</Label>
              <Switch checked={veTodasEmpresas} onCheckedChange={setVeTodasEmpresas} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Ativo</Label>
              <Switch checked={ativo} onCheckedChange={setAtivo} disabled={isSelf} />
            </div>
            {isSelf && (
              <p className="text-xs text-muted-foreground">
                Você está editando o próprio usuário — o campo “Ativo” fica bloqueado para evitar
                que você perca o acesso.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="font-normal">
              Empresas vinculadas{" "}
              {veTodasEmpresas && (
                <span className="text-muted-foreground">(ignorado: vê todas as empresas)</span>
              )}
            </Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
              {empresas.length === 0 && (
                <p className="text-xs text-muted-foreground col-span-2">
                  Nenhuma empresa cadastrada.
                </p>
              )}
              {empresas.map((emp) => (
                <label key={emp.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={empresaIds.includes(emp.id)}
                    onCheckedChange={() => toggleEmpresa(emp.id)}
                    disabled={veTodasEmpresas}
                  />
                  <span className={veTodasEmpresas ? "text-muted-foreground" : ""}>{emp.nome}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
