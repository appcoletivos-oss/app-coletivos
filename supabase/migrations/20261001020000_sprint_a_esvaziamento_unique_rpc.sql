-- =============================================================================
-- Sprint A — migration nova (seção 10 de
-- SPRINT_A_REGISTRO_SIMPLIFICADO_ETAPA2.md). Diferente do espelho
-- (20261001010000): este arquivo MUDA o banco. Escrito e parado aqui — o
-- Cowork revisa linha a linha, o Thiago roda no SQL Editor depois.
-- =============================================================================
--
-- Três peças, nenhuma dependendo da ordem das outras dentro deste arquivo:
--   1. Unique (data, turno) em relatorios_turno — pré-requisito do item 6
--      (Relatório do Turno: "um único por data+turno").
--   2. Tabela registros_esvaziamento_caixa — item 4.
--   3. Função registrar_alimentacao_com_bombonas — item 3.
--
-- ATENÇÃO ANTES DE RODAR (item 1): o Claude Code não tem acesso ao
-- Supabase real pra checar isto. Rodar primeiro, à parte:
--
--   select data, turno, count(*)
--   from relatorios_turno
--   group by 1, 2
--   having count(*) > 1;
--
-- Se vier alguma linha, PARAR — não rodar o "create unique index" abaixo
-- antes de resolver as duplicatas (decidir qual relatório fica, mover os
-- itens de relatorio_turno_itens pra ele, apagar o duplicado). Isso é
-- pouco provável: em 09/2026 a tabela só existia manualmente, sem tela
-- ainda, mas o item 6 desta sprint é o que torna relatorios_turno de uso
-- real — por isso a checagem é obrigatória antes do unique index.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Unique (data, turno) em relatorios_turno
-- -----------------------------------------------------------------------------
create unique index if not exists relatorios_turno_data_turno_uniq
  on relatorios_turno (data, turno);

-- -----------------------------------------------------------------------------
-- 2. registros_esvaziamento_caixa (item 4) — esvaziamento acontece depois
-- do descanso da caixa; o composto retirado é contabilizado em carrinhos,
-- sempre pra mesma área de descanso ao ar livre (sem campo de destino
-- nesta rodada). Peso é snapshot, igual ao carrinho de mão em manejo.
-- `status` da caixa NÃO muda ao esvaziar — decisão pendente do Thiago
-- (proposta P5 do sprint doc).
-- -----------------------------------------------------------------------------
create table if not exists registros_esvaziamento_caixa (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references caixas(id),
  tipo_carrinho_id uuid not null references tipos_carrinho(id),
  quantidade_carrinhos numeric not null check (quantidade_carrinhos > 0),
  peso_kg_calculado numeric not null check (peso_kg_calculado >= 0),
  observacao text,
  registrado_por uuid not null references auth.users(id) default auth.uid(),
  registrado_em timestamptz not null default now(),
  evento_agenda_id uuid references eventos_agenda(id) on delete set null
);

comment on table registros_esvaziamento_caixa is
  'Esvaziamento de caixa em descanso: composto retirado, contabilizado em carrinhos (peso snapshot). Destino é sempre a mesma área de descanso ao ar livre — sem campo de destino. Não altera caixas.status (decisão pendente do Thiago, ver sprint doc proposta P5).';

create index if not exists registros_esvaziamento_caixa_caixa_idx
  on registros_esvaziamento_caixa (caixa_id, registrado_em desc);

alter table registros_esvaziamento_caixa enable row level security;

-- Mesmo padrão das demais tabelas de registro do módulo (ver
-- doacoes_alimento, 20260930030000): insert e select por qualquer papel
-- autenticado; sem update e sem delete (append-only).
drop policy if exists "papel autenticado cria registros_esvaziamento_caixa" on registros_esvaziamento_caixa;
create policy "papel autenticado cria registros_esvaziamento_caixa"
  on registros_esvaziamento_caixa for insert
  to authenticated
  with check (
    (papel_atual() is not null)
    and ((registrado_por is null) or (registrado_por = auth.uid()))
  );

