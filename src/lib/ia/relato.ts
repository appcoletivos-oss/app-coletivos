// Relato do turno com IA (Sprint B, item B3 — SPRINT_B_RELATO_DO_TURNO.md
// seção 5 e SPRINT_B2_HOME_RELATO_FILA.md seção 3): prompt, schema e
// pós-processamento, no mesmo padrão de ./semana.ts.
//
// Divisão de trabalho (B2, seção 3.1):
//   * A IA só ESTRUTURA o texto: separa as atividades por tipo e devolve
//     lojas, caixas, canteiros, culturas e carrinhos COMO ESTÃO ESCRITOS.
//     Ela recebe só o texto, a data/turno e o checklist (id + descrição);
//     não recebe cadastro nenhum e não escolhe id nenhum, fora o do
//     checklist (que é conferido aqui).
//   * O servidor (este arquivo, código puro e testável sem IA) casa cada
//     referência com o cadastro ativo, sem adivinhar (zero ou mais de uma
//     correspondência = faltando), converte gramas em kg, confere soma ×
//     total (tolerância 0,05 kg) e monta campos_status/avisos.
//
// Sem import de valor de nada que fale com o Supabase: o script
// scripts/ia/relato.ts roda este arquivo direto no Node.

import { calcularPesoCarrinho } from "../carrinhos";
import { normalizarTexto } from "./semana";
import type {
  AcaoManejoRelato,
  BombonaRelato,
  CadastrosRelato,
  DadosChecklist,
  DadosColheita,
  DadosCompostagem,
  DadosDoacao,
  DadosManejo,
  DadosPlantio,
  ItemRelato,
  StatusCampo,
  TipoItemRelato,
} from "../relato";

export const LIMITE_TEXTO_RELATO_SERVIDOR = 8000;
export const TETO_DIARIO_IA = 30;

// -----------------------------------------------------------------------------
// O que a IA devolve
// -----------------------------------------------------------------------------

export interface PesoNoTexto {
  valor: number;
  unidade: "kg" | "g";
}

export interface ItemSaidaIA {
  tipo: TipoItemRelato;
  trecho_origem: string;
  descricao: string;
  observacao: string | null;
  item_planejado_id: string | null;
  loja_no_texto: string | null;
  qtd_bombonas: number | null;
  peso_total: PesoNoTexto | null;
  bombonas: { numero: string | null; peso: PesoNoTexto | null; observacao: string | null }[];
  caixas_no_texto: number[];
  peso_por_caixa: { caixa: number; peso: PesoNoTexto }[];
  cultura_no_texto: string | null;
  canteiros_no_texto: string[];
  canteiro_inferido: boolean;
  quantidade: number | null;
  unidade: string | null;
  peso: PesoNoTexto | null;
  acao_manejo: AcaoManejoRelato | "" | null;
  quantidade_carrinhos: number | null;
  tipo_carrinho_no_texto: string | null;
  natureza_doacao: "alimento" | "muda" | "nao_dito" | null;
  destino: string | null;
}

export interface SaidaIARelato {
  itens: ItemSaidaIA[];
  total_geral_compostagem: PesoNoTexto | null;
  datas_no_texto: { dia: number; mes: number | null }[];
  observacoes: string[];
  avisos: string[];
}

// A saída estruturada aceita no máximo 16 campos com união (anyOf/null).
// Por isso texto ausente vem como "" (o pós-processamento trata "" como
// nulo, ver limpo()) e só números e pesos são nuláveis.
const NULO = { type: "null" };
const TEXTO_OU_VAZIO = { type: "string" };
const NUMERO_NULAVEL = { anyOf: [{ type: "number" }, NULO] };
const PESO = {
  type: "object",
  additionalProperties: false,
  required: ["valor", "unidade"],
  properties: {
    valor: { type: "number" },
    unidade: { type: "string", enum: ["kg", "g"] },
  },
};
const PESO_NULAVEL = { anyOf: [PESO, NULO] };

const TIPOS: TipoItemRelato[] = ["checklist", "compostagem", "plantio", "colheita", "manejo", "doacao", "ronda"];

