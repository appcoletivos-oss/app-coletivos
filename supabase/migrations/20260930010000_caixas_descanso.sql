-- =============================================================================
-- Registro simplificado — Etapa 1, item 6: caixa em descanso
-- =============================================================================
--
-- NOTA: este SQL já foi aplicado manualmente no Supabase real via SQL
-- Editor em 30/09/2026 (ver claude_handoff-registro-simplificado.md, Etapa
-- 1 item 6). Este arquivo só documenta a migration no repositório — não
-- precisa ser executado de novo.
--
-- "descanso" = caixa fora de operação por decisão da coordenação (ex.:
-- dar um tempo pro composto maturar), diferente de "desativada" (defeito,
-- retirada de circulação). Cadastrar/mover pra descanso é restrito a
-- Coordenação/Consultor — a RLS de `caixas` já tem uma única política
-- cobrindo toda escrita na tabela (equipe só lê), então nenhuma policy
-- nova precisa ser criada aqui, só a constraint de status.
-- =============================================================================

alter table caixas add column if not exists data_inicio_descanso timestamptz;

alter table caixas drop constraint if exists caixas_status_check;
alter table caixas add constraint caixas_status_check
  check (status in ('ativa', 'nao_ativada', 'nova', 'desativada', 'descanso'));
