-- =============================================================================
-- Sprint B — Item B2b: compostagem por loja (dois formatos) e carrinho
-- assumido (SPRINT_B_RELATO_DO_TURNO.md, seção 4)
-- =============================================================================
--
-- Formato novo dos relatos: loja + quantidade de bombonas + peso total da
-- loja, sem número de bombona e sem divisão por caixa. E nos relatos de
-- setembro o mesmo número aparece duas vezes na mesma coleta.
--
--   1. registro_alimentacao_bombonas: numero_bombona aceita nulo e sai o
--      unique (registro_alimentacao_id, numero_bombona). O índice por
--      número fica. Número repetido na coleta: o app avisa, não bloqueia.
--   2. registros_alimentacao: coleta_id + totais da coleta. Todas as linhas
--      da mesma loja no mesmo turno têm o mesmo coleta_id; "total da loja
--      no turno" = agrupar por coleta_id.
--   3. RPC registrar_alimentacao_por_loja (nova). A antiga
--      registrar_alimentacao_com_bombonas continua igual (a tela atual usa).
--   4. registros_manejo.tipo_carrinho_assumido.
--
-- Observação: registros_alimentacao.peso_kg tem check (peso_kg > 0) desde
-- 20260821120000. Por isso a RPC recusa peso total 0 e divisão que deixe
-- caixa com 0 kg (a spec pedia peso_total >= 0; ver o erro abaixo).
--
-- Como aplicar: rodar inteiro no SQL Editor. Idempotente.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. registro_alimentacao_bombonas: número opcional, repetição permitida
-- -----------------------------------------------------------------------------

alter table registro_alimentacao_bombonas alter column numero_bombona drop not null;

-- O nome do unique foi gerado pelo Postgres (e truncado em 63 caracteres),
-- então procura pelo conjunto de colunas em vez de confiar no nome.
do $$
declare
  v_nome text;
begin
  for v_nome in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.registro_alimentacao_bombonas'::regclass
       and c.contype = 'u'
       and (select array_agg(a.attname::text order by a.attname)
              from unnest(c.conkey) k
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k)
           = array['numero_bombona', 'registro_alimentacao_id']
  loop
    execute format('alter table public.registro_alimentacao_bombonas drop constraint %I', v_nome);
  end loop;
end;
$$;

-- Mantido (já existe desde o espelho 20261001010000).
create index if not exists registro_alimentacao_bombonas_numero_idx
  on registro_alimentacao_bombonas (numero_bombona);


-- -----------------------------------------------------------------------------
-- 2. registros_alimentacao: coleta por loja
-- -----------------------------------------------------------------------------

alter table registros_alimentacao
  add column if not exists coleta_id              uuid,
  add column if not exists qtd_bombonas_coleta    int     check (qtd_bombonas_coleta >= 0),
  add column if not exists peso_total_coleta      numeric check (peso_total_coleta >= 0),
  add column if not exists peso_dividido_estimado boolean not null default false;

comment on column registros_alimentacao.coleta_id is
  'Agrupa as linhas (uma por caixa) da mesma entrega de uma loja no turno. Total da loja = agrupar por coleta_id. Nulo nos registros feitos pela RPC antiga (uma linha = uma coleta).';
comment on column registros_alimentacao.peso_dividido_estimado is
  'true = o peso por caixa desta coleta foi dividido em partes iguais pelo app (a pessoa só informou o total da loja). Vale para todas as linhas da coleta.';

create index if not exists idx_registros_alimentacao_coleta
  on registros_alimentacao (coleta_id) where coleta_id is not null;


