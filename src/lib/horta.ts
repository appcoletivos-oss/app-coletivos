// Funções de acesso a dados do bloco Horta. Mesmo padrão de patio.ts:
// centraliza as chamadas ao Supabase pra não espalhar `.from(...)` pelas
// telas. `listarCanteirosAtivos` fica em patio.ts (é a mesma tabela usada
// pela aba Canteiros do Cadastro) — este arquivo cuida só do que é
// específico da Horta.

import { supabase } from "./supabase";
import { requerSessao } from "./auth";
import type { NovoRegistroColheita, NovoRegistroManejo, TipoCanteiro } from "./types";

// Ícone por tipo de canteiro — mesma lógica do ícone por tipo de parceiro
// em Registrar compostagem (loja vs. construtora), só que com mais opções
// porque o regime de permacultura do coletivo usa formas diferentes de
// plantio (ver Registro Geral, seção 2).
const ICONES_TIPO_CANTEIRO: Record<TipoCanteiro, string> = {
  canteiro_solo: "🌾",
  bombona: "🪣",
  galeia: "🧺",
  geodesica: "⛰️",
  outro: "🪴",
};

export function iconeTipoCanteiro(tipo: TipoCanteiro): string {
  return ICONES_TIPO_CANTEIRO[tipo] ?? "🪴";
}

// Salva um registro de colheita. Lança erro se não houver internet ou
// sessão autenticada — quem chama decide o que fazer (ex.: fila offline).
// `registrado_por` é preenchido pelo banco (default auth.uid(), ver
// migration 20260827120000).
export async function salvarRegistroColheita(
  registro: NovoRegistroColheita,
): Promise<void> {
  await requerSessao();
  const { error } = await supabase.from("registros_colheita").insert(registro);
  if (error) throw error;
}

// Salva um registro de manejo (capina seletiva, adubação, poda,
// raleamento). Lança erro se não houver internet ou sessão autenticada —
// quem chama decide o que fazer (ex.: fila offline). `registrado_por` vem
// do banco (default auth.uid()).
export async function salvarRegistroManejo(
  registro: NovoRegistroManejo,
): Promise<void> {
  await requerSessao();
  const { error } = await supabase.from("registros_manejo").insert(registro);
  if (error) throw error;
}

// As culturas mais colhidas no histórico real (637 registros, 69 espécies
// — planilha "Tabela de Plantio e Colheita", ver Registro Geral) + 5
// espécies que o usuário pediu pra incluir por conhecimento direto do
// cotidiano da horta, mesmo com menos registros históricos (2026-08-22):
// salsa, banana, alho poró, cebolinha, taioba. Aparecem como grid fixo no
// passo "Qual foi a cultura?"; qualquer outra espécie entra pelo botão
// "Outra" (campo de texto, com sugestão de correção ortográfica — ver
// sugerirCorrecaoCultura). Decisão de produto 2026-08-22: sem tabela
// própria de "culturas" no banco por trás — ver NovoRegistroColheita em
// types.ts.
export const CULTURAS_COMUNS: { nome: string; icone: string }[] = [
  { nome: "Quiabo", icone: "🫛" },
  { nome: "Berinjela", icone: "🍆" },
  { nome: "Couve", icone: "🥬" },
  { nome: "Maxixe", icone: "🥒" },
  { nome: "Pimenta", icone: "🌶️" },
  { nome: "Tomate", icone: "🍅" },
  { nome: "Manjericão", icone: "🌿" },
  { nome: "Coentro", icone: "🍃" },
  { nome: "Rúcula", icone: "🌱" },
  { nome: "Mamão", icone: "🍈" },
  { nome: "Pimentão", icone: "🫑" },
  { nome: "Acerola", icone: "🍒" },
  { nome: "Salsa", icone: "🍀" },
  { nome: "Cebolinha", icone: "🧅" },
  { nome: "Banana", icone: "🍌" },
  { nome: "Alho poró", icone: "🌾" },
  { nome: "Taioba", icone: "🍃" },
];

