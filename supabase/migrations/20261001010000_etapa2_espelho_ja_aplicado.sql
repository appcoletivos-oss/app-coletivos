-- =============================================================================
-- Sprint A — Item 0: espelho do SQL da Etapa 2 aplicado direto no SQL
-- Editor em 09/2026 (sessões M e N). Idempotente. Existe só para versionar
-- o histórico (ver SPRINT_A_REGISTRO_SIMPLIFICADO_ETAPA2.md, seção 4).
-- =============================================================================
--
-- NOTA: este arquivo não muda o banco. As 6 tabelas da Etapa 2
-- (tipos_carrinho, registro_alimentacao_bombonas, relatorios_turno,
-- relatorio_turno_itens, planejamento_semanal_itens, relatos_ia_log) e as
-- colunas novas de registros_manejo já existem em produção (confirmado por
-- consulta a information_schema em 01/10/2026). Rodar de novo não tem
-- efeito algum — toda tabela/coluna usa IF NOT EXISTS, o seed usa ON
-- CONFLICT DO NOTHING, e toda policy é precedida de DROP POLICY IF EXISTS.
--
-- Exceção deliberada: a policy "coordenacao e consultor aprovam pontos"
-- (pontos) já está versionada em 20260930020000_pontos_fora_do_raio.sql, e
-- as policies de fotos_registro/doacoes_alimento (Etapa 1) já estão em
-- 20260930000000_fotos_registro.sql e 20260930030000_doacoes_alimento.sql —
-- nenhuma das três é repetida aqui.
--
-- relatos_ia_log é só espelhada (schema), sem nenhuma funcionalidade nova
-- construída sobre ela nesta sprint — Relato por IA é Sprint B.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- tipos_carrinho
-- -----------------------------------------------------------------------------
create table if not exists tipos_carrinho (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  peso_estimado_kg numeric not null,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

insert into tipos_carrinho (nome, peso_estimado_kg) values
  ('Carrinho velho', 30),
  ('Carrinho azul', 18)
on conflict (nome) do nothing;

alter table tipos_carrinho enable row level security;

drop policy if exists "coordenacao e consultor gerenciam tipos_carrinho" on tipos_carrinho;
create policy "coordenacao e consultor gerenciam tipos_carrinho"
  on tipos_carrinho for all
  to authenticated
  using (papel_atual() = any (array['coordenacao', 'consultor']))
  with check (papel_atual() = any (array['coordenacao', 'consultor']));

drop policy if exists "papel autenticado le tipos_carrinho" on tipos_carrinho;
create policy "papel autenticado le tipos_carrinho"
  on tipos_carrinho for select
  to authenticated
  using (papel_atual() is not null);

-- -----------------------------------------------------------------------------
-- registros_manejo — carrinho de mão (colunas novas, snapshot de peso)
-- -----------------------------------------------------------------------------
alter table registros_manejo add column if not exists tipo_carrinho_id uuid references tipos_carrinho(id);
alter table registros_manejo add column if not exists quantidade_carrinhos numeric;
alter table registros_manejo add column if not exists peso_kg_calculado numeric;

-- -----------------------------------------------------------------------------
-- registro_alimentacao_bombonas
-- -----------------------------------------------------------------------------
create table if not exists registro_alimentacao_bombonas (
  id uuid primary key default gen_random_uuid(),
  registro_alimentacao_id uuid not null references registros_alimentacao(id) on delete cascade,
  numero_bombona text not null,
  peso_kg numeric not null check (peso_kg >= 0),
  registro_bombona_id uuid references registros_bombonas(id),
  criado_em timestamptz not null default now(),
  unique (registro_alimentacao_id, numero_bombona)
);
create index if not exists registro_alimentacao_bombonas_numero_idx
  on registro_alimentacao_bombonas (numero_bombona);

alter table registro_alimentacao_bombonas enable row level security;

drop policy if exists "papel autenticado cria registro_alimentacao_bombonas" on registro_alimentacao_bombonas;
create policy "papel autenticado cria registro_alimentacao_bombonas"
  on registro_alimentacao_bombonas for insert
  to authenticated
  with check (papel_atual() is not null);

drop policy if exists "papel autenticado le registro_alimentacao_bombonas" on registro_alimentacao_bombonas;
create policy "papel autenticado le registro_alimentacao_bombonas"
  on registro_alimentacao_bombonas for select
  to authenticated
  using (papel_atual() is not null);

-- -----------------------------------------------------------------------------
-- relatorios_turno + relatorio_turno_itens
-- -----------------------------------------------------------------------------
create table if not exists relatorios_turno (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  turno text not null check (turno in ('manha', 'tarde')),
  evento_agenda_id uuid references eventos_agenda(id),
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  fechado_em timestamptz
);

create table if not exists relatorio_turno_itens (
  id uuid primary key default gen_random_uuid(),
  relatorio_turno_id uuid not null references relatorios_turno(id),
  descricao text not null,
  origem text not null default 'planejada' check (origem in ('planejada', 'extra')),
  feito boolean,
  motivo_nao_feito text,
  tipo_registro text check (tipo_registro in ('compostagem', 'canteiro', 'caixa', 'ronda', 'outro')),
  tabela_registro_gerado text,
  registro_id_gerado uuid,
  registrado_por uuid references auth.users(id),
  criado_em timestamptz not null default now()
);

alter table relatorios_turno enable row level security;
alter table relatorio_turno_itens enable row level security;

drop policy if exists "papel autenticado cria relatorios_turno" on relatorios_turno;
create policy "papel autenticado cria relatorios_turno"
  on relatorios_turno for insert
  to authenticated
  with check (
    (papel_atual() is not null)
    and ((criado_por is null) or (criado_por = auth.uid()))
  );

drop policy if exists "papel autenticado le relatorios_turno" on relatorios_turno;
create policy "papel autenticado le relatorios_turno"
  on relatorios_turno for select
  to authenticated
  using (papel_atual() is not null);

drop policy if exists "papel autenticado atualiza relatorios_turno" on relatorios_turno;
create policy "papel autenticado atualiza relatorios_turno"
  on relatorios_turno for update
  to authenticated
  using (papel_atual() is not null)
  with check (papel_atual() is not null);

drop policy if exists "papel autenticado cria relatorio_turno_itens" on relatorio_turno_itens;
create policy "papel autenticado cria relatorio_turno_itens"
  on relatorio_turno_itens for insert
  to authenticated
  with check (
    (papel_atual() is not null)
    and ((registrado_por is null) or (registrado_por = auth.uid()))
  );

drop policy if exists "papel autenticado le relatorio_turno_itens" on relatorio_turno_itens;
create policy "papel autenticado le relatorio_turno_itens"
  on relatorio_turno_itens for select
  to authenticated
  using (papel_atual() is not null);

drop policy if exists "papel autenticado atualiza relatorio_turno_itens" on relatorio_turno_itens;
create policy "papel autenticado atualiza relatorio_turno_itens"
  on relatorio_turno_itens for update
  to authenticated
  using (papel_atual() is not null)
  with check (papel_atual() is not null);

-- -----------------------------------------------------------------------------
-- planejamento_semanal_itens
-- -----------------------------------------------------------------------------
create table if not exists planejamento_semanal_itens (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  turno text not null check (turno in ('manha', 'tarde')),
  descricao text not null,
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now()
);

alter table planejamento_semanal_itens enable row level security;

drop policy if exists "coordenacao e consultor gerenciam planejamento_semanal_itens" on planejamento_semanal_itens;
create policy "coordenacao e consultor gerenciam planejamento_semanal_itens"
  on planejamento_semanal_itens for all
  to authenticated
  using (papel_atual() = any (array['coordenacao', 'consultor']))
  with check (papel_atual() = any (array['coordenacao', 'consultor']));

drop policy if exists "papel autenticado le planejamento_semanal_itens" on planejamento_semanal_itens;
create policy "papel autenticado le planejamento_semanal_itens"
  on planejamento_semanal_itens for select
  to authenticated
  using (papel_atual() is not null);

-- -----------------------------------------------------------------------------
-- relatos_ia_log — espelho de schema só; nenhuma tela/função usa esta
-- tabela nesta sprint (Relato por IA é Sprint B — ver AGENTS/sprint doc)
-- -----------------------------------------------------------------------------
create table if not exists relatos_ia_log (
  id uuid primary key default gen_random_uuid(),
  modo text not null check (modo in ('texto', 'voz')),
  relatorio_turno_id uuid references relatorios_turno(id),
  tokens_entrada int,
  tokens_saida int,
  segundos_audio int,
  aceito_sem_edicao boolean,
  registrado_por uuid references auth.users(id),
  criado_em timestamptz not null default now()
);

alter table relatos_ia_log enable row level security;

drop policy if exists "papel autenticado cria relatos_ia_log" on relatos_ia_log;
create policy "papel autenticado cria relatos_ia_log"
  on relatos_ia_log for insert
  to authenticated
  with check (
    (papel_atual() is not null)
    and ((registrado_por is null) or (registrado_por = auth.uid()))
  );

drop policy if exists "papel autenticado le relatos_ia_log" on relatos_ia_log;
create policy "papel autenticado le relatos_ia_log"
  on relatos_ia_log for select
  to authenticated
  using (papel_atual() is not null);
