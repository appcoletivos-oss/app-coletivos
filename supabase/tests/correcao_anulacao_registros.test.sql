-- =============================================================================
-- Testes de 20261002010000_correcao_anulacao_registros.sql
-- =============================================================================
--
-- Como rodar: no SQL Editor, DEPOIS de aplicar a migration, colar o arquivo
-- inteiro e executar. Tudo roda numa transação que termina em ROLLBACK —
-- nada fica gravado (usuários, membros, canteiro, cultura, plantios e
-- registros de teste somem no fim).
--
-- Resultado: cada teste que passa escreve "OK n: ..." nas mensagens
-- (NOTICE). O primeiro que falhar interrompe com "FALHOU n: ..." (ou com o
-- erro inesperado do Postgres).
--
-- Como "vira" uma pessoa: set_config('request.jwt.claims', {"sub": <uuid>})
-- + set local role authenticated — é o que o Supabase faz numa chamada
-- real do app, então RLS, auth.uid() e papel_atual() valem de verdade.
-- `reset role` volta pro dono (postgres) pra montar dados e conferir o
-- histórico.
--
-- Pessoas de teste:
--   ...c1 = coordenação · ...a1 = equipe A · ...b1 = equipe B · ...d1 = consultor
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Dados de teste (como postgres: INSERT não passa pelo trigger de correção)
-- -----------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'teste-coord@exemplo.invalid'),
  ('00000000-0000-0000-0000-0000000000a1', 'teste-equipe-a@exemplo.invalid'),
  ('00000000-0000-0000-0000-0000000000b1', 'teste-equipe-b@exemplo.invalid'),
  ('00000000-0000-0000-0000-0000000000d1', 'teste-consultor@exemplo.invalid');

insert into membros_equipe (nome, papel, whatsapp, status, user_id) values
  ('Teste Coord',     'coordenacao', '00000000000', 'ativo', '00000000-0000-0000-0000-0000000000c1'),
  ('Teste Equipe A',  'equipe',      '00000000000', 'ativo', '00000000-0000-0000-0000-0000000000a1'),
  ('Teste Equipe B',  'equipe',      '00000000000', 'ativo', '00000000-0000-0000-0000-0000000000b1'),
  ('Teste Consultor', 'consultor',   '00000000000', 'ativo', '00000000-0000-0000-0000-0000000000d1');

insert into canteiros (id, nome, tipo) values
  ('00000000-0000-0000-0000-00000000ca01', 'Canteiro TESTE', 'canteiro_solo');

insert into culturas (id, nome) values
  ('00000000-0000-0000-0000-00000000c001', 'Cultura TESTE correção');

-- P1: plantio da equipe A, com colheita (teste 5).
-- P2: plantio da equipe B, criado há 10 dias (teste 7: A encerra mesmo assim).
-- P3: plantio da equipe A, sem nada ligado (teste 8: anula ok).
insert into plantios (id, cultura_id, canteiro_id, origem, status, registrado_por, criado_em) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c001',
   '00000000-0000-0000-0000-00000000ca01', 'muda_comprada', 'ativo',
   '00000000-0000-0000-0000-0000000000a1', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000c001',
   '00000000-0000-0000-0000-00000000ca01', 'muda_comprada', 'ativo',
   '00000000-0000-0000-0000-0000000000b1', now() - interval '10 days'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-00000000c001',
   '00000000-0000-0000-0000-00000000ca01', 'muda_comprada', 'ativo',
   '00000000-0000-0000-0000-0000000000a1', now() - interval '1 hour');

