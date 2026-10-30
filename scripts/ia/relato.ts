// Conferência do Relato do turno (Sprint B, B3) com os casos 1 a 5 do
// Apêndice da SPRINT_B_RELATO_DO_TURNO.md.
//
//   npx jiti scripts/ia/relato.ts            -> chama a IA de verdade
//   npx jiti scripts/ia/relato.ts --sem-ia   -> só o pós-processamento, com
//                                               respostas montadas à mão
//
// Não grava nada no Supabase: o cadastro é fictício (abaixo), com os nomes
// que aparecem nos casos. Lê ANTHROPIC_API_KEY do .env.local e nunca a
// imprime. Imprime só a conferência esperado × obtido.

import { chamarIAComJson } from "../../src/lib/ia/anthropic";
import {
  SCHEMA_RELATO,
  SISTEMA_RELATO,
  montarPedidoRelato,
  posProcessarRelato,
  type ContextoRelato,
  type ItemSaidaIA,
  type SaidaIARelato,
} from "../../src/lib/ia/relato";
import type {
  DadosChecklist,
  DadosColheita,
  DadosCompostagem,
  DadosDoacao,
  DadosManejo,
  DadosPlantio,
  ItemRelato,
} from "../../src/lib/relato";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: só o modo --sem-ia funciona
}

// -----------------------------------------------------------------------------
// Cadastro fictício
// -----------------------------------------------------------------------------

const id = (prefixo: string, n: number | string) => `${prefixo}-${n}`;

const parceiros = ["Zio", "GB", "Yoshi", "Terra"].map((nome) => ({ id: id("loja", nome.toLowerCase()), nome }));
const caixas = Array.from({ length: 12 }, (_, i) => ({ id: id("caixa", i + 1), numero: i + 1 }));
const canteiros = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: id("canteiro", i + 1), nome: `Canteiro ${i + 1}`, tipo: "canteiro_solo" })),
  { id: id("canteiro", "pergolado"), nome: "Pergolado", tipo: "pergolado" },
  { id: id("canteiro", "geodesica"), nome: "Geodésica", tipo: "geodesica" },
];
const culturas = [
  "Alface", "Couve", "Coentro", "Salsão", "Cebolinha", "Pimenta", "Hortelã", "Capim santo",
  "Acerola", "Limão", "Amora", "Mamão", "Tomate Cereja", "Tomate Santa Clara", "Jambu",
].map((nome) => ({ id: id("cultura", nome), nome }));
const tiposCarrinho = [
  { id: "carrinho-azul", nome: "Carrinho azul", peso_estimado_kg: 18 },
  { id: "carrinho-velho", nome: "Carrinho velho", peso_estimado_kg: 30 },
];

function contexto(dataISO: string, checklist: string[]): ContextoRelato {
  return {
    dataISO,
    checklist: checklist.map((descricao, i) => ({ id: `00000000-0000-4000-8000-00000000000${i}`, descricao })),
    cadastros: { parceiros, caixas, canteiros, culturas, tipos_carrinho: tiposCarrinho },
    plantios: [{ id: "plantio-pimenta-c2", cultura_id: id("cultura", "Pimenta"), canteiro_id: id("canteiro", 2) }],
    caixasDescanso: [],
  };
}

// -----------------------------------------------------------------------------
// Casos
// -----------------------------------------------------------------------------

interface Caso {
  nome: string;
  texto: string;
  dataISO: string;
  checklist: string[];
  conferir: (r: ReturnType<typeof posProcessarRelato>) => Conferencia[];
  semIA?: SaidaIARelato;
}

interface Conferencia {
  esperado: string;
  obtido: string;
  ok: boolean;
}

function c(esperado: string, obtido: unknown, ok: boolean): Conferencia {
  return { esperado, obtido: typeof obtido === "string" ? obtido : JSON.stringify(obtido), ok };
}

const doTipo = <T,>(r: { itens: ItemRelato[] }, tipo: string) =>
  r.itens.filter((i) => i.tipo === tipo).map((i) => ({ ...i, d: i.dados as T }));

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function porCultura<T extends { cultura_no_texto: string | null }, I extends { d: T }>(lista: I[], nome: string) {
  return lista.find((i) => norm(i.d.cultura_no_texto).includes(norm(nome)));
}

const todosAvisos = (r: { itens: ItemRelato[]; avisos: string[] }) => [...r.avisos, ...r.itens.flatMap((i) => i.avisos)];

