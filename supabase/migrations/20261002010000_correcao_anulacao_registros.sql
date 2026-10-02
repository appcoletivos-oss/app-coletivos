-- =============================================================================
-- Sprint A.1 — Corrigir e anular registro + foto pendente da colheita
-- =============================================================================
--
-- Tabelas cobertas agora: registros_colheita, registros_perdas, plantios.
-- Mecanismo genérico pra estender depois (basta, por tabela: colunas de
-- anulação, policy de UPDATE e o trigger trg_registro_correcao com os
-- argumentos certos — ver seção 4).
--
-- Ficam de fora nesta migration: registros_manejo, registros_manejo_plantios,
-- registros_alimentacao, registro_alimentacao_bombonas, registros_bombonas,
-- registros_analise_sensorial, registros_esvaziamento_caixa,
-- plantio_transplantes, plantio_doacoes, doacoes_alimento, ocorrencias_atipicas,
-- pontos, lancamentos_financeiros.
--
-- Regras (decisão do Thiago, 02/10/2026):
--   * Anular = colunas no próprio registro (anulado_em/anulado_por/
--     motivo_anulacao). Sem DELETE novo. Anulado sai de saldo, listas, Mapa
--     e relatórios; a coordenação ainda consulta.
--   * Histórico: registros_historico guarda a linha ANTIGA (to_jsonb(OLD))
--     a cada UPDATE real. Só leitura, e só coordenação/consultor. Ninguém
--     insere direto: só o trigger (security definer).
--   * Quem corrige (consultor = coordenação em tudo, decisão de 02/10/2026):
--       - coordenação e consultor: qualquer registro, sempre (inclusive os
--         ligados a Relatório do Turno já fechado, e os já anulados);
--       - autor (registrado_por = auth.uid()): o próprio, até 48h depois de
--         criado, e só se NÃO estiver ligado a Relatório do Turno fechado;
--       - qualquer papel: só anexar a foto de colheita com foto_pendente.
--   * Desfazer anulação e mexer em registro já anulado: coordenação/consultor.
--
-- CONTRATO DA ANULAÇÃO (o app precisa seguir):
--   * Anular = um UPDATE que leva `anulado_em` de NULL pra NÃO NULL, junto
--     com `motivo_anulacao` não vazio. O app manda os dois:
--       update ... set anulado_em = <qualquer timestamp>, motivo_anulacao = '...'
--     O valor de anulado_em mandado pelo app é só o sinal: o banco troca por
--     now(), e anulado_por por auth.uid().
--   * Mandar só `motivo_anulacao` (sem anulado_em) NÃO anula: é recusado
--     (hint 'anulacao_incompleta'), pra não ficar registro com motivo e sem
--     anulação. O mesmo vale pra `anulado_por` mandado pelo app: é ignorado.
--   * Os dois triggers de plantios olham a MESMA condição (OLD.anulado_em
--     nulo e NEW.anulado_em não nulo, como o app mandou). O de bloqueio
--     (trg_plantios_a_bloquear_anulacao) roda antes do genérico
--     (trg_registro_correcao) porque o Postgres dispara triggers BEFORE da
--     mesma tabela em ordem alfabética do nome — então ele ainda vê o valor
--     mandado pelo app, e a troca por now() no genérico não muda nada pra
--     ele.
--   * As permissões ficam no trigger (e não só em RLS) porque RLS não sabe
--     comparar a linha antiga com a nova, e `plantios` tem atualização
--     operacional livre (status, germinação) que precisa continuar valendo
--     pra qualquer papel.
--
-- Como aplicar: rodar inteiro no SQL Editor. Idempotente.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Colunas de anulação + foto pendente
-- -----------------------------------------------------------------------------

alter table registros_colheita
  add column if not exists anulado_em      timestamptz,
  add column if not exists anulado_por     uuid references auth.users(id),
  add column if not exists motivo_anulacao text,
  -- true só quando a pessoa salvou SEM foto pelo app novo. Colheitas antigas
  -- sem foto ficam false (sem pendência retroativa).
  add column if not exists foto_pendente   boolean not null default false;

alter table registros_perdas
  add column if not exists anulado_em      timestamptz,
  add column if not exists anulado_por     uuid references auth.users(id),
  add column if not exists motivo_anulacao text;

alter table plantios
  add column if not exists anulado_em      timestamptz,
  add column if not exists anulado_por     uuid references auth.users(id),
  add column if not exists motivo_anulacao text;

comment on column registros_colheita.foto_pendente is
  'true = salva sem foto (foto obrigatória com envio posterior). Volta a false sozinha quando foto_url é preenchida.';

