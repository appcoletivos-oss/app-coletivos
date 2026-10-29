// Lançar a semana (Sprint B, item B5 — SPRINT_B_RELATO_DO_TURNO.md, seção 7):
// prompt, schema e pós-processamento da mensagem de escala + planejamento.
//
// Divisão de trabalho:
//   * A IA só ESTRUTURA o texto: em que dia/turno está cada nome e cada
//     atividade, como escrito. Ela não recebe a lista de membros e não
//     escolhe pessoa nenhuma.
//   * O servidor (este arquivo, código puro e testável) faz o resto:
//     dia da semana -> data da semana escolhida, aviso de data divergente,
//     casamento de nome com membro (sem adivinhar), limpeza dos marcadores
//     e "sem expediente".
// Assim a regra "nunca adivinhar pessoa" não depende do modelo.

import type { DiaSemanaTexto, LinhaAtividadeSemana, LinhaEscalaSemana, SemanaInterpretada } from "../lancar-semana";

// Uma semana inteira (Caso 6 do Apêndice) tem ~2.000 caracteres.
export const LIMITE_TEXTO_SEMANA = 12000;

// -----------------------------------------------------------------------------
// O que a IA devolve
// -----------------------------------------------------------------------------

const DIAS: DiaSemanaTexto[] = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];

export interface SaidaIASemana {
  escala: {
    dia_semana: DiaSemanaTexto;
    turno: "manha" | "tarde";
    nomes: string[];
    dia_no_texto: number | null;
    mes_no_texto: number | null;
  }[];
  folgas: {
    dia_semana: DiaSemanaTexto;
    nomes: string[];
  }[];
  atividades: {
    dia_semana: DiaSemanaTexto;
    turno: "manha" | "tarde";
    descricao: string;
  }[];
  avisos: string[];
}

const DIA_NULAVEL = { anyOf: [{ type: "integer" }, { type: "null" }] };

export const SCHEMA_SEMANA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["escala", "folgas", "atividades", "avisos"],
  properties: {
    escala: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dia_semana", "turno", "nomes", "dia_no_texto", "mes_no_texto"],
        properties: {
          dia_semana: { type: "string", enum: DIAS },
          turno: { type: "string", enum: ["manha", "tarde"] },
          nomes: { type: "array", items: { type: "string" } },
          dia_no_texto: DIA_NULAVEL,
          mes_no_texto: DIA_NULAVEL,
        },
      },
    },
    folgas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dia_semana", "nomes"],
        properties: {
          dia_semana: { type: "string", enum: DIAS },
          nomes: { type: "array", items: { type: "string" } },
        },
      },
    },
    atividades: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dia_semana", "turno", "descricao"],
        properties: {
          dia_semana: { type: "string", enum: DIAS },
          turno: { type: "string", enum: ["manha", "tarde"] },
          descricao: { type: "string" },
        },
      },
    },
    avisos: { type: "array", items: { type: "string" } },
  },
};

