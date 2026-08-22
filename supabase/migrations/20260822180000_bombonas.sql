-- =============================================================================
-- Módulo 1 (Pátio de Compostagem) — Controle de bombonas
-- =============================================================================
--
-- Baseado no formulário real "Controle das Bombonas" (Google Forms),
-- preenchido tanto por lojistas quanto pela equipe do pátio. parceiro_id
-- é sempre referência (nunca nome solto), mesmo padrão das demais tabelas
-- do módulo.
--
-- `registrado_por` aqui é texto livre (não uuid de auth.users, diferente
-- das outras tabelas de registro do app) porque quem preenche pode ser um
-- lojista sem conta/sessão vinculada a membros_equipe — a pessoa digita o
-- próprio nome na tela em vez do nome vir da sessão.
--
-- `preenchida_corretamente` é o campo marcado como "exclusivo da equipe"
-- no formulário original. Sem login/distinção de papel implementada
-- ainda, ele fica visível e editável por qualquer pessoa que use a tela —
-- PENDÊNCIA: restringir esse campo à equipe quando o controle de acesso
-- por papel existir (ver Registro Geral, seção 4).
-- =============================================================================

create table if not exists registros_bombonas (
  id                       uuid primary key default gen_random_uuid(),
  parceiro_id              uuid not null references parceiros(id),
  numero_bombona           text not null,
  data_entrega             date not null default current_date,
  data_devolucao           date,
  higienizada              boolean,
  tampa_fechada            boolean,
  adesivo_presente         boolean,
  odor                     smallint check (odor between 1 and 5),
  preenchida_corretamente  boolean,
  observacao               text,
  registrado_por           text,
  registrado_em            timestamptz not null default now()
);

comment on table registros_bombonas is
  'Controle de entrega/devolução de bombonas por loja parceira. parceiro_id é sempre referência. registrado_por é texto livre (nome digitado pela pessoa) — ver nota no topo do arquivo sobre lojistas sem conta.';
comment on column registros_bombonas.preenchida_corretamente is
  'Campo "exclusivo da equipe" no formulário original — hoje visível a qualquer pessoa por falta de controle de acesso por papel. Ver pendência no topo do arquivo.';

create index if not exists idx_registros_bombonas_parceiro on registros_bombonas (parceiro_id);
create index if not exists idx_registros_bombonas_data on registros_bombonas (registrado_em desc);

-- -----------------------------------------------------------------------------
-- RLS — mesma regra piloto das demais tabelas do módulo: qualquer pessoa
-- autenticada lê e escreve. Regras finas por papel ficam para quando o
-- login estiver implementado (ver Registro Geral, seção 4).
-- -----------------------------------------------------------------------------
alter table registros_bombonas enable row level security;

drop policy if exists "autenticados leem registros_bombonas" on registros_bombonas;
create policy "autenticados leem registros_bombonas" on registros_bombonas
  for select to authenticated using (true);

drop policy if exists "autenticados criam registros_bombonas" on registros_bombonas;
create policy "autenticados criam registros_bombonas" on registros_bombonas
  for insert to authenticated with check (true);
