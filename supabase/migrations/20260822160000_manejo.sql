-- =============================================================================
-- Módulo 1 (Pátio de Compostagem) — Horta → Manejo
-- =============================================================================
--
-- Um registro por evento de manejo recorrente num canteiro (capina
-- seletiva, adubação, poda, raleamento). Mesmo espírito de
-- registros_colheita: canteiro_id é sempre referência, nunca nome solto
-- (ver migration 20260821120000 e Registro Geral, seção 2).
-- =============================================================================

create table if not exists registros_manejo (
  id             uuid primary key default gen_random_uuid(),
  canteiro_id    uuid not null references canteiros(id),
  tipo_manejo    text not null
                   check (tipo_manejo in ('capina_seletiva', 'adubacao', 'poda', 'raleamento', 'outro')),
  observacao     text,
  foto_url       text,
  registrado_por uuid references auth.users(id),
  registrado_em  timestamptz not null default now()
);

comment on table registros_manejo is
  'Um registro por evento de manejo recorrente num canteiro (capina seletiva, adubação, poda, raleamento ou outro). canteiro_id é sempre referência (nunca nome solto).';

create index if not exists idx_registros_manejo_canteiro on registros_manejo (canteiro_id);
create index if not exists idx_registros_manejo_data on registros_manejo (registrado_em desc);

-- -----------------------------------------------------------------------------
-- RLS — mesma regra piloto das demais tabelas do módulo: qualquer pessoa
-- autenticada lê e escreve. Regras finas por papel ficam para quando o
-- login estiver implementado (ver Registro Geral, seção 4).
-- -----------------------------------------------------------------------------
alter table registros_manejo enable row level security;

drop policy if exists "autenticados leem registros_manejo" on registros_manejo;
create policy "autenticados leem registros_manejo" on registros_manejo
  for select to authenticated using (true);

drop policy if exists "autenticados criam registros_manejo" on registros_manejo;
create policy "autenticados criam registros_manejo" on registros_manejo
  for insert to authenticated with check (true);

-- Fotos de manejo (opcionais) usam o mesmo bucket privado "registros-fotos"
-- criado na migration 20260821120000 (pasta "manejo/") — bucket e
-- políticas de Storage já cobrem qualquer pasta dentro dele, então nada
-- novo precisa ser criado aqui.