const CAMPOS_ITEM = {
  tipo: { type: "string", enum: TIPOS },
  trecho_origem: { type: "string" },
  descricao: { type: "string" },
  observacao: TEXTO_OU_VAZIO,
  item_planejado_id: TEXTO_OU_VAZIO,
  loja_no_texto: TEXTO_OU_VAZIO,
  qtd_bombonas: NUMERO_NULAVEL,
  peso_total: PESO_NULAVEL,
  bombonas: {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      required: ["numero", "peso", "observacao"],
      properties: { numero: TEXTO_OU_VAZIO, peso: PESO_NULAVEL, observacao: TEXTO_OU_VAZIO },
    },
  },
  caixas_no_texto: { type: "array", items: { type: "integer" } },
  peso_por_caixa: {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      required: ["caixa", "peso"],
      properties: { caixa: { type: "integer" }, peso: PESO },
    },
  },
  cultura_no_texto: TEXTO_OU_VAZIO,
  canteiros_no_texto: { type: "array", items: { type: "string" } },
  canteiro_inferido: { type: "boolean" },
  quantidade: NUMERO_NULAVEL,
  unidade: TEXTO_OU_VAZIO,
  peso: PESO_NULAVEL,
  acao_manejo: { type: "string", enum: ["", "composto", "poda_triturada", "poda_planta", "outro"] },
  quantidade_carrinhos: NUMERO_NULAVEL,
  tipo_carrinho_no_texto: TEXTO_OU_VAZIO,
  natureza_doacao: { type: "string", enum: ["alimento", "muda", "nao_dito"] },
  destino: TEXTO_OU_VAZIO,
};

export const SCHEMA_RELATO: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["itens", "total_geral_compostagem", "datas_no_texto", "observacoes", "avisos"],
  properties: {
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: Object.keys(CAMPOS_ITEM),
        properties: CAMPOS_ITEM,
      },
    },
    total_geral_compostagem: PESO_NULAVEL,
    datas_no_texto: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dia", "mes"],
        properties: { dia: { type: "integer" }, mes: { anyOf: [{ type: "integer" }, NULO] } },
      },
    },
    observacoes: { type: "array", items: { type: "string" } },
    avisos: { type: "array", items: { type: "string" } },
  },
};

export const SISTEMA_RELATO = `Você organiza o relato de fim de turno da equipe de um pátio de compostagem e horta comunitária. A pessoa colou ou ditou um texto contando o que foi feito. Sua tarefa é separar o texto em itens no JSON pedido, sem inventar nada.

Tipos de item:
- checklist: atividade de rotina (rega, irrigação, limpeza, organização, peneiração, troca de água, revolvimento, instalação, produção de mudas sem quantidade e local etc.).
- compostagem: resíduo de UMA loja alimentado nas caixas. Um item por loja. loja_no_texto = nome da loja como escrito; qtd_bombonas; peso_total = peso da loja; caixas_no_texto = números das caixas alimentadas (se o texto diz "nas caixas 1 e 2" para todas as lojas, repita [1, 2] em cada loja); peso_por_caixa só se o texto disser quanto foi em cada caixa; bombonas = cada bombona citada com número (como escrito, ex.: "103") e peso. Se o texto lista bombonas por número sem loja, faça UM item de compostagem com loja_no_texto null e todas as bombonas. Observação de uma bombona (ex.: "veio com bastante líquido") vai em bombonas[].observacao.
- plantio: cultura_no_texto, quantidade, unidade como escrita no singular (muda, fileira, cova, semente...), canteiros_no_texto com o local. Um item por cultura.
- colheita: cultura_no_texto e peso (valor e unidade como escritos, "0,200 kg" = 0.2 kg, "700 g" = 700 g). Um item por cultura.
- manejo: acao_manejo = composto (aplicação de composto), poda_triturada (poda triturada aplicada em canteiro), poda_planta (poda de uma planta; um item por cultura, com cultura_no_texto) ou outro; quantidade_carrinhos e tipo_carrinho_no_texto quando houver carrinho; canteiros_no_texto.
- doacao: cultura_no_texto, quantidade, unidade, destino. natureza_doacao = "muda" se o texto diz muda(s) para aquela cultura, "alimento" se diz que é alimento/colheita, senão "nao_dito". Um item por cultura. Em "Doações: mudas de pimenta, bredo, pimenta de cheiro", só "pimenta" está dito como muda; os outros são "nao_dito".
- ronda: ronda observativa e o que foi observado (descricao com o que foi visto).

Campos de todo item: trecho_origem = o pedaço exato do texto de onde saiu o item; descricao = a atividade como está no texto, curta, sem reescrever; observacao = motivo ou detalhe dito junto (ex.: "faltou água"), senão null; item_planejado_id = o id do item do checklist que corresponde claramente à atividade, senão null (vale também para compostagem, plantio etc. quando houver item do checklist igual, como "Compostagem"). Campos que não se aplicam ao tipo ou que o texto não diz: texto = "" (vazio), número/peso = null, lista = [], booleano = false, acao_manejo = "", natureza_doacao = "nao_dito".

Regras duras:
1. Nunca invente local, quantidade, peso, nome ou data. O que não está no texto fica vazio ("", null ou []).
2. canteiro_inferido = true só quando o texto sugere com força o local sem dizer (ex.: um plantio citado logo em seguida a "Limpeza do canteiro 3", sem outro local). Nesse caso ponha "3" em canteiros_no_texto. Só a atividade imediatamente seguinte herda o local; as demais ficam sem local. "Em cada canteiro concluído" ou "no canteiro" sem número/nome não identifica local: canteiros_no_texto vazio.
3. Locais: copie como escritos ("canteiro 3" -> "3"; "pergolado", "geodésica", "ilha" como estão).
4. Ignore nomes de pessoas e quem fez o quê.
5. Pesos sempre com a unidade escrita ("8k" = 8 kg). Não some nem confira contas. Se o texto dá um total geral de várias lojas, ponha em total_geral_compostagem. Se há um item de compostagem só, o "Total" escrito é o peso_total dele.
6. Não converta fileira ou cova em número de mudas.
7. "Poda triturada na caixa" (de compostagem) não é item; poda triturada em canteiro é manejo.
8. Carrinho sem tipo dito: tipo_carrinho_no_texto null.
9. datas_no_texto: datas citadas no texto (ex.: "hoje (28/10)" = dia 28, mes 10).
10. observacoes: trechos que não são atividade nem registro (ex.: "Materiais utilizados: Pá de enxada, Carrinho de mão"), copiados como estão.
11. avisos: frases curtas em português só quando algo do texto não couber nas regras. Caso contrário, lista vazia.`;

