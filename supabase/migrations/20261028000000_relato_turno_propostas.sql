-- =============================================================================
-- Sprint B — Item B2: staging das propostas do Relato do turno com IA
-- (SPRINT_B_RELATO_DO_TURNO.md, seção 3)
-- =============================================================================
--
-- Decisão de arquitetura: a IA NUNCA grava nas tabelas de registro. O texto
-- colado vai pra relatos_turno; o que a pessoa confirma na tela "Entendi
-- isto" vira linha em relato_turno_propostas (status 'pendente'). Só quando
-- uma coordenadora/consultor aprova é que o APP cria o registro oficial,
-- chamando as funções/RPCs que já existem, com a sessão de quem aprova. Por
-- isso nada pendente vaza pra saldo, Mapa ou relatórios.
--
-- Autoria (verificado em 28/10/2026): as tabelas de registro só aceitam
-- `registrado_por = auth.uid()` ou nulo no insert (registros_alimentacao,
-- registros_colheita, registros_manejo e plantios com default auth.uid();
-- doacoes_alimento NOT NULL sem default, o app manda). Então o registro
-- oficial criado na aprovação fica com a coordenadora como registrado_por.
-- O autor real fica em relato_turno_propostas.criado_por, achado pelo par
-- (tabela_registro_gerado, registro_id_gerado). As telas mostram
-- "Relatado por X, conferido por Y".
--
-- relatos_ia_log já existe (espelho 20261001010000). Única mudança aqui: a
-- policy de UPDATE pro autor, porque a tela de conferência grava
-- aceito_sem_edicao depois da interpretação (o id da linha volta da rota
-- de API). Sem coluna nova.
--
-- Como aplicar: rodar inteiro no SQL Editor. Idempotente.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. relatos_turno — o texto como veio
-- -----------------------------------------------------------------------------

create table if not exists relatos_turno (
  id                 uuid primary key default gen_random_uuid(),
  relatorio_turno_id uuid not null references relatorios_turno(id),
  texto              text not null check (length(texto) <= 8000),
  interpretado_em    timestamptz,
  criado_por         uuid not null default auth.uid() references auth.users(id),
  criado_em          timestamptz not null default now()
);

comment on table relatos_turno is
  'Texto do relato do turno, colado/ditado pela pessoa, exatamente como veio. A interpretação da IA não fica aqui: o que a pessoa confirma vira relato_turno_propostas.';

create index if not exists idx_relatos_turno_relatorio
  on relatos_turno (relatorio_turno_id, criado_em desc);

alter table relatos_turno enable row level security;

drop policy if exists "papel autenticado cria relatos_turno" on relatos_turno;
create policy "papel autenticado cria relatos_turno" on relatos_turno
  for insert to authenticated
  with check (
    public.papel_atual() is not null
    and criado_por = auth.uid()
  );

drop policy if exists "autor ou coordenacao leem relatos_turno" on relatos_turno;
create policy "autor ou coordenacao leem relatos_turno" on relatos_turno
  for select to authenticated
  using (
    criado_por = auth.uid()
    or public.papel_atual() in ('coordenacao', 'consultor')
  );

-- Sem UPDATE e sem DELETE. interpretado_em é preenchido no próprio insert
-- (a rota de API grava depois de a IA responder).


-- -----------------------------------------------------------------------------
-- 2. relato_turno_propostas — o que a IA propôs e a pessoa confirmou
-- -----------------------------------------------------------------------------

create table if not exists relato_turno_propostas (
  id                     uuid primary key default gen_random_uuid(),
  relato_turno_id        uuid not null references relatos_turno(id),
  relatorio_turno_id     uuid not null references relatorios_turno(id),
  tipo                   text not null
                           check (tipo in ('compostagem', 'plantio', 'colheita', 'manejo', 'doacao')),
  dados                  jsonb not null check (jsonb_typeof(dados) = 'object'),
  campos_status          jsonb not null check (jsonb_typeof(campos_status) = 'object'),
  trecho_origem          text not null,
  avisos                 jsonb not null default '[]' check (jsonb_typeof(avisos) = 'array'),
  status                 text not null default 'pendente'
                           check (status in ('pendente', 'aprovada', 'rejeitada')),
  conferido_por          uuid references auth.users(id),
  conferido_em           timestamptz,
  motivo_rejeicao        text,
  tabela_registro_gerado text,
  registro_id_gerado     uuid,
  criado_por             uuid not null default auth.uid() references auth.users(id),
  criado_em              timestamptz not null default now(),
  -- Coerência do status com os campos de conferência.
  constraint relato_proposta_aprovada_tem_registro check (
    status <> 'aprovada'
    or (tabela_registro_gerado is not null and registro_id_gerado is not null
        and conferido_por is not null and conferido_em is not null)
  ),
  constraint relato_proposta_rejeitada_tem_motivo check (
    status <> 'rejeitada'
    or (nullif(btrim(coalesce(motivo_rejeicao, '')), '') is not null
        and conferido_por is not null and conferido_em is not null)
  )
);

