-- =============================================================================
-- Cadastro → Canteiros — corrige o nome do tipo "galeria" para "galeia"
-- =============================================================================
--
-- "Galeria" nunca foi o nome certo: é "Galeia", como a coordenação chama
-- essa forma de canteiro no dia a dia (correção confirmada 2026-08-22).
-- Como nenhum canteiro foi cadastrado ainda (tabela `canteiros` vazia —
-- confirmado antes de aplicar esta migration), é seguro renomear o valor
-- internamente, não só o rótulo mostrado na tela — não existe nenhuma
-- linha com tipo = 'galeria' pra migrar.
--
-- ATENÇÃO ao aplicar: o nome do constraint abaixo (canteiros_tipo_check)
-- é o nome default que o Postgres gera pra um `check` inline sem nome
-- explícito (coluna `tipo` na migration 20260821120000). Se o DROP
-- CONSTRAINT abaixo falhar com "constraint ... does not exist", confira o
-- nome real no SQL Editor do Supabase antes de tentar de novo:
--
--   select conname from pg_constraint
--   where conrelid = 'canteiros'::regclass and contype = 'c';
-- =============================================================================

alter table canteiros drop constraint canteiros_tipo_check;

alter table canteiros
  add constraint canteiros_tipo_check
  check (tipo in ('canteiro_solo', 'bombona', 'galeia', 'geodesica', 'outro'));
