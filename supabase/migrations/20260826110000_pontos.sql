-- =============================================================================
-- Meu Ponto — registros de entrada/saída
-- =============================================================================
--
-- Não existe estado "fora do raio, salvo como inválido": a regra é bloquear
-- no cliente antes de gravar (ver src/lib/ponto.ts e /patio/meu-ponto) — se
-- a pessoa está fora do raio do `local_trabalho` ou o GPS falha, nada é
-- salvo. Por isso a tabela não tem coluna `dentro_do_raio`: todo registro
-- que existe já passou na checagem. `distancia_metros` fica salva mesmo
-- assim, só como registro histórico de quão perto a pessoa estava.
--
-- Igual às demais tabelas de registro do app: append-only (sem update nem
-- delete pela RLS) — corrigir um ponto errado é um caso que ainda não tem
-- fluxo de produto definido.
-- =============================================================================

create table if not exists pontos (
  id                 uuid primary key default gen_random_uuid(),
  membro_equipe_id   uuid not null references membros_equipe(id),
  tipo               text not null check (tipo in ('entrada', 'saida')),
  horario            timestamptz not null,
  latitude           double precision not null,
  longitude          double precision not null,
  distancia_metros   numeric not null,
  observacao         text,
  criado_em          timestamptz not null default now()
);

comment on table pontos is
  'Entrada/saída batidas dentro do raio do local_trabalho. Sem coluna de validade — todo registro que existe já passou na checagem de geofence no cliente.';

create index if not exists idx_pontos_membro on pontos (membro_equipe_id);
create index if not exists idx_pontos_horario on pontos (horario desc);

-- -----------------------------------------------------------------------------
-- RLS — mesma regra piloto das demais tabelas de registro: qualquer pessoa
-- autenticada lê e cria, sem update/delete. Regras finas por papel ficam
-- para quando o login existir (ver Registro Geral, seção 4).
-- -----------------------------------------------------------------------------
alter table pontos enable row level security;

drop policy if exists "autenticados leem pontos" on pontos;
create policy "autenticados leem pontos" on pontos
  for select to authenticated using (true);
drop policy if exists "autenticados criam pontos" on pontos;
create policy "autenticados criam pontos" on pontos
  for insert to authenticated with check (true);
