import type { Database } from "@/integrations/supabase/database";

type Lancamento = Database["public"]["Tables"]["lancamentos"]["Row"];
type Papel = Database["public"]["Tables"]["papeis"]["Row"];

export interface CurrentUser {
  id: number;
  nome: string | null;
  email: string | null;
  ativo: boolean | null;
  papel: Papel;
  ve_retiradas: boolean;
  ve_faturamento: boolean;
  ve_todas_empresas: boolean;
  empresas_ids: number[]; // empresas que ele pode ver (vazio se ve_todas_empresas)
}

/** Tipos de lançamento que este usuário pode ver. */
export function tiposVisiveis(u: CurrentUser): string[] {
  const todos = ["Receita", "Despesa", "Retirada", "Empréstimo"];
  return todos.filter((t) => {
    if (t === "Receita" && !u.ve_faturamento) return false;
    if (t === "Retirada" && !u.ve_retiradas) return false;
    return true;
  });
}

export function podeVerEmpresa(u: CurrentUser, empresaId: number): boolean {
  if (u.ve_todas_empresas) return true;
  return u.empresas_ids.includes(empresaId);
}

export function podeVerLancamento(u: CurrentUser, l: Pick<Lancamento, "tipo" | "empresa_id">): boolean {
  if (l.tipo === "Receita" && !u.ve_faturamento) return false;
  if (l.tipo === "Retirada" && !u.ve_retiradas) return false;
  return podeVerEmpresa(u, l.empresa_id);
}

export function podeLancar(u: CurrentUser): boolean {
  return !!u.papel.pode_lancar;
}

export function podeEditarLancamento(
  u: CurrentUser,
  l: Pick<Lancamento, "revisado">,
): boolean {
  if (l.revisado) return !!u.papel.pode_editar_revisado;
  return !!u.papel.pode_editar_normal;
}

export function podeMarcarRevisado(u: CurrentUser): boolean {
  return !!u.papel.pode_marcar_revisado;
}

export function podeGerirUsuarios(u: CurrentUser): boolean {
  return !!u.papel.pode_gerir_usuarios;
}

export function podeVerStone(u: CurrentUser): boolean {
  return u.ve_faturamento;
}

export function podeImportar(u: CurrentUser): boolean {
  // Só quem pode gerir usuários pode importar (Admin/Sócio)
  return !!u.papel.pode_gerir_usuarios;
}
