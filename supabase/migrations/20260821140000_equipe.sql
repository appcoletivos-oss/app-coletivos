-- =============================================================================
-- Cadastro → Equipe: membros da equipe e convite de acesso
-- =============================================================================
--
-- Decisão de produto (2026-08-21, ver Registro Geral, seção "Cadastro →
-- Equipe: gestão de membros e convite"): a coordenação pré-cadastra um
-- membro (nome, papel, WhatsApp) e o app gera um link de convite único.
-- A pessoa abre o link, o app já reconhece quem ela é (pelo pré-cadastro)
-- e ela conclui o próprio login (PIN/biometria/social — ainda não
-- implementado) pra vincular a conta ao perfil pré-cadastrado.
--
-- "Remover" um membro segue a mesma lógica de memória histórica de
-- parceiros/canteiros (ver 20260821120000_entidades_parceiros_caixas_
-- canteiros.sql): nunca apaga a linha, só desativa — mantém rastreável
-- quem registrou o quê enquanto era parte da equipe, mesmo depois de sair.
-- =============================================================================

create table if not exists membros_equipe (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  papel              text not null default 'funcionaria'
                       check (papel in ('funcionaria', 'coordenacao')),
  whatsapp           text not null,
  status             text not null default 'convidado'
                       check (status in ('convidado', 'ativo', 'inativo')),
  convite_token      uuid unique,
  convite_criado_em  timestamptz,
  convite_expira_em  timestamptz,
  user_id            uuid references auth.users(id),
  vinculado_desde    date not null default current_date,
  vinculado_ate      date,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

comment on table membros_equipe is
  'Membros da equipe (funcionária/coordenação). Ciclo de status: convidado -> ativo (depois do primeiro login) -> inativo (removido). "Remover" pela tela de Cadastro sempre marca inativo + vinculado_ate — nunca apaga a linha, mesma lógica de parceiros/canteiros.';
comment on column membros_equipe.convite_token is
  'Token do link de convite (usado em /convite/<token>). Continua preenchido depois de aceito — a validade é sempre conferida junto com "status", não precisa apagar o token.';
comment on column membros_equipe.convite_expira_em is
  'Prazo do link de convite (7 dias a partir da criação, definido em src/lib/equipe.ts). Depois de expirado, a coordenação gera um novo convite pela tela de Cadastro.';
comment on column membros_equipe.user_id is
  'Preenchido só depois que a pessoa aceita o convite e faz login pela primeira vez (auth.users) — vincula a conta real ao pré-cadastro. Enquanto for null, o membro ainda não concluiu o acesso.';

create index if not exists idx_membros_equipe_status on membros_equipe (status);

drop trigger if exists trg_membros_equipe_atualizado_em on membros_equipe;
create trigger trg_membros_equipe_atualizado_em
  before update on membros_equipe
  for each row execute function set_atualizado_em();

-- -----------------------------------------------------------------------------
-- RLS — mesmo padrão piloto das outras tabelas: qualquer autenticado lê e
-- escreve. Regras finas por papel ficam para quando o login existir.
-- -----------------------------------------------------------------------------
alter table membros_equipe enable row level security;

drop policy if exists "autenticados leem membros_equipe" on membros_equipe;
create policy "autenticados leem membros_equipe" on membros_equipe
  for select to authenticated using (true);
drop policy if exists "autenticados gerenciam membros_equipe" on membros_equipe;
create policy "autenticados gerenciam membros_equipe" on membros_equipe
  for all to authenticated using (true) with check (true);

-- -----------------------------------------------------------------------------
-- Convite por link: quem abre /convite/<token> ainda NÃO está logado — é
-- literalmente o que o link leva a fazer — então a leitura não pode
-- depender da policy "authenticated" acima. Em vez de abrir a tabela
-- inteira pra qualquer visitante anônimo, expõe só o mínimo necessário
-- pra tela "Bem-vindo(a), [nome]" através de uma function security
-- definer (nome, papel e se o convite ainda vale — nunca WhatsApp nem o
-- restante da linha).
-- -----------------------------------------------------------------------------
create or replace function public.buscar_convite_por_token(p_token uuid)
returns table (nome text, papel text, valido boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    m.nome,
    m.papel,
    (m.status = 'convidado' and m.convite_expira_em > now()) as valido
  from public.membros_equipe m
  where m.convite_token = p_token
  limit 1;
end;
$$;

revoke all on function public.buscar_convite_por_token(uuid) from public;
grant execute on function public.buscar_convite_por_token(uuid) to anon, authenticated;
