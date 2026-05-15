import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { from, asRow } from "@/integrations/supabase/db";
import type { LancamentoRow } from "@/integrations/supabase/database";
import { useEmpresas, useUnidades, useCategorias } from "@/hooks/use-refs";
import { useCurrentUser } from "@/contexts/auth-context";
import { tiposVisiveis, podeEditarLancamento } from "@/lib/permissions";
import { toast } from "sonner";

const TIPOS_ALL = ["Receita", "Despesa", "Retirada", "Empréstimo"] as const;

const schema = z.object({
  data: z.string().min(1, "Data obrigatória"),
  tipo: z.enum(TIPOS_ALL),
  empresa_id: z.coerce.number().int().positive("Selecione a empresa"),
  unidade_id: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  categoria_id: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  subcategoria: z.string().max(200).optional().or(z.literal("")),
  descricao: z.string().max(1000).optional().or(z.literal("")),
  valor: z.coerce.number().refine((v) => Number.isFinite(v) && v !== 0, "Valor obrigatório"),
});

type FormVals = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lancamento?: LancamentoRow | null;
}

export function LancamentoDialog({ open, onOpenChange, lancamento }: Props) {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const isEdit = !!lancamento;
  const editavel = !lancamento || podeEditarLancamento(user, lancamento);

  const empresas = useEmpresas();
  const unidades = useUnidades();
  const categorias = useCategorias();

  const tipos = tiposVisiveis(user);

  const form = useForm<FormVals>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      data: new Date().toISOString().slice(0, 10),
      tipo: (tipos[0] as FormVals["tipo"]) ?? "Despesa",
      empresa_id: 0 as unknown as number,
      valor: 0,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (lancamento) {
      form.reset({
        data: lancamento.data,
        tipo: lancamento.tipo as FormVals["tipo"],
        empresa_id: lancamento.empresa_id,
        unidade_id: lancamento.unidade_id ?? undefined,
        categoria_id: lancamento.categoria_id ?? undefined,
        subcategoria: lancamento.subcategoria ?? "",
        descricao: lancamento.descricao ?? "",
        valor: Number(lancamento.valor),
      });
    } else {
      form.reset({
        data: new Date().toISOString().slice(0, 10),
        tipo: (tipos[0] as FormVals["tipo"]) ?? "Despesa",
        empresa_id: 0 as unknown as number,
        unidade_id: undefined,
        categoria_id: undefined,
        subcategoria: "",
        descricao: "",
        valor: 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lancamento?.id]);

  const tipo = form.watch("tipo");
  const empresaId = form.watch("empresa_id");

  const mutation = useMutation({
    mutationFn: async (vals: FormVals) => {
      const d = new Date(vals.data);
      const payload = {
        data: vals.data,
        ano: d.getUTCFullYear(),
        mes: d.getUTCMonth() + 1,
        tipo: vals.tipo,
        empresa_id: vals.empresa_id,
        unidade_id: vals.unidade_id || null,
        categoria_id: vals.categoria_id || null,
        subcategoria: vals.subcategoria || null,
        descricao: vals.descricao || null,
        valor: vals.valor,
      };
      if (isEdit && lancamento) {
        const r = await from("lancamentos")
          .update({ ...payload, atualizado_em: new Date().toISOString() })
          .eq("id", lancamento.id)
          .select("*")
          .single();
        if (r.error) throw r.error;
        return asRow("lancamentos", r.data);
      } else {
        const r = await from("lancamentos")
          .insert({
            ...payload,
            revisado: false,
            contar_no_total: true,
            origem_classificacao: "manual",
            criado_em: new Date().toISOString(),
          })
          .select("*")
          .single();
        if (r.error) throw r.error;
        return asRow("lancamentos", r.data);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      qc.invalidateQueries({ queryKey: ["a-revisar"] });
      toast.success(isEdit ? "Lançamento atualizado" : "Lançamento criado");
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(msg);
    },
  });

  const unidadesFiltradas = (unidades.data ?? []).filter((u) =>
    empresaId ? u.empresa_id === Number(empresaId) : true,
  );
  const categoriasFiltradas = (categorias.data ?? []).filter(
    (c) => !c.tipo_predominante || c.tipo_predominante === tipo,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        </DialogHeader>

        {!editavel && (
          <p className="text-sm text-destructive">
            Este lançamento já está marcado como revisado e seu papel não permite editá-lo.
          </p>
        )}

        <form
          onSubmit={form.handleSubmit((vals) => mutation.mutate(vals))}
          className="space-y-3"
        >
          <fieldset disabled={!editavel || mutation.isPending} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data</Label>
                <Input type="date" {...form.register("data")} />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={form.watch("tipo")}
                  onValueChange={(v) => form.setValue("tipo", v as FormVals["tipo"])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Empresa</Label>
                <Select
                  value={String(form.watch("empresa_id") || "")}
                  onValueChange={(v) => form.setValue("empresa_id", Number(v))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(empresas.data ?? []).map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Unidade (opcional)</Label>
                <Select
                  value={String(form.watch("unidade_id") ?? "")}
                  onValueChange={(v) => form.setValue("unidade_id", v ? Number(v) : undefined)}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {unidadesFiltradas.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select
                  value={String(form.watch("categoria_id") ?? "")}
                  onValueChange={(v) => form.setValue("categoria_id", v ? Number(v) : undefined)}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {categoriasFiltradas.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valor</Label>
                <Input type="number" step="0.01" {...form.register("valor")} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Subcategoria</Label>
              <Input {...form.register("subcategoria")} />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea rows={2} {...form.register("descricao")} />
            </div>

            {form.formState.errors && (
              <div className="text-xs text-destructive space-y-0.5">
                {Object.entries(form.formState.errors).map(([k, v]) => (
                  <div key={k}>{(v as { message?: string })?.message}</div>
                ))}
              </div>
            )}
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!editavel || mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Hook simples pra controlar abertura. */
export function useLancamentoDialog() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LancamentoRow | null>(null);
  return {
    open,
    editing,
    openNew: () => { setEditing(null); setOpen(true); },
    openEdit: (l: LancamentoRow) => { setEditing(l); setOpen(true); },
    setOpen,
  };
}