-- -----------------------------------------------------------------------------
-- 3. registrar_alimentacao_por_loja
-- -----------------------------------------------------------------------------
-- Uma chamada = uma loja num turno. Grava uma linha de registros_alimentacao
-- por caixa, todas com o mesmo coleta_id (devolvido).
--
-- p_distribuicao: [{"caixa_id": uuid, "peso_kg": numeric|null}, ...], ao
-- menos 1 caixa, sem caixa repetida.
--   * Todas com peso: a soma tem que bater com p_peso_total_kg (tolerância
--     0,05 kg).
--   * Alguma sem peso: o que sobra do total (total - soma das informadas)
--     é dividido em partes iguais entre as sem peso (2 casas, truncado; a
--     última leva o resto) e TODAS as linhas da coleta ficam com
--     peso_dividido_estimado = true.
--
-- p_bombonas (opcional): [{"numero_bombona": text|null, "peso_kg": numeric}].
-- Só grava as filhas quando há exatamente 1 caixa. Com mais de 1 caixa não
-- dá pra saber qual bombona foi pra qual caixa: as filhas NÃO são gravadas
-- (limitação conhecida, ficam só qtd_bombonas_coleta e peso_total_coleta).
-- Vínculo com registros_bombonas igual à RPC antiga (mesmo parceiro +
-- número, mais recente por data_entrega), só quando houver número.
--
-- security invoker: a RLS de quem chama continua valendo; a função só põe
-- tudo numa transação (registros_alimentacao não tem DELETE).
-- -----------------------------------------------------------------------------

