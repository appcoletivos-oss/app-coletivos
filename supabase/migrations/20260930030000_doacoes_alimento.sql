-- =============================================================================
-- Registro simplificado — Etapa 1, item 5: doação de alimento (bloco Venda)
-- =============================================================================
--
-- NOTA: este SQL já foi aplicado manualmente no Supabase real via SQL
-- Editor em 30/09/2026 (ver claude_handoff-registro-simplificado.md, Etapa
-- 1 item 5). Este arquivo só documenta a migration no repositório — não
-- precisa ser executado de novo.
--
-- Distinta de plantio_doacoes (doação de muda/produção, vinculada a um
-- plantio_id, migration 20260827130000): aqui o rastreio é pela colheita
-- (registro_colheita_id), não pelo canteiro — sem vínculo obrigatório a
-- canteiro. Sem geofence (pode ser registrada fora da área de trabalho).
-- =============================================================================

create table if not exists doacoes_alimento (
  id                     uuid primary key default gen_random_uuid(),
  registro_colheita_id   uuid references registros_colheita(id),
  cultura_id             uuid references culturas(id),
  quantidade             numeric,
  unidade                text not null default 'kg',
  destino                text,
  foto_url               text not null,
  observacao             text,
  registrado_por         uuid not null references auth.users(id),
  criado_em              timestamptz not null default now(),
  constraint doacao_alimento_tem_origem check (registro_colheita_id is not null or cultura_id is not null)
);

comment on table doacoes_alimento is
  'Doação de alimento já colhido (bloco Venda) — distinta de plantio_doacoes (doação de muda/produção). Exatamente uma origem: registro_colheita_id ou cultura_id+quantidade.';

alter table doacoes_alimento enable row level security;

drop policy if exists "papel autenticado cria doacoes_alimento" on doacoes_alimento;
create policy "papel autenticado cria doacoes_alimento"
  on doacoes_alimento for insert
  to authenticated
  with check (
    (papel_atual() is not null)
    and ((registrado_por is null) or (registrado_por = auth.uid()))
  );

drop policy if exists "papel autenticado le doacoes_alimento" on doacoes_alimento;
create policy "papel autenticado le doacoes_alimento"
  on doacoes_alimento for select
  to authenticated
  using (papel_atual() is not null);
