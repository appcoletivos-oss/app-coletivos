-- =============================================================================
-- Horta — rastreio de plantio ponta a ponta (origem → germinação →
-- transplante → colheita/perda/doação) + regime de manejo por cultura
-- =============================================================================
--
-- Handoff completo: HANDOFF_HORTA_COMPLETO.md (v3). Esta migration
-- implementa a seção 3 inteira, adaptada ao estado atual do schema:
--
--   - RLS por papel já existe desde a Leva 1 (migration 20260827120000) —
--     as tabelas novas seguem o MESMO padrão de lá (public.papel_atual()), não o
--     padrão "autenticados ... using(true)" descrito na seção 3.11 do
--     handoff (que era o padrão piloto, anterior à Leva 1). Tabelas tipo
--     Cadastro (culturas, culturas_regime_manejo): leitura pra qualquer
--     papel, escrita só coordenação/consultor — mesma regra de
--     parceiros/canteiros/caixas. Tabelas operacionais (plantios e as
--     tabelas ligadas a um plantio): leitura+escrita pra qualquer papel —
--     mesma regra de registros_colheita/registros_manejo.
--   - canteiros.tipo já teve "galeria" corrigido pra "galeia" (migration
--     20260822150000) — a lista nova de tipos usa "galeia", nunca "galeria".
--   - O fechamento do plantio na colheita NUNCA é automático por
--     ciclo_produtivo — é sempre confirmação explícita da tela (ver nota na
--     seção 3.6 do handoff). Esta migration só adiciona a coluna; a lógica
--     de "essa colheita encerra o plantio?" fica na aplicação.
--   - plantio_transplantes: sem função RPC — o registro é feito em
--     chamadas sequenciais do cliente (insere plantio filho, insere o
--     vínculo, atualiza status do pai se esgotou o saldo), mesmo padrão já
--     usado em encerrarESubstituirParceiro/Canteiro (lib/patio.ts). Não há
--     transação real entre as 3 chamadas — risco aceito, mesmo padrão do
--     resto do módulo.
--
-- Como aplicar: rodar este arquivo inteiro no SQL Editor do projeto (sem
-- CLI do Supabase configurada neste repo — mesmo fluxo das migrations
-- anteriores). Rodar a seed (seed_culturas.sql, próxima migration) depois
-- desta.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. canteiros: local (pátio/teto) + novos tipos de canteiro
-- -----------------------------------------------------------------------------

alter table canteiros add column if not exists local text not null default 'patio'
  check (local in ('patio', 'teto'));

comment on column canteiros.local is
  'patio | teto — em qual área física o canteiro fica. Usado pra separar a visão do Mapa por área.';

alter table canteiros drop constraint if exists canteiros_tipo_check;
alter table canteiros add constraint canteiros_tipo_check
  check (tipo in ('canteiro_solo', 'bombona', 'galeia', 'geodesica',
                   'pergolado', 'vaso', 'bandeja_muda', 'saco_muda', 'outro'));


-- -----------------------------------------------------------------------------
-- 2. culturas — ficha de cultura
-- -----------------------------------------------------------------------------

