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

  type UsuarioRow = NonNullable<typeof byUid.data>;
  let usuarioRow: UsuarioRow | null = byUid.data ?? null;

  // 2. Se não achou e tem email, tenta pelo email e vincula auth_uid
  if (!usuarioRow && email) {
    const byEmail = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email)
      .is("auth_uid", null)
      .maybeSingle();

    if (byEmail.data) {
      const linked = await supabase
        .from("usuarios")
        .update({ auth_uid: authUid })
        .eq("id", byEmail.data.id)
        .select("*")
        .single();
      usuarioRow = linked.data ?? byEmail.data;
    }
  }

  if (!usuarioRow) {
    return { status: "no-record", email };
  }

  if (usuarioRow.ativo === false) {
    return { status: "no-record", email };
  }

  // 3. Carrega papel
  const { data: papel } = await supabase
    .from("papeis")
    .select("*")
    .eq("id", usuarioRow.papel_id ?? -1)
    .maybeSingle();

  if (!papel) {
    return { status: "no-record", email };
  }

  // 4. Carrega empresas vinculadas (se ve_todas_empresas=false)
  const veTodas = !!usuarioRow.ve_todas_empresas;
  let empresasIds: number[] = [];
  if (!veTodas) {
    const { data: ues } = await supabase
      .from("usuario_empresas")
      .select("empresa_id")
      .eq("usuario_id", usuarioRow.id);
    empresasIds = (ues ?? []).map((r) => r.empresa_id);
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
    const next = await loadCurrentUser(data.session);
    setState(next);
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
      // Use setTimeout to avoid deadlocks in supabase listener
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

/** Helper para componentes que SÓ rodam autenticados — lança se não estiver. */
export function useCurrentUser(): CurrentUser {
  const { state } = useAuth();
  if (state.status !== "ok") {
    throw new Error("useCurrentUser called outside authenticated route");
  }
  return state.user;
}
