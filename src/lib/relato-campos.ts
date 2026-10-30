// Campos, perguntas e respostas dos itens do Relato do turno (Sprint B,
// B3 e B4). Código puro, sem Supabase: a tela "Entendi isto" (quem
// relatou) e a fila "Para conferir" (coordenação) usam as mesmas regras
// pra mostrar os campos com selo e pra completar o que falta por toque.

import type {
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
} from "./relato";

export const ROTULO_TIPO: Record<TipoItemRelato, { icone: string; rotulo: string }> = {
  checklist: { icone: "✅", rotulo: "Atividade" },
  compostagem: { icone: "📥", rotulo: "Compostagem" },
  plantio: { icone: "🌱", rotulo: "Plantio" },
  colheita: { icone: "🧺", rotulo: "Colheita" },
  manejo: { icone: "🌾", rotulo: "Manejo" },
  doacao: { icone: "📦", rotulo: "Doação" },
  ronda: { icone: "🚶", rotulo: "Ronda" },
};

// Mesmos rótulos de Registrar plantio (muda_comprada aparece como "Muda").
const ROTULO_ORIGEM: Record<string, string> = {
  semente: "Semente",
  muda_comprada: "Muda",
  estaca: "Estaca",
  ja_existente: "Já existia",
  divisao: "Divisão",
};

const ROTULO_ACAO: Record<DadosManejo["acao"], string> = {
  composto: "Aplicação de composto",
  poda_triturada: "Poda triturada no canteiro",
  poda_planta: "Poda de planta",
  outro: "Outro manejo",
};