create table if not exists culturas (
  id                     uuid primary key default gen_random_uuid(),
  nome                   text not null unique,
  solo_ideal             text,
  rega_ideal             text,
  ciclo_produtivo        text not null default 'unico'
                           check (ciclo_produtivo in ('unico', 'continuo')),
  dias_para_germinacao   int,
  dias_para_transplante  int,
  dias_para_colheita     int,
  ativo                  boolean not null default true,
  observacoes            text,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

comment on table culturas is
  'Ficha de cultura (Cadastro → Culturas). Todos os campos numéricos são opcionais, pode ser preenchida aos poucos. Ver seed_culturas.sql (próxima migration) pro dado de partida real, pesquisado com fonte institucional.';
comment on column culturas.ciclo_produtivo is
  'unico = colheita encerra o plantio (alface, cenoura). continuo = planta permanece produzindo (tomate, banana). É só o valor de PARTIDA do checkbox "essa colheita encerra o plantio?" em Registrar colheita — a pessoa registrando sempre confirma ou troca (ver migration, nota de topo).';

drop trigger if exists trg_culturas_atualizado_em on culturas;
create trigger trg_culturas_atualizado_em
  before update on culturas
  for each row execute function set_atualizado_em();


-- -----------------------------------------------------------------------------
-- 3. culturas_regime_manejo — regra de manejo periódico, com marco de referência
-- -----------------------------------------------------------------------------

create table if not exists culturas_regime_manejo (
  id              uuid primary key default gen_random_uuid(),
  cultura_id      uuid not null references culturas(id),
  tipo_manejo     text not null check (tipo_manejo in ('capina_seletiva', 'adubacao', 'poda', 'raleamento')),
  referencia      text not null check (referencia in ('plantio', 'germinacao', 'transplante')),
  dias_inicio     int not null check (dias_inicio >= 0),
  intervalo_dias  int not null check (intervalo_dias > 0),
  observacao      text,
  unique (cultura_id, tipo_manejo)
);

comment on table culturas_regime_manejo is
  'Regra de manejo periódico por cultura+tipo, contada a partir de um marco configurável (plantio/germinação/transplante) — necessário porque cada regra da vida real conta a partir de um ponto diferente (ex.: tomate: adubação a cada 15 dias a partir do TRANSPLANTE, não do plantio). Base do motor de "demandas do dia" (lib/plantios.ts).';


-- -----------------------------------------------------------------------------
-- 4. plantios — o lote, com origem e status
-- -----------------------------------------------------------------------------

create table if not exists plantios (
  id                          uuid primary key default gen_random_uuid(),
  cultura_id                  uuid not null references culturas(id),
  canteiro_id                 uuid not null references canteiros(id),
  plantio_pai_id              uuid references plantios(id),
  origem                      text not null
                                 check (origem in ('semente', 'muda_comprada', 'estaca', 'ja_existente', 'divisao')),
  data_inicio                 date not null default current_date,
  quantidade_inicial          numeric,
  unidade                     text,
  data_germinacao             date,
  quantidade_germinada        numeric,
  dias_para_colheita_snapshot int,
  previsao_colheita           date,
  status                      text not null default 'ativo'
                                 check (status in ('germinando', 'ativo', 'colhido', 'perdido', 'doado', 'transplantado', 'encerrado')),
  registrado_por              uuid references auth.users(id) default auth.uid(),
  criado_em                   timestamptz not null default now()
);

comment on table plantios is
  'Um lote de plantio, do início ao fim. plantio_pai_id monta a linhagem completa quando o lote nasceu de um transplante parcial (origem=divisao) — ver função linhagem_plantio(). origem=ja_existente cobre plantas que já estavam no canteiro antes deste módulo (perenes antigas), sem exigir data/quantidade exatas.';
comment on column plantios.status is
  'germinando: só origem=semente, até confirmar germinação. transplantado: 100% do lote foi movido/dividido, não resta planta ativa neste registro (mas ele segue existindo como nó da linhagem). colhido: só fecha automaticamente quando a cultura é ciclo_produtivo=unico E a pessoa confirma na tela; em ciclo continuo o plantio segue ativo até encerrado/perdido manual.';

create index if not exists idx_plantios_canteiro on plantios (canteiro_id);
create index if not exists idx_plantios_cultura on plantios (cultura_id);
create index if not exists idx_plantios_pai on plantios (plantio_pai_id);
create index if not exists idx_plantios_status on plantios (status);

create or replace function linhagem_plantio(p_plantio_id uuid)
returns setof plantios
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive linhagem as (
    select * from public.plantios where id = p_plantio_id
    union all
    select p.* from public.plantios p join linhagem l on p.id = l.plantio_pai_id
  )
  select * from linhagem;
$$;

comment on function linhagem_plantio(uuid) is
  'Reconstrói a linhagem completa de um plantio (semente → germinação → transplante(s) → lote atual), subindo por plantio_pai_id. Usado pelo Mapa pra mostrar "de onde veio" um plantio.';

revoke all on function linhagem_plantio(uuid) from public;
grant execute on function linhagem_plantio(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 5. plantio_transplantes — movimentação com divisão de lote
-- -----------------------------------------------------------------------------

create table if not exists plantio_transplantes (
  id                  uuid primary key default gen_random_uuid(),
  plantio_origem_id   uuid not null references plantios(id),
  plantio_destino_id  uuid not null references plantios(id),
  canteiro_destino_id uuid not null references canteiros(id),
  quantidade          numeric,
  observacao          text,
  foto_url            text,
  registrado_por      uuid references auth.users(id) default auth.uid(),
  registrado_em       timestamptz not null default now()
);

comment on table plantio_transplantes is
  'Um registro por movimentação de plantio (transplante, com ou sem divisão de lote). plantio_destino_id é o lote-filho criado na mesma operação (origem=divisao, plantio_pai_id=plantio_origem_id) — ver nota de topo sobre como o cliente monta essa operação em passos sequenciais.';

create index if not exists idx_plantio_transplantes_origem on plantio_transplantes (plantio_origem_id);
create index if not exists idx_plantio_transplantes_destino on plantio_transplantes (plantio_destino_id);


-- -----------------------------------------------------------------------------
-- 6. registros_colheita: vínculo obrigatório (na aplicação) a um plantio
-- -----------------------------------------------------------------------------

alter table registros_colheita add column if not exists plantio_id uuid references plantios(id);

comment on column registros_colheita.plantio_id is
  'Obrigatório NA APLICAÇÃO pra todo registro novo (nullable no banco só pra não quebrar histórico anterior a este módulo). A cultura passa a vir do plantio escolhido; o campo cultura (texto livre) segue existindo só pra exibir os registros antigos.';

create index if not exists idx_registros_colheita_plantio on registros_colheita (plantio_id);


-- -----------------------------------------------------------------------------
-- 7. registros_perdas
-- -----------------------------------------------------------------------------

create table if not exists registros_perdas (
  id             uuid primary key default gen_random_uuid(),
  plantio_id     uuid not null references plantios(id),
  quantidade     numeric,
  unidade        text,
  motivo         text,
  foto_url       text,
  registrado_por uuid references auth.users(id) default auth.uid(),
  registrado_em  timestamptz not null default now()
);

comment on table registros_perdas is
  'Perda de mudas/produção de um plantio específico, com quantidade. Sempre amarrada a plantio_id (nunca só a um canteiro).';

create index if not exists idx_registros_perdas_plantio on registros_perdas (plantio_id);


-- -----------------------------------------------------------------------------
-- 8. plantio_doacoes — doação de mudas/produção (distinta da doação de
--    alimento já colhido, que fica no bloco Venda, fora de escopo aqui)
-- -----------------------------------------------------------------------------

create table if not exists plantio_doacoes (
  id             uuid primary key default gen_random_uuid(),
  plantio_id     uuid not null references plantios(id),
  quantidade     numeric,
  unidade        text,
  destino        text,
  observacao     text,
  foto_url       text,
  registrado_por uuid references auth.users(id) default auth.uid(),
  registrado_em  timestamptz not null default now()
);

comment on table plantio_doacoes is
  'Doação de mudas ou de parte de um lote (ex.: sobrou muda da bandeja). Diferente da doação de alimento já colhido pra ZEIS (bloco Venda, não mexe aqui).';

create index if not exists idx_plantio_doacoes_plantio on plantio_doacoes (plantio_id);


-- -----------------------------------------------------------------------------
-- 9. registros_manejo_plantios — vínculo manejo↔plantio
-- -----------------------------------------------------------------------------

create table if not exists registros_manejo_plantios (
  registro_manejo_id uuid not null references registros_manejo(id),
  plantio_id          uuid not null references plantios(id),
  primary key (registro_manejo_id, plantio_id)
);

comment on table registros_manejo_plantios is
  'Vínculo entre um registro de manejo e os plantios afetados. Adubação/capina: o cliente já sabe (na tela) quais plantios estão ativos no canteiro escolhido e preenche esta tabela sozinho, sem passo extra pra pessoa registrando. Poda/raleamento: exige escolher explicitamente quais plantios na tela.';

create index if not exists idx_registros_manejo_plantios_plantio on registros_manejo_plantios (plantio_id);


-- -----------------------------------------------------------------------------
-- 10. plantios_saldo — saldo disponível do lote (view, nunca armazenado)
-- -----------------------------------------------------------------------------

create or replace view plantios_saldo as
select
  p.id,
  coalesce(p.quantidade_germinada, p.quantidade_inicial)
    - coalesce((select sum(quantidade) from plantio_transplantes where plantio_origem_id = p.id), 0)
    - coalesce((select sum(quantidade) from registros_perdas where plantio_id = p.id), 0)
    - coalesce((select sum(quantidade) from plantio_doacoes where plantio_id = p.id), 0)
    as quantidade_disponivel
from plantios p;

comment on view plantios_saldo is
  'Saldo disponível de cada plantio, sempre calculado (nunca armazenado). Base: quantidade_germinada quando existir (semente já confirmada), senão quantidade_inicial.';


-- -----------------------------------------------------------------------------
-- 11. RLS
-- -----------------------------------------------------------------------------
-- Cadastro (culturas / regime de manejo): leitura pra qualquer papel,
-- escrita só coordenação/consultor — mesmo padrão de parceiros/canteiros.

alter table culturas enable row level security;
alter table culturas_regime_manejo enable row level security;

do $$
declare t text;
begin
  foreach t in array array['culturas', 'culturas_regime_manejo']
  loop
    execute format($f$
      create policy "papel autenticado le %1$s" on %1$s
        for select to authenticated
        using (public.papel_atual() is not null)
    $f$, t);

    execute format($f$
      create policy "coordenacao e consultor gerenciam %1$s" on %1$s
        for all to authenticated
        using (public.papel_atual() in ('coordenacao','consultor'))
        with check (public.papel_atual() in ('coordenacao','consultor'))
    $f$, t);
  end loop;
end $$;

-- Operacional (plantios e tabelas ligadas): leitura+escrita pra qualquer
-- papel — mesmo padrão de registros_colheita/registros_manejo.

alter table plantios enable row level security;
alter table plantio_transplantes enable row level security;
alter table registros_perdas enable row level security;
alter table plantio_doacoes enable row level security;
alter table registros_manejo_plantios enable row level security;

create policy "papel autenticado le plantios" on plantios
  for select to authenticated
  using (public.papel_atual() is not null);

create policy "papel autenticado cria plantios" on plantios
  for insert to authenticated
  with check (
    public.papel_atual() is not null
    and (registrado_por is null or registrado_por = auth.uid())
  );

-- UPDATE (confirmar germinação, marcar transplantado/perdido/doado/
-- encerrado) não é restrito a quem criou o registro — qualquer papel pode
-- atualizar o status de qualquer plantio, é trabalho colaborativo de campo.
create policy "papel autenticado atualiza plantios" on plantios
  for update to authenticated
  using (public.papel_atual() is not null)
  with check (public.papel_atual() is not null);

do $$
declare t text;
begin
  foreach t in array array['plantio_transplantes', 'registros_perdas', 'plantio_doacoes']
  loop
    execute format($f$
      create policy "papel autenticado le %1$s" on %1$s
        for select to authenticated
        using (public.papel_atual() is not null)
    $f$, t);

    execute format($f$
      create policy "papel autenticado cria %1$s" on %1$s
        for insert to authenticated
        with check (
          public.papel_atual() is not null
          and (registrado_por is null or registrado_por = auth.uid())
        )
    $f$, t);
  end loop;
end $$;

-- registros_manejo_plantios não tem registrado_por próprio (a autoria vem
-- de registros_manejo, que ela referencia) — só exige papel autenticado.
create policy "papel autenticado le registros_manejo_plantios" on registros_manejo_plantios
  for select to authenticated
  using (public.papel_atual() is not null);

create policy "papel autenticado cria registros_manejo_plantios" on registros_manejo_plantios
  for insert to authenticated
  with check (public.papel_atual() is not null);
