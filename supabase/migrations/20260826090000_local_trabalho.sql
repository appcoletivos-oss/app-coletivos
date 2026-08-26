-- =============================================================================
-- Meu Ponto — Local de trabalho (config do geofence)
-- =============================================================================
--
-- Uma única linha com a coordenada e o raio (metros) que definem "estar no
-- pátio" pra fim de bater ponto (ver src/lib/ponto.ts, calcularDistanciaMetros
-- e a regra de bloqueio em /patio/meu-ponto). Não há trigger nem constraint
-- forçando linha única — a tela de Cadastro (aba "Local de trabalho") só
-- edita a primeira linha encontrada; múltiplas linhas não são um caso
-- esperado, mas nada no schema impede fisicamente.
--
-- Editável hoje por qualquer pessoa autenticada (mesma pendência de sempre:
-- sem controle de acesso por papel implementado ainda — ver Registro Geral,
-- seção 4). Produto já decidiu que no futuro isso deve ser exclusivo da
-- coordenação.
-- =============================================================================

create table if not exists local_trabalho (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null default 'Pátio de Compostagem — Shopping Recife',
  latitude       double precision not null,
  longitude      double precision not null,
  raio_metros    integer not null default 20,
  atualizado_em  timestamptz not null default now()
);

comment on table local_trabalho is
  'Config do geofence usado por Meu Ponto pra bloquear entrada/saída fora do pátio. Linha única por convenção (sem constraint que force isso).';

drop trigger if exists trg_local_trabalho_atualizado_em on local_trabalho;
create trigger trg_local_trabalho_atualizado_em
  before update on local_trabalho
  for each row execute function set_atualizado_em();

alter table local_trabalho enable row level security;

drop policy if exists "autenticados leem local_trabalho" on local_trabalho;
create policy "autenticados leem local_trabalho" on local_trabalho
  for select to authenticated using (true);
drop policy if exists "autenticados gerenciam local_trabalho" on local_trabalho;
create policy "autenticados gerenciam local_trabalho" on local_trabalho
  for all to authenticated using (true) with check (true);

insert into local_trabalho (latitude, longitude, raio_metros)
select -8.12009276287604, -34.90810134288076, 20
where not exists (select 1 from local_trabalho);
