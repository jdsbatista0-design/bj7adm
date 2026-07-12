
-- ============ MENU PERMISSOES ============
CREATE TABLE IF NOT EXISTS public.menu_permissoes (
  id BIGSERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  menu_key TEXT NOT NULL,
  empresa_id INTEGER REFERENCES public.empresas(id) ON DELETE CASCADE,
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS menu_permissoes_uniq
  ON public.menu_permissoes(usuario_id, menu_key, COALESCE(empresa_id, -1));
CREATE INDEX IF NOT EXISTS menu_permissoes_usuario_idx ON public.menu_permissoes(usuario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_permissoes TO authenticated;
GRANT ALL ON public.menu_permissoes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.menu_permissoes_id_seq TO authenticated, service_role;

ALTER TABLE public.menu_permissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_permissoes_owner_read" ON public.menu_permissoes
  FOR SELECT TO authenticated
  USING (
    usuario_id IN (SELECT id FROM public.usuarios WHERE auth_uid = auth.uid()::text)
    OR (SELECT pode_gerir_usuarios FROM public.current_user_perms() LIMIT 1) = true
  );

CREATE POLICY "menu_permissoes_admin_write" ON public.menu_permissoes
  FOR ALL TO authenticated
  USING ((SELECT pode_gerir_usuarios FROM public.current_user_perms() LIMIT 1) = true)
  WITH CHECK ((SELECT pode_gerir_usuarios FROM public.current_user_perms() LIMIT 1) = true);

-- ============ CONVITES ============
CREATE TABLE IF NOT EXISTS public.convites (
  id BIGSERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  email TEXT NOT NULL,
  nome TEXT,
  papel_id INTEGER NOT NULL REFERENCES public.papeis(id),
  ve_faturamento BOOLEAN NOT NULL DEFAULT false,
  ve_retiradas BOOLEAN NOT NULL DEFAULT false,
  ve_todas_empresas BOOLEAN NOT NULL DEFAULT false,
  empresas_ids INTEGER[] NOT NULL DEFAULT '{}',
  menus JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{menu_key, empresa_id|null}]
  created_by INTEGER REFERENCES public.usuarios(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  used_at TIMESTAMPTZ,
  usuario_id INTEGER REFERENCES public.usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS convites_token_idx ON public.convites(token);
CREATE INDEX IF NOT EXISTS convites_email_idx ON public.convites(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.convites TO authenticated;
GRANT ALL ON public.convites TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.convites_id_seq TO authenticated, service_role;

ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "convites_admin_all" ON public.convites
  FOR ALL TO authenticated
  USING ((SELECT pode_gerir_usuarios FROM public.current_user_perms() LIMIT 1) = true)
  WITH CHECK ((SELECT pode_gerir_usuarios FROM public.current_user_perms() LIMIT 1) = true);

-- ============ RPC: get_convite (público - só metadata pelo token) ============
CREATE OR REPLACE FUNCTION public.get_convite_publico(_token TEXT)
RETURNS TABLE(email TEXT, nome TEXT, expirado BOOLEAN, usado BOOLEAN)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.email, c.nome,
         (c.expires_at < now()) AS expirado,
         (c.used_at IS NOT NULL) AS usado
  FROM public.convites c
  WHERE c.token = _token
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_convite_publico(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_convite_publico(TEXT) TO anon, authenticated;
