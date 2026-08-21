-- =============================================================================
-- Módulo 1 (Pátio de Compostagem) — entidades base com memória histórica
-- =============================================================================
--
-- Decisão de produto (2026-08-21): lojas parceiras e canteiros da Horta
-- precisam poder ser renomeados e trocados livremente pela própria equipe,
-- sem perder o histórico. Ex.: a Loja "X" pode ser substituída por outra
-- loja no mês que vem, mas todo registro feito enquanto "X" estava
-- vinculada ao projeto continua mostrando "X" corretamente, marcado no
-- tempo — não pode virar "outra loja" retroativamente.
--
-- Como isso é resolvido aqui:
--   1. Cada parceiro/caixa/canteiro é uma linha com um id (uuid) fixo.
--      Os registros (ex.: registros_alimentacao) sempre referenciam esse id,
--      nunca o nome como texto solto.
--   2. Renomear (corrigir "Loja 1" pra "Padaria do Seu João") só atualiza o
--      campo "nome" da mesma linha — indicado pra corrigir nomes padrão/erros
--      de digitação, não pra trocar quem é o parceiro de fato.
--   3. Quando o parceiro/canteiro de verdade muda (turnover), a prática
--      correta é: marcar o antigo como ativo = false e preencher
--      vinculado_ate, e cadastrar uma linha NOVA para o novo parceiro/
--      canteiro. Assim o histórico de quem cada um foi, e quando, fica
--      intacto — nada é sobrescrito.
--   4. "ativo = false" nunca apaga a linha (nem os registros que apontam
--      pra ela) — só tira das listas de seleção para novos registros.
--
-- A tela de "Cadastro" (equipe edita nomes, tipos, e ativa/desativa) ainda
-- não foi desenhada — é o próximo passo de produto depois desta migração.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Parceiros (lojas/restaurantes que entregam resíduo, + construtora vinculada)
-- -----------------------------------------------------------------------------
create table if not exists parceiros (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  tipo            text not null default 'loja'
                    check (tipo in ('loja', 'construtora', 'outro')),
  ativo           boolean not null default true,
  vinculado_desde date not null default current_date,
  vinculado_ate   date,
  observacoes     text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

comment on table parceiros is
  'Lojas/restaurantes/construtora que entregam resíduo ao pátio. Nome e tipo são editáveis pela equipe (tela de Cadastro). Ver nota de memória histórica no topo do arquivo.';
comment on column parceiros.ativo is
  'false = não aparece mais como opção em novos registros, mas os registros antigos que já apontam pra este parceiro continuam intactos.';
comment on column parceiros.vinculado_ate is
  'Preenchido quando o parceiro deixa de participar do projeto (turnover) — não quando é só uma correção de nome.';

-- -----------------------------------------------------------------------------
-- Caixas de compostagem (1000L / ~620kg) — infraestrutura física do pátio
-- -----------------------------------------------------------------------------
create table if not exists caixas (
  id             uuid primary key default gen_random_uuid(),
  numero         int not null unique,
  status         text not null default 'ativa'
                   check (status in ('ativa', 'nao_ativada', 'nova', 'desativada')),
  capacidade_kg  numeric not null default 620,
  observacoes    text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

comment on table caixas is
  'Caixas d''água de 1000L usadas na compostagem. "nao_ativada"/"nova" ficam visíveis mas não selecionáveis em Registrar alimentação, até a equipe marcar como ativa.';

-- -----------------------------------------------------------------------------
-- Canteiros da Horta — mesma lógica de memória histórica dos parceiros,
-- e com tipo variável (regime de permacultura: solo, bombona, galeria,
-- geodésica, etc. — cada um com forma própria de quantificar área/volume).
-- -----------------------------------------------------------------------------
create table if not exists canteiros (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  tipo              text not null default 'canteiro_solo'
                      check (tipo in ('canteiro_solo', 'bombona', 'galeria', 'geodesica', 'outro')),
  area_m2           numeric,
  capacidade_texto  text,
  ativo             boolean not null default true,
  vinculado_desde   date not null default current_date,
  vinculado_ate     date,
  observacoes       text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

comment on table canteiros is
  'Unidades de plantio da Horta (canteiro no solo, bombona, galeria, geodésica etc.). Mesma regra de memória histórica dos parceiros: renomear corrige nome; trocar de verdade = desativar + cadastrar novo.';
comment on column canteiros.capacidade_texto is
  'Texto livre porque a unidade de medida muda por tipo (m² pra canteiro no solo, litros pra bombona, etc.) — não dá pra usar uma coluna numérica única.';

-- -----------------------------------------------------------------------------
-- Registros de alimentação (Compostagem → Registrar alimentação)
-- -----------------------------------------------------------------------------
create table if not exists registros_alimentacao (
  id             uuid primary key default gen_random_uuid(),
  parceiro_id    uuid not null references parceiros(id),
  caixa_id       uuid not null references caixas(id),
  peso_kg        numeric not null check (peso_kg > 0),
  tipo_residuo   text not null default 'alimento'
                   check (tipo_residuo in ('alimento', 'poda_verde', 'outro_organico')),
  temperatura_c  numeric,
  foto_url       text,
  observacao     text,
  registrado_por uuid references auth.users(id),
  registrado_em  timestamptz not null default now()
);

comment on table registros_alimentacao is
  'Um registro por entrega de resíduo numa caixa. parceiro_id e caixa_id são sempre referências, nunca nomes soltos — é isso que preserva a memória histórica mesmo se o parceiro for renomeado ou substituído depois.';

create index if not exists idx_registros_alimentacao_parceiro on registros_alimentacao (parceiro_id);
create index if not exists idx_registros_alimentacao_caixa on registros_alimentacao (caixa_id);
create index if not exists idx_registros_alimentacao_data on registros_alimentacao (registrado_em desc);

-- -----------------------------------------------------------------------------
-- Trigger genérico: mantém atualizado_em em dia sozinho
-- -----------------------------------------------------------------------------
create or replace function set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_parceiros_atualizado_em on parceiros;
create trigger trg_parceiros_atualizado_em
  before update on parceiros
  for each row execute function set_atualizado_em();

drop trigger if exists trg_caixas_atualizado_em on caixas;
create trigger trg_caixas_atualizado_em
  before update on caixas
  for each row execute function set_atualizado_em();

drop trigger if exists trg_canteiros_atualizado_em on canteiros;
create trigger trg_canteiros_atualizado_em
  before update on canteiros
  for each row execute function set_atualizado_em();

-- -----------------------------------------------------------------------------
-- RLS — fase piloto: qualquer pessoa autenticada lê e escreve.
-- Regras finas por papel (funcionária / coordenação / lojista) ficam para
-- quando o login (PIN/biometria/social, já decidido) estiver implementado —
-- ver Registro Geral do Projeto, seção 4.
-- -----------------------------------------------------------------------------
alter table parceiros enable row level security;
alter table caixas enable row level security;
alter table canteiros enable row level security;
alter table registros_alimentacao enable row level security;

drop policy if exists "autenticados leem parceiros" on parceiros;
create policy "autenticados leem parceiros" on parceiros
  for select to authenticated using (true);
drop policy if exists "autenticados gerenciam parceiros" on parceiros;
create policy "autenticados gerenciam parceiros" on parceiros
  for all to authenticated using (true) with check (true);

drop policy if exists "autenticados leem caixas" on caixas;
create policy "autenticados leem caixas" on caixas
  for select to authenticated using (true);
drop policy if exists "autenticados gerenciam caixas" on caixas;
create policy "autenticados gerenciam caixas" on caixas
  for all to authenticated using (true) with check (true);

drop policy if exists "autenticados leem canteiros" on canteiros;
create policy "autenticados leem canteiros" on canteiros
  for select to authenticated using (true);
drop policy if exists "autenticados gerenciam canteiros" on canteiros;
create policy "autenticados gerenciam canteiros" on canteiros
  for all to authenticated using (true) with check (true);

drop policy if exists "autenticados leem registros_alimentacao" on registros_alimentacao;
create policy "autenticados leem registros_alimentacao" on registros_alimentacao
  for select to authenticated using (true);
drop policy if exists "autenticados criam registros_alimentacao" on registros_alimentacao;
create policy "autenticados criam registros_alimentacao" on registros_alimentacao
  for insert to authenticated with check (true);

-- -----------------------------------------------------------------------------
-- Storage: bucket privado para as fotos de Registrar alimentação
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('registros-fotos', 'registros-fotos', false)
on conflict (id) do nothing;

drop policy if exists "autenticados enviam fotos de registros" on storage.objects;
create policy "autenticados enviam fotos de registros" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'registros-fotos');

drop policy if exists "autenticados veem fotos de registros" on storage.objects;
create policy "autenticados veem fotos de registros" on storage.objects
  for select to authenticated
  using (bucket_id = 'registros-fotos');

-- -----------------------------------------------------------------------------
-- Seed: as 26 caixas reais do pátio (18 ativas, 4 não ativadas, 4 novas)
-- -----------------------------------------------------------------------------
insert into caixas (numero, status)
select
  n,
  case
    when n between 19 and 22 then 'nao_ativada'
    when n between 23 and 26 then 'nova'
    else 'ativa'
  end
from generate_series(1, 26) as n
on conflict (numero) do nothing;

-- -----------------------------------------------------------------------------
-- Seed: parceiros com nomes placeholder — a equipe deve renomear pela tela
-- de Cadastro (ainda não construída) assim que os nomes reais dos 5
-- restaurantes parceiros forem confirmados. Ver pendência no Registro Geral.
-- -----------------------------------------------------------------------------
insert into parceiros (nome, tipo)
select nome, tipo from (values
  ('Loja 1', 'loja'),
  ('Loja 2', 'loja'),
  ('Loja 3', 'loja'),
  ('Loja 4', 'loja'),
  ('Loja 5', 'loja'),
  ('Construtora', 'construtora')
) as seed(nome, tipo)
where not exists (select 1 from parceiros);
