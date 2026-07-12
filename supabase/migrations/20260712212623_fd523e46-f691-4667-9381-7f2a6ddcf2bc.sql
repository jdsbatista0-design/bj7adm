create or replace function public.current_user_is_active()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.usuarios u
    where u.auth_uid = auth.uid()::text
      and coalesce(u.ativo, true) = true
  )
$$;
grant execute on function public.current_user_is_active() to authenticated;

alter view if exists public.dre_consolidada set (security_invoker = on);
alter view if exists public.dre_operacional set (security_invoker = on);
alter view if exists public.v_resumo_dre set (security_invoker = on);
alter view if exists public.pessoas_dashboard set (security_invoker = on);
alter view if exists public.rebate_clientes_stone set (security_invoker = on);
alter view if exists public.v_cliente_lifetime set (security_invoker = on);
alter view if exists public.v_ranking_vendedor set (security_invoker = on);
alter view if exists public.v_evolucao_mensal set (security_invoker = on);

do $$
declare
  t text;
  policy_name text;
begin
  foreach t in array array[
    'empresas','unidades','usuario_empresas','categorias','lancamentos','notas_fiscais',
    'apuracao_rebate','evolucao_base_clientes','clientes_sumidos','importacoes','regras',
    'alertas','tarefas','interacoes','categoria_sugestoes','itens','contas_a_pagar',
    'obrigacoes_fiscais','notas_rapidas','juridico_processos','mkt_campanhas',
    'pessoas_colaboradores','pessoas_pdis','pessoas_okrs','pessoas_one_on_ones',
    'pessoas_rotina_rua','stone_rebate_imports','stone_rebate_linhas'
  ] loop
    policy_name := 'active_auth_' || t;
    execute format('drop policy if exists %I on public.%I', 'all_auth_' || t, t);
    execute format('drop policy if exists %I on public.%I', policy_name, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.current_user_is_active()) with check (public.current_user_is_active())',
      policy_name,
      t
    );
  end loop;
end $$;