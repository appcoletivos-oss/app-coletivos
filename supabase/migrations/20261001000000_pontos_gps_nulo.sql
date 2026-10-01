-- =============================================================================
-- Registro simplificado — Etapa 1, item 7: GPS indisponível/timeout
-- =============================================================================
--
-- NOTA: este SQL já foi aplicado manualmente no Supabase real via SQL
-- Editor em 01/10/2026 (ver claude_handoff-registro-simplificado.md, Etapa
-- 1 item 7). Este arquivo só documenta a migration no repositório — não
-- precisa ser executado de novo.
--
-- Complementa 20260930020000_pontos_fora_do_raio.sql: aquela migration
-- tratava só "fora do raio com GPS funcionando". Esta cobre o caso de GPS
-- fraco/indisponível dentro do shopping, onde o navegador não devolve
-- coordenada nenhuma — até aqui latitude/longitude/distancia_metros eram
-- not null, o que bloqueava o registro. Agora as três colunas aceitam
-- null, mas só quando o ponto é marcado fora_do_raio=true e tem
-- justificativa — a constraint garante isso no banco, não só na tela.
-- =============================================================================

alter table pontos alter column latitude drop not null;
alter table pontos alter column longitude drop not null;
alter table pontos alter column distancia_metros drop not null;

alter table pontos add constraint pontos_sem_gps_exige_justificativa
  check (
    (latitude is not null and longitude is not null and distancia_metros is not null)
    or (fora_do_raio = true and justificativa is not null and length(trim(justificativa)) > 0)
  );