create or replace function public.registrar_alimentacao_por_loja(
  p_parceiro_id      uuid,
  p_tipo_residuo     text,
  p_qtd_bombonas     int,
  p_peso_total_kg    numeric,
  p_distribuicao     jsonb,
  p_bombonas         jsonb   default null,
  p_temperatura_c    numeric default null,
  p_foto_url         text    default null,
  p_observacao       text    default null,
  p_evento_agenda_id uuid    default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_coleta_id      uuid := gen_random_uuid();
  v_qtd_caixas     int;
  v_qtd_sem_peso   int;
  v_soma_informada numeric;
  v_restante       numeric;
  v_parte          numeric;
  v_estimado       boolean;
  v_item           jsonb;
  v_peso_linha     numeric;
  v_sem_peso_vistos int := 0;
  v_distribuido    numeric := 0;
  v_registro_id    uuid;
  v_bombona        jsonb;
  v_registro_bombona_id uuid;
begin
  if p_parceiro_id is null then
    raise exception 'Informe a loja.';
  end if;

  if p_qtd_bombonas is null or p_qtd_bombonas < 0 then
    raise exception 'Informe a quantidade de bombonas (zero ou mais).';
  end if;

  -- registros_alimentacao.peso_kg exige > 0.
  if p_peso_total_kg is null or p_peso_total_kg <= 0 then
    raise exception 'Informe o peso total da loja (maior que zero).';
  end if;

  if p_distribuicao is null
     or jsonb_typeof(p_distribuicao) <> 'array'
     or jsonb_array_length(p_distribuicao) = 0 then
    raise exception 'Informe ao menos uma caixa.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_distribuicao) d
     where nullif(d->>'caixa_id', '') is null
        or ((d->>'peso_kg') is not null and (d->>'peso_kg')::numeric <= 0)
  ) then
    raise exception 'Toda caixa precisa de id, e o peso por caixa, quando informado, tem que ser maior que zero.';
  end if;

  if (select count(distinct d->>'caixa_id') from jsonb_array_elements(p_distribuicao) d)
     <> jsonb_array_length(p_distribuicao) then
    raise exception 'A mesma caixa apareceu mais de uma vez.';
  end if;

  select count(*),
         count(*) filter (where (d->>'peso_kg') is null),
         coalesce(sum((d->>'peso_kg')::numeric), 0)
    into v_qtd_caixas, v_qtd_sem_peso, v_soma_informada
    from jsonb_array_elements(p_distribuicao) d;

  v_estimado := v_qtd_sem_peso > 0;

  if not v_estimado then
    if abs(v_soma_informada - p_peso_total_kg) > 0.05 then
      raise exception 'A soma dos pesos por caixa (% kg) não bate com o total da loja (% kg).',
        v_soma_informada, p_peso_total_kg;
    end if;
  else
    v_restante := p_peso_total_kg - v_soma_informada;
    -- Cada caixa sem peso precisa ficar com pelo menos 0,01 kg.
    if v_restante < 0.01 * v_qtd_sem_peso then
      raise exception 'Os pesos por caixa (% kg) já somam o total da loja (% kg): não sobra peso para as caixas sem peso.',
        v_soma_informada, p_peso_total_kg;
    end if;
    -- trunc (e não round): a última caixa nunca fica com menos que as outras.
    v_parte := trunc(v_restante / v_qtd_sem_peso, 2);
  end if;

  if p_bombonas is not null then
    if jsonb_typeof(p_bombonas) <> 'array' then
      raise exception 'Lista de bombonas inválida.';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_bombonas) b
       where (b->>'peso_kg') is null or (b->>'peso_kg')::numeric < 0
    ) then
      raise exception 'Toda bombona detalhada precisa de peso maior ou igual a zero.';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_distribuicao)
  loop
    if (v_item->>'peso_kg') is not null then
      v_peso_linha := (v_item->>'peso_kg')::numeric;
    else
      v_sem_peso_vistos := v_sem_peso_vistos + 1;
      if v_sem_peso_vistos < v_qtd_sem_peso then
        v_peso_linha := v_parte;
        v_distribuido := v_distribuido + v_parte;
      else
        -- Última sem peso leva o que sobrou do arredondamento.
        v_peso_linha := v_restante - v_distribuido;
      end if;
    end if;

    insert into public.registros_alimentacao (
      parceiro_id, caixa_id, peso_kg, tipo_residuo, temperatura_c, foto_url, observacao,
      evento_agenda_id, coleta_id, qtd_bombonas_coleta, peso_total_coleta, peso_dividido_estimado
    )
    values (
      p_parceiro_id, (v_item->>'caixa_id')::uuid, v_peso_linha, p_tipo_residuo, p_temperatura_c,
      p_foto_url, p_observacao, p_evento_agenda_id, v_coleta_id, p_qtd_bombonas, p_peso_total_kg,
      v_estimado
    )
    returning id into v_registro_id;

    -- Bombonas detalhadas: só com 1 caixa (ver cabeçalho).
    if p_bombonas is not null and v_qtd_caixas = 1 then
      for v_bombona in select * from jsonb_array_elements(p_bombonas)
      loop
        v_registro_bombona_id := null;
        if nullif(btrim(coalesce(v_bombona->>'numero_bombona', '')), '') is not null then
          select rb.id into v_registro_bombona_id
            from public.registros_bombonas rb
           where rb.parceiro_id = p_parceiro_id
             and rb.numero_bombona = btrim(v_bombona->>'numero_bombona')
           order by rb.data_entrega desc
           limit 1;
        end if;

        insert into public.registro_alimentacao_bombonas (
          registro_alimentacao_id, numero_bombona, peso_kg, registro_bombona_id
        )
        values (
          v_registro_id,
          nullif(btrim(coalesce(v_bombona->>'numero_bombona', '')), ''),
          (v_bombona->>'peso_kg')::numeric,
          v_registro_bombona_id
        );
      end loop;
    end if;
  end loop;

  return v_coleta_id;
end;
$$;

revoke all on function public.registrar_alimentacao_por_loja(uuid, text, int, numeric, jsonb, jsonb, numeric, text, text, uuid) from public;
grant execute on function public.registrar_alimentacao_por_loja(uuid, text, int, numeric, jsonb, jsonb, numeric, text, text, uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 4. registros_manejo: tipo de carrinho assumido
-- -----------------------------------------------------------------------------

alter table registros_manejo
  add column if not exists tipo_carrinho_assumido boolean not null default false;

comment on column registros_manejo.tipo_carrinho_assumido is
  'true = o relato não disse o tipo de carrinho e o app assumiu o Carrinho azul (18 kg). peso_kg_calculado é estimativa.';
