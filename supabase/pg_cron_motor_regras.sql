-- Motor de regras automático via pg_cron
-- Executa executar_regras() todo dia às 06:00 BRT (09:00 UTC, fuso UTC-3)
--
-- COMO RODAR:
-- Colar no SQL Editor do Supabase (Dashboard → SQL Editor) como superuser.
-- pg_cron já vem habilitado nos projetos Supabase — não precisa instalar extensão.
--
-- VERIFICAR agendamentos ativos:
--   SELECT * FROM cron.job;
--
-- REMOVER este agendamento (se necessário):
--   SELECT cron.unschedule('motor-regras-diario');

SELECT cron.schedule(
  'motor-regras-diario',   -- nome único do job
  '0 9 * * *',             -- todo dia às 09:00 UTC = 06:00 BRT
  'SELECT executar_regras()'
);
