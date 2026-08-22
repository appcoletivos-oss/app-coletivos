-- =============================================================================
-- Módulo 1 (Pátio de Compostagem) — Horta → Registrar colheita
-- =============================================================================
--
-- Um registro por evento de colheita (mesmo espírito de registros_alimentacao):
-- canteiro_id é sempre referência, nunca nome solto — preserva a memória
-- histórica mesmo se o canteiro for renomeado ou substituído depois (ver
-- migration 20260821120000 e Registro Geral, seção 2).
--
-- `cultura` é texto livre por decisão de produto (2026-08-22): a tela
-- mostra um grid fixo com as 12 espécies mais colhidas no histórico real
-- (planilha "Tabela de Plantio e Colheita", 637 registros / 69 espécies)
-- + botão "Outra" pra digitar. Não existe tabela própria de "culturas" —
-- diferente de parceiros/canteiros, cultura não tem turnover pra rastrear,
-- então a modelagem mais simples (texto) foi suficiente aqui.
-- =============================================================================

create table if not exists registros_colheita (
  id             uuid primary key default gen_random_uuid(),
  canteiro_id    uuid not null references canteiros(id),
  cultura        text not null,
  peso_kg        numeric not null check (peso_kg > 0),
  foto_url       text,
  observacao     text,
  registrado_por uuid references auth.users(id),
  registrado_em  timestamptz not null default now()
);

comment on table registros_colheita is
  'Um registro por evento de colheita. canteiro_id é sempre referência (nunca nome solto). cultura é texto livre — ver nota no topo do arquivo.';

create index if not exists idx_registros_colheita_canteiro on registros_colheita (canteiro_id);
create index if not exists idx_registros_colheita_data on registros_colheita (registrado_em desc);

-- -----------------------------------------------------------------------------
-- RLS — mesma regra piloto das demais tabelas do módulo: qualquer pessoa
-- autenticada lê e escreve. Regras finas por papel ficam para quando o
-- login estiver implementado (ver Registro Geral, seção 4).
-- -----------------------------------------------------------------------------
alter table registros_colheita enable row level security;

drop policy if exists "autenticados leem registros_colheita" on registros_colheita;
create policy "autenticados leem registros_colheita" on registros_colheita
  for select to authenticated using (true);

drop policy if exists "autenticados criam registros_colheita" on registros_colheita;
create policy "autenticados criam registros_colheita" on registros_colheita
  for insert to authenticated with check (true);

-- Fotos de colheita usam o mesmo bucket privado "registros-fotos" criado
-- na migration 20260821120000 (pasta "colheita/" em vez de "alimentacao/"
-- — ver lib/patio.ts, enviarFotoRegistro). Bucket e políticas de Storage
-- já cobrem qualquer pasta dentro dele, então nada novo precisa ser criado
-- aqui.
