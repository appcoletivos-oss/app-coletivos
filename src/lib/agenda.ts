// Funções de acesso a dados do bloco Agenda. Mesmo padrão de patio.ts/horta.ts:
// centraliza as chamadas ao Supabase pra não espalhar `.from(...)` pelas telas.

import { garantirSessaoAnonima, supabase } from "./supabase";
import type { EventoAgenda, NovoEventoAgenda, TipoEventoAgenda, TurnoDia } from "./types";

export const TIPOS_EVENTO_AGENDA: { valor: TipoEventoAgenda; icone: string; rotulo: string }[] = [
  { valor: "atividade", icone: "🌱", rotulo: "Atividade" },
  { valor: "mutirao", icone: "🤝", rotulo: "Mutirão" },
  { valor: "oficina", icone: "🎓", rotulo: "Oficina" },
  { valor: "visita", icone: "👥", rotulo: "Visita" },
  { valor: "turno_trabalho", icone: "⏰", rotulo: "Turno de trabalho" },
  { valor: "folga", icone: "🌴", rotulo: "Folga" },
  { valor: "ferias", icone: "🏖️", rotulo: "Férias" },
];

export function rotuloTipoEvento(tipo: TipoEventoAgenda): string {
  return TIPOS_EVENTO_AGENDA.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}

export function iconeTipoEvento(tipo: TipoEventoAgenda): string {
  return TIPOS_EVENTO_AGENDA.find((t) => t.valor === tipo)?.icone ?? "📅";
}

// Tipos que exigem membro_equipe_id em regra de produto (não é constraint
// de banco — ver comentário na migration 20260826100000). A tela de Agenda
// usa isso pra decidir se mostra o seletor de pessoa como obrigatório.
export function exigeMembro(tipo: TipoEventoAgenda): boolean {
  return tipo === "turno_trabalho" || tipo === "folga" || tipo === "ferias";
}

// Tipos que podem cobrir um período (data + data_fim) em vez de um dia só.
export function permiteDataFim(tipo: TipoEventoAgenda): boolean {
  return tipo === "ferias";
}

export const TURNOS_DIA: { valor: TurnoDia; rotulo: string }[] = [
  { valor: "manha", rotulo: "Manhã" },
  { valor: "tarde", rotulo: "Tarde" },
  { valor: "dia_todo", rotulo: "Dia todo" },
];

export function rotuloTurno(turno: TurnoDia | null): string {
  if (!turno) return "sem turno definido";
  return TURNOS_DIA.find((t) => t.valor === turno)?.rotulo ?? turno;
}

// Rotas de registro que um evento tipo "atividade" pode linkar — a tela de
// Agenda mostra esses botões quando o evento é desse tipo; ao abrir por
// esse link, a tela de registro já vem com evento_agenda_id pré-preenchido
// (query param, ver telas de registro em src/app/patio/**).
export const LINKS_REGISTRO_ATIVIDADE: { rotulo: string; icone: string; href: string }[] = [
  { rotulo: "Registrar compostagem", icone: "📥", href: "/patio/compostagem/registrar-alimentacao" },
  { rotulo: "Registrar colheita", icone: "🧺", href: "/patio/horta/registrar-colheita" },
  { rotulo: "Manejo", icone: "🌾", href: "/patio/horta/manejo" },
  { rotulo: "Análise sensorial", icone: "👃", href: "/patio/compostagem/analise-sensorial" },
  { rotulo: "Controle de bombonas", icone: "🛢️", href: "/patio/compostagem/bombonas" },
];

export function linkComEvento(href: string, eventoId: string): string {
  return `${href}?evento_agenda_id=${eventoId}`;
}

// Lista todos os eventos, mais recentes/próximos primeiro por data — a tela
// de Agenda agrupa por dia no cliente. Volume ainda pequeno (fase piloto),
// sem paginação por enquanto.
export async function listarEventos(): Promise<EventoAgenda[]> {
  await garantirSessaoAnonima();
  const { data, error } = await supabase
    .from("eventos_agenda")
    .select("*")
    .order("data", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// criado_por referencia membros_equipe, não auth.users diretamente — sem
// login de verdade implementado ainda, não há como resolver o membro a
// partir da sessão anônima, então fica null por enquanto (mesma pendência
// de controle de acesso das demais telas).
export async function criarEvento(dados: NovoEventoAgenda): Promise<EventoAgenda> {
  await garantirSessaoAnonima();
  const { data, error } = await supabase
    .from("eventos_agenda")
    .insert({
      titulo: dados.titulo.trim(),
      descricao: dados.descricao?.trim() || null,
      tipo: dados.tipo,
      data: dados.data,
      data_fim: dados.data_fim || null,
      turno: dados.turno || null,
      membro_equipe_id: dados.membro_equipe_id || null,
      criado_por: null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function removerEvento(id: string): Promise<void> {
  await garantirSessaoAnonima();
  const { error } = await supabase.from("eventos_agenda").delete().eq("id", id);
  if (error) throw error;
}

// Agrupa eventos por data (chave "YYYY-MM-DD") pra exibição em lista
// agrupada por dia — comparação de string funciona porque `data` já vem
// nesse formato (column type `date`).
export function agruparEventosPorDia(eventos: EventoAgenda[]): Map<string, EventoAgenda[]> {
  const mapa = new Map<string, EventoAgenda[]>();
  for (const evento of eventos) {
    const lista = mapa.get(evento.data) ?? [];
    lista.push(evento);
    mapa.set(evento.data, lista);
  }
  return mapa;
}
