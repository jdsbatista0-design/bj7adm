import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const aceitarSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(6),
});

export const aceitarConvite = createServerFn({ method: "POST" })
  .inputValidator((data) => aceitarSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Load convite
    const cv = await supabaseAdmin
      .from("convites")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (cv.error) throw new Error(cv.error.message);
    if (!cv.data) throw new Error("Convite inválido");
    const c = cv.data as {
      id: number;
      email: string;
      nome: string | null;
      papel_id: number;
      ve_faturamento: boolean;
      ve_retiradas: boolean;
      ve_todas_empresas: boolean;
      empresas_ids: number[];
      menus: Array<{ menu_key: string; empresa_id: number | null }>;
      expires_at: string;
      used_at: string | null;
      usuario_id: number | null;
    };
    if (c.used_at) throw new Error("Convite já utilizado");
    if (new Date(c.expires_at) < new Date()) throw new Error("Convite expirado");

    const email = c.email.trim().toLowerCase();

    // 2. Create or reuse auth user
    let authUid: string | null = null;
    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (created.error) {
      // Se já existe, atualiza a senha
      const list = await supabaseAdmin.auth.admin.listUsers();
      const existing = list.data?.users.find((u) => (u.email ?? "").toLowerCase() === email);
      if (!existing) throw new Error(created.error.message);
      const upd = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: data.password,
        email_confirm: true,
      });
      if (upd.error) throw new Error(upd.error.message);
      authUid = existing.id;
    } else {
      authUid = created.data.user?.id ?? null;
    }
    if (!authUid) throw new Error("Falha ao criar conta de acesso");

    // 3. Cria/atualiza usuario
    const existingUsu = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let usuarioId: number;
    const usuarioPayload = {
      auth_uid: authUid,
      email,
      nome: c.nome,
      papel_id: c.papel_id,
      ativo: true,
      ve_faturamento: c.ve_faturamento,
      ve_retiradas: c.ve_retiradas,
      ve_todas_empresas: c.ve_todas_empresas,
    };
    if (existingUsu.data) {
      const upd = await supabaseAdmin
        .from("usuarios")
        .update(usuarioPayload)
        .eq("id", existingUsu.data.id)
        .select("id")
        .single();
      if (upd.error) throw new Error(upd.error.message);
      usuarioId = upd.data.id as number;
    } else {
      const ins = await supabaseAdmin
        .from("usuarios")
        .insert(usuarioPayload)
        .select("id")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      usuarioId = ins.data.id as number;
    }

    // 4. Empresas vinculadas
    await supabaseAdmin.from("usuario_empresas").delete().eq("usuario_id", usuarioId);
    if (!c.ve_todas_empresas && c.empresas_ids.length > 0) {
      const rows = c.empresas_ids.map((empresa_id) => ({ usuario_id: usuarioId, empresa_id }));
      const ie = await supabaseAdmin.from("usuario_empresas").insert(rows);
      if (ie.error) throw new Error(ie.error.message);
    }

    // 5. Menus
    await supabaseAdmin.from("menu_permissoes").delete().eq("usuario_id", usuarioId);
    if (c.menus.length > 0) {
      const rows = c.menus.map((m) => ({
        usuario_id: usuarioId,
        menu_key: m.menu_key,
        empresa_id: m.empresa_id,
        allowed: true,
      }));
      const im = await supabaseAdmin.from("menu_permissoes").insert(rows);
      if (im.error) throw new Error(im.error.message);
    }

    // 6. Marca convite como usado
    await supabaseAdmin
      .from("convites")
      .update({ used_at: new Date().toISOString(), usuario_id: usuarioId })
      .eq("id", c.id);

    return { ok: true as const, email };
  });