-- C1: colheita de A há 1h (dentro das 48h), no P1.
-- C2: colheita de A há 49h (fora das 48h).
-- C3: colheita de A há 72h, SEM foto e com foto_pendente.
-- C4: colheita de A há 1h no P2, que "encerrou" o P2 (teste 9: anular + reabrir).
-- C5: colheita de A há 1h ligada a Relatório do Turno FECHADO.
insert into registros_colheita (id, canteiro_id, plantio_id, cultura, peso_kg, foto_url, foto_pendente, registrado_por, registrado_em) values
  ('00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-0000000000f1',
   'Cultura TESTE correção', 2, 'colheita/teste-1.jpg', false, '00000000-0000-0000-0000-0000000000a1', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000001c2', '00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-0000000000f1',
   'Cultura TESTE correção', 2, 'colheita/teste-2.jpg', false, '00000000-0000-0000-0000-0000000000a1', now() - interval '49 hours'),
  ('00000000-0000-0000-0000-0000000001c3', '00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-0000000000f1',
   'Cultura TESTE correção', 2, null, true, '00000000-0000-0000-0000-0000000000a1', now() - interval '72 hours'),
  ('00000000-0000-0000-0000-0000000001c4', '00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-0000000000f2',
   'Cultura TESTE correção', 1, 'colheita/teste-4.jpg', false, '00000000-0000-0000-0000-0000000000a1', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000001c5', '00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-0000000000f1',
   'Cultura TESTE correção', 3, 'colheita/teste-5.jpg', false, '00000000-0000-0000-0000-0000000000a1', now() - interval '1 hour');

insert into relatorios_turno (id, data, turno, criado_por, fechado_em) values
  -- Data de 1900: relatorios_turno tem unique (data, turno), não pode
  -- colidir com um relatório real.
  ('00000000-0000-0000-0000-00000000e001', '1900-01-01', 'manha', '00000000-0000-0000-0000-0000000000a1', now());
insert into relatorio_turno_itens (relatorio_turno_id, descricao, origem, feito, tipo_registro,
                                   tabela_registro_gerado, registro_id_gerado, registrado_por) values
  ('00000000-0000-0000-0000-00000000e001', 'colheita teste', 'extra', true, 'canteiro',
   'registros_colheita', '00000000-0000-0000-0000-0000000001c5', '00000000-0000-0000-0000-0000000000a1');


-- =============================================================================
-- 1. Autor corrige o próprio registro dentro de 48h (e vira histórico)
-- =============================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  update registros_colheita set peso_kg = 2.5 where id = '00000000-0000-0000-0000-0000000001c1';
  if not found then raise exception 'FALHOU 1: o UPDATE não pegou a linha (RLS de UPDATE?)'; end if;
  raise notice 'OK 1: autor corrigiu dentro de 48h';
end $$;
reset role;
do $$
begin
  if not exists (
    select 1 from registros_historico
     where tabela = 'registros_colheita'
       and registro_id = '00000000-0000-0000-0000-0000000001c1'
       and (dados_anteriores ->> 'peso_kg')::numeric = 2
       and alterado_por = '00000000-0000-0000-0000-0000000000a1'
  ) then
    raise exception 'FALHOU 1b: histórico não guardou a linha antiga com o autor da alteração';
  end if;
  raise notice 'OK 1b: histórico guardou peso antigo (2) e quem alterou';
end $$;


-- =============================================================================
-- 2. Autor bloqueado depois de 48h
-- =============================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  update registros_colheita set peso_kg = 9 where id = '00000000-0000-0000-0000-0000000001c2';
  raise exception 'FALHOU 2: autor corrigiu depois de 48h';
exception when insufficient_privilege then
  raise notice 'OK 2: autor bloqueado após 48h (%)', sqlerrm;
end $$;
reset role;


-- =============================================================================
-- 3. Equipe bloqueada no registro de outra pessoa (mesmo dentro de 48h)
-- =============================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  update registros_colheita set peso_kg = 9 where id = '00000000-0000-0000-0000-0000000001c1';
  raise exception 'FALHOU 3: equipe B corrigiu colheita da equipe A';
exception when insufficient_privilege then
  raise notice 'OK 3: equipe bloqueada no registro de outro (%)', sqlerrm;
end $$;
reset role;


-- =============================================================================
-- 4. Anulação sem motivo é recusada (e motivo sem anulado_em também)
-- =============================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  update registros_colheita set anulado_em = now() where id = '00000000-0000-0000-0000-0000000001c1';
  raise exception 'FALHOU 4: anulou sem motivo';
