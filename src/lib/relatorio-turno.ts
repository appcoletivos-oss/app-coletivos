// Funções de acesso a dados do Relatório do Turno (Sprint A, item 6 —
// SPRINT_A_REGISTRO_SIMPLIFICADO_ETAPA2.md, seção 11). Mesmo padrão de
// patio.ts/agenda.ts: centraliza as chamadas ao Supabase pra não espalhar
// `.from(...)` pela tela.
//
// Fuso: toda comparação de data/hora de turno é em `America/Recife`
// (UTC-3), nunca UTC puro (regra da sprint) — ver horaRecife/dataRecife.

import { supabase } from "./supabase";
import { requerSessao, obterMeuMembro } from "./auth";
import type {
  ItemRelatorioTurno,
  MembroDoTurno,
  RelatorioTurno,
  TipoRegistroRelatorio,
  TurnoPlanejamento,
} from "./types";

// -----------------------------------------------------------------------------
// Fuso horário — America/Recife (UTC-3, sem horário de verão). Usa
// Intl.DateTimeFormat em vez de aritmética manual de offset, pra não errar
// perto da meia-noite nem depender de o servidor estar em UTC.
// -----------------------------------------------------------------------------

// Hora local (0-23) de um timestamp ISO, em America/Recife.
function horaRecife(iso: string): number {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Recife",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  return Number(partes.find((p) => p.type === "hour")?.value ?? "0");
}

// Data local (YYYY-MM-DD) de um timestamp ISO, em America/Recife. Usa o
// locale en-CA porque Intl já devolve nesse formato (sem parsing manual).
function dataRecife(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

// Data de hoje (YYYY-MM-DD) em America/Recife — pra data_inicio de
// plantio etc. sem cair no dia seguinte depois das 21h (UTC). Chamar só
// pós-mount (handler/useEffect), nunca no render.
export function dataHojeRecife(): string {
  return dataRecife(new Date().toISOString());
}

// Antes das 12:00 (Recife) = manhã; da 12:00 em diante = tarde — regra
// fechada da sprint (seção 3 do sprint doc). Saída não define turno.
export function turnoPeloHorario(iso: string): TurnoPlanejamento {
  return horaRecife(iso) < 12 ? "manha" : "tarde";
}

// -----------------------------------------------------------------------------
// Abrir ou criar (seção 11b)
// -----------------------------------------------------------------------------

// Descobre data+turno de hoje pra abrir o relatório: se a pessoa bateu
// ponto de entrada hoje (Recife), o turno vem da hora desse ponto; sem
// ponto de entrada hoje (consultor, ou equipe que ainda não bateu),
// usa a hora de agora — `trocavel=true` avisa a tela que, nesse caso, a
// pessoa pode trocar o turno manualmente antes de abrir.
export async function determinarDataTurnoAtual(): Promise<{
  data: string;
  turno: TurnoPlanejamento;
  trocavel: boolean;
}> {
  await requerSessao();
  const agoraIso = new Date().toISOString();
  const hoje = dataRecife(agoraIso);

  const meuMembro = await obterMeuMembro();
  if (meuMembro) {
    const janelaInicio = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: pontos, error } = await supabase
      .from("pontos")
      .select("horario")
      .eq("membro_equipe_id", meuMembro.id)
      .eq("tipo", "entrada")
      .gte("horario", janelaInicio)
      .lte("horario", agoraIso)
      .order("horario", { ascending: false });
    if (error) throw error;

    const pontoDeHoje = (pontos ?? []).find((p) => dataRecife(p.horario) === hoje);
    if (pontoDeHoje) {
      return { data: hoje, turno: turnoPeloHorario(pontoDeHoje.horario), trocavel: false };
    }
  }

  return { data: hoje, turno: turnoPeloHorario(agoraIso), trocavel: true };
}

// Evento `tipo = 'turno_trabalho'` da data cujo turno seja igual ao do
// relatório OU `dia_todo` — sem evento correspondente, fica nulo, sem
// travar (seção 11b, ponto 4).
async function buscarEventoTurnoTrabalho(
  data: string,
  turno: TurnoPlanejamento,
): Promise<{ id: string } | null> {
  const { data: eventos, error } = await supabase
    .from("eventos_agenda")
    .select("id, turno")
    .eq("data", data)
    .eq("tipo", "turno_trabalho");
  if (error) throw error;
  return (eventos ?? []).find((e) => e.turno === turno || e.turno === "dia_todo") ?? null;
}