create index if not exists idx_registros_colheita_foto_pendente
  on registros_colheita (registrado_em desc) where foto_pendente and anulado_em is null;


-- -----------------------------------------------------------------------------
-- 2. Histórico genérico
-- -----------------------------------------------------------------------------

create table if not exists registros_historico (
  id               uuid primary key default gen_random_uuid(),
  tabela           text not null,
  registro_id      uuid not null,
  dados_anteriores jsonb not null,
  alterado_por     uuid default auth.uid(),
  alterado_em      timestamptz not null default now()
);

comment on table registros_historico is
  'Linha ANTIGA (to_jsonb(OLD)) de cada UPDATE em tabela de registro — o "depois" é a linha atual. Preenchida só pelo trigger registro_antes_de_alterar(). Leitura só coordenação/consultor; sem INSERT/UPDATE/DELETE pelo cliente.';

create index if not exists idx_registros_historico_registro
  on registros_historico (tabela, registro_id, alterado_em desc);

alter table registros_historico enable row level security;

drop policy if exists "coordenacao e consultor leem registros_historico" on registros_historico;
create policy "coordenacao e consultor leem registros_historico" on registros_historico
  for select to authenticated
  using (public.papel_atual() in ('coordenacao', 'consultor'));


-- -----------------------------------------------------------------------------
-- 3. Trigger genérico: permissão de correção + histórico
-- -----------------------------------------------------------------------------
-- Argumentos do trigger:
--   tg_argv[0]   = coluna de data de criação (registrado_em / criado_em),
--                  base do prazo de 48h do autor;
--   tg_argv[1..] = colunas de atualização OPERACIONAL, liberadas pra qualquer
--                  papel (ex.: plantios.status). Não contam como correção,
--                  mas também vão pro histórico.
-- Erros saem com errcode 42501 e um `hint` curto que o app traduz.

create or replace function public.registro_antes_de_alterar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antigo        jsonb := to_jsonb(old);
  v_novo          jsonb := to_jsonb(new);
  v_coluna_tempo  text  := tg_argv[0];
  v_livres        text[] := coalesce(tg_argv[1:tg_nargs - 1], '{}');
  v_alteradas     text[];
  v_papel         text  := public.papel_atual();
  v_anulando      boolean;
  v_desanulando   boolean;
  v_ja_anulado    boolean;
  v_relatorio_fechado boolean;
begin
  select coalesce(array_agg(k), '{}') into v_alteradas
    from jsonb_object_keys(v_novo) as t(k)
   where v_novo -> k is distinct from v_antigo -> k;

  -- UPDATE que não muda nada: não vira histórico.
  if cardinality(v_alteradas) = 0 then
    return new;
  end if;

  if v_papel is null then
    raise exception using errcode = '42501', message = 'Sem permissão.', hint = 'sem_papel';
  end if;

  if v_alteradas && array['id', 'registrado_por', v_coluna_tempo] then
    raise exception using errcode = '42501',
      message = 'Autor e data de criação de um registro não podem ser alterados.', hint = 'imutavel';
  end if;

  v_ja_anulado  := v_antigo ->> 'anulado_em' is not null;
  v_anulando    := not v_ja_anulado and v_novo ->> 'anulado_em' is not null;
  v_desanulando := v_ja_anulado and v_novo ->> 'anulado_em' is null;

  -- Motivo (ou autor da anulação) mexido sem a transição de anulado_em:
  -- não é anulação. Recusa em vez de gravar motivo solto (ver CONTRATO).
  if not v_anulando and not v_desanulando and v_alteradas && array['motivo_anulacao'] then
    raise exception using errcode = '23514',
      message = 'Pra anular, mande anulado_em junto com o motivo.', hint = 'anulacao_incompleta';
  end if;

  if v_anulando then
    if nullif(btrim(coalesce(v_novo ->> 'motivo_anulacao', '')), '') is null then
      raise exception using errcode = '23514',
        message = 'Diga o motivo da anulação.', hint = 'motivo_obrigatorio';
    end if;
    -- Quem e quando vêm do banco, nunca do aparelho.
    new.anulado_em  := now();
    new.anulado_por := auth.uid();
  elsif not v_desanulando then
    new.anulado_por := old.anulado_por;
  end if;

  -- (a) Só colunas operacionais, registro não anulado: qualquer papel.
  if not v_ja_anulado and not v_anulando and v_alteradas <@ v_livres then
    null;

  -- (b) Anexar a foto pendente de uma colheita: qualquer papel.
  elsif not v_ja_anulado and not v_anulando
        and v_antigo ? 'foto_pendente'
        and (v_antigo ->> 'foto_pendente')::boolean
        and v_alteradas <@ array['foto_url', 'foto_pendente']
        and v_novo ->> 'foto_url' is not null then
    null;

  -- (c) Correção / anulação.
  else
    if v_ja_anulado and v_papel not in ('coordenacao', 'consultor') then
      raise exception using errcode = '42501',
        message = 'Registro anulado: só a coordenação ou o consultor podem mexer.', hint = 'anulado';
    end if;

    select exists (
      select 1
        from public.relatorio_turno_itens i
        join public.relatorios_turno r on r.id = i.relatorio_turno_id
       where i.tabela_registro_gerado = tg_table_name
         and i.registro_id_gerado = old.id
         and r.fechado_em is not null
    ) into v_relatorio_fechado;

    if v_papel in ('coordenacao', 'consultor') then
      null;
    elsif v_relatorio_fechado then
      raise exception using errcode = '42501',
        message = 'Esse registro é de um Relatório do Turno já fechado: só a coordenação ou o consultor corrigem.',
        hint = 'relatorio_fechado';
    elsif (v_antigo ->> 'registrado_por')::uuid is distinct from auth.uid() then
      raise exception using errcode = '42501',
        message = 'Só quem registrou (ou a coordenação/consultor) pode corrigir.', hint = 'nao_autor';
    elsif (v_antigo ->> v_coluna_tempo)::timestamptz < now() - interval '48 hours' then
      raise exception using errcode = '42501',
        message = 'Passou o prazo de 48h pra corrigir: peça pra coordenação.', hint = 'prazo_48h';
    end if;
  end if;

  -- Foto anexada (pendente ou correção): limpa a pendência.
  if v_antigo ? 'foto_pendente' and v_novo ->> 'foto_url' is not null then
    new.foto_pendente := false;
  end if;

  insert into public.registros_historico (tabela, registro_id, dados_anteriores)
  values (tg_table_name, old.id, v_antigo);

  return new;
