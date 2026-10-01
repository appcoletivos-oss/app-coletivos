-- =============================================================================
-- Registro simplificado — Etapa 1, item 2: fotos múltiplas
-- =============================================================================
--
-- NOTA: este SQL já foi aplicado manualmente no Supabase real via SQL
-- Editor em 30/09/2026 (ver claude_handoff-registro-simplificado.md, Etapa
-- 1 item 2). Este arquivo só documenta a migration no repositório — não
-- precisa ser executado de novo.
--
-- Guarda fotos além da capa de qualquer tabela que já tinha `foto_url`
-- (registros_colheita, plantio_doacoes, plantio_transplantes,
-- registros_perdas, registros_alimentacao, registros_manejo,
-- ocorrencias_atipicas, doacoes_alimento). `foto_url` continua sendo a
-- capa — compatibilidade com a Galeria já construída (lib/galeria.ts só lê
-- a capa, sem mudança nela). `tabela_origem` usa o nome real da tabela.
-- =============================================================================

create table if not exists fotos_registro (
  id             uuid primary key default gen_random_uuid(),
  tabela_origem  text not null,
  registro_id    uuid not null,
  foto_url       text not null,
  ordem          int not null default 0,
  criado_em      timestamptz not null default now()
);

comment on table fotos_registro is
  'Fotos extras (além da capa foto_url) de qualquer tabela de registro. tabela_origem + registro_id apontam pra linha original — sem FK (a origem varia de tabela), mesma convenção de registro_id solto já usada em outras uniões do projeto (ex.: listar_galeria_fotos).';

create index if not exists fotos_registro_origem_idx on fotos_registro (tabela_origem, registro_id);

alter table fotos_registro enable row level security;

drop policy if exists "papel autenticado cria fotos_registro" on fotos_registro;
create policy "papel autenticado cria fotos_registro"
  on fotos_registro for insert
  to authenticated
  with check (papel_atual() is not null);

drop policy if exists "papel autenticado le fotos_registro" on fotos_registro;
create policy "papel autenticado le fotos_registro"
  on fotos_registro for select
  to authenticated
  using (papel_atual() is not null);