export const SISTEMA_SEMANA = `Você organiza a mensagem semanal que a coordenação de um pátio de compostagem e horta comunitária manda no WhatsApp. A mensagem tem a escala da equipe (quem trabalha em cada dia e turno), as folgas e a lista de atividades planejadas por dia e turno.

Sua única tarefa é transcrever a mensagem para o JSON pedido, sem interpretar além do que está escrito.

Regras:
1. dia_semana vem do NOME do dia escrito no texto (Segunda, Terça-feira, Quarta, Quinta-feira, Sexta...), nunca do número do dia. Sem acento e minúsculo: segunda, terca, quarta, quinta, sexta, sabado, domingo.
2. Turno: "Manhã" = manha, "Tarde" = tarde.
3. escala: uma entrada por dia e turno que tenha pessoas. Em "nomes", ponha cada pessoa separada (a mensagem separa por vírgula e por " e "), exatamente como escrita. Se o turno diz "Sem expediente", NÃO crie entrada de escala para ele.
4. dia_no_texto e mes_no_texto: o número do dia e do mês que o texto atribui àquele dia da escala (ex.: "Dia 26 (Segunda)" num texto que começa "Escala de 26 a 30_9" = dia 26, mês 9). Se o texto não diz o número, use null. Não calcule datas.
5. folgas: da seção "Folgas", uma entrada por dia, com os nomes como escritos (ex.: "Terca: C" = dia terca, nomes ["C"]).
6. atividades: uma entrada por item de lista (marcador •, -, * ou linha própria) dentro de cada dia e turno. Copie o texto do item exatamente como está, inclusive erros de digitação e palavras como "Possível"/"Possivel"; só tire o marcador do começo e o ";" ou "." do fim. Não junte, não divida, não reescreva, não corrija. Se o turno diz "Sem expediente", NÃO crie atividade para ele.
7. Nunca invente dia, turno, pessoa ou atividade. O que não estiver no texto fica de fora.
8. avisos: frases curtas em português só quando algo do texto não couber nas regras acima (ex.: um dia citado sem turno). Caso contrário, lista vazia.`;

export function montarPedidoSemana(texto: string): string {
  return `Mensagem da coordenação:\n\n${texto}`;
}

// -----------------------------------------------------------------------------
// Pós-processamento (servidor)
// -----------------------------------------------------------------------------

export interface MembroParaCasar {
  id: string;
  nome: string;
}

const OFFSET_DIA: Record<DiaSemanaTexto, number> = {
  segunda: 0,
  terca: 1,
  quarta: 2,
  quinta: 3,
  sexta: 4,
  sabado: 5,
  domingo: 6,
};

export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function somarDias(segundaISO: string, dias: number): string {
  const [a, m, d] = segundaISO.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d + dias));
  return data.toISOString().slice(0, 10);
}

