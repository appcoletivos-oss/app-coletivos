-- =============================================================================
-- Leva 1 — Autenticação real + RLS por papel (Coordenação / Equipe / Consultor)
-- =============================================================================
--
-- Contexto (ver "Registro Geral", decisão de 2026-08-27):
--
-- Até aqui todo acesso ao Supabase passava por sessão anônima
-- (`signInAnonymously`, ver src/lib/supabase.ts antes desta leva). Ninguém
-- tinha identidade real: `membros_equipe.user_id` nunca era preenchido,
-- `eventos_agenda.criado_por` era sempre null, e a RLS de todas as tabelas
-- era `to authenticated using(true) with check(true)` — qualquer sessão
-- (anônima inclusive) lia e escrevia tudo.
--
-- Esta migration migra Coordenação, Equipe e Consultor para login de
-- verdade (Google OAuth + e-mail/senha, configurados no painel) e troca a
-- RLS piloto por regras por papel, conforme a matriz de acesso da decisão.
--
-- FORA DO ESCOPO desta leva (Leva 2): contas de lojista, convite vinculado
-- a loja, RLS por loja. Por isso `registros_bombonas.registrado_por`
-- continua texto livre (nome digitado) e a tabela segue aberta a qualquer
-- papel autenticado — nada aqui modela loja.
--
-- REQUISITO FUTURO documentado nesta sessão (NÃO implementar agora): a tela
-- "Venda → Registrar doação" (tabela `registros_doacao`, ainda não criada)
-- vai exigir foto obrigatória da pessoa recebendo e NÃO terá geofence
-- (diferente de `pontos` — a doação pode acontecer fora do pátio). Só está
-- registrado aqui pra não modelar nada que entre em conflito depois.
--
-- Como aplicar: rodar este arquivo inteiro no SQL Editor do projeto. Não há
-- CLI do Supabase configurada neste repo (mesmo fluxo das migrations
-- anteriores). Depois, seguir os passos manuais no fim do arquivo.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Papéis: 'funcionaria' -> 'equipe', e novo papel 'consultor'
-- -----------------------------------------------------------------------------
-- Consultor entra como registro normal em membros_equipe (papel =
-- 'consultor'); campos que só fazem sentido pra equipe operacional
-- (carga_semanal_turnos) ficam nulos pra ele — sem tabela separada.

update membros_equipe set papel = 'equipe' where papel = 'funcionaria';

alter table membros_equipe alter column papel set default 'equipe';
alter table membros_equipe drop constraint if exists membros_equipe_papel_check;
alter table membros_equipe add constraint membros_equipe_papel_check
  check (papel in ('coordenacao', 'equipe', 'consultor'));

comment on column membros_equipe.papel is
  'coordenacao | equipe | consultor. Coordenação e consultor têm o mesmo nível de acesso (ver matriz na decisão de 2026-08-27); a diferença prática é que consultor não bate ponto. Lojista fica para a Leva 2 — não existe como papel aqui.';
comment on column membros_equipe.user_id is
  'auth.users(id) da pessoa. Preenchido no aceite do convite (function aceitar_convite) — é o vínculo entre a conta real e o pré-cadastro. Enquanto for null, o membro ainda não concluiu o primeiro acesso.';


-- -----------------------------------------------------------------------------
-- 2. Funções auxiliares de papel (usadas pelas policies)
-- -----------------------------------------------------------------------------
-- security definer + search_path = '' : leem membros_equipe ignorando a
-- própria RLS (senão a policy de membros_equipe entraria em recursão ao ser
-- avaliada). Ambas chaveiam por auth.uid() e só revelam dado da própria
-- pessoa. `revoke from public` + `grant to authenticated` conforme o
-- checklist de segurança do Supabase (SD em `public` é chamável por
-- anon/authenticated por padrão).

create or replace function public.papel_atual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select papel
  from public.membros_equipe
  where user_id = auth.uid() and status = 'ativo'
  limit 1;
$$;

create or replace function public.meu_membro_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.membros_equipe
  where user_id = auth.uid() and status = 'ativo'
  limit 1;
$$;

revoke all on function public.papel_atual() from public;
revoke all on function public.meu_membro_id() from public;
grant execute on function public.papel_atual() to authenticated;
grant execute on function public.meu_membro_id() to authenticated;

comment on function public.papel_atual() is
  'Papel (texto) do membro ativo vinculado a auth.uid(), ou null se a conta ainda não tem vínculo. Base das policies RLS desta leva.';


-- -----------------------------------------------------------------------------
-- 3. Aceite de convite: vincula a conta recém-logada ao pré-cadastro
-- -----------------------------------------------------------------------------
-- Espelha buscar_convite_por_token (migration 20260821140000): a pessoa que
-- acabou de logar ainda não tem papel_atual(), então não passaria por
-- nenhuma policy de UPDATE em membros_equipe. Este SD faz o vínculo com
-- guardas explícitas. Uma conta = um membro.

