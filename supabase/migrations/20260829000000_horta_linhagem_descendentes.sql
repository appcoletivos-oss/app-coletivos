-- =============================================================================
-- Horta — releitura da v3 contra o código entregue (HANDOFF_HORTA_COMPLETO.md):
-- corrige a função linhagem_plantio() pra também subir por descendentes, não
-- só por ancestrais. As duas migrations anteriores (20260827130000 e
-- 20260827140000) já foram aplicadas no Supabase remoto — não editar, só
-- adicionar por cima com CREATE OR REPLACE.
--
-- Gap: o Mapa só mostrava "de onde veio" um plantio (subindo por
-- plantio_pai_id). Rastreabilidade de ponta a ponta exige também "pra onde
-- foi" — sobretudo pro plantio pai, que vira status=transplantado (saldo
-- zerado) e precisa continuar navegável, nunca virar beco sem saída. Esse
-- filtro de "transplantado continua aparecendo no Mapa como nó
-- fechado/histórico" é ajuste de aplicação (ver src/lib/plantios.ts,
-- listarPlantiosParaMapaPorCanteiro), não precisa de mudança de schema.
--
-- RLS: conferida contra a matriz coordenação/equipe/consultor = leitura+
-- escrita, lojista = sem acesso — já é exatamente o que a migration
-- 20260827130000 implementou (public.papel_atual() is not null cobre as
-- três, lojista não tem papel_atual() nenhum). Nenhuma mudança de RLS
-- necessária aqui.
-- =============================================================================

create or replace function linhagem_plantio(p_plantio_id uuid)
returns setof plantios
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive ancestrais as (
    select * from public.plantios where id = p_plantio_id
    union all
    select p.* from public.plantios p join ancestrais a on p.id = a.plantio_pai_id
  ),
  descendentes as (
    select * from public.plantios where id = p_plantio_id
    union all
    select p.* from public.plantios p join descendentes d on p.plantio_pai_id = d.id
  ),
  linhagem as (
    select * from ancestrais
    union
    select * from descendentes
  )
  select * from linhagem order by data_inicio asc, criado_em asc;
$$;

comment on function linhagem_plantio(uuid) is
  'Reconstrói a linhagem completa de um plantio: sobe por plantio_pai_id (ancestrais — "de onde veio") E desce por plantio_pai_id = id (descendentes — "pra onde foi"), ordenada do mais antigo pro mais novo. Usado pelo Mapa, inclusive pra plantios status=transplantado (saldo zerado, mas que seguem navegáveis como nó da linhagem).';