drop policy if exists "papel autenticado le registros_esvaziamento_caixa" on registros_esvaziamento_caixa;
create policy "papel autenticado le registros_esvaziamento_caixa"
  on registros_esvaziamento_caixa for select
  to authenticated
  using (papel_atual() is not null);

-- -----------------------------------------------------------------------------
-- 3. registrar_alimentacao_com_bombonas (item 3) — salva o registro pai
-- (registros_alimentacao, peso_kg = soma das bombonas) e as linhas filhas
-- (registro_alimentacao_bombonas) numa transação só, porque
-- registros_alimentacao não tem policy de DELETE (não dá pra "desfazer" o
-- pai no cliente se uma bombona falhasse num insert separado).
--
-- security invoker (não definer): roda com o papel de quem chama, então a
-- RLS de registros_alimentacao/registro_alimentacao_bombonas continua
-- valendo normalmente — a função só agrupa os dois inserts numa
-- transação, não contorna permissão.
--
-- p_bombonas: jsonb array de {"numero_bombona": text, "peso_kg": numeric}.
-- Pra cada bombona, procura em registros_bombonas a linha com o mesmo
-- parceiro_id da coleta e o mesmo numero_bombona, a mais recente por
-- data_entrega, e grava o id em registro_bombona_id; sem match, fica nulo
-- e a linha salva normal (número livre, sem cadastro prévio — o app nunca
-- deduz a loja pelo número, ver sprint doc seção 7).
-- -----------------------------------------------------------------------------
create or replace function registrar_alimentacao_com_bombonas(
  p_parceiro_id uuid,
  p_caixa_id uuid,
  p_tipo_residuo text,
  p_bombonas jsonb,
  p_temperatura_c numeric default null,
  p_foto_url text default null,
  p_observacao text default null,
  p_evento_agenda_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_registro_id uuid;
  v_peso_total numeric;
  v_bombona jsonb;
  v_registro_bombona_id uuid;
begin
  -- Exige ao menos 1 bombona, com numero preenchido e peso >= 0. Sem isso,
  -- p_bombonas nulo ou [] criaria uma coleta de 0 kg sem nenhuma bombona.
  if p_bombonas is null
     or jsonb_typeof(p_bombonas) <> 'array'
     or jsonb_array_length(p_bombonas) = 0 then
    raise exception 'Informe ao menos uma bombona.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_bombonas) b
    where length(trim(coalesce(b->>'numero_bombona', ''))) = 0
       or (b->>'peso_kg') is null
       or (b->>'peso_kg')::numeric < 0
  ) then
    raise exception 'Toda bombona precisa de numero e de peso maior ou igual a zero.';
  end if;

  select coalesce(sum((b->>'peso_kg')::numeric), 0) into v_peso_total
  from jsonb_array_elements(p_bombonas) b;

  insert into public.registros_alimentacao (
    parceiro_id, caixa_id, peso_kg, tipo_residuo, temperatura_c, foto_url, observacao, evento_agenda_id
  )
  values (
    p_parceiro_id, p_caixa_id, v_peso_total, p_tipo_residuo, p_temperatura_c, p_foto_url, p_observacao, p_evento_agenda_id
  )
  returning id into v_registro_id;

  for v_bombona in select * from jsonb_array_elements(p_bombonas)
  loop
    select rb.id into v_registro_bombona_id
    from public.registros_bombonas rb
    where rb.parceiro_id = p_parceiro_id
      and rb.numero_bombona = (v_bombona->>'numero_bombona')
    order by rb.data_entrega desc
    limit 1;

    insert into public.registro_alimentacao_bombonas (
      registro_alimentacao_id, numero_bombona, peso_kg, registro_bombona_id
    )
    values (
      v_registro_id, v_bombona->>'numero_bombona', (v_bombona->>'peso_kg')::numeric, v_registro_bombona_id
    );
  end loop;

  return v_registro_id;
end;
$$;

revoke all on function registrar_alimentacao_com_bombonas(uuid, uuid, text, jsonb, numeric, text, text, uuid) from public;
grant execute on function registrar_alimentacao_com_bombonas(uuid, uuid, text, jsonb, numeric, text, text, uuid) to authenticated;