end;
$$;

revoke all on function public.registro_antes_de_alterar() from public;


-- -----------------------------------------------------------------------------
-- 4. Ligar o trigger nas tabelas + policy de UPDATE
-- -----------------------------------------------------------------------------
-- RLS de UPDATE fica aberta a qualquer papel; quem decide é o trigger.
-- plantios já tinha "papel autenticado atualiza plantios" (20260827130000).

drop policy if exists "papel autenticado atualiza registros_colheita" on registros_colheita;
create policy "papel autenticado atualiza registros_colheita" on registros_colheita
  for update to authenticated
  using (public.papel_atual() is not null)
  with check (public.papel_atual() is not null);

drop policy if exists "papel autenticado atualiza registros_perdas" on registros_perdas;
create policy "papel autenticado atualiza registros_perdas" on registros_perdas
  for update to authenticated
  using (public.papel_atual() is not null)
  with check (public.papel_atual() is not null);

drop trigger if exists trg_registro_correcao on registros_colheita;
create trigger trg_registro_correcao
  before update on registros_colheita
  for each row execute function public.registro_antes_de_alterar('registrado_em');

drop trigger if exists trg_registro_correcao on registros_perdas;
create trigger trg_registro_correcao
  before update on registros_perdas
  for each row execute function public.registro_antes_de_alterar('registrado_em');

