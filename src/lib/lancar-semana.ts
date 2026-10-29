// Lançar a semana (Sprint B, item B5 — SPRINT_B_RELATO_DO_TURNO.md, seção 7).
// Lado do navegador: tipos compartilhados com a rota, chamada à rota de
// interpretação e gravação (sem apagar nada que já existe).
//
// A interpretação roda no servidor (src/app/api/semana/interpretar/route.ts,
// que usa src/lib/ia/semana.ts). A gravação usa criarEvento e
// criarItemPlanejamento, as mesmas funções das telas de Agenda e
// Planejamento semanal, com a sessão de quem está lançando.

import { supabase } from "./supabase";
import { requerSessao } from "./auth";
import { criarEvento } from "./agenda";
import { chavesComRelatorioTurno, criarItemPlanejamento, listarItensPlanejamento } from "./planejamento";
import type { EventoAgenda } from "./types";

export type DiaSemanaTexto = "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado" | "domingo";

export interface LinhaEscalaSemana {
  data: string; // YYYY-MM-DD
  turno: "manha" | "tarde" | "dia_todo"; // dia_todo só para folga
  tipo: "turno_trabalho" | "folga";
  membro_id: string | null;
  nome_no_texto: string;
  pessoa_status: "certo" | "faltando";
}

export interface LinhaAtividadeSemana {
  data: string;
  turno: "manha" | "tarde";
  descricao: string;
}

export interface SemanaInterpretada {
  escala: LinhaEscalaSemana[];
  atividades: LinhaAtividadeSemana[];
  avisos: string[];
  log_id: string | null;
}

export { LIMITE_TEXTO_SEMANA } from "./ia/semana";

export class ErroLancarSemana extends Error {}

export async function interpretarSemana(segunda: string, texto: string): Promise<SemanaInterpretada> {
  await requerSessao();
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;

  let resposta: Response;
  try {
    resposta = await fetch("/api/semana/interpretar", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token ?? ""}`,
      },
      body: JSON.stringify({ segunda, texto }),
    });
  } catch {
    throw new ErroLancarSemana("Sem internet agora. O texto continua aqui; tente de novo quando a conexão voltar.");
  }

  const corpo = (await resposta.json().catch(() => null)) as (SemanaInterpretada & { erro?: string }) | null;
  if (!resposta.ok || !corpo) {
    throw new ErroLancarSemana(corpo?.erro ?? "Não deu pra entender a semana agora. Tente de novo.");
  }
  return corpo;
}

// -----------------------------------------------------------------------------
// Gravação
// -----------------------------------------------------------------------------

export interface ResumoLancamento {
  turnosCriados: number;
  folgasCriadas: number;
  atividadesCriadas: number;
  puladasExistentes: number;
  puladasComRelatorio: { data: string; turno: "manha" | "tarde"; descricao: string }[];
}

function chaveEvento(data: string, turno: string | null, membroId: string | null, tipo: string): string {
  return `${data}|${turno ?? ""}|${membroId ?? ""}|${tipo}`;
}

function chaveAtividade(data: string, turno: string, descricao: string): string {
  return `${data}|${turno}|${descricao.trim()}`;
}

async function listarEventosPeriodo(inicio: string, fim: string): Promise<EventoAgenda[]> {
  const { data, error } = await supabase
    .from("eventos_agenda")
    .select("*")
    .gte("data", inicio)
    .lte("data", fim);
  if (error) throw error;
  return data ?? [];
}

// Grava a escala e as atividades da semana. Nada é apagado nem alterado:
//   * evento igual (mesmo dia, turno, pessoa e tipo) já existente: pula;
//   * atividade igual (mesmo dia, turno e texto) já existente: pula;
//   * atividade em (data, turno) que já tem Relatório do Turno: pula e
//     lista no resumo (regra P2: o checklist daquele turno já foi copiado).
// Linhas repetidas dentro do próprio texto contam como "já existiam".
// Se algo falhar no meio, o que já foi gravado fica; lançar de novo pula
// o que já existe.
export async function lancarSemana(
  segunda: string,
  escala: LinhaEscalaSemana[],
  atividades: LinhaAtividadeSemana[],
): Promise<ResumoLancamento> {
  await requerSessao();
  if (escala.some((l) => !l.membro_id)) {
    throw new ErroLancarSemana("Escolha a pessoa das linhas marcadas (ou apague essas linhas) antes de lançar.");
  }

  const [a, m, d] = segunda.split("-").map(Number);
  const domingo = new Date(Date.UTC(a, m - 1, d + 6)).toISOString().slice(0, 10);

  const [eventos, itens, comRelatorio] = await Promise.all([
    listarEventosPeriodo(segunda, domingo),
    listarItensPlanejamento(segunda, domingo),
    chavesComRelatorioTurno(segunda, domingo),
  ]);

  const eventosExistentes = new Set(eventos.map((e) => chaveEvento(e.data, e.turno, e.membro_equipe_id, e.tipo)));
  const itensExistentes = new Set(itens.map((i) => chaveAtividade(i.data, i.turno, i.descricao)));

  const resumo: ResumoLancamento = {
    turnosCriados: 0,
    folgasCriadas: 0,
    atividadesCriadas: 0,
    puladasExistentes: 0,
    puladasComRelatorio: [],
  };

  for (const linha of escala) {
    const chave = chaveEvento(linha.data, linha.turno, linha.membro_id, linha.tipo);
    if (eventosExistentes.has(chave)) {
      resumo.puladasExistentes++;
      continue;
    }
    await criarEvento({
      titulo: linha.tipo === "folga" ? "Folga" : "Turno de trabalho",
      tipo: linha.tipo,
      data: linha.data,
      turno: linha.turno,
      membro_equipe_id: linha.membro_id,
    });
    eventosExistentes.add(chave);
    if (linha.tipo === "folga") resumo.folgasCriadas++;
    else resumo.turnosCriados++;
  }

  for (const item of atividades) {
    if (comRelatorio.has(`${item.data}|${item.turno}`)) {
      resumo.puladasComRelatorio.push(item);
      continue;
    }
    const chave = chaveAtividade(item.data, item.turno, item.descricao);
    if (itensExistentes.has(chave)) {
      resumo.puladasExistentes++;
      continue;
    }
    await criarItemPlanejamento({ data: item.data, turno: item.turno, descricao: item.descricao });
    itensExistentes.add(chave);
    resumo.atividadesCriadas++;
  }

  return resumo;
}

// relatos_ia_log.aceito_sem_edicao: true se a coordenação lançou sem mexer
// em nenhuma linha. Falha aqui não atrapalha o lançamento.
export async function registrarAceiteSemEdicao(logId: string | null, semEdicao: boolean): Promise<void> {
  if (!logId) return;
  await supabase.from("relatos_ia_log").update({ aceito_sem_edicao: semEdicao }).eq("id", logId);
}
