-- =============================================================================
-- Bloco Agenda — eventos e escala de trabalho
-- =============================================================================
--
-- Uma tabela só cobre dois usos bem diferentes:
--   - Eventos gerais da equipe (mutirão, oficina, visita, atividade de
--     horta/compostagem) — `membro_equipe_id` fica null.
--   - Escala individual (turno_trabalho, folga, ferias) — uma linha por
--     pessoa, por dia, por turno. `turno_trabalho` é a peça que a
--     Coordenação usa pra registrar quem trabalha quando; o cálculo de
--     banco de horas (ver src/lib/ponto.ts) soma essas linhas como "horas
--     esperadas" da semana.
--
-- `data_fim` só é usado por férias que cobrem um período — os demais tipos
-- deixam null e valem só para `data`. `turno` é nullable pelo mesmo motivo
-- (férias multi-dia pode não ter turno definido).
--
-- Quando `tipo = 'atividade'`, a tela de Agenda pode linkar pra tela de
-- registro correspondente (Manejo, Registrar colheita, etc.) via query
-- param `evento_agenda_id` — ver migration 20260826120000, que adiciona
-- essa coluna às tabelas de registro.
-- =============================================================================

create type tipo_evento_agenda as enum (
  'atividade',
  'mutirao',
  'oficina',
  'visita',
  'turno_trabalho',
  'folga',
  'ferias'
);

create type turno_dia as enum ('manha', 'tarde', 'dia_todo');

create table if not exists eventos_agenda (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null,
  descricao         text,
  tipo              tipo_evento_agenda not null,
  data              date not null,
  data_fim          date,
  turno             turno_dia,
  membro_equipe_id  uuid references membros_equipe(id),
  criado_por        uuid references membros_equipe(id),
  criado_em         timestamptz not null default now()
);

comment on table eventos_agenda is
  'Eventos da Agenda: gerais da equipe (membro_equipe_id null) ou escala individual (turno_trabalho, folga, ferias — uma linha por pessoa/dia/turno).';
comment on column eventos_agenda.data_fim is
  'Só usado por férias que cobrem período. Demais tipos usam só `data`.';
comment on column eventos_agenda.membro_equipe_id is
  'Obrigatório (em regra de produto, não de banco) para turno_trabalho, folga e ferias. Null = evento geral da equipe.';

create index if not exists idx_eventos_agenda_data on eventos_agenda (data);
create index if not exists idx_eventos_agenda_membro on eventos_agenda (membro_equipe_id);
create index if not exists idx_eventos_agenda_tipo on eventos_agenda (tipo);

-- -----------------------------------------------------------------------------
-- RLS — mesma regra piloto das demais tabelas do app: qualquer pessoa
-- autenticada lê e escreve. Regras finas por papel (só coordenação cria
-- turno_trabalho, por exemplo) ficam para quando o login existir (ver
-- Registro Geral, seção 4).
-- -----------------------------------------------------------------------------
alter table eventos_agenda enable row level security;

drop policy if exists "autenticados leem eventos_agenda" on eventos_agenda;
create policy "autenticados leem eventos_agenda" on eventos_agenda
  for select to authenticated using (true);
drop policy if exists "autenticados gerenciam eventos_agenda" on eventos_agenda;
create policy "autenticados gerenciam eventos_agenda" on eventos_agenda
  for all to authenticated using (true) with check (true);
