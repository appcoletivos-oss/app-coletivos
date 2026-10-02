-- =============================================================================
-- Sprint A.1 — espelho do SQL de culturas aplicado direto no SQL Editor em
-- 02/10/2026 (Thiago). Idempotente. Existe só para versionar o histórico
-- (ver SPRINT_A1_MENOS_TOQUES.md, seção 9b, item 5).
-- =============================================================================
--
-- NOTA: este arquivo não muda o banco. As colunas e a policy abaixo já
-- existem em produção. Rodar de novo não tem efeito: colunas usam
-- IF NOT EXISTS e a policy é precedida de DROP POLICY IF EXISTS.
--
-- O que faz: qualquer papel cadastra cultura só com o nome ("Não achei a
-- cultura" em Registrar plantio). Fora coordenação/consultor, o insert
-- precisa ir com revisar = true — vira alerta "culturas novas pra revisar"
-- pra coordenação/consultor. criada_por é sempre o próprio auth.uid().
-- A policy "coordenacao e consultor gerenciam culturas" (for all, migration
-- 20260827130000) continua valendo: é por ela que a revisão (UPDATE que
-- limpa revisar) acontece.
-- =============================================================================

alter table culturas
  add column if not exists revisar boolean not null default false,
  add column if not exists criada_por uuid default auth.uid();

drop policy if exists "papel autenticado cria culturas minimas" on culturas;
create policy "papel autenticado cria culturas minimas"
  on culturas for insert
  to authenticated
  with check (
    papel_atual() is not null
    and criada_por = auth.uid()
    and (
      papel_atual() in ('coordenacao', 'consultor')
      or revisar = true
    )
  );