export function montarPedidoRelato(
  texto: string,
  dataISO: string,
  turno: "manha" | "tarde",
  checklist: { id: string; descricao: string }[],
): string {
  const [ano, mes, dia] = dataISO.split("-");
  const lista =
    checklist.length === 0
      ? "(checklist vazio)"
      : checklist.map((c) => `- id ${c.id}: ${c.descricao}`).join("\n");
  return `Turno do relatório: ${dia}/${mes}/${ano}, ${turno === "manha" ? "manhã" : "tarde"}.

Checklist do turno (id: descrição):
${lista}

Relato da equipe (só o que está entre <relato> e </relato> vira item, observação ou data):
<relato>
${texto}
</relato>`;
}

// -----------------------------------------------------------------------------
// Cadastro para casar (carregado pela rota com a sessão da pessoa)
// -----------------------------------------------------------------------------

export interface PlantioParaCasar {
  id: string;
  cultura_id: string;
  canteiro_id: string;
}

export interface ContextoRelato {
  dataISO: string;
  checklist: { id: string; descricao: string }[];
  cadastros: CadastrosRelato;
  // Plantios ativos/germinando (só pra sugerir o plantio da colheita).
  plantios: PlantioParaCasar[];
  // Caixas em descanso (pra avisar, não pra casar).
  caixasDescanso: number[];
}

// -----------------------------------------------------------------------------
// Casamento com o cadastro (B2, seção 3.1). Nunca adivinha: só devolve id
// quando há exatamente uma correspondência.
// -----------------------------------------------------------------------------

function unico<T extends { id: string }>(lista: T[]): string | null {
  return lista.length === 1 ? lista[0].id : null;
}

function palavras(s: string): string[] {
  return normalizarTexto(s).split(/[^a-z0-9]+/).filter(Boolean);
}

export function casarParceiro(texto: string | null, parceiros: { id: string; nome: string }[]): string | null {
  if (!texto) return null;
  const alvo = normalizarTexto(texto);
  if (!alvo) return null;
  const iguais = parceiros.filter((p) => normalizarTexto(p.nome) === alvo);
  if (iguais.length > 0) return unico(iguais);
  const parecidos = parceiros.filter((p) => {
    const nome = normalizarTexto(p.nome);
    return nome.startsWith(alvo) || palavras(p.nome).some((w) => w.startsWith(alvo)) || (alvo.length >= 4 && nome.includes(alvo));
  });
  return unico(parecidos);
}

// Regra 10: número casa com o canteiro cujo nome tem esse número como
// palavra; apelido (Ilha, Pergolado, Geodésica...) só com um único
// canteiro de nome ou tipo correspondente. Devolve os candidatos: 0 =
// não cadastrado, 1 = casou, mais de 1 = ambíguo (pergunta).
export function candidatosCanteiro<T extends { id: string; nome: string; tipo: string }>(texto: string, canteiros: T[]): T[] {
  const alvo = normalizarTexto(texto).replace(/^(o |a |no |na )/, "").replace(/^canteiros? /, "").trim();
  if (!alvo) return [];
  const iguais = canteiros.filter((c) => normalizarTexto(c.nome) === alvo);
  if (iguais.length > 0) return iguais;

  if (/^\d+$/.test(alvo)) return canteiros.filter((c) => palavras(c.nome).includes(alvo));
  const semPlural = alvo.replace(/s$/, "");
  const porNome = canteiros.filter((c) => {
    const nome = normalizarTexto(c.nome);
    return nome.includes(alvo) || palavras(c.nome).includes(semPlural);
  });
  if (porNome.length > 0) return porNome;
  return canteiros.filter((c) => normalizarTexto(c.tipo.replace(/_/g, " ")) === semPlural);
}