function kg(n: number | null): string | null {
  return n === null ? null : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`;
}

function nomeDe(lista: { id: string; nome: string }[], id: string | null): string | null {
  return id ? (lista.find((x) => x.id === id)?.nome ?? null) : null;
}

export interface CampoVisivel {
  campo: string;
  rotulo: string;
  valor: string | null;
  status: StatusCampo | null;
}

// O que o cartão mostra de cada tipo (valor já resolvido pro nome).
export function camposVisiveis(item: ItemRelato, cad: CadastrosRelato): CampoVisivel[] {
  const s = item.campos_status;
  const v = (campo: string, rotulo: string, valor: string | null): CampoVisivel => ({
    campo,
    rotulo,
    valor,
    status: s[campo] ?? null,
  });
  switch (item.tipo) {
    case "compostagem": {
      const d = item.dados as DadosCompostagem;
      const divisao = d.peso_por_caixa
        ? d.peso_por_caixa
            .map((p) => `cx ${cad.caixas.find((c) => c.id === p.caixa_id)?.numero ?? "?"}: ${kg(p.peso_kg)}`)
            .join(", ")
        : d.caixa_ids.length > 1
          ? s.divisao_caixas === "inferido"
            ? "dividir igual (estimado)"
            : null
          : d.caixa_ids.length === 1
            ? "tudo nessa caixa"
            : null;
      return [
        v("parceiro_id", "Loja", nomeDe(cad.parceiros, d.parceiro_id) ?? (d.loja_no_texto ? `"${d.loja_no_texto}"?` : null)),
        v("qtd_bombonas", "Bombonas", d.qtd_bombonas === null ? null : String(d.qtd_bombonas)),
        v("peso_total_kg", "Peso total", kg(d.peso_total_kg)),
        v("caixas", "Caixas", d.caixas_numeros.length ? d.caixas_numeros.join(", ") : null),
        v("divisao_caixas", "Divisão", divisao),
        ...(d.bombonas.length
          ? [
              {
                campo: "bombonas",
                rotulo: "Detalhe",
                valor: d.bombonas
                  .map((b) => `${b.numero ?? "s/n"}: ${kg(b.peso_kg) ?? "?"}${b.observacao ? ` (${b.observacao})` : ""}`)
                  .join(" · "),
                status: null,
              },
            ]
          : []),
      ];
    }
    case "plantio": {
      const d = item.dados as DadosPlantio;
      return [
        v("cultura_id", "Cultura", nomeDe(cad.culturas, d.cultura_id) ?? (d.cultura_no_texto ? `"${d.cultura_no_texto}" (não cadastrada)` : null)),
        v("canteiro_id", "Canteiro", nomeDe(cad.canteiros, d.canteiro_id) ?? (d.canteiro_no_texto ? `"${d.canteiro_no_texto}"?` : null)),
        v("quantidade", "Quantidade", d.quantidade === null ? null : `${d.quantidade} ${d.unidade ?? ""}`.trim()),
        v("origem", "Origem", d.origem ? (ROTULO_ORIGEM[d.origem] ?? d.origem) : null),
      ];
    }
    case "colheita": {
      const d = item.dados as DadosColheita;
      return [
        v("cultura_id", "Cultura", nomeDe(cad.culturas, d.cultura_id) ?? (d.cultura_no_texto ? `"${d.cultura_no_texto}" (não cadastrada)` : null)),
        v("peso_kg", "Peso", kg(d.peso_kg)),
        v("canteiro_id", "Canteiro", nomeDe(cad.canteiros, d.canteiro_id) ?? (d.canteiro_no_texto ? `"${d.canteiro_no_texto}"?` : null)),
        v("plantio_id", "Plantio", d.plantio_id ? "escolhido" : null),
      ];
    }
    case "manejo": {
      const d = item.dados as DadosManejo;
      const carrinho = nomeDe(
        cad.tipos_carrinho.map((t) => ({ id: t.id, nome: t.nome })),
        d.tipo_carrinho_id,
      );
      return [
        v("acao", "Ação", ROTULO_ACAO[d.acao]),
        ...(d.acao === "poda_planta"
          ? [v("cultura_id", "Cultura", nomeDe(cad.culturas, d.cultura_id) ?? (d.cultura_no_texto ? `"${d.cultura_no_texto}" (não cadastrada)` : null))]
          : []),
        v(
          "canteiro_ids",
          "Canteiro(s)",
          d.canteiro_ids.length ? d.canteiro_ids.map((id) => nomeDe(cad.canteiros, id) ?? "?").join(", ") : null,
        ),
        ...(d.quantidade_carrinhos !== null || s.quantidade_carrinhos
          ? [
              v(
                "quantidade_carrinhos",
                "Carrinhos",
                d.quantidade_carrinhos === null
                  ? null
                  : `${d.quantidade_carrinhos} × ${carrinho ?? "?"}${d.peso_kg_calculado !== null ? ` ≈ ${kg(d.peso_kg_calculado)}` : ""}`,
              ),
            ]
          : []),
      ];
    }
    case "doacao": {
      const d = item.dados as DadosDoacao;
      return [
        v("cultura_id", "Cultura", nomeDe(cad.culturas, d.cultura_id) ?? (d.cultura_no_texto ? `"${d.cultura_no_texto}" (não cadastrada)` : null)),
        v("quantidade", "Quantidade", d.quantidade === null ? null : `${d.quantidade} ${d.unidade}`),
        v("natureza", "Tipo", "alimento"),
        v("destino", "Destino", d.destino),
        { campo: "foto", rotulo: "Foto", valor: "pendente (anexar depois)", status: null },
      ];
    }
    default: {
      const d = item.dados as DadosChecklist;
      return [{ campo: "descricao", rotulo: "", valor: d.observacao ? `${d.descricao} (${d.observacao})` : d.descricao, status: null }];
    }
  }
}

export function piorStatus(item: ItemRelato): StatusCampo {
  const valores = Object.values(item.campos_status);
  if (valores.includes("faltando") || valores.includes("nao_cadastrado")) return "faltando";
  if (valores.includes("inferido")) return "inferido";
  return "certo";
}

// -----------------------------------------------------------------------------
// Nome que não existe no cadastro (status nao_cadastrado)
// -----------------------------------------------------------------------------

export interface NaoCadastrado {
  campo: "cultura_id" | "canteiro_id" | "canteiro_ids";
  tipo: "cultura" | "canteiro";
  nome: string;
}

export function naoCadastrados(item: ItemRelato): NaoCadastrado[] {
  const lista: NaoCadastrado[] = [];
  const d = item.dados as unknown as Record<string, unknown>;
  const s = item.campos_status;
  if (s.cultura_id === "nao_cadastrado" && typeof d.cultura_no_texto === "string") {
    lista.push({ campo: "cultura_id", tipo: "cultura", nome: d.cultura_no_texto });
  }
  if (s.canteiro_id === "nao_cadastrado" && typeof d.canteiro_no_texto === "string") {
    lista.push({ campo: "canteiro_id", tipo: "canteiro", nome: d.canteiro_no_texto });
  }
  if (s.canteiro_ids === "nao_cadastrado") {
    const nomes = (d.canteiros_nao_cadastrados as string[] | undefined) ?? (d.canteiros_no_texto as string[] | undefined) ?? [];
    lista.push({ campo: "canteiro_ids", tipo: "canteiro", nome: nomes.join(", ") });
  }
  return lista;
}

// -----------------------------------------------------------------------------
// Perguntas por toque
// -----------------------------------------------------------------------------

export interface OpcaoPergunta {
  valor: string;
  rotulo: string;
}

export interface Pergunta {
  chave: string;
  itemChave: string;
  campo: string;
  // Menor = mais importante (B2, seção 3.7: o que bloqueia aprovação
  // primeiro — peso total, loja, plantio, canteiro).
  impacto: number;
  rotulo: string;
  tipo: "escolha" | "multi" | "numero" | "plantio";
  opcoes: OpcaoPergunta[];
  // "Cadastrar 'nome'" quando a cultura não está no cadastro.
  cadastrarCultura?: string;
  // Pergunta de plantio: carregada na hora, do canteiro escolhido.
  canteiroId?: string;
  culturaId?: string | null;
}

const IMPACTO: Record<string, number> = {
  peso_total_kg: 1,
  peso_kg: 1,
  parceiro_id: 2,
  plantio_id: 3,
  canteiro_id: 4,
  canteiro_ids: 4,
  cultura_id: 5,
  caixas: 6,
  divisao_caixas: 7,
  quantidade: 8,
  quantidade_carrinhos: 8,
  origem: 9,
  tipo_carrinho_id: 9,
};

// Recentes primeiro, depois o resto em ordem de nome (já vem ordenado).
function opcoesCanteiros(cad: CadastrosRelato, recentes: string[]): OpcaoPergunta[] {
  const porId = new Map(cad.canteiros.map((c) => [c.id, c]));
  const primeiro = recentes.map((id) => porId.get(id)).filter((c): c is CadastrosRelato["canteiros"][number] => !!c);
  const resto = cad.canteiros.filter((c) => !recentes.includes(c.id));
  return [...primeiro, ...resto].map((c) => ({ valor: c.id, rotulo: c.nome }));
}

// incluirInferidos = modo "Editar" da fila (B4): a coordenação também
// pode trocar o que está "confira". soCampo = só a pergunta desse campo,
// qualquer que seja o status (chips de "Escolher uma que existe").
export function perguntasDoItem(
  item: ItemRelato,
  cad: CadastrosRelato,
  canteirosRecentes: string[] = [],
  incluirInferidos = false,
  soCampo?: string,
): Pergunta[] {
  const lista: Pergunta[] = [];
  const faltando = (campo: string) =>
    soCampo
      ? campo === soCampo
      : item.campos_status[campo] === "faltando" || (incluirInferidos && item.campos_status[campo] === "inferido");
  const p = (campo: string, rotulo: string, tipo: Pergunta["tipo"], opcoes: OpcaoPergunta[], extra: Partial<Pergunta> = {}) =>
    lista.push({ chave: `${item.chave}:${campo}`, itemChave: item.chave, campo, impacto: IMPACTO[campo] ?? 10, rotulo, tipo, opcoes, ...extra });
  const nome = `${ROTULO_TIPO[item.tipo].rotulo}`;

  const perguntaCultura = (culturaNoTexto: string | null) => {
    if (!faltando("cultura_id")) return;
    p("cultura_id", `${nome}: qual cultura?`, "escolha", cad.culturas.map((c) => ({ valor: c.id, rotulo: c.nome })), {
      cadastrarCultura: culturaNoTexto ?? undefined,
    });
  };

  switch (item.tipo) {
    case "compostagem": {
      const d = item.dados as DadosCompostagem;
      const loja = d.loja_no_texto ? ` (${d.loja_no_texto})` : "";
      if (faltando("peso_total_kg")) {
        p(
          "peso_total_kg",
          `Compostagem${loja}: qual o peso total?`,
          d.peso_total_opcoes.length ? "escolha" : "numero",
          d.peso_total_opcoes.map((n) => ({ valor: String(n), rotulo: kg(n) ?? "" })),
        );
      }
      if (faltando("parceiro_id")) {
        p("parceiro_id", `Compostagem: de qual loja${loja ? ` era "${d.loja_no_texto}"` : ""}?`, "escolha", cad.parceiros.map((x) => ({ valor: x.id, rotulo: x.nome })));
      }
      if (faltando("caixas")) {
        p("caixas", `Compostagem${loja}: em quais caixas?`, "multi", cad.caixas.map((c) => ({ valor: c.id, rotulo: `Caixa ${c.numero}` })));
      }
      if (faltando("divisao_caixas") && (d.caixa_ids.length > 1 || (incluirInferidos && d.caixa_ids.length > 0))) {
        p("divisao_caixas", `Compostagem${loja}: como dividir entre as caixas ${d.caixas_numeros.join(" e ")}?`, "escolha", [
          { valor: "igual", rotulo: "Dividir igual" },
          ...d.caixa_ids.map((id, i) => ({ valor: id, rotulo: `Tudo na caixa ${d.caixas_numeros[i]}` })),
        ]);
      }
      break;
    }
    case "plantio": {
      const d = item.dados as DadosPlantio;
      perguntaCultura(d.cultura_no_texto);
      if (faltando("canteiro_id")) p("canteiro_id", `Plantio de ${d.cultura_no_texto ?? "?"}: em qual canteiro?`, "escolha", opcoesCanteiros(cad, canteirosRecentes));
      if (faltando("quantidade")) p("quantidade", `Plantio de ${d.cultura_no_texto ?? "?"}: quantas ${d.unidade ?? "mudas"}?`, "numero", []);
      if (faltando("origem")) {
        p(
          "origem",
          `Plantio de ${d.cultura_no_texto ?? "?"}: veio de quê?`,
          "escolha",
          Object.entries(ROTULO_ORIGEM).map(([valor, rotulo]) => ({ valor, rotulo })),
        );
      }
      break;
    }
    case "colheita": {
      const d = item.dados as DadosColheita;
      if (faltando("peso_kg")) p("peso_kg", `Colheita de ${d.cultura_no_texto ?? "?"}: quantos kg?`, "numero", []);
      if (faltando("plantio_id") && d.canteiro_id) {
        p("plantio_id", `Colheita de ${d.cultura_no_texto ?? "?"}: de qual plantio?`, "plantio", [], {
          canteiroId: d.canteiro_id,
          culturaId: d.cultura_id,
        });
      }
      perguntaCultura(d.cultura_no_texto);
      if (faltando("canteiro_id")) p("canteiro_id", `Colheita de ${d.cultura_no_texto ?? "?"}: de qual canteiro?`, "escolha", opcoesCanteiros(cad, canteirosRecentes));
      break;
    }
    case "manejo": {
      const d = item.dados as DadosManejo;
      const rotulo = d.acao === "poda_planta" ? `Poda de ${d.cultura_no_texto ?? "?"}` : ROTULO_ACAO[d.acao];
      if (faltando("canteiro_ids")) p("canteiro_ids", `${rotulo}: em quais canteiros?`, "multi", opcoesCanteiros(cad, canteirosRecentes));
      if (d.acao === "poda_planta") perguntaCultura(d.cultura_no_texto);
      if (faltando("quantidade_carrinhos")) p("quantidade_carrinhos", `${rotulo}: quantos carrinhos?`, "numero", []);
      if (faltando("tipo_carrinho_id")) p("tipo_carrinho_id", `${rotulo}: qual carrinho?`, "escolha", cad.tipos_carrinho.map((t) => ({ valor: t.id, rotulo: t.nome })));
      break;
    }
    case "doacao": {
      const d = item.dados as DadosDoacao;
      perguntaCultura(d.cultura_no_texto);
      if (faltando("quantidade")) p("quantidade", `Doação de ${d.cultura_no_texto ?? "?"}: quanto (${d.unidade})?`, "numero", []);
      break;
    }
  }
  return lista;
}

// As N perguntas mais importantes do relato inteiro (empate: ordem do texto).
export function perguntasPrioritarias(itens: ItemRelato[], cad: CadastrosRelato, recentes: string[], limite: number): Pergunta[] {
  const ordem = new Map(itens.map((i, n) => [i.chave, n]));
  return itens
    .flatMap((i) => perguntasDoItem(i, cad, recentes))
    .sort((a, b) => a.impacto - b.impacto || (ordem.get(a.itemChave) ?? 0) - (ordem.get(b.itemChave) ?? 0))
    .slice(0, limite);
}

// -----------------------------------------------------------------------------
// Aplicar resposta (devolve um item novo; nunca muta)
// -----------------------------------------------------------------------------

export type Resposta = string | string[] | number;

export function aplicarResposta(item: ItemRelato, campo: string, resposta: Resposta, cad: CadastrosRelato): ItemRelato {
  const status = { ...item.campos_status, [campo]: "certo" as StatusCampo };
  const dados = { ...item.dados } as Record<string, unknown>;

  switch (campo) {
    case "peso_total_kg":
    case "peso_kg":
    case "quantidade":
      dados[campo] = Number(resposta);
      break;
    case "quantidade_carrinhos": {
      const qtd = Number(resposta);
      dados.quantidade_carrinhos = qtd;
      const tipo = cad.tipos_carrinho.find((t) => t.id === dados.tipo_carrinho_id);
      if (!tipo) {
        const azul = cad.tipos_carrinho.find((t) => t.nome.toLowerCase() === "carrinho azul");
        if (azul) {
          dados.tipo_carrinho_id = azul.id;
          dados.tipo_carrinho_assumido = true;
          status.tipo_carrinho_id = "inferido";
        }
      }
      const atual = cad.tipos_carrinho.find((t) => t.id === dados.tipo_carrinho_id);
      dados.peso_kg_calculado = atual ? Math.round(qtd * atual.peso_estimado_kg * 100) / 100 : null;
      break;
    }
    case "tipo_carrinho_id": {
      dados.tipo_carrinho_id = String(resposta);
      dados.tipo_carrinho_assumido = false;
      const tipo = cad.tipos_carrinho.find((t) => t.id === resposta);
      const qtd = dados.quantidade_carrinhos as number | null;
      dados.peso_kg_calculado = tipo && qtd ? Math.round(qtd * tipo.peso_estimado_kg * 100) / 100 : null;
      break;
    }
    case "caixas": {
      const ids = (Array.isArray(resposta) ? resposta : [String(resposta)]).filter((id) => cad.caixas.some((c) => c.id === id));
      dados.caixa_ids = ids;
      dados.caixas_numeros = ids.map((id) => cad.caixas.find((c) => c.id === id)?.numero ?? 0);
      dados.peso_por_caixa = null;
      status.caixas = ids.length ? "certo" : "faltando";
      status.divisao_caixas = ids.length === 1 ? "certo" : "faltando";
      break;
    }
    case "divisao_caixas":
      if (resposta === "igual") {
        dados.peso_por_caixa = null;
        // A RPC divide igual e marca peso_dividido_estimado.
        status.divisao_caixas = "inferido";
      } else {
        const caixa = cad.caixas.find((c) => c.id === resposta);
        if (caixa) {
          dados.caixa_ids = [caixa.id];
          dados.caixas_numeros = [caixa.numero];
          dados.peso_por_caixa = null;
        }
      }
      break;
    case "canteiro_id":
      dados.canteiro_id = String(resposta);
      if ("plantio_id" in dados) {
        dados.plantio_id = null;
        status.plantio_id = "faltando";
      }
      break;
    case "canteiro_ids":
      dados.canteiro_ids = Array.isArray(resposta) ? resposta : [String(resposta)];
      status.canteiro_ids = (dados.canteiro_ids as string[]).length ? "certo" : "faltando";
      break;
    default:
      dados[campo] = resposta;
  }
  return { ...item, dados: dados as unknown as ItemRelato["dados"], campos_status: status };
}