// Só chamada pra um relatório recém-criado (nunca pra um que já existia) —
// copia o planejamento daquela (data,turno) e resolve o evento_agenda_id.
async function preencherRelatorioNovo(relatorio: RelatorioTurno): Promise<void> {
  const [itensPlanejamento, evento] = await Promise.all([
    supabase
      .from("planejamento_semanal_itens")
      .select("descricao")
      .eq("data", relatorio.data)
      .eq("turno", relatorio.turno),
    buscarEventoTurnoTrabalho(relatorio.data, relatorio.turno),
  ]);
  if (itensPlanejamento.error) throw itensPlanejamento.error;

  const linhas = (itensPlanejamento.data ?? []).map((item) => ({
    relatorio_turno_id: relatorio.id,
    descricao: item.descricao,
    origem: "planejada" as const,
  }));
  if (linhas.length > 0) {
    const { error } = await supabase.from("relatorio_turno_itens").insert(linhas);
    if (error) throw error;
  }

  if (evento) {
    const { error } = await supabase
      .from("relatorios_turno")
      .update({ evento_agenda_id: evento.id })
      .eq("id", relatorio.id);
    if (error) throw error;
    relatorio.evento_agenda_id = evento.id;
  }
}

// Cria sem duplicar: upsert com ignoreDuplicates (= `on conflict (data,
// turno) do nothing` no SQL) e, se a linha já existia, um select separado
// — só quem de fato criou a linha (upsert devolveu algo) copia o
// planejamento, pra não duplicar nas aberturas seguintes do mesmo turno
// (seção 11b, pontos 2 e 3).
export async function abrirOuCriarRelatorioTurno(
  data: string,
  turno: TurnoPlanejamento,
): Promise<RelatorioTurno> {
  await requerSessao();
  const { data: sessao } = await supabase.auth.getSession();

  const { data: inseridos, error: erroUpsert } = await supabase
    .from("relatorios_turno")
    .upsert({ data, turno, criado_por: sessao.session?.user.id }, { onConflict: "data,turno", ignoreDuplicates: true })
    .select("*");
  if (erroUpsert) throw erroUpsert;

  if (inseridos && inseridos.length > 0) {
    const relatorio = inseridos[0] as RelatorioTurno;
    await preencherRelatorioNovo(relatorio);
    return relatorio;
  }

  const { data: existente, error: erroSelect } = await supabase
    .from("relatorios_turno")
    .select("*")
    .eq("data", data)
    .eq("turno", turno)
    .single();
  if (erroSelect) throw erroSelect;
  return existente as RelatorioTurno;
}

