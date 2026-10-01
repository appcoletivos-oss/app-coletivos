-- =============================================================================
-- Registro simplificado — Etapa 1, item 7: ponto fora do raio
-- =============================================================================
--
-- NOTA: este SQL já foi aplicado manualmente no Supabase real via SQL
-- Editor em 30/09/2026 (ver claude_handoff-registro-simplificado.md, Etapa
-- 1 item 7). Este arquivo só documenta a migration no repositório — não
-- precisa ser executado de novo.
--
-- Ponto fora do raio deixa de ser bloqueado: fica pendente de aprovação da
-- Coordenação/Consultor. Nesta migration latitude/longitude/distancia_metros
-- continuavam not null — só "fora do raio com GPS funcionando" ganhou este
-- caminho; o caso de GPS indisponível (sem coordenada nenhuma) só deixou de
-- bloquear na migration seguinte, 20261001000000_pontos_gps_nulo.sql.
-- =============================================================================

alter table pontos add column if not exists fora_do_raio boolean not null default false;
alter table pontos add column if not exists justificativa text;
alter table pontos add column if not exists status_aprovacao text
  check (status_aprovacao in ('pendente', 'aprovado', 'rejeitado'));
alter table pontos add column if not exists aprovado_por uuid references auth.users(id);
alter table pontos add column if not exists aprovado_em timestamptz;

-- Único update real que a tabela ganha (era append-only até aqui) —
-- restrito a quem decide a aprovação; leitura e criação já eram liberadas
-- pra qualquer papel autenticado desde a migration original.
drop policy if exists "coordenacao e consultor aprovam pontos" on pontos;
create policy "coordenacao e consultor aprovam pontos"
  on pontos for update
  to authenticated
  using (papel_atual() = any (array['coordenacao', 'consultor']))
  with check (papel_atual() = any (array['coordenacao', 'consultor']));