export function casarCanteiro(texto: string, canteiros: { id: string; nome: string; tipo: string }[]): string | null {
  return unico(candidatosCanteiro(texto, canteiros));
}

// Igual ou prefixo único. Candidatos com a mesma regra de 0/1/vários.
export function candidatosCultura<T extends { id: string; nome: string }>(texto: string | null, culturas: T[]): T[] {
  if (!texto) return [];
  const alvo = normalizarTexto(texto);
  if (!alvo) return [];
  const iguais = culturas.filter((c) => normalizarTexto(c.nome) === alvo);
  if (iguais.length > 0) return iguais;
  return culturas.filter((c) => normalizarTexto(c.nome).startsWith(alvo));
}

export function casarCultura(texto: string | null, culturas: { id: string; nome: string }[]): string | null {
  return unico(candidatosCultura(texto, culturas));
}

const NOME_CARRINHO_PADRAO = "carrinho azul";

function casarCarrinho(
  texto: string | null,
  tipos: CadastrosRelato["tipos_carrinho"],
): { id: string | null; assumido: boolean } {
  if (texto) {
    const alvo = normalizarTexto(texto);
    const achados = tipos.filter((t) => {
      const nome = normalizarTexto(t.nome);
      return nome === alvo || nome.includes(alvo) || alvo.includes(nome);
    });
    return { id: unico(achados), assumido: false };
  }
  const padrao = tipos.find((t) => normalizarTexto(t.nome) === NOME_CARRINHO_PADRAO);
  return { id: padrao?.id ?? null, assumido: true };
}

// -----------------------------------------------------------------------------
// Contas (regra 6: no servidor, nunca no modelo)
// -----------------------------------------------------------------------------

const TOLERANCIA_KG = 0.05;

export function pesoEmKg(peso: PesoNoTexto | null | undefined): number | null {
  if (!peso || typeof peso.valor !== "number" || !Number.isFinite(peso.valor) || peso.valor < 0) return null;
  const kg = peso.unidade === "g" ? peso.valor / 1000 : peso.valor;
  return Math.round(kg * 1000) / 1000;
}

