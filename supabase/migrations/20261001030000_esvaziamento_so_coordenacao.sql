-- =============================================================================
-- Sprint A — esvaziamento de caixa só pela coordenação (decisão de 10/2026).
-- Já aplicado no Supabase pelo SQL Editor; este arquivo versiona o histórico.
-- Idempotente (drop policy if exists + create or replace function).
--
-- 1. Só Coordenação e Consultor inserem em registros_esvaziamento_caixa
--    (substitui a policy "papel autenticado cria ...", da 20261001020000).
-- 2. registrar_esvaziamento_caixa: security invoker, atômica. Muda o status da
--    caixa de 'descanso' para 'ativa' ou 'desativada' (manutenção), limpa
--    data_inicio_descanso e grava o esvaziamento com o peso calculado no banco
--    (quantidade × peso_estimado_kg do tipo de carrinho).
-- =============================================================================

drop policy if exists "papel autenticado cria registros_esvaziamento_caixa" on registros_esvaziamento_caixa;
drop policy if exists "coordenacao e consultor criam registros_esvaziamento_caixa" on registros_esvaziamento_caixa;
create policy "coordenacao e consultor criam registros_esvaziamento_caixa"
  on registros_esvaziamento_caixa for insert
  to authenticated
  with check (
    papel_atual() = any (array['coordenacao', 'consultor'])
    and registrado_por = auth.uid()
  );

create or replace function registrar_esvaziamento_caixa(
  p_caixa_id uuid,
  p_tipo_carrinho_id uuid,
  p_quantidade_carrinhos numeric,
  p_novo_status text,
  p_observacao text default null,
  p_evento_agenda_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_peso_carrinho numeric;
  v_atualizadas int;
begin
  if public.papel_atual() is distinct from 'coordenacao'
     and public.papel_atual() is distinct from 'consultor' then
    raise exception 'So a coordenacao registra esvaziamento de caixa.';
  end if;

  if p_novo_status not in ('ativa', 'desativada') then
    raise exception 'Depois do esvaziamento a caixa volta a funcionar ou vai pra manutencao.';
  end if;

  if p_quantidade_carrinhos is null or p_quantidade_carrinhos <= 0 then
    raise exception 'Informe quantos carrinhos.';
  end if;

  select peso_estimado_kg into v_peso_carrinho
  from public.tipos_carrinho
  where id = p_tipo_carrinho_id;

  if not found then
    raise exception 'Tipo de carrinho nao encontrado.';
  end if;

  update public.caixas
  set status = p_novo_status,
      data_inicio_descanso = null
  where id = p_caixa_id
    and status = 'descanso';

  get diagnostics v_atualizadas = row_count;
  if v_atualizadas = 0 then
    raise exception 'Essa caixa nao esta em descanso.';
  end if;

  insert into public.registros_esvaziamento_caixa (
    caixa_id, tipo_carrinho_id, quantidade_carrinhos, peso_kg_calculado,
    observacao, registrado_por, evento_agenda_id
  )
  values (
    p_caixa_id, p_tipo_carrinho_id, p_quantidade_carrinhos,
    p_quantidade_carrinhos * v_peso_carrinho,
    p_observacao, auth.uid(), p_evento_agenda_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function registrar_esvaziamento_caixa(uuid, uuid, numeric, text, text, uuid) from public;
grant execute on function registrar_esvaziamento_caixa(uuid, uuid, numeric, text, text, uuid) to authenticated;
