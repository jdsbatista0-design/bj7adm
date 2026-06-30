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

  // Garante que existe o registro em public.usuarios para este auth user.
  // A função SECURITY DEFINER cria/vincula no 1º login.
  const ensured = await supabase.rpc("ensure_self_usuario");
  if (ensured.error) {
    console.error("ensure_self_usuario falhou:", ensured.error);
    return { status: "no-record", email };
  }

  const usuarioRow = (ensured.data as UsuarioRow | null) ?? null;

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
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setState({ status: "anon" });
        return;
      }
      setState(await loadCurrentUser(data.session));
    } catch (err) {
      console.error("refresh session falhou, limpando:", err);
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      setState({ status: "anon" });
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let bootstrapped = false;
    void (async () => {
      try {
        // Timeout defensivo: se o refresh travar (rede / token corrompido),
        // não deixamos a app presa em "loading" eternamente.
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 8000),
        );
        const { data } = await Promise.race([sessionPromise, timeoutPromise]);
        if (!mounted) return;
        bootstrapped = true;
        if (!data.session) {
          setState({ status: "anon" });
          return;
        }
        const next = await loadCurrentUser(data.session);
        if (mounted) setState(next);
      } catch (err) {
        console.error("bootstrap auth falhou, caindo para anon:", err);
        if (!mounted) return;
        bootstrapped = true;
        try { await supabase.auth.signOut(); } catch { /* ignore */ }
        setState({ status: "anon" });
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignora INITIAL_SESSION (já tratado pelo getSession acima) e TOKEN_REFRESHED
      // (sessão continua válida — não precisa recarregar perfil/papel).
      // Sem este filtro, todo refresh dobrava a sequência de auth (~4 round-trips até Oregon).
      if (!bootstrapped) return;
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
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
