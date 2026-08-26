-- =============================================================================
-- Corrige semântica de exclusão de evento_agenda_id nas tabelas de registro
-- =============================================================================
--
-- Bug encontrado em teste manual (2026-08-26): a migration 20260826120000
-- criou `evento_agenda_id` sem especificar `on delete`, então o Postgres usa
-- o padrão (`no action`) — excluir um evento da Agenda que já tem algum
-- registro vinculado falha com 409 (violação de chave estrangeira), em vez
-- de simplesmente desvincular o registro.
--
-- Como evento_agenda_id é só um vínculo informativo opcional (o registro
-- continua fazendo sentido sozinho, sem o evento), a semântica correta é
-- `on delete set null`: apagar o evento da Agenda não deve apagar nem
-- bloquear a exclusão de nenhum registro — só desfaz o link.
--
-- Os nomes de constraint abaixo são os gerados automaticamente pelo Postgres
-- pra `references` declarado inline em `alter table ... add column`
-- (padrão `<tabela>_<coluna>_fkey`).
-- =============================================================================

alter table registros_alimentacao
  drop constraint if exists registros_alimentacao_evento_agenda_id_fkey,
  add constraint registros_alimentacao_evento_agenda_id_fkey
    foreign key (evento_agenda_id) references eventos_agenda(id) on delete set null;

alter table registros_colheita
  drop constraint if exists registros_colheita_evento_agenda_id_fkey,
  add constraint registros_colheita_evento_agenda_id_fkey
    foreign key (evento_agenda_id) references eventos_agenda(id) on delete set null;

alter table registros_manejo
  drop constraint if exists registros_manejo_evento_agenda_id_fkey,
  add constraint registros_manejo_evento_agenda_id_fkey
    foreign key (evento_agenda_id) references eventos_agenda(id) on delete set null;

alter table registros_analise_sensorial
  drop constraint if exists registros_analise_sensorial_evento_agenda_id_fkey,
  add constraint registros_analise_sensorial_evento_agenda_id_fkey
    foreign key (evento_agenda_id) references eventos_agenda(id) on delete set null;

alter table registros_bombonas
  drop constraint if exists registros_bombonas_evento_agenda_id_fkey,
  add constraint registros_bombonas_evento_agenda_id_fkey
    foreign key (evento_agenda_id) references eventos_agenda(id) on delete set null;