comment on table relato_turno_propostas is
  'Proposta de registro saída do Relato do turno (IA + confirmação da pessoa). Pendente não conta em nada. Aprovada = o app criou o registro oficial (tabela_registro_gerado/registro_id_gerado) com a sessão de quem conferiu; criado_por guarda quem relatou.';
comment on column relato_turno_propostas.campos_status is
  'Por campo de `dados`: "certo" | "inferido" | "faltando".';

create index if not exists idx_relato_propostas_pendentes
  on relato_turno_propostas (relatorio_turno_id, criado_em) where status = 'pendente';
create index if not exists idx_relato_propostas_relato
  on relato_turno_propostas (relato_turno_id);
create index if not exists idx_relato_propostas_autor
  on relato_turno_propostas (criado_por, criado_em desc);
-- Usado pela B2c (quem relatou pode anexar a foto da doação gerada).
create index if not exists idx_relato_propostas_registro_gerado
  on relato_turno_propostas (tabela_registro_gerado, registro_id_gerado)
  where registro_id_gerado is not null;

alter table relato_turno_propostas enable row level security;

-- Insert: só o autor, só pendente, e só pendurado num relato dele mesmo e
-- no mesmo relatório do relato.
drop policy if exists "autor cria relato_turno_propostas" on relato_turno_propostas;
create policy "autor cria relato_turno_propostas" on relato_turno_propostas
  for insert to authenticated
  with check (
    public.papel_atual() is not null
    and criado_por = auth.uid()
    and status = 'pendente'
    and conferido_por is null
    and conferido_em is null
    and registro_id_gerado is null
    and exists (
      select 1 from public.relatos_turno r
       where r.id = relato_turno_id
         and r.relatorio_turno_id = relato_turno_propostas.relatorio_turno_id
         and r.criado_por = auth.uid()
    )
  );

drop policy if exists "autor ou coordenacao leem relato_turno_propostas" on relato_turno_propostas;
create policy "autor ou coordenacao leem relato_turno_propostas" on relato_turno_propostas
  for select to authenticated
  using (
    criado_por = auth.uid()
    or public.papel_atual() in ('coordenacao', 'consultor')
  );

-- Update: só coordenação/consultor, e só enquanto pendente (aprovada ou
-- rejeitada fica congelada). conferido_por, quando vier, é quem está
-- conferindo.
drop policy if exists "coordenacao e consultor conferem relato_turno_propostas" on relato_turno_propostas;
create policy "coordenacao e consultor conferem relato_turno_propostas" on relato_turno_propostas
  for update to authenticated
  using (
    public.papel_atual() in ('coordenacao', 'consultor')
    and status = 'pendente'
  )
  with check (
    public.papel_atual() in ('coordenacao', 'consultor')
    and (conferido_por is null or conferido_por = auth.uid())
  );

-- Sem DELETE.

-- Autor, relato e data de criação não mudam na conferência (RLS não
-- compara linha antiga com a nova).
create or replace function public.relato_proposta_imutaveis()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.criado_por is distinct from old.criado_por
     or new.criado_em is distinct from old.criado_em
     or new.relato_turno_id is distinct from old.relato_turno_id
     or new.relatorio_turno_id is distinct from old.relatorio_turno_id
     or new.tipo is distinct from old.tipo
     or new.trecho_origem is distinct from old.trecho_origem then
    raise exception using errcode = '42501',
      message = 'Autor, relato, tipo e trecho original de uma proposta não podem ser alterados.',
      hint = 'imutavel';
  end if;
  return new;
end;
$$;

revoke all on function public.relato_proposta_imutaveis() from public;

drop trigger if exists trg_relato_proposta_imutaveis on relato_turno_propostas;
create trigger trg_relato_proposta_imutaveis
  before update on relato_turno_propostas
  for each row execute function public.relato_proposta_imutaveis();


-- -----------------------------------------------------------------------------
-- 3. relatos_ia_log — autor grava aceito_sem_edicao depois
-- -----------------------------------------------------------------------------

drop policy if exists "autor atualiza relatos_ia_log" on relatos_ia_log;
create policy "autor atualiza relatos_ia_log" on relatos_ia_log
  for update to authenticated
  using (public.papel_atual() is not null and registrado_por = auth.uid())
  with check (public.papel_atual() is not null and registrado_por = auth.uid());