exception when check_violation then
  raise notice 'OK 4: anulação sem motivo recusada (%)', sqlerrm;
end $$;
do $$
begin
  update registros_colheita set motivo_anulacao = 'peso errado' where id = '00000000-0000-0000-0000-0000000001c1';
  raise exception 'FALHOU 4b: gravou motivo sem anular';
exception when check_violation then
  raise notice 'OK 4b: motivo sem anulado_em recusado (%)', sqlerrm;
end $$;
reset role;


-- =============================================================================
-- 5. Plantio com colheita válida não anula (nem pela coordenação)
-- =============================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  update plantios set anulado_em = now(), motivo_anulacao = 'teste'
   where id = '00000000-0000-0000-0000-0000000000f1';
  raise exception 'FALHOU 5: anulou plantio que tem colheita';
exception when foreign_key_violation then
  raise notice 'OK 5: plantio com colheita não anula (%)', sqlerrm;
end $$;
reset role;


-- =============================================================================
-- 6. Qualquer papel anexa a foto pendente — e só a foto
-- =============================================================================
-- Equipe B, colheita da A, de 72h atrás: fora do prazo e de outra pessoa,
-- mas a foto pendente pode.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  update registros_colheita set peso_kg = 9 where id = '00000000-0000-0000-0000-0000000001c3';
  raise exception 'FALHOU 6a: equipe B corrigiu o peso de uma colheita só porque estava com foto pendente';
exception when insufficient_privilege then
  raise notice 'OK 6a: foto pendente não libera corrigir outros campos (%)', sqlerrm;
end $$;
do $$
declare v_pendente boolean;
begin
  update registros_colheita set foto_url = 'colheita/teste-3.jpg'
   where id = '00000000-0000-0000-0000-0000000001c3'
   returning foto_pendente into v_pendente;
  if not found then raise exception 'FALHOU 6: o UPDATE da foto não pegou a linha'; end if;
  if v_pendente then raise exception 'FALHOU 6: foto anexada mas foto_pendente continua true'; end if;
  raise notice 'OK 6: equipe B anexou a foto pendente e a pendência foi limpa';
end $$;
reset role;
do $$
begin
  if not exists (
    select 1 from registros_historico
     where registro_id = '00000000-0000-0000-0000-0000000001c3'
       and dados_anteriores ->> 'foto_url' is null
       and (dados_anteriores ->> 'foto_pendente')::boolean
  ) then
    raise exception 'FALHOU 6b: anexar foto não foi pro histórico';
  end if;
  raise notice 'OK 6b: anexar foto ficou no histórico';
end $$;


-- =============================================================================
-- 7. Equipe encerra plantio de outra pessoa ao colher (status é operacional)
-- =============================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  -- P2 é da equipe B e tem 10 dias: só passa porque status é coluna livre.
  update plantios set status = 'colhido' where id = '00000000-0000-0000-0000-0000000000f2';
  if not found then raise exception 'FALHOU 7: o UPDATE de status não pegou a linha'; end if;
  raise notice 'OK 7: equipe encerrou o plantio ao colher';
end $$;
do $$
begin
  update plantios set quantidade_inicial = 99 where id = '00000000-0000-0000-0000-0000000000f2';
  raise exception 'FALHOU 7b: equipe A corrigiu quantidade de plantio da equipe B com 10 dias';
exception when insufficient_privilege then
  raise notice 'OK 7b: campo de cadastro do plantio continua protegido (%)', sqlerrm;
end $$;
reset role;


-- =============================================================================
-- 8. Plantio sem nada ligado anula; quem/quando vêm do banco
-- =============================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_por uuid; v_em timestamptz;
begin
  update plantios
     set anulado_em = '2000-01-01', motivo_anulacao = 'cadastrei no canteiro errado',
         anulado_por = '00000000-0000-0000-0000-0000000000b1'
   where id = '00000000-0000-0000-0000-0000000000f3'
  returning anulado_por, anulado_em into v_por, v_em;
  if v_por is distinct from '00000000-0000-0000-0000-0000000000a1' then
    raise exception 'FALHOU 8: anulado_por não é quem anulou (%)', v_por;
  end if;
  if v_em < now() - interval '1 minute' then
    raise exception 'FALHOU 8: anulado_em veio do aparelho (%), não do banco', v_em;
  end if;
  raise notice 'OK 8: autor anulou o próprio plantio; anulado_por/anulado_em do banco';
