-- =============================================================================
-- Vínculo de carga semanal + evento_agenda_id nas tabelas de registro
-- =============================================================================
--
-- carga_semanal_turnos: número de turnos de 3h/semana esperados no vínculo
-- geral da pessoa (usado como "esperado" no cálculo de banco de horas, ver
-- src/lib/ponto.ts). Editável a qualquer momento pela coordenação — não é
-- um valor "de contratação" fixo, por isso não tem histórico/versão.
--
-- evento_agenda_id: link opcional de um registro a um evento da Agenda
-- (tipo 'atividade'). Quando a tela de registro é aberta a partir de um
-- link da Agenda (query param ?evento_agenda_id=...), o registro salvo
-- carrega essa referência — sem isso, fica null (registro avulso, sem
-- vínculo com nenhum evento agendado).
-- =============================================================================

alter table membros_equipe add column if not exists carga_semanal_turnos integer;
comment on column membros_equipe.carga_semanal_turnos is
  'Turnos de 3h/semana esperados no vínculo geral da pessoa. Editável livremente pela coordenação, a qualquer momento — não é fixado na criação do cadastro.';

alter table registros_alimentacao add column if not exists evento_agenda_id uuid references eventos_agenda(id);
alter table registros_colheita add column if not exists evento_agenda_id uuid references eventos_agenda(id);
alter table registros_manejo add column if not exists evento_agenda_id uuid references eventos_agenda(id);
alter table registros_analise_sensorial add column if not exists evento_agenda_id uuid references eventos_agenda(id);
alter table registros_bombonas add column if not exists evento_agenda_id uuid references eventos_agenda(id);