export async function buscarRelatorioPorId(id: string): Promise<RelatorioTurno | null> {
  await requerSessao();
  const { data, error } = await supabase.from("relatorios_turno").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listarUltimosRelatorios(limite = 10): Promise<RelatorioTurno[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("relatorios_turno")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data ?? [];
}

// -----------------------------------------------------------------------------
// Equipe do turno (seção 11c)
// -----------------------------------------------------------------------------

// Membros com ponto de entrada naquela (data,turno) em America/Recife,
// fora quem teve o ponto rejeitado. Busca com janela de ±1 dia em UTC (pra
// não cortar o dia local perto da virada) e filtra de verdade em JS, no
// fuso certo — comparar strings ISO direto erraria perto da meia-noite.
export async function buscarEquipeDoTurno(data: string, turno: TurnoPlanejamento): Promise<MembroDoTurno[]> {
  await requerSessao();
  const base = new Date(`${data}T00:00:00Z`).getTime();
  const inicio = new Date(base - 24 * 3600_000).toISOString();
  const fim = new Date(base + 48 * 3600_000).toISOString();

  const { data: pontos, error } = await supabase
    .from("pontos")
    .select("membro_equipe_id, horario, status_aprovacao")
    .eq("tipo", "entrada")
    .gte("horario", inicio)
    .lte("horario", fim);
  if (error) throw error;

  const membroIds = new Set<string>();
  for (const p of pontos ?? []) {
    if (p.status_aprovacao === "rejeitado") continue;
    if (dataRecife(p.horario) !== data) continue;
    if (turnoPeloHorario(p.horario) !== turno) continue;
    membroIds.add(p.membro_equipe_id);
  }
  if (membroIds.size === 0) return [];

  const { data: membros, error: erroMembros } = await supabase
    .from("membros_equipe")
    .select("id, nome, papel")
    .in("id", [...membroIds]);
  if (erroMembros) throw erroMembros;
  return membros ?? [];
}

// -----------------------------------------------------------------------------
// Itens do relatório (seção 11c/11d)
// -----------------------------------------------------------------------------

export async function listarItensDoRelatorio(relatorioId: string): Promise<ItemRelatorioTurno[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("relatorio_turno_itens")
    .select("*")
    .eq("relatorio_turno_id", relatorioId)
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function buscarItemPorId(id: string): Promise<ItemRelatorioTurno | null> {
  await requerSessao();
  const { data, error } = await supabase.from("relatorio_turno_itens").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// Botão "+ outra atividade" — texto livre, origem=extra. tipo_registro
// começa nulo: é escolhido só na hora que a pessoa aperta "Registrar dado"
// (ver escolherTipoRegistro), igual aos itens vindos do planejamento.
export async function criarItemExtra(relatorioId: string, descricao: string): Promise<ItemRelatorioTurno> {
  await requerSessao();
  const { data, error } = await supabase
    .from("relatorio_turno_itens")
    .insert({ relatorio_turno_id: relatorioId, descricao: descricao.trim(), origem: "extra" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Primeira vez que a pessoa aperta "Registrar dado" num item sem
// tipo_registro ainda — grava a escolha pra não perguntar de novo. ronda
// e outro não têm sub-formulário (ver 11d): a tela só esconde o botão
// depois disso, nenhum outro efeito aqui.
export async function escolherTipoRegistro(
  itemId: string,
  tipo: TipoRegistroRelatorio,
): Promise<void> {
  await requerSessao();
  const { error } = await supabase.from("relatorio_turno_itens").update({ tipo_registro: tipo }).eq("id", itemId);
  if (error) throw error;
}

// ✅ Feito / ❌ Não feito (seção 11c, ponto 1-2). `motivoNaoFeito` só faz
// sentido quando feito=false — a tela já garante isso antes de chamar.
export async function marcarItemFeito(
  itemId: string,
  feito: boolean,
  motivoNaoFeito?: string | null,
): Promise<void> {
  await requerSessao();
  const { data: sessao } = await supabase.auth.getSession();
  const { error } = await supabase
    .from("relatorio_turno_itens")
    .update({
      feito,
      motivo_nao_feito: feito ? null : motivoNaoFeito?.trim() || null,
      registrado_por: sessao.session?.user.id,
    })
    .eq("id", itemId);
  if (error) throw error;
}

// Um item tem no máximo um registro gerado (seção 11d). Quando a
// atividade gera mais de um (ex.: compostagem de duas lojas na mesma
// coleta), "Registrar dado" num item que já tem registro cria este item
// IRMÃO — mesma descrição + " (cont.)", mesmo tipo_registro, origem=extra,
// sem registro ainda — em vez de sobrescrever o vínculo existente.
export async function criarItemIrmao(item: ItemRelatorioTurno): Promise<ItemRelatorioTurno> {
  await requerSessao();
  const { data, error } = await supabase
    .from("relatorio_turno_itens")
    .insert({
      relatorio_turno_id: item.relatorio_turno_id,
      descricao: `${item.descricao} (cont.)`,
      origem: "extra",
      tipo_registro: item.tipo_registro,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Chamada pelo sub-formulário (Registrar compostagem, Manejo, etc.) ao
// salvar com sucesso um registro vinculado a este item — grava a tabela e
// o id gerados e marca feito=true (seção 11d). `registrado_por` é de quem
// salvou o registro, não necessariamente quem abriu o relatório.
export async function vincularRegistroAoItem(
  itemId: string,
  tabela: string,
  registroId: string,
): Promise<void> {
  await requerSessao();
  const { data: sessao } = await supabase.auth.getSession();
  const { error } = await supabase
    .from("relatorio_turno_itens")
    .update({
      tabela_registro_gerado: tabela,
      registro_id_gerado: registroId,
      feito: true,
      registrado_por: sessao.session?.user.id,
    })
    .eq("id", itemId);
  if (error) throw error;
}

// Plantio em consórcio (Sprint A, item 1) pode criar N lotes de uma vez —
// mais do que o "no máximo um registro por item" de vincularRegistroAoItem
// cobre sozinho. Vincula o PRIMEIRO plantio ao item de origem e cria um
// item IRMÃO pra cada um dos demais N-1 (mesma descrição + " (cont.)",
// mesmo tipo_registro, já com o próprio registro_id_gerado) — decisão do
// Thiago, 01/10/2026: não bloquear consórcio vindo do relatório, e cada
// plantio extra ganha seu próprio item em vez de ficar sem vínculo.
export async function vincularPlantiosAoItem(itemId: string, plantioIds: string[]): Promise<void> {
  if (plantioIds.length === 0) return;
  await requerSessao();

  const item = await buscarItemPorId(itemId);
  if (!item) throw new Error("Item do relatório não encontrado.");

  const [primeiro, ...resto] = plantioIds;
  await vincularRegistroAoItem(item.id, "plantios", primeiro);

  for (const plantioId of resto) {
    const irmao = await criarItemIrmao(item);
    await vincularRegistroAoItem(irmao.id, "plantios", plantioId);
  }
}

// -----------------------------------------------------------------------------
// Fechar / reabrir (seção 11c, ponto 6)
// -----------------------------------------------------------------------------

export async function fecharRelatorio(id: string): Promise<void> {
  await requerSessao();
  const { error } = await supabase
    .from("relatorios_turno")
    .update({ fechado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Reabrir é restrito a Coordenação/Consultor só na tela (a RLS de update
// de relatorios_turno é aberta a qualquer papel — ver migration
// 20261001010000 e proposta P1 do sprint doc, default adotado).
export async function reabrirRelatorio(id: string): Promise<void> {
  await requerSessao();
  const { error } = await supabase.from("relatorios_turno").update({ fechado_em: null }).eq("id", id);
  if (error) throw error;
}
