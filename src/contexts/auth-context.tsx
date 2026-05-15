import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type {
  PapelRow,
  UsuarioRow,
  UsuarioEmpresaRow,
} from "@/integrations/supabase/database";
import type { CurrentUser } from "@/lib/permissions";

type AuthState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "no-record"; email: string }
  | { status: "ok"; user: CurrentUser; session: Session };

interface AuthContextValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadCurrentUser(session: Session): Promise<AuthState> {
  const email = session.user.email ?? "";
  const authUid = session.user.id;

  // 1. Tenta achar usuario por auth_uid
  const byUid = await supabase
    .from("usuarios")
    .select("*")
    .eq("auth_uid", authUid)
    .maybeSingle();

  let usuarioRow: UsuarioRow | null = (byUid.data as UsuarioRow | null) ?? null;

  // 2. Se não achou e tem email, tenta pelo email e vincula auth_uid
  if (!usuarioRow && email) {
    const byEmail = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email)
      .is("auth_uid", null)
      .maybeSingle();

    const byEmailRow = byEmail.data as UsuarioRow | null;
    if (byEmailRow) {
      const linked = await supabase
        .from("usuarios")
        .update({ auth_uid: authUid })
        .eq("id", byEmailRow.id)
        .select("*")
        .single();
      usuarioRow = (linked.data as UsuarioRow | null) ?? byEmailRow;
    }
  }

  if (!usuarioRow) return { status: "no-record", email };
  if (usuarioRow.ativo === false) return { status: "no-record", email };

  // 3. Carrega papel
  const papelResp = await supabase
    .from("papeis")
    .select("*")
    .eq("id", usuarioRow.papel_id ?? -1)
    .maybeSingle();
  const papel = papelResp.data as PapelRow | null;
  if (!papel) return { status: "no-record", email };

  // 4. Empresas vinculadas
  const veTodas = !!usuarioRow.ve_todas_empresas;
  let empresasIds: number[] = [];
  if (!veTodas) {
    const ues = await supabase
      .from("usuario_empresas")
      .select("empresa_id")
      .eq("usuario_id", usuarioRow.id);
    const rows = (ues.data ?? []) as Pick<UsuarioEmpresaRow, "empresa_id">[];
    empresasIds = rows.map((r) => r.empresa_id);
  }

  const user: CurrentUser = {
    id: usuarioRow.id,
    nome: usuarioRow.nome,
    email: usuarioRow.email,
    ativo: usuarioRow.ativo,
    papel,
    ve_retiradas: !!usuarioRow.ve_retiradas,
    ve_faturamento: !!usuarioRow.ve_faturamento,
    ve_todas_empresas: veTodas,
    empresas_ids: empresasIds,
  };

  return { status: "ok", user, session };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setState({ status: "anon" });
      return;
    }
    setState(await loadCurrentUser(data.session));
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        setState({ status: "anon" });
        return;
      }
      const next = await loadCurrentUser(data.session);
      if (mounted) setState(next);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setState({ status: "anon" });
        return;
      }
      setTimeout(async () => {
        const next = await loadCurrentUser(session);
        if (mounted) setState(next);
      }, 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      refresh,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          return { error: "Não foi possível concluir sua sessão. Tente novamente." };
        }

        const next = await loadCurrentUser(data.session);
        setState(next);

        return {};
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setState({ status: "anon" });
      },
    }),
    [state, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function useCurrentUser(): CurrentUser {
  const { state } = useAuth();
  if (state.status !== "ok") {
    throw new Error("useCurrentUser called outside authenticated route");
  }
  return state.user;
}