end $$;
-- Registro anulado: o autor não mexe mais.
do $$
begin
  update plantios set quantidade_inicial = 5 where id = '00000000-0000-0000-0000-0000000000f3';
  raise exception 'FALHOU 8b: autor mexeu em plantio anulado';
exception when insufficient_privilege then
  raise notice 'OK 8b: registro anulado só coordenação/consultor mexem (%)', sqlerrm;
end $$;
reset role;


-- =============================================================================
-- 9. Anular a colheita que encerrou o plantio e reabrir o plantio
--    (mesma pessoa, equipe A, dentro das 48h)
-- =============================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  update registros_colheita set anulado_em = now(), motivo_anulacao = 'colhi do canteiro errado'
   where id = '00000000-0000-0000-0000-0000000001c4';
  if not found then raise exception 'FALHOU 9: anulação da colheita não pegou a linha'; end if;
  -- "Essa colheita tinha encerrado o plantio. Reabrir?" → Reabrir
  update plantios set status = 'ativo' where id = '00000000-0000-0000-0000-0000000000f2';
  if not found then raise exception 'FALHOU 9: reabrir o plantio não pegou a linha'; end if;
  raise notice 'OK 9: anulou a colheita e reabriu o plantio';
end $$;
reset role;


-- =============================================================================
-- 10. Relatório do Turno fechado: autor bloqueado; consultor corrige
-- =============================================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  update registros_colheita set peso_kg = 4 where id = '00000000-0000-0000-0000-0000000001c5';
  raise exception 'FALHOU 10: autor corrigiu registro de relatório fechado';
exception when insufficient_privilege then
  raise notice 'OK 10: autor bloqueado em relatório fechado (%)', sqlerrm;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  update registros_colheita set peso_kg = 4 where id = '00000000-0000-0000-0000-0000000001c5';
  if not found then raise exception 'FALHOU 10b: consultor não conseguiu corrigir'; end if;
  raise notice 'OK 10b: consultor corrigiu registro de relatório fechado';
end $$;
reset role;


-- =============================================================================
-- 11. Saldo ignora perda anulada e plantio anulado
-- =============================================================================
-- Como postgres o trigger de correção ainda vale (é BEFORE UPDATE, não
-- RLS): usa a coordenação como quem altera.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
update plantios set quantidade_inicial = 10 where id = '00000000-0000-0000-0000-0000000000f1';
insert into registros_perdas (id, plantio_id, quantidade, registrado_por, registrado_em) values
  ('00000000-0000-0000-0000-0000000002e1', '00000000-0000-0000-0000-0000000000f1', 3,
   '00000000-0000-0000-0000-0000000000a1', now());
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_saldo numeric;
begin
  select quantidade_disponivel into v_saldo from plantios_saldo where id = '00000000-0000-0000-0000-0000000000f1';
  if v_saldo <> 7 then raise exception 'FALHOU 11: saldo antes da anulação devia ser 7, veio %', v_saldo; end if;
  update registros_perdas set anulado_em = now(), motivo_anulacao = 'contei duas vezes'
   where id = '00000000-0000-0000-0000-0000000002e1';
  select quantidade_disponivel into v_saldo from plantios_saldo where id = '00000000-0000-0000-0000-0000000000f1';
  if v_saldo <> 10 then raise exception 'FALHOU 11: perda anulada ainda desconta (saldo %)', v_saldo; end if;
  select quantidade_disponivel into v_saldo from plantios_saldo where id = '00000000-0000-0000-0000-0000000000f3';
  if v_saldo <> 0 then raise exception 'FALHOU 11: plantio anulado devia ter saldo 0, veio %', v_saldo; end if;
  raise notice 'OK 11: saldo ignora perda anulada e plantio anulado';
end $$;
reset role;


rollback;