// -----------------------------------------------------------------------------
// Sugestão de correção ortográfica pro campo "Outra" — pedido explícito
// do usuário (2026-08-22): boa parte da equipe não escreve com muita
// segurança, então em vez de só aceitar o texto digitado literalmente, a
// tela sugere a espécie conhecida mais parecida (ex.: digitou "beringela"
// → sugere "Berinjela"). É só uma sugestão, nunca uma trava: a pessoa
// pode ignorar e salvar o texto como digitou.
//
// CULTURAS_CONHECIDAS é uma lista de referência bem mais ampla que
// CULTURAS_COMUNS (que é só o grid de botões) — vem de uma limpeza manual
// das 69 espécies da planilha real (removendo variações que eram só erro
// de digitação da própria planilha, ex.: "Manjericao Verde"/"Manjeriçao"
// viraram só "Manjericão", e descartando 2 entradas que não são cultura
// de fato: "Rep.ramoso" — abreviação ambígua — e "Terramicina" — um
// medicamento, não uma planta). É "melhor esforço", não uma lista
// definitiva; pode crescer conforme a equipe usar o campo "Outra".
export const CULTURAS_CONHECIDAS: string[] = [
  "Abacaxi", "Abóbora", "Abobrinha", "Acerola", "Agrião", "Alecrim",
  "Alface", "Alface Roxo", "Alho", "Alho poró", "Amora", "Banana",
  "Batata doce", "Batata roxa", "Beldroega", "Berinjela", "Beterraba",
  "Boldo", "Bredo", "Cana", "Cebolinha", "Cenoura", "Coentro", "Couve",
  "Curry", "Erva doce", "Espinafre", "Feijão", "Goiaba", "Graviola",
  "Hortelã", "Jaboticaba", "Jiló", "Laranja", "Limão", "Macaxeira",
  "Mamão", "Manjericão", "Maracujá", "Maxixe", "Melancia", "Melissa",
  "Melão", "Menta", "Milho", "Mirra", "Morango", "Pepino", "Pimenta",
  "Pimentão", "Pinha", "Pitaia", "Pitanga", "Quiabo", "Quiabo estrela",
  "Rabanete", "Repolho", "Rúcula", "Salsa", "Salsão", "Taioba",
  "Tomate", "Tomate Cereja", "Vagem",
];

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    // eslint-disable-next-line no-misleading-character-class -- intencional: remove marcas diacríticas combinantes (acentos) após normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Distância de Levenshtein (número mínimo de edições — inserir, remover,
// trocar uma letra — pra transformar uma palavra na outra). Implementação
// simples própria: não vale a pena adicionar uma biblioteca só pra isso,
// e a lista de referência é pequena o bastante (~60 nomes curtos) pra não
// pesar rodando a cada tecla digitada.
function distanciaLevenshtein(a: string, b: string): number {
  const linhas = a.length + 1;
  const colunas = b.length + 1;
  const dp: number[][] = Array.from({ length: linhas }, () => new Array(colunas).fill(0));

  for (let i = 0; i < linhas; i++) dp[i][0] = i;
  for (let j = 0; j < colunas; j++) dp[0][j] = j;

  for (let i = 1; i < linhas; i++) {
    for (let j = 1; j < colunas; j++) {
      const custoTroca = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // remover
        dp[i][j - 1] + 1, // inserir
        dp[i - 1][j - 1] + custoTroca, // trocar (ou manter, se custo 0)
      );
    }
  }

  return dp[linhas - 1][colunas - 1];
}

// Devolve o nome conhecido mais parecido com o que foi digitado, se
// houver um parecido o bastante — senão devolve null (não força sugestão
// nenhuma). O limite de distância é deliberadamente conservador (cresce
// devagar com o tamanho da palavra): é melhor deixar de sugerir um typo
// óbvio do que sugerir errado — ex.: "abacate" não pode virar "Abacaxi"
// só porque as palavras se parecem, senão a sugestão engana em vez de
// ajudar. Por isso mesmo a sugestão nunca substitui sozinha: é sempre uma
// pergunta ("Quis dizer X?") que a pessoa aceita ou ignora.
export function sugerirCorrecaoCultura(digitado: string): string | null {
  const alvo = normalizarTexto(digitado);
  if (alvo.length < 3) return null;

  let melhor: { nome: string; distancia: number } | null = null;

  for (const nome of CULTURAS_CONHECIDAS) {
    const candidato = normalizarTexto(nome);
    if (candidato === alvo) return null; // já bateu certinho — sem sugestão

    const distancia = distanciaLevenshtein(alvo, candidato);
    const limite = Math.min(3, Math.max(1, Math.floor(alvo.length / 4)));
    if (distancia <= limite && (!melhor || distancia < melhor.distancia)) {
      melhor = { nome, distancia };
    }
  }

  return melhor?.nome ?? null;
}