function itemVazio(parcial: Partial<ItemSaidaIA>): ItemSaidaIA {
  return {
    tipo: "checklist",
    trecho_origem: "",
    descricao: "",
    observacao: null,
    item_planejado_id: null,
    loja_no_texto: null,
    qtd_bombonas: null,
    peso_total: null,
    bombonas: [],
    caixas_no_texto: [],
    peso_por_caixa: [],
    cultura_no_texto: null,
    canteiros_no_texto: [],
    canteiro_inferido: false,
    quantidade: null,
    unidade: null,
    peso: null,
    acao_manejo: null,
    quantidade_carrinhos: null,
    tipo_carrinho_no_texto: null,
    natureza_doacao: null,
    destino: null,
    ...parcial,
  };
}

const kg = (valor: number) => ({ valor, unidade: "kg" as const });

const CASOS: Caso[] = [
  {
    nome: "Caso 1 (compostagem por loja, 28/10)",
    dataISO: "2026-10-28",
    checklist: ["Ronda observativa do pátio", "Compostagem", "Rega manual dos canteiros"],
    texto:
      "Compostagem de hoje (28/10), 7 bombonas divididas em: 2 Zio: 83,67Kg / 2 Gb: 81,21Kg / 2 Yoshi: 67,09Kg / 1 Terra: 24,78Kg / Total: 256,75Kg / Alimentadas nas caixas 1 e 2 / Produzimos mudas de Tomate Cereja, Tomate Santa Clara e Alface",
    semIA: {
      itens: [
        ["Zio", 2, 83.67],
        ["Gb", 2, 81.21],
        ["Yoshi", 2, 67.09],
        ["Terra", 1, 24.78],
      ].map(([loja, qtd, peso]) =>
        itemVazio({
          tipo: "compostagem",
          trecho_origem: `${qtd} ${loja}: ${peso}Kg`,
          descricao: "Compostagem",
          loja_no_texto: loja as string,
          qtd_bombonas: qtd as number,
          peso_total: kg(peso as number),
          caixas_no_texto: [1, 2],
        }),
      ).concat([
        itemVazio({
          tipo: "checklist",
          trecho_origem: "Produzimos mudas de Tomate Cereja, Tomate Santa Clara e Alface",
          descricao: "Produzimos mudas de Tomate Cereja, Tomate Santa Clara e Alface",
        }),
      ]),
      total_geral_compostagem: kg(256.75),
      datas_no_texto: [{ dia: 28, mes: 10 }],
      observacoes: [],
      avisos: [],
    },
    conferir: (r) => {
      const comp = doTipo<DadosCompostagem>(r, "compostagem");
      const lojas = comp.map((i) => `${i.d.parceiro_id}:${i.d.qtd_bombonas}:${i.d.peso_total_kg}`).sort();
      const plantios = doTipo<DadosPlantio>(r, "plantio");
      const mudas = r.itens.filter((i) => i.tipo === "checklist" && norm((i.dados as DadosChecklist).descricao).includes("muda"));
      return [
        c("4 propostas de compostagem", comp.length, comp.length === 4),
        c(
          "Zio 2/83,67; GB 2/81,21; Yoshi 2/67,09; Terra 1/24,78",
          lojas,
          JSON.stringify(lojas) ===
            JSON.stringify(["loja-gb:2:81.21", "loja-terra:1:24.78", "loja-yoshi:2:67.09", "loja-zio:2:83.67"]),
        ),
        c("caixas 1 e 2 em cada loja", comp.map((i) => i.d.caixas_numeros), comp.every((i) => i.d.caixas_numeros.join() === "1,2")),
        c(
          "divisão entre as caixas faltando",
          comp.map((i) => i.campos_status.divisao_caixas),
          comp.length > 0 && comp.every((i) => i.campos_status.divisao_caixas === "faltando"),
        ),
        c("soma confere (sem aviso de soma)", todosAvisos(r).filter((a) => a.includes("Soma")), !todosAvisos(r).some((a) => a.includes("Soma"))),
        c("sem aviso de data (28/10 é o turno)", r.avisos.filter((a) => a.includes("fala de")), !r.avisos.some((a) => a.includes("fala de"))),
        c("\"Produzimos mudas\" = item extra do checklist", mudas.map((i) => (i.dados as DadosChecklist).descricao), mudas.length >= 1),
        c("nenhuma proposta de plantio", plantios.length, plantios.length === 0),
      ];
    },
  },
  {
    nome: "Caso 2 (soma divergente, 23/09)",
    dataISO: "2026-09-23",
    checklist: ["Compostagem"],
    texto:
      "Compostagem 103 peso 18kg / 92 peso 29kg / 77 peso 8k (veio com bastante líquido) / 75 peso 10kg / 99 peso 35kg / Total 103kg",
    semIA: {
      itens: [
        itemVazio({
          tipo: "compostagem",
          trecho_origem: "Compostagem 103 peso 18kg / ... / Total 103kg",
          descricao: "Compostagem",
          peso_total: kg(103),
          bombonas: [
            { numero: "103", peso: kg(18), observacao: null },
            { numero: "92", peso: kg(29), observacao: null },
            { numero: "77", peso: kg(8), observacao: "veio com bastante líquido" },
            { numero: "75", peso: kg(10), observacao: null },
            { numero: "99", peso: kg(35), observacao: null },
          ],
        }),
      ],
      total_geral_compostagem: null,
      datas_no_texto: [],
      observacoes: [],
      avisos: [],
    },
    conferir: (r) => {
      const comp = doTipo<DadosCompostagem>(r, "compostagem");
      const um = comp[0];
      const b77 = um?.d.bombonas.find((b) => b.numero === "77");
      return [
        c("1 proposta de compostagem", comp.length, comp.length === 1),
        c("aviso \"soma 100 kg, total escrito 103 kg\"", todosAvisos(r).filter((a) => a.includes("Soma")), todosAvisos(r).some((a) => a.includes("Soma 100 kg, total escrito 103 kg"))),
        c("peso total faltando até a pessoa escolher", { peso: um?.d.peso_total_kg, status: um?.campos_status.peso_total_kg }, um?.d.peso_total_kg === null && um?.campos_status.peso_total_kg === "faltando"),
        c("opções de peso 100 e 103", um?.d.peso_total_opcoes, JSON.stringify(um?.d.peso_total_opcoes) === "[100,103]"),
        c("observação preservada na bombona 77", b77?.observacao ?? null, norm(b77?.observacao).includes("liquido")),
        c("5 bombonas com número", um?.d.bombonas.map((b) => b.numero), um?.d.bombonas.length === 5),
        c("loja faltando (texto não diz)", um?.campos_status.parceiro_id, um?.campos_status.parceiro_id === "faltando"),
      ];
    },
  },
  {
    nome: "Caso 3 (plantio, colheita, doação e ronda, sem locais)",
    dataISO: "2026-10-20",
    checklist: ["Ronda observativa do pátio", "Plantio e organização de um canteiro"],
    texto:
      "Limpeza do canteiro 3. Plantio de 14 mudas de alface. Plantio de 64 mudas de couve. Plantio de 1 fileira de coentro. Plantio de 5 covas de coentro. Poda das frutíferas: Acerola; Limão; Amora; Mamão. Colheita: Salsão: 0,200 kg. Cebolinha: 0,080 kg. Pimenta: 0,300 kg. Doações: mudas de pimenta, bredo, pimenta de cheiro, cebolinho. Ronda observativa: canteiro 2 com solo bastante seco; linhas de irrigação das frutíferas muito secas.",
    conferir: (r) => {
      const plantios = doTipo<DadosPlantio>(r, "plantio");
      const alface = porCultura(plantios, "alface");
      const couve = porCultura(plantios, "couve");
      const coentros = plantios.filter((p) => norm(p.d.cultura_no_texto).includes("coentro"));
      const colheitas = doTipo<DadosColheita>(r, "colheita");
      const pesos = ["salsao", "cebolinha", "pimenta"].map((n) => porCultura(colheitas, n)?.d.peso_kg ?? null);
      const podas = doTipo<DadosManejo>(r, "manejo").filter((m) => m.d.acao === "poda_planta");
      const doacoes = doTipo<DadosDoacao>(r, "doacao");
      const ronda = r.itens.filter((i) => i.tipo === "ronda");
      const limpeza = r.itens.find((i) => i.tipo === "checklist" && norm((i.dados as DadosChecklist).descricao).includes("limpeza"));
      const muda = r.itens.find((i) => i.tipo === "checklist" && i.avisos.some((a) => a.includes("muda")));
      return [
        c("\"limpeza do canteiro 3\" = checklist", (limpeza?.dados as DadosChecklist | undefined)?.descricao ?? null, !!limpeza),
        c("alface: canteiro 3 inferido", { canteiro: alface?.d.canteiro_id, status: alface?.campos_status.canteiro_id }, alface?.d.canteiro_id === "canteiro-3" && alface?.campos_status.canteiro_id === "inferido"),
        c("couve: canteiro faltando", couve?.campos_status.canteiro_id, couve?.campos_status.canteiro_id === "faltando"),
        c("coentro: 2 plantios, fileira e cova mantidas", coentros.map((p) => `${p.d.quantidade} ${p.d.unidade}`), coentros.length === 2 && coentros.some((p) => norm(p.d.unidade).startsWith("fileira")) && coentros.some((p) => norm(p.d.unidade).startsWith("cova"))),
        c("coentro: quantidade em mudas faltando", coentros.map((p) => p.campos_status.quantidade_mudas), coentros.length === 2 && coentros.every((p) => p.campos_status.quantidade_mudas === "faltando")),
        c("colheitas 0,2 / 0,08 / 0,3 kg", pesos, JSON.stringify(pesos) === "[0.2,0.08,0.3]"),
        c("colheitas com plantio faltando", colheitas.map((i) => i.campos_status.plantio_id), colheitas.length === 3 && colheitas.every((i) => i.campos_status.plantio_id === "faltando")),
        c("poda por cultura (4), plantio/canteiro faltando", podas.map((p) => `${p.d.cultura_no_texto}:${p.campos_status.canteiro_ids}`), podas.length === 4 && podas.every((p) => p.campos_status.canteiro_ids === "faltando")),
        c("\"mudas de pimenta\" = item extra com aviso de doação de muda", (muda?.dados as DadosChecklist | undefined)?.descricao ?? null, !!muda),
        c("3 doações de alimento (bredo, pimenta de cheiro, cebolinho)", doacoes.map((d) => d.d.cultura_no_texto), doacoes.length === 3),
        c("doações: cultura não cadastrada (fica o nome cru)", doacoes.map((d) => `${d.d.cultura_no_texto}:${d.campos_status.cultura_id}`), doacoes.length === 3 && doacoes.every((d) => d.campos_status.cultura_id === "nao_cadastrado" && !!d.d.cultura_no_texto)),
        c("doações: natureza inferido, quantidade faltando", doacoes.map((d) => `${d.campos_status.natureza}/${d.campos_status.quantidade}`), doacoes.length === 3 && doacoes.every((d) => d.campos_status.natureza === "inferido" && d.campos_status.quantidade === "faltando")),
        c("ronda como texto, sugestão de ocorrência", ronda.map((i) => (i.dados as DadosChecklist).descricao), ronda.length >= 1 && ronda.every((i) => i.avisos.some((a) => a.includes("ocorrência")))),
      ];
    },
  },
  {
    nome: "Caso 4 (carrinhos sem tipo e sem canteiros)",
    dataISO: "2026-10-21",
    checklist: ["Organização e Plantio de um canteiro", "Organização e limpeza dos espaços e ferramentas utilizadas"],
    texto:
      "Atualização de um canteiro. Revolvimento da terra. Aplicação de 2 carrinhos de composto e 1 carrinho de poda triturada em cada canteiro concluído. Instalação dos aspersores no canteiro. Limpeza das mudas das geodésica. Troca de água. Materiais utilizados: Pá de enxada, Carrinho de mão, Rastelo.",
    semIA: {
      itens: [
        itemVazio({ tipo: "checklist", trecho_origem: "Atualização de um canteiro.", descricao: "Atualização de um canteiro" }),
        itemVazio({ tipo: "manejo", trecho_origem: "Aplicação de 2 carrinhos de composto", descricao: "Aplicação de composto", acao_manejo: "composto", quantidade_carrinhos: 2 }),
        itemVazio({ tipo: "manejo", trecho_origem: "1 carrinho de poda triturada em cada canteiro concluído", descricao: "Poda triturada", acao_manejo: "poda_triturada", quantidade_carrinhos: 1 }),
      ],
      total_geral_compostagem: null,
      datas_no_texto: [],
      observacoes: ["Materiais utilizados: Pá de enxada, Carrinho de mão, Rastelo."],
      avisos: [],
    },
    conferir: (r) => {
      const manejos = doTipo<DadosManejo>(r, "manejo");
      const composto = manejos.find((m) => m.d.acao === "composto");
      const poda = manejos.find((m) => m.d.acao === "poda_triturada");
      const outrasPropostas = r.itens.filter((i) => ["compostagem", "plantio", "colheita", "doacao"].includes(i.tipo));
      return [
        c("manejo composto: 2 carrinhos azuis, assumido, 36 kg", composto && { qtd: composto.d.quantidade_carrinhos, tipo: composto.d.tipo_carrinho_id, assumido: composto.d.tipo_carrinho_assumido, kg: composto.d.peso_kg_calculado }, composto?.d.quantidade_carrinhos === 2 && composto?.d.tipo_carrinho_id === "carrinho-azul" && composto.d.tipo_carrinho_assumido && composto.d.peso_kg_calculado === 36),
        c("manejo poda triturada: 1 carrinho azul, assumido", poda && { qtd: poda.d.quantidade_carrinhos, assumido: poda.d.tipo_carrinho_assumido }, poda?.d.quantidade_carrinhos === 1 && poda?.d.tipo_carrinho_assumido === true),
        c("canteiros faltando", manejos.map((m) => m.campos_status.canteiro_ids), manejos.length >= 2 && manejos.every((m) => m.campos_status.canteiro_ids === "faltando")),
        c("demais linhas = itens do checklist", r.itens.filter((i) => i.tipo === "checklist").map((i) => (i.dados as DadosChecklist).descricao), r.itens.filter((i) => i.tipo === "checklist").length >= 1),
        c("\"Materiais utilizados\" = observação, sem proposta", r.observacoes, r.observacoes.some((o) => norm(o).includes("materiais"))),
        c("nenhuma outra proposta", outrasPropostas.map((i) => i.tipo), outrasPropostas.length === 0),
      ];
    },
  },
  {
    nome: "Caso extra (cultura e canteiro não cadastrados)",
    dataISO: "2026-10-23",
    checklist: [],
    texto: "Plantio de 10 mudas de bredo no canteiro 15. Poda triturada: 1 carrinho na ilha.",
    semIA: {
      itens: [
        itemVazio({ tipo: "plantio", trecho_origem: "Plantio de 10 mudas de bredo no canteiro 15", descricao: "Plantio", cultura_no_texto: "bredo", canteiros_no_texto: ["15"], quantidade: 10, unidade: "muda" }),
        itemVazio({ tipo: "manejo", trecho_origem: "Poda triturada: 1 carrinho na ilha", descricao: "Poda triturada", acao_manejo: "poda_triturada", quantidade_carrinhos: 1, canteiros_no_texto: ["ilha"] }),
      ],
      total_geral_compostagem: null,
      datas_no_texto: [],
      observacoes: [],
      avisos: [],
    },
    conferir: (r) => {
      const plantio = doTipo<DadosPlantio>(r, "plantio")[0];
      const manejo = doTipo<DadosManejo>(r, "manejo")[0];
      return [
        c("bredo: cultura nao_cadastrado com nome cru", plantio && `${plantio.d.cultura_no_texto}:${plantio.campos_status.cultura_id}`, plantio?.campos_status.cultura_id === "nao_cadastrado" && norm(plantio.d.cultura_no_texto) === "bredo"),
        c("canteiro 15: nao_cadastrado com nome cru", plantio && `${plantio.d.canteiro_no_texto}:${plantio.campos_status.canteiro_id}`, plantio?.campos_status.canteiro_id === "nao_cadastrado" && plantio.d.canteiro_no_texto === "15"),
        c("ilha (manejo): nao_cadastrado", manejo && { status: manejo.campos_status.canteiro_ids, nomes: manejo.d.canteiros_nao_cadastrados }, manejo?.campos_status.canteiro_ids === "nao_cadastrado" && norm(manejo.d.canteiros_nao_cadastrados?.[0]) === "ilha"),
      ];
    },
  },
  {
    nome: "Caso 5 (checklist puro, 22/10)",
    dataISO: "2026-10-22",
    checklist: ["Ronda observativa do pátio", "Rega manual dos canteiros", "Plantio e organização de um canteiro"],
    texto:
      "Poda de salsão. Poda de hortelã. Poda da pimenta. Poda do capim santo. Ronda observativa. Peneiração de 1 carro de composto. Irrigação só no pergolado e no canteiro em frente, pois faltou água. Colheita de pimenta. Plantio de 2 mudas de jambu.",
    conferir: (r) => {
      const rega = r.itens.find((i) => norm((i.dados as DadosChecklist).observacao ?? "").includes("agua") || norm(i.trecho_origem).includes("faltou agua"));
      const colheita = porCultura(doTipo<DadosColheita>(r, "colheita"), "pimenta");
      const jambu = porCultura(doTipo<DadosPlantio>(r, "plantio"), "jambu");
      const tipos = r.itens.map((i) => i.tipo);
      return [
        c("\"faltou água\" como observação da rega (não perda)", rega ? { tipo: rega.tipo, obs: (rega.dados as DadosChecklist).observacao } : null, !!rega && rega.tipo === "checklist" && norm((rega.dados as DadosChecklist).observacao).includes("agua")),
        c("colheita de pimenta sem peso (faltando)", colheita && { peso: colheita.d.peso_kg, status: colheita.campos_status.peso_kg }, colheita?.d.peso_kg === null && colheita?.campos_status.peso_kg === "faltando"),
        c("jambu 2 mudas, canteiro faltando", jambu && { qtd: jambu.d.quantidade, unidade: jambu.d.unidade, canteiro: jambu.campos_status.canteiro_id }, jambu?.d.quantidade === 2 && jambu?.campos_status.canteiro_id === "faltando"),
        c("ronda e peneiração no checklist/ronda", tipos, tipos.includes("ronda") || r.itens.some((i) => i.item_planejado_id === "00000000-0000-4000-8000-000000000000")),
      ];
    },
  },
];