-- plantios: colunas livres = TODAS as que o app atualiza hoje (busca por
-- .update( em src/, 02/10/2026), todas em lib/plantios.ts:
--   confirmarGerminacao         -> data_germinacao, quantidade_germinada, status
--   marcarStatusPlantio         -> status (Mapa; Colher "encerra o plantio")
--   encerrarPlantioPorDesativacao -> status, observacao_encerramento
--   registrarTransplante        -> status ('transplantado')
-- "Reabrir o plantio" depois de anular a colheita que o encerrou também é
-- só `status`, então passa pra qualquer papel (inclusive quem anulou),
-- desde que o próprio plantio não esteja anulado. Nenhuma RPC/função do
-- banco atualiza plantios.
drop trigger if exists trg_registro_correcao on plantios;
create trigger trg_registro_correcao
  before update on plantios
  for each row execute function public.registro_antes_de_alterar(
    'criado_em', 'status', 'data_germinacao', 'quantidade_germinada', 'observacao_encerramento'
  );


-- -----------------------------------------------------------------------------
-- 5. plantios: não anular lote que ainda tem registro ligado
-- -----------------------------------------------------------------------------
-- Anular um plantio com colheita/perda válida, transplante, doação, manejo
-- ou lote filho deixaria esses registros órfãos. Pede pra anular (ou
-- resolver) os ligados antes.
-- Enxerga a anulação pela mesma condição do trigger genérico: OLD.anulado_em
-- nulo e NEW.anulado_em não nulo (ver CONTRATO no topo). Se o app mandasse
-- só motivo_anulacao, este trigger não dispararia — mas aí o genérico
-- recusa a escrita ('anulacao_incompleta'), então não há caminho pra anular
-- sem passar por aqui. Nome em ordem alfabética antes de
-- trg_registro_correcao: roda primeiro.

create or replace function public.plantio_bloquear_anulacao_com_ligados()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.anulado_em is null and new.anulado_em is not null and (
       exists (select 1 from public.registros_colheita c where c.plantio_id = old.id and c.anulado_em is null)
    or exists (select 1 from public.registros_perdas p where p.plantio_id = old.id and p.anulado_em is null)
    or exists (select 1 from public.plantio_transplantes t
                where t.plantio_origem_id = old.id or t.plantio_destino_id = old.id)
    or exists (select 1 from public.plantio_doacoes d where d.plantio_id = old.id)
    or exists (select 1 from public.registros_manejo_plantios m where m.plantio_id = old.id)
    or exists (select 1 from public.plantios f where f.plantio_pai_id = old.id and f.anulado_em is null)
  ) then
    raise exception using errcode = '23503',
      message = 'Esse plantio tem colheita, perda, transplante, doação ou manejo registrados. Anule esses registros antes.',
      hint = 'plantio_com_ligados';
  end if;
  return new;
end;
$$;

revoke all on function public.plantio_bloquear_anulacao_com_ligados() from public;

drop trigger if exists trg_plantios_a_bloquear_anulacao on plantios;
create trigger trg_plantios_a_bloquear_anulacao
  before update on plantios
  for each row execute function public.plantio_bloquear_anulacao_com_ligados();


-- -----------------------------------------------------------------------------
-- 6. Saldo e galeria sem anulados
-- -----------------------------------------------------------------------------
-- plantios_saldo: mesmas colunas de antes (create or replace). Plantio
-- anulado tem saldo 0 (sai do Estoque do viveiro); perda anulada não
-- desconta. Transplante/doação ainda não têm anulação (seção 0).

create or replace view plantios_saldo as
select
  p.id,
  case
    when p.anulado_em is not null then 0
    else coalesce(p.quantidade_germinada, p.quantidade_inicial)
      - coalesce((select sum(quantidade) from plantio_transplantes where plantio_origem_id = p.id), 0)
      - coalesce((select sum(quantidade) from registros_perdas
                   where plantio_id = p.id and anulado_em is null), 0)
      - coalesce((select sum(quantidade) from plantio_doacoes where plantio_id = p.id), 0)
  end as quantidade_disponivel
from plantios p;

comment on view plantios_saldo is
  'Saldo disponível de cada plantio, sempre calculado (nunca armazenado). Base: quantidade_germinada quando existir, senão quantidade_inicial. Plantio anulado = 0; perda anulada não desconta.';

-- Galeria: mesma função de 20260830000000, sem colheita/perda anuladas.
create or replace function public.listar_galeria_fotos()
returns table (origem text, registro_id uuid, foto_url text, data timestamptz, descricao text)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select 'colheita'::text as origem, c.id as registro_id, c.foto_url,
           c.registrado_em as data,
           (coalesce(c.cultura, '') || ' · ' || c.peso_kg || ' kg')::text as descricao
      from public.registros_colheita c where c.foto_url is not null and c.anulado_em is null
    union all
    select 'doacao', d.id, d.foto_url, d.registrado_em, coalesce(d.destino, 'doação de muda/produção')
      from public.plantio_doacoes d where d.foto_url is not null
    union all
    select 'perda', p.id, p.foto_url, p.registrado_em, coalesce(p.motivo, 'perda')
      from public.registros_perdas p where p.foto_url is not null and p.anulado_em is null
    union all
    select 'transplante', t.id, t.foto_url, t.registrado_em, coalesce(t.observacao, 'transplante')
      from public.plantio_transplantes t where t.foto_url is not null
    union all
    select 'alimentacao', a.id, a.foto_url, a.registrado_em, 'alimentação de caixa'
      from public.registros_alimentacao a where a.foto_url is not null
    union all
    select 'manejo', m.id, m.foto_url, m.registrado_em, m.tipo_manejo
      from public.registros_manejo m where m.foto_url is not null
    union all
    select 'ocorrencia_atipica', o.id, o.foto_url, o.criado_em, o.descricao
      from public.ocorrencias_atipicas o
  ) t
  where public.papel_atual() in ('coordenacao', 'consultor')
  order by data desc;
$$;

-- linhagem_plantio() não muda: devolve `setof plantios`, então já traz
-- anulado_em, e o app marca o nó anulado em vez de esconder (a linhagem é
-- justamente onde a coordenação consulta).