function ddmm(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// Separa "A, B e C" (a IA já deveria separar; aqui é a garantia).
function separarNomes(nomes: string[]): string[] {
  return nomes
    .flatMap((n) => n.split(/,|\s+e\s+/i))
    .map((n) => n.replace(/[.;:]+$/g, "").trim())
    .filter((n) => n.length > 0 && normalizarTexto(n) !== "sem expediente");
}

// Regra 4 da seção 7: casa o primeiro nome ignorando maiúsculas e acentos,
// só entre os membros ativos. Sem correspondência ÚNICA = null.
//   1. nome do texto igual ao nome completo de exatamente um membro;
//   2. senão, primeiro nome do texto igual ao primeiro nome de exatamente
//      um membro.
// Grafia parecida (Tiago x Thiago) não casa: vai pra escolha da coordenação.
export function casarMembro(nomeNoTexto: string, membros: MembroParaCasar[]): string | null {
  const alvo = normalizarTexto(nomeNoTexto);
  if (!alvo) return null;

  const completos = membros.filter((m) => normalizarTexto(m.nome) === alvo);
  if (completos.length === 1) return completos[0].id;
  if (completos.length > 1) return null;

  const primeiro = alvo.split(" ")[0];
  const porPrimeiro = membros.filter((m) => normalizarTexto(m.nome).split(" ")[0] === primeiro);
  return porPrimeiro.length === 1 ? porPrimeiro[0].id : null;
}

function limparAtividade(descricao: string): string {
  return descricao
    .trim()
    .replace(/^[•\-*–·]+\s*/, "")
    .replace(/[;.]+\s*$/, "")
    .trim();
}

export function posProcessarSemana(
  saida: SaidaIASemana,
  segundaISO: string,
  membros: MembroParaCasar[],
): Omit<SemanaInterpretada, "log_id"> {
  const avisos: string[] = [];
  // data real -> "DD/MM" que o texto diz, um por dia divergente
  const datasDivergentes = new Map<string, string>();

  const escala: LinhaEscalaSemana[] = [];
  for (const bloco of saida.escala ?? []) {
    if (!(bloco.dia_semana in OFFSET_DIA)) continue;
    const data = somarDias(segundaISO, OFFSET_DIA[bloco.dia_semana]);

    // Regra 1: o dia da semana manda; número divergente só gera aviso.
    const [, mesReal, diaReal] = data.split("-").map(Number);
    const diaTexto = bloco.dia_no_texto;
    const mesTexto = bloco.mes_no_texto;
    if ((diaTexto != null && diaTexto !== diaReal) || (mesTexto != null && mesTexto !== mesReal)) {
      const textoDiz = `${String(diaTexto ?? diaReal).padStart(2, "0")}/${String(mesTexto ?? mesReal).padStart(2, "0")}`;
      datasDivergentes.set(data, textoDiz);
    }

    for (const nome of separarNomes(bloco.nomes ?? [])) {
      const membroId = casarMembro(nome, membros);
      escala.push({
        data,
        turno: bloco.turno,
        tipo: "turno_trabalho",
        membro_id: membroId,
        nome_no_texto: nome,
        pessoa_status: membroId ? "certo" : "faltando",
      });
    }
  }

  for (const bloco of saida.folgas ?? []) {
    if (!(bloco.dia_semana in OFFSET_DIA)) continue;
    const data = somarDias(segundaISO, OFFSET_DIA[bloco.dia_semana]);
    for (const nome of separarNomes(bloco.nomes ?? [])) {
      const membroId = casarMembro(nome, membros);
      escala.push({
        data,
        turno: "dia_todo",
        tipo: "folga",
        membro_id: membroId,
        nome_no_texto: nome,
        pessoa_status: membroId ? "certo" : "faltando",
      });
    }
  }

  const atividades: LinhaAtividadeSemana[] = [];
  for (const item of saida.atividades ?? []) {
    if (!(item.dia_semana in OFFSET_DIA)) continue;
    const descricao = limparAtividade(item.descricao ?? "");
    if (!descricao || normalizarTexto(descricao) === "sem expediente") continue;
    atividades.push({
      data: somarDias(segundaISO, OFFSET_DIA[item.dia_semana]),
      turno: item.turno,
      descricao,
    });
  }

  // Um aviso só: "O texto diz 26/09 a 30/09, a semana escolhida é 29/09 a 03/10."
  if (datasDivergentes.size > 0) {
    const reais = [...datasDivergentes.keys()].sort();
    const primeira = reais[0];
    const ultima = reais[reais.length - 1];
    const textoDiz =
      reais.length === 1
        ? datasDivergentes.get(primeira)
        : `${datasDivergentes.get(primeira)} a ${datasDivergentes.get(ultima)}`;
    const escolhida = reais.length === 1 ? ddmm(primeira) : `${ddmm(primeira)} a ${ddmm(ultima)}`;
    avisos.push(`O texto diz ${textoDiz}, a semana escolhida é ${escolhida}. Valeu o dia da semana escrito.`);
  }
  for (const a of saida.avisos ?? []) if (a.trim()) avisos.push(a.trim());

  const semPessoa = escala.filter((l) => !l.membro_id).length;
  if (semPessoa > 0) {
    avisos.unshift(
      semPessoa === 1
        ? "1 nome não casou com ninguém da equipe: escolha a pessoa na linha marcada."
        : `${semPessoa} nomes não casaram com ninguém da equipe: escolha a pessoa nas linhas marcadas.`,
    );
  }

  const ordem = (l: { data: string; turno: string }) => `${l.data}|${l.turno === "manha" ? 0 : l.turno === "tarde" ? 1 : 2}`;
  escala.sort((a, b) => ordem(a).localeCompare(ordem(b)));
  atividades.sort((a, b) => ordem(a).localeCompare(ordem(b)));

  return { escala, atividades, avisos };
}