function kgTexto(kg: number): string {
  return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`;
}

function arredondar(kg: number): number {
  return Math.round(kg * 1000) / 1000;
}

function ddmm(dia: number, mes: number): string {
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

// -----------------------------------------------------------------------------
// Pós-processamento
// -----------------------------------------------------------------------------

function limpo(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t ? t : null;
}

function quantidadeValida(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

// Nome dito e nenhum parecido no cadastro = nao_cadastrado (a pessoa
// escolhe uma que existe ou segue com o nome cru; a coordenação decide).
// Sem nome, ou mais de uma parecida = faltando.
function resolverCultura(texto: string | null, ctx: ContextoRelato): { id: string | null; status: StatusCampo } {
  if (!texto) return { id: null, status: "faltando" };
  const candidatos = candidatosCultura(texto, ctx.cadastros.culturas);
  if (candidatos.length === 1) return { id: candidatos[0].id, status: "certo" };
  return { id: null, status: candidatos.length === 0 ? "nao_cadastrado" : "faltando" };
}

function processarCompostagem(item: ItemSaidaIA, ctx: ContextoRelato, avisos: string[]): Omit<ItemRelato, "chave"> {
  const { cadastros } = ctx;
  const status: Record<string, StatusCampo> = {};

  const lojaTexto = limpo(item.loja_no_texto);
  const parceiroId = casarParceiro(lojaTexto, cadastros.parceiros);
  status.parceiro_id = parceiroId ? "certo" : "faltando";
  if (lojaTexto && !parceiroId) avisos.push(`Loja "${lojaTexto}" não casou com uma loja ativa: escolha a loja.`);

  const bombonas: BombonaRelato[] = (item.bombonas ?? []).map((b) => ({
    numero: limpo(b.numero),
    peso_kg: pesoEmKg(b.peso),
    observacao: limpo(b.observacao),
  }));
  const numeros = bombonas.map((b) => b.numero).filter((n): n is string => !!n);
  const repetidos = [...new Set(numeros.filter((n, i) => numeros.indexOf(n) !== i))];
  if (repetidos.length > 0) avisos.push(`Bombona ${repetidos.join(", ")} aparece mais de uma vez nesta coleta.`);

  let qtd = quantidadeValida(item.qtd_bombonas);
  status.qtd_bombonas = qtd ? "certo" : "faltando";
  if (!qtd && bombonas.length > 0) {
    qtd = bombonas.length;
    status.qtd_bombonas = "inferido";
  }

  // Peso total × soma das bombonas.
  const totalEscrito = pesoEmKg(item.peso_total);
  const pesosBombonas = bombonas.map((b) => b.peso_kg);
  const somaBombonas =
    pesosBombonas.length > 0 && pesosBombonas.every((p) => p !== null)
      ? arredondar(pesosBombonas.reduce<number>((s, p) => s + (p ?? 0), 0))
      : null;

  let pesoTotal: number | null = totalEscrito;
  let opcoes: number[] = [];
  status.peso_total_kg = totalEscrito !== null && totalEscrito > 0 ? "certo" : "faltando";
  if (totalEscrito !== null && somaBombonas !== null && Math.abs(somaBombonas - totalEscrito) > TOLERANCIA_KG) {
    avisos.push(`Soma ${kgTexto(somaBombonas)}, total escrito ${kgTexto(totalEscrito)}.`);
    pesoTotal = null;
    opcoes = [somaBombonas, totalEscrito];
    status.peso_total_kg = "faltando";
  } else if (totalEscrito === null && somaBombonas !== null && somaBombonas > 0) {
    pesoTotal = somaBombonas;
    status.peso_total_kg = "inferido";
    avisos.push(`Total não escrito: usei a soma das bombonas (${kgTexto(somaBombonas)}).`);
  }
  if (pesoTotal !== null && pesoTotal <= 0) pesoTotal = null;

  // Caixas por número.
  const numerosCaixa = [...new Set(item.caixas_no_texto ?? [])];
  const caixaIds: string[] = [];
  const caixasNumeros: number[] = [];
  for (const n of numerosCaixa) {
    const caixa = cadastros.caixas.find((c) => c.numero === n);
    if (caixa) {
      caixaIds.push(caixa.id);
      caixasNumeros.push(n);
    } else if (ctx.caixasDescanso.includes(n)) {
      avisos.push(`A caixa ${n} está em descanso: confira a caixa.`);
    } else {
      avisos.push(`Caixa ${n} não existe no cadastro (ou não está ativa).`);
    }
  }
  status.caixas = caixaIds.length > 0 && caixaIds.length === numerosCaixa.length ? "certo" : "faltando";

  // Peso por caixa: só quando o texto disse, e tem que fechar com o total.
  let pesoPorCaixa: DadosCompostagem["peso_por_caixa"] = null;
  if ((item.peso_por_caixa ?? []).length > 0) {
    const linhas = item.peso_por_caixa
      .map((p) => ({ caixa: cadastros.caixas.find((c) => c.numero === p.caixa), kg: pesoEmKg(p.peso) }))
      .filter((l): l is { caixa: { id: string; numero: number }; kg: number } => !!l.caixa && l.kg !== null && l.kg > 0);
    const soma = arredondar(linhas.reduce((s, l) => s + l.kg, 0));
    if (pesoTotal !== null && Math.abs(soma - pesoTotal) > TOLERANCIA_KG) {
      avisos.push(`Soma por caixa ${kgTexto(soma)}, total da loja ${kgTexto(pesoTotal)}.`);
    } else if (linhas.length > 0) {
      pesoPorCaixa = linhas.map((l) => ({ caixa_id: l.caixa.id, peso_kg: l.kg }));
    }
  }
  if (caixaIds.length <= 1) status.divisao_caixas = caixaIds.length === 1 ? "certo" : "faltando";
  else status.divisao_caixas = pesoPorCaixa ? "certo" : "faltando";

  const dados: DadosCompostagem = {
    parceiro_id: parceiroId,
    loja_no_texto: lojaTexto,
    qtd_bombonas: qtd,
    peso_total_kg: pesoTotal,
    peso_total_opcoes: opcoes,
    caixa_ids: caixaIds,
    caixas_numeros: caixasNumeros,
    peso_por_caixa: pesoPorCaixa,
    bombonas,
    observacao: limpo(item.observacao),
  };
  return { tipo: "compostagem", trecho_origem: item.trecho_origem, item_planejado_id: null, dados, campos_status: status, avisos };
}

// Canteiro único do item (plantio/colheita). Mais de um local citado = faltando.
function resolverCanteiroUnico(
  item: ItemSaidaIA,
  ctx: ContextoRelato,
  avisos: string[],
): { id: string | null; texto: string | null; status: StatusCampo } {
  const textos = (item.canteiros_no_texto ?? []).map((t) => t.trim()).filter(Boolean);
  if (textos.length === 0) return { id: null, texto: null, status: "faltando" };
  if (textos.length > 1) {
    avisos.push(`Mais de um local citado (${textos.join(", ")}): escolha o canteiro.`);
    return { id: null, texto: textos.join(", "), status: "faltando" };
  }
  const candidatos = candidatosCanteiro(textos[0], ctx.cadastros.canteiros);
  if (candidatos.length === 0) return { id: null, texto: textos[0], status: "nao_cadastrado" };
  if (candidatos.length > 1) {
    avisos.push(`"${textos[0]}" serve pra mais de um canteiro: escolha o canteiro.`);
    return { id: null, texto: textos[0], status: "faltando" };
  }
  const id = candidatos[0].id;
  return { id, texto: textos[0], status: item.canteiro_inferido ? "inferido" : "certo" };
}

const UNIDADES_DE_PLANTA = new Set(["muda", "mudas", "semente", "sementes", "planta", "plantas", "pe", "pes"]);

function processarPlantio(item: ItemSaidaIA, ctx: ContextoRelato, avisos: string[]): Omit<ItemRelato, "chave"> {
  const status: Record<string, StatusCampo> = {};
  const culturaTexto = limpo(item.cultura_no_texto);
  const cultura = resolverCultura(culturaTexto, ctx);
  const culturaId = cultura.id;
  status.cultura_id = cultura.status;

  const canteiro = resolverCanteiroUnico(item, ctx, avisos);
  status.canteiro_id = canteiro.status;

  const quantidade = quantidadeValida(item.quantidade);
  status.quantidade = quantidade ? "certo" : "faltando";
  const unidade = limpo(item.unidade);
  status.unidade = unidade ? "certo" : "faltando";
  // Regra 7: fileira/cova ficam como estão; o número de mudas não foi dito.
  if (unidade && !UNIDADES_DE_PLANTA.has(normalizarTexto(unidade))) {
    status.quantidade_mudas = "faltando";
    avisos.push(`Quantidade em mudas não informada (${quantidade ?? "?"} ${unidade}).`);
  }

  const unidadeNorm = normalizarTexto(unidade ?? "");
  const origem = unidadeNorm.startsWith("semente") ? "semente" : unidadeNorm.startsWith("muda") ? "muda_comprada" : null;
  status.origem = origem ? "certo" : "faltando";

  const dados: DadosPlantio = {
    cultura_id: culturaId,
    cultura_no_texto: culturaTexto,
    canteiro_id: canteiro.id,
    canteiro_no_texto: canteiro.texto,
    quantidade,
    unidade,
    origem,
    observacao: limpo(item.observacao),
  };
  return { tipo: "plantio", trecho_origem: item.trecho_origem, item_planejado_id: null, dados, campos_status: status, avisos };
}

function processarColheita(item: ItemSaidaIA, ctx: ContextoRelato, avisos: string[]): Omit<ItemRelato, "chave"> {
  const status: Record<string, StatusCampo> = {};
  const culturaTexto = limpo(item.cultura_no_texto);
  const cultura = resolverCultura(culturaTexto, ctx);
  const culturaId = cultura.id;
  status.cultura_id = cultura.status;

  const peso = pesoEmKg(item.peso);
  status.peso_kg = peso !== null && peso > 0 ? "certo" : "faltando";

  const canteiro = resolverCanteiroUnico(item, ctx, avisos);
  status.canteiro_id = canteiro.status;

  // Colheita exige plantio (regra central do módulo). Só sugere quando o
  // canteiro está decidido e há exatamente um plantio ativo da cultura nele.
  let plantioId: string | null = null;
  if (canteiro.id && culturaId) {
    plantioId = unico(ctx.plantios.filter((p) => p.canteiro_id === canteiro.id && p.cultura_id === culturaId));
  }
  status.plantio_id = plantioId ? "inferido" : "faltando";

  const dados: DadosColheita = {
    cultura_id: culturaId,
    cultura_no_texto: culturaTexto,
    peso_kg: peso !== null && peso > 0 ? peso : null,
    canteiro_id: canteiro.id,
    canteiro_no_texto: canteiro.texto,
    plantio_id: plantioId,
    observacao: limpo(item.observacao),
  };
  return { tipo: "colheita", trecho_origem: item.trecho_origem, item_planejado_id: null, dados, campos_status: status, avisos };
}

function processarManejo(item: ItemSaidaIA, ctx: ContextoRelato, avisos: string[]): Omit<ItemRelato, "chave"> {
  const status: Record<string, StatusCampo> = {};
  const acao: AcaoManejoRelato = item.acao_manejo || "outro";
  status.acao = item.acao_manejo ? "certo" : "inferido";

  const textos = (item.canteiros_no_texto ?? []).map((t) => t.trim()).filter(Boolean);
  const canteiroIds: string[] = [];
  const naoCadastrados: string[] = [];
  let ambiguo = false;
  for (const t of textos) {
    const candidatos = candidatosCanteiro(t, ctx.cadastros.canteiros);
    if (candidatos.length === 1) {
      if (!canteiroIds.includes(candidatos[0].id)) canteiroIds.push(candidatos[0].id);
    } else if (candidatos.length === 0) {
      naoCadastrados.push(t);
    } else {
      ambiguo = true;
      avisos.push(`"${t}" serve pra mais de um canteiro: escolha o canteiro.`);
    }
  }
  status.canteiro_ids =
    naoCadastrados.length > 0
      ? "nao_cadastrado"
      : !ambiguo && canteiroIds.length > 0
        ? item.canteiro_inferido
          ? "inferido"
          : "certo"
        : "faltando";

  const quantidade = quantidadeValida(item.quantidade_carrinhos);
  let tipoCarrinhoId: string | null = null;
  let assumido = false;
  let peso: number | null = null;
  if (quantidade !== null) {
    status.quantidade_carrinhos = "certo";
    const carrinho = casarCarrinho(limpo(item.tipo_carrinho_no_texto), ctx.cadastros.tipos_carrinho);
    tipoCarrinhoId = carrinho.id;
    assumido = carrinho.assumido;
    status.tipo_carrinho_id = carrinho.id ? (assumido ? "inferido" : "certo") : "faltando";
    if (assumido && carrinho.id) avisos.push("Tipo de carrinho não dito: assumi o Carrinho azul.");
    const tipo = ctx.cadastros.tipos_carrinho.find((t) => t.id === carrinho.id);
    if (tipo) peso = calcularPesoCarrinho(quantidade, tipo.peso_estimado_kg);
  } else if (acao === "composto" || acao === "poda_triturada") {
    status.quantidade_carrinhos = "faltando";
  }

  let culturaId: string | null = null;
  const culturaTexto = limpo(item.cultura_no_texto);
  if (acao === "poda_planta") {
    const cultura = resolverCultura(culturaTexto, ctx);
    culturaId = cultura.id;
    status.cultura_id = cultura.status;
  }

  const dados: DadosManejo = {
    acao,
    canteiro_ids: canteiroIds,
    canteiros_no_texto: textos,
    canteiros_nao_cadastrados: naoCadastrados,
    quantidade_carrinhos: quantidade,
    tipo_carrinho_id: tipoCarrinhoId,
    tipo_carrinho_assumido: assumido,
    peso_kg_calculado: peso,
    cultura_id: culturaId,
    cultura_no_texto: culturaTexto,
    observacao: limpo(item.observacao),
  };
  return { tipo: "manejo", trecho_origem: item.trecho_origem, item_planejado_id: null, dados, campos_status: status, avisos };
}

const AVISO_DOACAO_MUDA = "Doação de muda: registrar pelo fluxo de doação de muda (precisa do plantio).";

function processarDoacao(item: ItemSaidaIA, ctx: ContextoRelato, avisos: string[]): Omit<ItemRelato, "chave"> {
  const culturaTexto = limpo(item.cultura_no_texto);
  // Doação de muda não entra nesta sprint: vira item extra do checklist.
  if (item.natureza_doacao === "muda") {
    avisos.push(AVISO_DOACAO_MUDA);
    const dados: DadosChecklist = {
      descricao: limpo(item.descricao) ?? `Doação de mudas${culturaTexto ? ` de ${culturaTexto}` : ""}`,
      observacao: limpo(item.observacao),
    };
    return { tipo: "checklist", trecho_origem: item.trecho_origem, item_planejado_id: null, dados, campos_status: {}, avisos };
  }

  const status: Record<string, StatusCampo> = {};
  const cultura = resolverCultura(culturaTexto, ctx);
  const culturaId = cultura.id;
  status.cultura_id = cultura.status;

  const quantidade = quantidadeValida(item.quantidade);
  status.quantidade = quantidade ? "certo" : "faltando";
  const unidade = limpo(item.unidade) ?? "kg";
  status.natureza = item.natureza_doacao === "alimento" ? "certo" : "inferido";
  const destino = limpo(item.destino);
  if (destino) status.destino = "certo";
  avisos.push("Foto da doação fica pendente: anexe depois da entrega.");

  const dados: DadosDoacao = {
    cultura_id: culturaId,
    cultura_no_texto: culturaTexto,
    quantidade,
    unidade,
    destino,
    natureza: "alimento",
    registro_colheita_id: null,
    observacao: limpo(item.observacao),
  };
  return { tipo: "doacao", trecho_origem: item.trecho_origem, item_planejado_id: null, dados, campos_status: status, avisos };
}

export function posProcessarRelato(
  saida: SaidaIARelato,
  ctx: ContextoRelato,
): { itens: ItemRelato[]; avisos: string[]; observacoes: string[] } {
  const idsChecklist = new Set(ctx.checklist.map((c) => c.id));
  const itens: ItemRelato[] = [];

  // Uma coleta só (ou bombonas sem loja): o "Total" do texto é o total
  // dela, mesmo que o modelo tenha posto em total_geral_compostagem
  // (aconteceu no Caso 2 contra a IA real).
  let totalGeralSaida = saida.total_geral_compostagem;
  const coletas = (saida.itens ?? []).filter((i) => i?.tipo === "compostagem");
  if (coletas.length === 1 && !coletas[0].peso_total && totalGeralSaida) {
    coletas[0] = Object.assign(coletas[0], { peso_total: totalGeralSaida });
    totalGeralSaida = null;
  }

  (saida.itens ?? []).forEach((bruto, indice) => {
    if (!bruto || !TIPOS.includes(bruto.tipo)) return;
    const avisos: string[] = [];
    let base: Omit<ItemRelato, "chave">;
    switch (bruto.tipo) {
      case "compostagem":
        base = processarCompostagem(bruto, ctx, avisos);
        break;
      case "plantio":
        base = processarPlantio(bruto, ctx, avisos);
        break;
      case "colheita":
        base = processarColheita(bruto, ctx, avisos);
        break;
      case "manejo":
        base = processarManejo(bruto, ctx, avisos);
        break;
      case "doacao":
        base = processarDoacao(bruto, ctx, avisos);
        break;
      default: {
        if (bruto.tipo === "ronda") avisos.push("Pode virar ocorrência: a coordenação decide.");
        const dados: DadosChecklist = {
          descricao: limpo(bruto.descricao) ?? limpo(bruto.trecho_origem) ?? "(sem descrição)",
          observacao: limpo(bruto.observacao),
        };
        base = { tipo: bruto.tipo, trecho_origem: bruto.trecho_origem, item_planejado_id: null, dados, campos_status: {}, avisos };
      }
    }

    // Único id que vem do modelo: só vale se veio da lista enviada.
    const idPlanejado = bruto.item_planejado_id && idsChecklist.has(bruto.item_planejado_id) ? bruto.item_planejado_id : null;
    itens.push({
      ...base,
      chave: `i${indice}`,
      trecho_origem: limpo(base.trecho_origem) ?? limpo(bruto.descricao) ?? "",
      item_planejado_id: idPlanejado,
    });
  });

  const avisos: string[] = [];

  // Regra 5: data diferente da do turno vira aviso, sem mudar a data.
  const [, mesTurno, diaTurno] = ctx.dataISO.split("-").map(Number);
  const vistas = new Set<string>();
  for (const d of saida.datas_no_texto ?? []) {
    if (!d || !Number.isInteger(d.dia)) continue;
    const mes = d.mes ?? mesTurno;
    if (d.dia === diaTurno && mes === mesTurno) continue;
    const texto = ddmm(d.dia, mes);
    if (vistas.has(texto)) continue;
    vistas.add(texto);
    avisos.push(`O texto fala de ${texto}, este turno é ${ddmm(diaTurno, mesTurno)}.`);
  }

  // Total geral de várias lojas × soma das lojas.
  const totalGeral = pesoEmKg(totalGeralSaida);
  if (totalGeral !== null) {
    const lojas = itens.filter((i) => i.tipo === "compostagem").map((i) => i.dados as DadosCompostagem);
    if (lojas.length > 1 && lojas.every((l) => l.peso_total_kg !== null)) {
      const soma = arredondar(lojas.reduce((s, l) => s + (l.peso_total_kg ?? 0), 0));
      if (Math.abs(soma - totalGeral) > TOLERANCIA_KG) {
        avisos.push(`Soma das lojas ${kgTexto(soma)}, total escrito ${kgTexto(totalGeral)}.`);
      }
    }
  }

  for (const a of saida.avisos ?? []) if (a?.trim()) avisos.push(a.trim());
  // O cabeçalho do pedido não é relato (o modelo copiou uma vez no teste).
  const observacoes = (saida.observacoes ?? [])
    .map((o) => o.trim())
    .filter((o) => o && !normalizarTexto(o).startsWith("turno do relatorio"));
  return { itens, avisos, observacoes };
}
