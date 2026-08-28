-- =============================================================================
-- Bloco "Mais completo" — Pacote 1
-- =============================================================================
--
-- Handoff: claude/handoff-mais-pacote1.md. Cobre as 5 frentes do pacote:
--   1. Canteiro — exclusão real x inativação (motivo próprio) + novo
--      encerramento de plantio "por desativação da estrutura", separado de
--      perda real.
--   2. Ocorrência atípica (tabela nova) + banner na home do Pátio.
--   3. Avisos ao shopping (tabela nova) — log bidirecional de comunicação.
--   4. Galeria de fotos — sem tabela, função que une as fotos já existentes.
--   5. Financeiro — categorias cadastráveis + lançamentos com comprovante.
--
-- Ajustes em relação ao handoff, feitos contra o schema real:
--   - canteiros JÁ TEM `ativo boolean` (migration 20260821120000) e
--     `listarCanteiros()` já filtra por ele — inativar reaproveita esse
--     campo em vez de criar um `status` enum novo. As colunas novas só
--     guardam o MOTIVO/AUTOR da inativação, pra distinguir de um
--     "encerrar e substituir" (turnover, que preenche vinculado_ate).
--   - plantios.status: a constraint real tem 7 valores (germinando, ativo,
--     colhido, perdido, doado, transplantado, encerrado). Esta migration
--     ADICIONA o 8º (encerrado_por_desativacao), mantendo os 7.
--   - RLS segue o padrão da Leva 1 (public.papel_atual()), não o padrão
--     piloto `using(true)`. "Mais" (avisos, financeiro, galeria) =
--     coordenação/consultor; ocorrência atípica = qualquer papel.
--   - FK circular avisos_shopping <-> lancamentos_financeiros resolvida
--     criando as duas tabelas primeiro e amarrando a segunda FK por ALTER.
--   - Handoff 5.4 (reaproveitar compras de Compostagem/Horta): NÃO existe
--     nenhuma tabela nem formulário de compra no schema atual — a coluna
--     `origem` de lancamentos_financeiros fica pronta pra marcação manual,
--     mas a "tela de conferência" fica pendente até haver o que conferir.
--
-- Como aplicar: rodar este arquivo inteiro no SQL Editor do projeto (sem
-- CLI do Supabase configurada neste repo — mesmo fluxo das migrations
-- anteriores).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1a. canteiros — inativação com motivo próprio
-- -----------------------------------------------------------------------------
-- Reaproveita `ativo boolean` (já existe). Inativar = ativo=false +
-- motivo_inativacao preenchido. "Encerrar e substituir" (turnover) continua
-- sendo ativo=false + vinculado_ate — os dois estados convivem sem conflito.

alter table canteiros add column if not exists motivo_inativacao text;
alter table canteiros add column if not exists inativado_em timestamptz;
alter table canteiros add column if not exists inativado_por uuid references auth.users(id);

comment on column canteiros.motivo_inativacao is
  'Preenchido quando o canteiro é INATIVADO pela tela de Cadastro (estrutura quebrada, planta perene encerrada etc.) — distinto de vinculado_ate, que marca turnover (encerrar e substituir).';