// -----------------------------------------------------------------------------
// Execução
// -----------------------------------------------------------------------------

function resumoItens(itens: ItemRelato[]): string {
  return itens
    .map((i) => {
      const faltando = Object.entries(i.campos_status).filter(([, s]) => s !== "certo").map(([k, s]) => `${k}=${s}`);
      const d = i.dados as unknown as Record<string, unknown>;
      const rotulo = (d.descricao ?? d.cultura_no_texto ?? d.loja_no_texto ?? d.acao ?? "") as string;
      return `      · ${i.tipo}: ${rotulo}${faltando.length ? ` [${faltando.join(", ")}]` : ""}${i.item_planejado_id ? " (checklist)" : ""}`;
    })
    .join("\n");
}

async function main() {
  const semIA = process.argv.includes("--sem-ia");
  if (!semIA && !process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY ausente (.env.local). Use --sem-ia para só o pós-processamento.");
    process.exit(1);
  }

  let totalOk = 0;
  let total = 0;
  let tokensEntrada = 0;
  let tokensSaida = 0;

  for (const caso of CASOS) {
    const ctx = contexto(caso.dataISO, caso.checklist);
    let saida: SaidaIARelato;
    if (semIA) {
      if (!caso.semIA) continue;
      saida = caso.semIA;
    } else {
      const inicio = Date.now();
      const resposta = await chamarIAComJson<SaidaIARelato>({
        sistema: SISTEMA_RELATO,
        usuario: montarPedidoRelato(caso.texto, caso.dataISO, "manha", ctx.checklist),
        schema: SCHEMA_RELATO,
      });
      saida = resposta.dados;
      tokensEntrada += resposta.tokensEntrada;
      tokensSaida += resposta.tokensSaida;
      console.log(`\n${caso.nome}  (${((Date.now() - inicio) / 1000).toFixed(1)} s, ${resposta.tokensEntrada}+${resposta.tokensSaida} tokens)`);
    }
    if (semIA) console.log(`\n${caso.nome}  (sem IA)`);

    const r = posProcessarRelato(saida, ctx);
    for (const conf of caso.conferir(r)) {
      total += 1;
      if (conf.ok) totalOk += 1;
      console.log(`  ${conf.ok ? "✓" : "✗"} ${conf.esperado}\n      obtido: ${conf.obtido}`);
    }
    console.log("    itens:\n" + resumoItens(r.itens));
    if (r.avisos.length) console.log("    avisos gerais: " + r.avisos.join(" | "));
    if (r.observacoes.length) console.log("    observações: " + r.observacoes.join(" | "));
  }

  console.log(`\n${totalOk}/${total} conferências ok${semIA ? "" : ` · tokens ${tokensEntrada}+${tokensSaida}`}`);
}

main().catch((e) => {
  // detalhe = status + começo do corpo da resposta da API (nunca a chave).
  const detalhe = (e as { detalhe?: string }).detalhe;
  console.error("Falhou:", e instanceof Error ? e.message : e, detalhe ? `
  ${detalhe}` : "");
  process.exit(1);
});