create or replace function public.aceitar_convite(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_afetados int;
begin
  if auth.uid() is null then
    raise exception 'Precisa estar autenticado para aceitar um convite.';
  end if;

  if exists (
    select 1 from public.membros_equipe where user_id = auth.uid()
  ) then
    raise exception 'Esta conta já está vinculada a um membro da equipe.';
  end if;

  update public.membros_equipe
  set user_id = auth.uid(),
      status = 'ativo',
      atualizado_em = now()
  where convite_token = p_token
    and status = 'convidado'
    and user_id is null
    and convite_expira_em > now();

  get diagnostics v_afetados = row_count;
  return v_afetados > 0;
end;
$$;

revoke all on function public.aceitar_convite(uuid) from public;
revoke all on function public.aceitar_convite(uuid) from anon;
grant execute on function public.aceitar_convite(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 4. Autoria automática dos registros (remove o plumbing de getUser() do app)
-- -----------------------------------------------------------------------------
-- As quatro tabelas de registro já têm `registrado_por uuid references
-- auth.users(id)` (nullable). Passa a ser preenchido pelo banco no INSERT.
-- Continua nullable: o dado de teste do piloto tem null e não é migrado.

alter table registros_alimentacao      alter column registrado_por set default auth.uid();
alter table registros_colheita         alter column registrado_por set default auth.uid();
alter table registros_manejo           alter column registrado_por set default auth.uid();
alter table registros_analise_sensorial alter column registrado_por set default auth.uid();

-- eventos_agenda.criado_por referencia membros_equipe(id), não auth.users —
-- então não dá pra usar `default auth.uid()`. Trigger resolve via meu_membro_id().
create or replace function public.set_criado_por_evento_agenda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.criado_por is null then
    new.criado_por := public.meu_membro_id();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_eventos_agenda_criado_por on eventos_agenda;
create trigger trg_eventos_agenda_criado_por
  before insert on eventos_agenda
  for each row execute function public.set_criado_por_evento_agenda();


-- -----------------------------------------------------------------------------
-- 5. RLS por papel — substitui as policies piloto `using(true)`
-- -----------------------------------------------------------------------------
-- Padrão: uma policy de SELECT (permissiva) + uma policy `for all` de
-- gestão. Policies permissivas são OR'd, então:
--   * SELECT passa se qualquer uma bater  -> efetivamente "papel autenticado"
--   * INSERT/UPDATE/DELETE só passam pela policy `for all` (a de SELECT não
--     concede esses comandos)
-- `papel_atual() is not null` = qualquer papel desta leva (coord/equipe/consultor).

-- ---- parceiros / caixas / canteiros / local_trabalho / membros_equipe ----
-- Cadastro: leitura pra todos (as telas de registro precisam ler parceiros,
-- caixas, canteiros e a lista de membros); escrita só coordenação/consultor.

do $$
declare t text;
begin
  foreach t in array array['parceiros','caixas','canteiros','local_trabalho','membros_equipe']
  loop
    execute format('drop policy if exists "autenticados leem %1$s" on %1$s', t);
    execute format('drop policy if exists "autenticados gerenciam %1$s" on %1$s', t);

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

-- ---- eventos_agenda ----
-- Visualizar: todos. Criar/editar/excluir (qualquer tipo, inclusive turno):
-- só coordenação/consultor.
drop policy if exists "autenticados leem eventos_agenda" on eventos_agenda;
drop policy if exists "autenticados gerenciam eventos_agenda" on eventos_agenda;

create policy "papel autenticado le eventos_agenda" on eventos_agenda
  for select to authenticated
  using (public.papel_atual() is not null);

create policy "coordenacao e consultor gerenciam eventos_agenda" on eventos_agenda
  for all to authenticated
  using (public.papel_atual() in ('coordenacao','consultor'))
  with check (public.papel_atual() in ('coordenacao','consultor'));

-- ---- tabelas de registro (append-only): alimentacao / colheita / manejo /
--      analise_sensorial / bombonas ----
-- Compostagem, Bombonas e Horta: leitura+escrita pra todos os papéis.
do $$
declare t text;
begin
  foreach t in array array[
    'registros_alimentacao','registros_colheita','registros_manejo',
    'registros_analise_sensorial','registros_bombonas'
  ]
  loop
    execute format('drop policy if exists "autenticados leem %1$s" on %1$s', t);
    execute format('drop policy if exists "autenticados criam %1$s" on %1$s', t);

    execute format($f$
      create policy "papel autenticado le %1$s" on %1$s
        for select to authenticated
        using (public.papel_atual() is not null)
    $f$, t);

    execute format($f$
      create policy "papel autenticado cria %1$s" on %1$s
        for insert to authenticated
        with check (public.papel_atual() is not null)
    $f$, t);
  end loop;
end $$;

-- Reforço nas 4 tabelas com autor real: o INSERT só pode gravar o próprio
-- auth.uid() como autor (ou deixar null). bombonas fica de fora — autor é
-- texto livre (lojista sem conta), ver nota no topo.
do $$
declare t text;
begin
  foreach t in array array[
    'registros_alimentacao','registros_colheita','registros_manejo','registros_analise_sensorial'
  ]
  loop
    execute format('drop policy if exists "papel autenticado cria %1$s" on %1$s', t);
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

-- ---- pontos (Meu Ponto) ----
-- Bater o próprio ponto: coordenação e equipe (consultor não bate ponto).
-- Ver ponto/banco de horas: coordenação e consultor veem todo mundo; equipe
-- vê só o próprio registro (filtro por dono via meu_membro_id()).
drop policy if exists "autenticados leem pontos" on pontos;
drop policy if exists "autenticados criam pontos" on pontos;

create policy "leitura de pontos por papel" on pontos
  for select to authenticated
  using (
    public.papel_atual() in ('coordenacao','consultor')
    or membro_equipe_id = public.meu_membro_id()
  );

create policy "coordenacao e equipe batem o proprio ponto" on pontos
  for insert to authenticated
  with check (
    public.papel_atual() in ('coordenacao','equipe')
    and membro_equipe_id = public.meu_membro_id()
  );

-- ---- storage (bucket registros-fotos) ----
-- As policies atuais já são `to authenticated` e a sessão agora é sempre de
-- um usuário real — nada a mudar. (Deixado explícito aqui como lembrete.)


-- =============================================================================
-- PASSOS MANUAIS (fora do SQL) — na ordem
-- =============================================================================
--
-- A. Google Cloud (conta appcoletivos@gmail.com):
--    - OAuth consent screen (External) + credencial "OAuth client ID" tipo
--      Web application.
--    - Authorized redirect URI:
--        https://<PROJECT_REF>.supabase.co/auth/v1/callback
--
-- B. Supabase → Authentication → Sign In / Providers → Google:
--    colar Client ID e Client Secret; salvar.
--
-- C. Supabase → Authentication → URL Configuration:
--    - Site URL: a URL de produção do app.
--    - Redirect URLs (Additional): http://localhost:3000/**  e  <producao>/**
--
-- D. Rodar este arquivo no SQL Editor (se ainda não rodou).
--
-- E. Bootstrap do primeiro coordenador (chicken-and-egg: ninguém consegue
--    gerar convites pelo app até existir alguém vinculado com papel
--    coordenacao ou consultor):
--
--    1. A primeira pessoa entra no app por /entrar (Google ou e-mail+senha).
--    2. Descobrir o uid dela:
--         select id, email from auth.users order by created_at desc;
--    3. Descobrir o id do pré-cadastro dela (ou criar um):
--         select id, nome, papel, status from membros_equipe;
--         -- se não existir, insert + update em um único passo (já sabendo
--         -- o uid do passo 2):
--         -- insert into membros_equipe (nome, papel, whatsapp, status, user_id)
--         --   values ('Nome da pessoa', 'coordenacao', '5511999999999', 'ativo', '<uid>');
--    4. Se já existia um pré-cadastro (passo 3 achou linha), vincular:
--         update membros_equipe
--         set user_id = '<uid>', status = 'ativo', papel = 'coordenacao'
--         where id = '<id do membro>';
--
--    EXECUTADO em 2026-08-27 — bootstrap real de Thiago França (dono do
--    projeto), papel 'consultor' (não coordenacao — ver Registro Geral,
--    ele testa/acompanha como consultor). membros_equipe estava vazia,
--    então foi insert direto com o uid já conhecido (sem passo de update
--    separado):
--
--      insert into membros_equipe (nome, papel, whatsapp, status, user_id)
--        values (
--          'Thiago França',
--          'consultor',
--          '+55 81 9 9959 9393',
--          'ativo',
--          'b5a5dc68-a05c-43be-b5bf-c8c6d0d2b89a'
--        );
--
-- F. A coordenação gera os convites pela tela de Cadastro → Equipe; cada
--    pessoa abre o link, escolhe Google ou e-mail/senha, e cria o PIN.
--
-- G. Quando todo mundo estiver vinculado (nenhuma tela depende mais de
--    sessão anônima): Authentication → Sign In / Providers → desligar
--    "Allow anonymous sign-ins".
--
-- H. (Opcional) Limpar o dado de teste do piloto via SQL — a critério do
--    usuário. Os registros antigos ficam com registrado_por / criado_por
--    null; não precisam ser migrados.
-- =============================================================================
