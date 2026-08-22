-- =============================================================================
-- Módulo 1 (Pátio de Compostagem) — Análise sensorial
-- =============================================================================
--
-- Registro qualitativo por caixa: visão, olfato e tato, cada um como
-- texto livre e opcional. Sem gravação de áudio nesta primeira versão —
-- possível melhoria futura, já que parte da equipe tem baixo letramento e
-- um campo de voz reduziria a barreira de escrever (decisão de produto
-- 2026-08-22, ver comentário em analise-sensorial/page.tsx e Registro
-- Geral).
--
-- caixa_id segue o mesmo tipo/referência usado em
-- registros_alimentacao.caixa_id (migration 20260821120000).
-- =============================================================================

create table if not exists registros_analise_sensorial (
  id             uuid primary key default gen_random_uuid(),
  caixa_id       uuid not null references caixas(id),
  visao          text,
  olfato         text,
  tato           text,
  registrado_por uuid references auth.users(id),
  registrado_em  timestamptz not null default now()
);

comment on table registros_analise_sensorial is
  'Análise qualitativa de uma caixa por observação sensorial (visão, olfato, tato), cada campo em texto livre e opcional.';

create index if not exists idx_registros_analise_sensorial_caixa on registros_analise_sensorial (caixa_id);
create index if not exists idx_registros_analise_sensorial_data on registros_analise_sensorial (registrado_em desc);

-- -----------------------------------------------------------------------------
-- RLS — mesma regra piloto das demais tabelas do módulo: qualquer pessoa
-- autenticada lê e escreve. Regras finas por papel ficam para quando o
-- login estiver implementado (ver Registro Geral, seção 4).
-- -----------------------------------------------------------------------------
alter table registros_analise_sensorial enable row level security;

drop policy if exists "autenticados leem registros_analise_sensorial" on registros_analise_sensorial;
create policy "autenticados leem registros_analise_sensorial" on registros_analise_sensorial
  for select to authenticated using (true);

drop policy if exists "autenticados criam registros_analise_sensorial" on registros_analise_sensorial;
create policy "autenticados criam registros_analise_sensorial" on registros_analise_sensorial
  for insert to authenticated with check (true);