-- -----------------------------------------------------------------------------
-- 1b. plantios — encerramento "por desativação da estrutura"
-- -----------------------------------------------------------------------------
-- Motivo de manter FORA de registros_perdas: perda real (praga, falta
-- d'água) e encerramento por decisão operacional (canteiro desativado)
-- precisam ficar separáveis nos relatórios de produtividade — juntar os
-- dois no mesmo motivo polui o dado.

-- Deriva o nome real da check constraint de status (convenção do PG é
-- plantios_status_check, mas dropa qualquer check em plantios que cite
-- "status" pra não sobrar constraint antiga barrando o valor novo).
do $$
declare c text;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'plantios'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table plantios drop constraint %I', c);
  end loop;
end $$;

alter table plantios add constraint plantios_status_check
  check (status in ('germinando', 'ativo', 'colhido', 'perdido', 'doado',
                    'transplantado', 'encerrado', 'encerrado_por_desativacao'));

alter table plantios add column if not exists observacao_encerramento text;

comment on column plantios.status is
  'germinando: só origem=semente, até confirmar germinação. transplantado: 100% do lote foi movido. colhido: só fecha quando ciclo_produtivo=unico E a pessoa confirma. encerrado: fim do pé por decisão manual (cria perda automática do saldo). encerrado_por_desativacao: canteiro/estrutura foi inativado e a planta não podia ser movida/colhida — NÃO conta como perda nos relatórios (ver observacao_encerramento).';


-- -----------------------------------------------------------------------------
-- 2. ocorrencias_atipicas
-- -----------------------------------------------------------------------------

create table if not exists ocorrencias_atipicas (
  id             uuid primary key default gen_random_uuid(),
  descricao      text not null,
  foto_url       text not null,
  resolvido      boolean not null default false,
  resolvido_em   timestamptz,
  resolvido_por  uuid references auth.users(id),
  registrado_por uuid references auth.users(id) default auth.uid(),
  criado_em      timestamptz not null default now()
);

comment on table ocorrencias_atipicas is
  'Registro de qualquer papel autenticado (equipe inclusive), com foto obrigatória. Enquanto resolvido=false, aparece no banner da home do Pátio. Pode virar um aviso ao shopping (avisos_shopping.ocorrencia_atipica_id).';

create index if not exists idx_ocorrencias_atipicas_pendentes
  on ocorrencias_atipicas (criado_em desc) where not resolvido;


-- -----------------------------------------------------------------------------
-- 3. avisos_shopping  (FK pra lancamentos_financeiros amarrada no fim)
-- -----------------------------------------------------------------------------

create table if not exists avisos_shopping (
  id                       uuid primary key default gen_random_uuid(),
  direcao                  text not null check (direcao in ('para_shopping', 'do_shopping')),
  canal                    text not null check (canal in ('whatsapp', 'email', 'presencial', 'outro')),
  assunto                  text not null check (assunto in (
                             'pedido_compra', 'ocorrencia_atipica', 'pagamento_mensal',
                             'planejamento_atividade', 'pedido_manutencao', 'outro'
                           )),
  descricao                text not null,
  data                     date not null,
  status                   text not null default 'pendente' check (status in ('pendente', 'resolvido')),
  ocorrencia_atipica_id    uuid references ocorrencias_atipicas(id),
  lancamento_financeiro_id uuid,  -- FK adicionada no fim do arquivo
  registrado_por           uuid references auth.users(id) default auth.uid(),
  criado_em                timestamptz not null default now()
);

comment on table avisos_shopping is
  'Log cronológico de comunicação entre o coletivo e o shopping, nos dois sentidos. Linka a uma ocorrência atípica (assunto=ocorrencia_atipica) e/ou a um lançamento financeiro (assunto=pagamento_mensal) — vínculo por atalho, nunca criação automática forçada (ver handoff, 5.5).';

create index if not exists idx_avisos_shopping_data on avisos_shopping (data desc);


-- -----------------------------------------------------------------------------
-- 4. Financeiro — categorias + lançamentos
-- -----------------------------------------------------------------------------

create table if not exists categorias_financeiras (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  tipo       text not null check (tipo in ('entrada', 'saida')),
  criado_por uuid references auth.users(id) default auth.uid(),
  criado_em  timestamptz not null default now()
);

comment on table categorias_financeiras is
  'Categorias de lançamento, cadastráveis pela coordenação financeira (sem lista fixa). tipo separa entrada de saída.';

create table if not exists lancamentos_financeiros (
  id                uuid primary key default gen_random_uuid(),
  tipo              text not null check (tipo in ('entrada', 'saida')),
  categoria_id      uuid not null references categorias_financeiras(id),
  valor             numeric(12,2) not null check (valor >= 0),
  data              date not null,
  descricao         text,
  comprovante_url   text not null,  -- anexo obrigatório (handoff, 5.2)
  origem            text not null default 'manual' check (origem in (
                      'manual', 'compra_compostagem', 'compra_horta', 'repasse_shopping', 'outro'
                    )),
  registro_origem_id uuid,  -- referência solta pro registro de compra original, se vier de lá
  aviso_id          uuid references avisos_shopping(id),
  registrado_por    uuid references auth.users(id) default auth.uid(),
  criado_em         timestamptz not null default now()
);

comment on table lancamentos_financeiros is
  'Lançamento de caixa (entrada/saída) com comprovante obrigatório. origem marca de onde veio (manual, repasse do shopping, compra de um módulo). aviso_id/avisos_shopping.lancamento_financeiro_id se apontam quando um repasse é linkado a um aviso de pagamento_mensal.';

create index if not exists idx_lancamentos_financeiros_data on lancamentos_financeiros (data desc);
create index if not exists idx_lancamentos_financeiros_categoria on lancamentos_financeiros (categoria_id);

-- Segunda ponta da FK circular (avisos_shopping foi criada antes).
alter table avisos_shopping drop constraint if exists avisos_shopping_lancamento_financeiro_id_fkey;
alter table avisos_shopping add constraint avisos_shopping_lancamento_financeiro_id_fkey
  foreign key (lancamento_financeiro_id) references lancamentos_financeiros(id);


-- -----------------------------------------------------------------------------
-- 5. Galeria de fotos — função que une as fotos já existentes
-- -----------------------------------------------------------------------------
-- Sem tabela nova. security definer + checagem de papel dentro da função:
-- a galeria é da coordenação/consultor (handoff, seção 6), e uma view não
-- carrega RLS própria. As fotos ficam no bucket privado "registros-fotos"
-- (qualquer pasta) — a tela gera signed URLs pra exibir.

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
      from public.registros_colheita c where c.foto_url is not null
    union all
    select 'doacao', d.id, d.foto_url, d.registrado_em, coalesce(d.destino, 'doação de muda/produção')
      from public.plantio_doacoes d where d.foto_url is not null
    union all
    select 'perda', p.id, p.foto_url, p.registrado_em, coalesce(p.motivo, 'perda')
      from public.registros_perdas p where p.foto_url is not null
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

comment on function public.listar_galeria_fotos() is
  'Galeria de fotos (Mais → Arquivo de fotos): une foto_url + metadados de todas as tabelas que já guardam foto. Ordem cronológica (mais recente primeiro). Restrita a coordenação/consultor.';

revoke all on function public.listar_galeria_fotos() from public;
grant execute on function public.listar_galeria_fotos() to authenticated;


-- -----------------------------------------------------------------------------
-- 6. RLS
-- -----------------------------------------------------------------------------

-- ---- ocorrencias_atipicas: qualquer papel lê, cria e resolve ----
alter table ocorrencias_atipicas enable row level security;

create policy "papel autenticado le ocorrencias_atipicas" on ocorrencias_atipicas
  for select to authenticated
  using (public.papel_atual() is not null);

create policy "papel autenticado cria ocorrencias_atipicas" on ocorrencias_atipicas
  for insert to authenticated
  with check (
    public.papel_atual() is not null
    and (registrado_por is null or registrado_por = auth.uid())
  );

-- Resolver/reabrir é trabalho colaborativo — qualquer papel pode.
create policy "papel autenticado atualiza ocorrencias_atipicas" on ocorrencias_atipicas
  for update to authenticated
  using (public.papel_atual() is not null)
  with check (public.papel_atual() is not null);

-- ---- avisos_shopping: coordenação/consultor gerenciam ----
-- INSERT tem uma exceção: qualquer papel pode CRIAR o aviso que nasce
-- amarrado a uma ocorrência atípica (assunto=ocorrencia_atipica), porque a
-- ocorrência é aberta a todos e o handoff (2.3) prevê o aviso ser criado
-- junto. Ler/editar/apagar a lista de avisos segue só coordenação/consultor.
alter table avisos_shopping enable row level security;

create policy "coordenacao e consultor leem avisos_shopping" on avisos_shopping
  for select to authenticated
  using (public.papel_atual() in ('coordenacao', 'consultor'));

create policy "avisos_shopping — insert" on avisos_shopping
  for insert to authenticated
  with check (
    (public.papel_atual() in ('coordenacao', 'consultor'))
    or (
      public.papel_atual() is not null
      and assunto = 'ocorrencia_atipica'
      and ocorrencia_atipica_id is not null
    )
  );

create policy "coordenacao e consultor editam avisos_shopping" on avisos_shopping
  for update to authenticated
  using (public.papel_atual() in ('coordenacao', 'consultor'))
  with check (public.papel_atual() in ('coordenacao', 'consultor'));

create policy "coordenacao e consultor apagam avisos_shopping" on avisos_shopping
  for delete to authenticated
  using (public.papel_atual() in ('coordenacao', 'consultor'));

-- ---- financeiro: coordenação/consultor, tudo ----
alter table categorias_financeiras enable row level security;
alter table lancamentos_financeiros enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categorias_financeiras', 'lancamentos_financeiros']
  loop
    execute format($f$
      create policy "coordenacao e consultor leem %1$s" on %1$s
        for select to authenticated
        using (public.papel_atual() in ('coordenacao','consultor'))
    $f$, t);

    execute format($f$
      create policy "coordenacao e consultor gerenciam %1$s" on %1$s
        for all to authenticated
        using (public.papel_atual() in ('coordenacao','consultor'))
        with check (public.papel_atual() in ('coordenacao','consultor'))
    $f$, t);
  end loop;
end $$;
