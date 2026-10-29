-- =============================================================================
-- Sprint B — Item B2c: doação de alimento com foto pendente
-- (SPRINT_B_RELATO_DO_TURNO.md, seção 4b)
-- =============================================================================
--
-- A doação de alimento que sai do Relato do turno é aprovada antes de a
-- foto existir (a entrega costuma ser feita depois, em mãos). Então
-- doacoes_alimento passa a aceitar foto_url nula SÓ com foto_pendente.
--
-- Anexar a foto = UPDATE só de foto_url (foto_pendente vira false sozinha).
-- Quem pode anexar:
--   * o autor do registro (registrado_por);
--   * quem relatou (relato_turno_propostas.criado_por, com
--     tabela_registro_gerado = 'doacoes_alimento' e registro_id_gerado = id);
--   * coordenação e consultor.
--
-- Relação com a A.1 (20261002010000_correcao_anulacao_registros.sql):
-- aquela migration NÃO inclui doacoes_alimento (está na lista "ficam de
-- fora") e o Claude Code não tem como saber se ela já foi aplicada. Por
-- isso este arquivo não depende dela e não liga o trigger genérico aqui:
--   * Segue o mesmo padrão de foto_pendente da colheita (coluna boolean not
--     null default false, índice parcial, limpa sozinha ao anexar).
--   * Trigger próprio, trg_doacoes_a_foto_pendente, cuida só da foto. O
--     nome vem antes de trg_registro_correcao na ordem alfabética: se um
--     dia a A.1 for estendida a doacoes_alimento, este roda primeiro e o
--     genérico continua valendo pro resto (correção, histórico).
--   * Qualquer outra coluna: se o trigger genérico da A.1 estiver ligado
--     nesta tabela, ele decide; se não estiver, a alteração é recusada
--     (sem mecanismo de correção, doação continua append-only como hoje).
--   * Ao estender a A.1 pra cá: a coluna de data é `criado_em` (não
--     registrado_em) e o branch (b) do genérico ("qualquer papel anexa
--     foto pendente") fica mais largo que esta regra, mas este trigger já
--     barrou antes quem não pode.
--
-- Depende de 20261028000000 (relato_turno_propostas) só em tempo de
-- execução; aplicar na ordem dos nomes.
--
-- Como aplicar: rodar inteiro no SQL Editor. Idempotente.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Colunas e constraint
-- -----------------------------------------------------------------------------

alter table doacoes_alimento alter column foto_url drop not null;

alter table doacoes_alimento
  add column if not exists foto_pendente boolean not null default false;

alter table doacoes_alimento drop constraint if exists doacao_alimento_foto_ou_pendente;
alter table doacoes_alimento
  add constraint doacao_alimento_foto_ou_pendente check (foto_url is not null or foto_pendente);

comment on column doacoes_alimento.foto_pendente is
  'true = doação aprovada sem foto (veio do Relato do turno; foto obrigatória com envio posterior). Volta a false sozinha quando foto_url é preenchida.';

create index if not exists idx_doacoes_alimento_foto_pendente
  on doacoes_alimento (criado_em desc) where foto_pendente;


-- -----------------------------------------------------------------------------
-- 2. Trigger: quem anexa a foto, e nada mais muda por aqui
-- -----------------------------------------------------------------------------

create or replace function public.doacao_alimento_foto_pendente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antigo    jsonb := to_jsonb(old);
  v_novo      jsonb := to_jsonb(new);
  v_alteradas text[];
  v_papel     text  := public.papel_atual();
begin
  select coalesce(array_agg(k), '{}') into v_alteradas
    from jsonb_object_keys(v_novo) as t(k)
   where v_novo -> k is distinct from v_antigo -> k;

  if cardinality(v_alteradas) = 0 then
    return new;
  end if;

  if v_papel is null then
    raise exception using errcode = '42501', message = 'Sem permissão.', hint = 'sem_papel';
  end if;

  -- Anexar a foto pendente.
  if old.foto_pendente
     and new.foto_url is not null
     and v_alteradas <@ array['foto_url', 'foto_pendente'] then
    if v_papel in ('coordenacao', 'consultor')
       or old.registrado_por = auth.uid()
       or exists (
         select 1 from public.relato_turno_propostas p
          where p.tabela_registro_gerado = 'doacoes_alimento'
            and p.registro_id_gerado = old.id
            and p.criado_por = auth.uid()
       ) then
      new.foto_pendente := false;
      return new;
    end if;
    raise exception using errcode = '42501',
      message = 'Só quem registrou, quem relatou ou a coordenação/consultor podem anexar esta foto.',
      hint = 'foto_sem_permissao';
  end if;

  -- Qualquer outra alteração: só pelo mecanismo de correção da A.1, se
  -- estiver ligado nesta tabela.
  if exists (
    select 1 from pg_catalog.pg_trigger t
     where t.tgrelid = 'public.doacoes_alimento'::regclass
       and t.tgname = 'trg_registro_correcao'
       and not t.tgisinternal
  ) then
    return new;
  end if;

  raise exception using errcode = '42501',
    message = 'Doação registrada não pode ser alterada (só anexar a foto pendente).',
    hint = 'doacao_somente_foto';
end;
$$;

revoke all on function public.doacao_alimento_foto_pendente() from public;

drop trigger if exists trg_doacoes_a_foto_pendente on doacoes_alimento;
create trigger trg_doacoes_a_foto_pendente
  before update on doacoes_alimento
  for each row execute function public.doacao_alimento_foto_pendente();


-- -----------------------------------------------------------------------------
-- 3. Policy de UPDATE (não existia: a tabela era só insert/select)
-- -----------------------------------------------------------------------------
-- Aberta a qualquer papel; quem decide é o trigger acima (RLS não compara
-- a linha antiga com a nova). Mesmo padrão da A.1 em registros_colheita.

drop policy if exists "papel autenticado atualiza doacoes_alimento" on doacoes_alimento;
create policy "papel autenticado atualiza doacoes_alimento" on doacoes_alimento
  for update to authenticated
  using (public.papel_atual() is not null)
  with check (public.papel_atual() is not null);
