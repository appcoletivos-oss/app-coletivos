// Fila "Para conferir" (Sprint B, item B4 — SPRINT_B_RELATO_DO_TURNO.md
// seção 6 e SPRINT_B2_HOME_RELATO_FILA.md seção 4). Só coordenação e
// consultor (a RLS de UPDATE de relato_turno_propostas já barra o resto).
//
// Aprovar sem duplicar — como ficou, e por quê (verificado no schema real):
// a SPRINT_B2 pedia reivindicar com `set status = 'aprovada'` antes de criar
// o registro e devolver pra 'pendente' se falhasse. Isso não passa no banco:
//   * a constraint relato_proposta_aprovada_tem_registro exige
//     tabela_registro_gerado e registro_id_gerado quando status = 'aprovada'
//     (a reivindicação sem registro é recusada);
//   * a policy de UPDATE só enxerga linha com status = 'pendente' (a
//     devolução de 'aprovada' pra 'pendente' não acha a linha).
// O gatilho relato_proposta_imutaveis não atrapalha (só protege autor,
// relato, tipo e trecho). Então a reivindicação usa conferido_por/
// conferido_em com a proposta AINDA pendente, sem migration:
//   (a) update conferido_por = eu, conferido_em = agora
//       where id and status = 'pendente' and conferido_por is null -> tem
//       que voltar 1 linha. Duas coordenadoras ao mesmo tempo: o Postgres
//       trava a linha e a segunda reavalia o WHERE já com conferido_por
//       preenchido -> 0 linhas. Dois toques seguidos da mesma pessoa: idem.
//       Não há retomada automática de reivindicação velha.
//   (b) cria o registro oficial com as funções que já existem;
//   (c) grava tabela/id gerado (ainda pendente) e depois status =
//       'aprovada', cada um em até 3 tentativas com espera curta, sempre
//       where id and status = 'pendente' and conferido_por = eu. Gravar o
//       vínculo antes de virar 'aprovada' é o que deixa a seção "Travadas"
//       saber qual registro já existe se a virada falhar;
//   (d) só se (b) falhar: limpa conferido_por/conferido_em (ainda
//       pendente, a policy deixa) e mostra o erro.
//
// "Travadas": pendente com conferido_por preenchido há mais de 5 min (a
// aprovação caiu no meio). Coordenação/consultor decidem na fila: marcar
// como aprovada (o registro já existe) ou liberar pra conferir de novo
// (marcarTravadaComoAprovada / liberarTravada).

import { supabase } from "./supabase";
import { requerSessao } from "./auth";
import { enviarFotoRegistro } from "./patio";
import { salvarRegistroColheita, salvarRegistroManejo } from "./horta";
import { calcularPrevisaoColheita, criarPlantio, listarPlantiosAtivosPorCanteiro } from "./plantios";
import { criarItemIrmao, buscarItemPorId, vincularRegistroAoItem } from "./relatorio-turno";
import { criarDoacaoAlimento } from "./venda";
import type {
  CadastrosRelato,
  DadosColheita,
  DadosCompostagem,
  DadosDoacao,
  DadosManejo,
  DadosPlantio,
  ItemRelato,
  StatusCampo,
  TipoProposta,
} from "./relato";
import type { Cultura, TipoManejo, TurnoPlanejamento } from "./types";

// Reivindicação parada há mais que isso aparece em "Travadas".
export const TRAVADA_APOS_MS = 5 * 60_000;
const TENTATIVAS_FECHAR = 3;
const ESPERA_ENTRE_TENTATIVAS_MS = 800;

export interface PropostaCompleta {
  id: string;
  relato_turno_id: string;
  relatorio_turno_id: string;
  tipo: TipoProposta;
  dados: Record<string, unknown>;
  campos_status: Record<string, StatusCampo>;
  trecho_origem: string;
  avisos: string[];
  status: "pendente" | "aprovada" | "rejeitada";
  conferido_por: string | null;
  conferido_em: string | null;
  motivo_rejeicao: string | null;
  tabela_registro_gerado: string | null;
  registro_id_gerado: string | null;
  criado_por: string;
  criado_em: string;
}

export interface RelatorioResumo {
  id: string;
  data: string;
  turno: TurnoPlanejamento;
}

async function meuUsuario(): Promise<string> {
  await requerSessao();
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Sessão expirada. Entre de novo.");
  return id;
}

// -----------------------------------------------------------------------------
// Leitura
// -----------------------------------------------------------------------------

export async function contarParaConferir(): Promise<number> {
  await requerSessao();
  const [propostas, culturas] = await Promise.all([
    supabase.from("relato_turno_propostas").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("culturas").select("id", { count: "exact", head: true }).eq("revisar", true),
  ]);
  if (propostas.error) throw propostas.error;
  if (culturas.error) throw culturas.error;
  return (propostas.count ?? 0) + (culturas.count ?? 0);
}

export async function listarPropostasPendentes(): Promise<PropostaCompleta[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("relato_turno_propostas")
    .select("*")
    .eq("status", "pendente")
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PropostaCompleta[];
}

export async function listarPropostasConferidas(limite = 50): Promise<PropostaCompleta[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("relato_turno_propostas")
    .select("*")
    .neq("status", "pendente")
    .order("conferido_em", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as PropostaCompleta[];
}

export async function buscarRelatorios(ids: string[]): Promise<Map<string, RelatorioResumo>> {
  if (ids.length === 0) return new Map();
  await requerSessao();
  const { data, error } = await supabase.from("relatorios_turno").select("id, data, turno").in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.id, r as RelatorioResumo]));
}

// user_id (auth) -> nome em membros_equipe. Quem não tiver vínculo fica de fora.
export async function nomesPorUsuario(userIds: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(userIds.filter(Boolean))];
  if (unicos.length === 0) return new Map();
  await requerSessao();
  const { data, error } = await supabase.from("membros_equipe").select("user_id, nome").in("user_id", unicos);
  if (error) throw error;
  return new Map((data ?? []).map((m) => [m.user_id as string, m.nome as string]));
}

// Mesmo recorte da rota de interpretação (só ativos; caixa em descanso ou
// desativada não recebe resíduo). culturasCompletas serve pra previsão de
// colheita do plantio aprovado.
export async function carregarCadastrosRelato(): Promise<{ cadastros: CadastrosRelato; culturasCompletas: Cultura[] }> {
  await requerSessao();
  const [parceiros, caixas, canteiros, culturas, carrinhos] = await Promise.all([
    supabase.from("parceiros").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("caixas").select("id, numero, status").order("numero"),
    supabase.from("canteiros").select("id, nome, tipo").eq("ativo", true).order("nome"),
    supabase.from("culturas").select("*").eq("ativo", true).order("nome"),
    supabase.from("tipos_carrinho").select("id, nome, peso_estimado_kg").eq("ativo", true).order("nome"),
  ]);
  for (const r of [parceiros, caixas, canteiros, culturas, carrinhos]) if (r.error) throw r.error;
  const culturasCompletas = (culturas.data ?? []) as Cultura[];
  return {
    culturasCompletas,
    cadastros: {
      parceiros: parceiros.data ?? [],
      caixas: (caixas.data ?? [])
        .filter((c) => c.status !== "desativada" && c.status !== "descanso")
        .map((c) => ({ id: c.id as string, numero: c.numero as number })),
      canteiros: canteiros.data ?? [],
      culturas: culturasCompletas.map((c) => ({ id: c.id, nome: c.nome })),
      tipos_carrinho: (carrinhos.data ?? []).map((t) => ({ ...t, peso_estimado_kg: Number(t.peso_estimado_kg) })),
    },
  };
}

export function propostaParaItem(p: PropostaCompleta): ItemRelato {
  const { item_planejado_id, ...dados } = p.dados as Record<string, unknown> & { item_planejado_id?: string | null };
  return {
    chave: p.id,
    tipo: p.tipo,
    trecho_origem: p.trecho_origem,
    item_planejado_id: item_planejado_id ?? null,
    dados: dados as unknown as ItemRelato["dados"],
    campos_status: p.campos_status ?? {},
    avisos: Array.isArray(p.avisos) ? p.avisos : [],
  };
}

// Campos obrigatórios pra aprovar (seção 6). Vazio = pode aprovar.
export function obrigatoriosFaltando(item: ItemRelato): string[] {
  const falta: string[] = [];
  // Nome que não existe no cadastro bloqueia até a coordenação decidir.
  if (item.campos_status.cultura_id === "nao_cadastrado") falta.push("cultura não cadastrada");
  if (item.campos_status.canteiro_id === "nao_cadastrado" || item.campos_status.canteiro_ids === "nao_cadastrado") {
    falta.push("canteiro não cadastrado");
  }
  switch (item.tipo) {
    case "compostagem": {
      const d = item.dados as DadosCompostagem;
      if (!d.parceiro_id) falta.push("loja");
      if (!(d.peso_total_kg && d.peso_total_kg > 0)) falta.push("peso total");
      if (!d.caixa_ids?.length) falta.push("caixa");
      break;
    }
    case "plantio": {
      const d = item.dados as DadosPlantio;
      if (!d.cultura_id) falta.push("cultura");
      if (!d.canteiro_id) falta.push("canteiro");
      if (!(d.quantidade && d.quantidade > 0)) falta.push("quantidade");
      if (!d.origem) falta.push("origem");
      break;
    }
    case "colheita": {
      const d = item.dados as DadosColheita;
      if (!d.cultura_id) falta.push("cultura");
      if (!(d.peso_kg && d.peso_kg > 0)) falta.push("peso");
      // Regra central do módulo: colheita sem plantio nunca aprova.
      if (!d.canteiro_id || !d.plantio_id) falta.push("plantio");
      break;
    }
    case "manejo": {
      const d = item.dados as DadosManejo;
      if (!d.canteiro_ids?.length) falta.push("canteiro");
      const comPlanta = d.acao === "poda_planta" && !!d.cultura_id;
      if (!(d.quantidade_carrinhos && d.quantidade_carrinhos > 0) && !comPlanta) {
        falta.push(d.acao === "poda_planta" ? "cultura" : "quantidade de carrinhos");
      }
      break;
    }
    case "doacao": {
      const d = item.dados as DadosDoacao;
      if (!d.cultura_id) falta.push("cultura");
      if (!(d.quantidade && d.quantidade > 0)) falta.push("quantidade");
      break;
    }
  }
  // "cultura não cadastrada" já diz que falta a cultura (idem canteiro).
  return falta.filter(
    (f) => !(f === "cultura" && falta.includes("cultura não cadastrada")) && !(f === "canteiro" && falta.includes("canteiro não cadastrado")),
  );
}

// -----------------------------------------------------------------------------
// Editar / rejeitar
// -----------------------------------------------------------------------------

function dadosParaGravar(item: ItemRelato): Record<string, unknown> {
  return { ...(item.dados as unknown as Record<string, unknown>), item_planejado_id: item.item_planejado_id };
}

export async function editarProposta(id: string, item: ItemRelato): Promise<void> {
  await requerSessao();
  const { data, error } = await supabase
    .from("relato_turno_propostas")
    .update({ dados: dadosParaGravar(item), campos_status: item.campos_status })
    .eq("id", id)
    .eq("status", "pendente")
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Esta proposta já foi conferida por outra pessoa.");
}

export async function rejeitarProposta(id: string, motivo: string): Promise<void> {
  const eu = await meuUsuario();
  const { data, error } = await supabase
    .from("relato_turno_propostas")
    .update({ status: "rejeitada", motivo_rejeicao: motivo.trim(), conferido_por: eu, conferido_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pendente")
    .is("conferido_por", null)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Esta proposta já foi conferida (ou está sendo aprovada) por outra pessoa.");
}

// -----------------------------------------------------------------------------
// Aprovar
// -----------------------------------------------------------------------------

interface RegistroCriado {
  tabela: string;
  id: string;
  todos: string[];
  erroParcial?: string;
}

function juntarObservacoes(...partes: (string | null | undefined)[]): string | null {
  const t = partes.map((p) => p?.trim()).filter(Boolean).join(" · ");
  return t || null;
}

async function criarRegistro(item: ItemRelato, relatorioData: string, culturas: Cultura[]): Promise<RegistroCriado> {
  switch (item.tipo) {
    case "compostagem": {
      const d = item.dados as DadosCompostagem;
      const pesos = new Map((d.peso_por_caixa ?? []).map((p) => [p.caixa_id, p.peso_kg]));
      const bombonasComPeso = d.bombonas.length > 0 && d.bombonas.every((b) => b.peso_kg !== null);
      const obsBombonas = d.bombonas
        .filter((b) => b.observacao)
        .map((b) => `bombona ${b.numero ?? "s/n"}: ${b.observacao}`)
        .join("; ");
      const { data, error } = await supabase.rpc("registrar_alimentacao_por_loja", {
        p_parceiro_id: d.parceiro_id,
        p_tipo_residuo: "alimento",
        p_qtd_bombonas: d.qtd_bombonas ?? d.bombonas.length,
        p_peso_total_kg: d.peso_total_kg,
        p_distribuicao: d.caixa_ids.map((caixa_id) => ({ caixa_id, peso_kg: pesos.get(caixa_id) ?? null })),
        p_bombonas: bombonasComPeso ? d.bombonas.map((b) => ({ numero_bombona: b.numero, peso_kg: b.peso_kg })) : null,
        p_observacao: juntarObservacoes(d.observacao, obsBombonas, "via relato do turno"),
      });
      if (error) throw error;
      // A RPC devolve o coleta_id (agrupa as linhas, uma por caixa): é ele
      // que fica em registro_id_gerado.
      return { tabela: "registros_alimentacao", id: data as string, todos: [data as string] };
    }
    case "plantio": {
      const d = item.dados as DadosPlantio;
      const cultura = culturas.find((c) => c.id === d.cultura_id);
      const { snapshot, previsao } = calcularPrevisaoColheita(cultura?.dias_para_colheita ?? null, relatorioData);
      const plantio = await criarPlantio({
        cultura_id: d.cultura_id as string,
        canteiro_id: d.canteiro_id as string,
        origem: d.origem as NonNullable<DadosPlantio["origem"]>,
        data_inicio: relatorioData,
        quantidade_inicial: d.quantidade,
        unidade: d.unidade,
        dias_para_colheita_snapshot: snapshot,
        previsao_colheita: previsao,
      });
      return { tabela: "plantios", id: plantio.id, todos: [plantio.id] };
    }
    case "colheita": {
      const d = item.dados as DadosColheita;
      const nome = culturas.find((c) => c.id === d.cultura_id)?.nome ?? d.cultura_no_texto ?? "";
      const id = await salvarRegistroColheita({
        canteiro_id: d.canteiro_id as string,
        plantio_id: d.plantio_id as string,
        cultura: nome,
        peso_kg: d.peso_kg as number,
        observacao: juntarObservacoes(d.observacao, "via relato do turno"),
      });
      return { tabela: "registros_colheita", id, todos: [id] };
    }
    case "manejo": {
      const d = item.dados as DadosManejo;
      const tipo: TipoManejo = d.acao === "poda_planta" ? "poda" : d.acao === "outro" ? "outro" : "adubacao";
      const rotuloAcao =
        d.acao === "composto" ? "Composto" : d.acao === "poda_triturada" ? "Poda triturada" : d.acao === "poda_planta" ? "Poda" : null;
      // Não dá pra desfazer (registros_manejo não tem DELETE): um canteiro
      // por vez, e se um falhar no meio a proposta fica aprovada com os que
      // entraram e o erro diz quantos faltaram.
      const ids: string[] = [];
      for (const canteiroId of d.canteiro_ids) {
        let plantioIds: string[] = [];
        try {
          const ativos = await listarPlantiosAtivosPorCanteiro(canteiroId);
          plantioIds = (d.acao === "poda_planta" ? ativos.filter((p) => p.cultura_id === d.cultura_id) : ativos).map((p) => p.id);
        } catch {
          // Sem a lista, o manejo entra sem vínculo com plantio.
        }
        try {
          ids.push(
            await salvarRegistroManejo({
              canteiro_id: canteiroId,
              tipo_manejo: tipo,
              observacao: juntarObservacoes(rotuloAcao, d.observacao, "via relato do turno"),
              tipo_carrinho_id: d.quantidade_carrinhos ? d.tipo_carrinho_id : null,
              quantidade_carrinhos: d.quantidade_carrinhos,
              peso_kg_calculado: d.peso_kg_calculado,
              tipo_carrinho_assumido: d.tipo_carrinho_assumido,
              plantioIds,
            }),
          );
        } catch (e) {
          if (ids.length === 0) throw e;
          return {
            tabela: "registros_manejo",
            id: ids[0],
            todos: ids,
            erroParcial: `Aprovada só em ${ids.length} de ${d.canteiro_ids.length} canteiros: registre o resto pelo Manejo.`,
          };
        }
      }
      return { tabela: "registros_manejo", id: ids[0], todos: ids };
    }
    case "doacao": {
      const d = item.dados as DadosDoacao;
      const doacao = await criarDoacaoAlimento({
        registro_colheita_id: d.registro_colheita_id,
        cultura_id: d.cultura_id,
        quantidade: d.quantidade,
        unidade: d.unidade,
        destino: d.destino,
        foto_url: null,
        foto_pendente: true,
        observacao: juntarObservacoes(d.observacao, "via relato do turno"),
      });
      return { tabela: "doacoes_alimento", id: doacao.id, todos: [doacao.id] };
    }
    default:
      throw new Error("Tipo de proposta desconhecido.");
  }
}

// Melhor esforço: liga o registro ao item do checklist que o relato
// marcou (item já com registro -> item irmão, como em "Registrar dado").
async function vincularAoChecklist(itemPlanejadoId: string | null, tabela: string, registroId: string): Promise<void> {
  if (!itemPlanejadoId) return;
  try {
    const item = await buscarItemPorId(itemPlanejadoId);
    if (!item) return;
    const alvo = item.registro_id_gerado ? await criarItemIrmao(item) : item;
    await vincularRegistroAoItem(alvo.id, tabela, registroId);
  } catch {
    // O registro oficial já existe; o vínculo com o checklist é só conveniência.
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// true = voltou 1 linha. Erro de rede ou 0 linhas: tenta de novo, com
// espera crescente, até TENTATIVAS_FECHAR vezes.
async function comTentativas(
  executar: () => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<boolean> {
  for (let tentativa = 1; tentativa <= TENTATIVAS_FECHAR; tentativa += 1) {
    try {
      const { data, error } = await executar();
      if (!error && data && data.length > 0) return true;
      if (error) console.error("[conferir] tentativa", tentativa, error);
    } catch (e) {
      console.error("[conferir] tentativa", tentativa, e);
    }
    if (tentativa < TENTATIVAS_FECHAR) await esperar(ESPERA_ENTRE_TENTATIVAS_MS * tentativa);
  }
  return false;
}

export async function aprovarProposta(
  proposta: PropostaCompleta,
  item: ItemRelato,
  relatorioData: string,
  culturas: Cultura[],
): Promise<{ aviso?: string }> {
  const falta = obrigatoriosFaltando(item);
  if (falta.length > 0) throw new Error(`Falta: ${falta.join(", ")}.`);
  const eu = await meuUsuario();

  // (a) reivindica
  const { data: reivindicada, error: erroReivindicar } = await supabase
    .from("relato_turno_propostas")
    .update({ conferido_por: eu, conferido_em: new Date().toISOString() })
    .eq("id", proposta.id)
    .eq("status", "pendente")
    .is("conferido_por", null)
    .select("id");
  if (erroReivindicar) throw erroReivindicar;
  if (!reivindicada?.length) throw new Error("Outra pessoa já está conferindo (ou já conferiu) esta proposta.");

  // (b) cria o registro oficial; (d) devolve se falhar
  let criado: RegistroCriado;
  try {
    criado = await criarRegistro(item, relatorioData, culturas);
  } catch (e) {
    await supabase
      .from("relato_turno_propostas")
      .update({ conferido_por: null, conferido_em: null })
      .eq("id", proposta.id)
      .eq("status", "pendente")
      .eq("conferido_por", eu);
    const mensagem = e instanceof Error ? e.message : "";
    throw new Error(`Não deu pra criar o registro. ${mensagem}`.trim());
  }

  // (c) grava o vínculo (ainda pendente) e fecha a proposta
  const dados = dadosParaGravar(item);
  if (criado.todos.length > 1) dados.registros_gerados = criado.todos;
  const vinculou = await comTentativas(() =>
    supabase
      .from("relato_turno_propostas")
      .update({ tabela_registro_gerado: criado.tabela, registro_id_gerado: criado.id, dados, campos_status: item.campos_status })
      .eq("id", proposta.id)
      .eq("status", "pendente")
      .eq("conferido_por", eu)
      .select("id"),
  );
  const fechou =
    vinculou &&
    (await comTentativas(() =>
      supabase
        .from("relato_turno_propostas")
        .update({ status: "aprovada", conferido_em: new Date().toISOString() })
        .eq("id", proposta.id)
        .eq("status", "pendente")
        .eq("conferido_por", eu)
        .select("id"),
    ));
  if (!fechou) {
    console.error("[conferir] registro criado mas proposta não fechada", proposta.id, criado);
    throw new Error(
      'O registro foi criado, mas a proposta não foi marcada como aprovada. Ela vai aparecer em "Travadas" daqui a 5 minutos: não aprove de novo.',
    );
  }

  await vincularAoChecklist(item.item_planejado_id, criado.tabela, criado.id);
  return { aviso: criado.erroParcial };
}

// -----------------------------------------------------------------------------
// Travadas (aprovação que caiu no meio)
// -----------------------------------------------------------------------------

export function estaTravada(p: PropostaCompleta, agora: number): boolean {
  return (
    p.status === "pendente" &&
    !!p.conferido_por &&
    !!p.conferido_em &&
    agora - new Date(p.conferido_em).getTime() > TRAVADA_APOS_MS
  );
}

export interface RegistroCandidato {
  tabela: string;
  id: string;
  quando: string;
}

const TABELA_POR_TIPO: Record<TipoProposta, { tabela: string; coluna_data: string; id: string; observacao: boolean }> = {
  compostagem: { tabela: "registros_alimentacao", coluna_data: "registrado_em", id: "coleta_id", observacao: true },
  plantio: { tabela: "plantios", coluna_data: "criado_em", id: "id", observacao: false },
  colheita: { tabela: "registros_colheita", coluna_data: "registrado_em", id: "id", observacao: true },
  manejo: { tabela: "registros_manejo", coluna_data: "registrado_em", id: "id", observacao: true },
  doacao: { tabela: "doacoes_alimento", coluna_data: "criado_em", id: "id", observacao: true },
};

// Qual registro a aprovação travada criou. Se o vínculo chegou a ser
// gravado (passo c), é ele. Senão, procura o que quem reivindicou gravou
// na tabela do tipo entre 1 min antes e 15 min depois da reivindicação
// (com "via relato do turno" na observação, quando a tabela tem). Pode
// voltar vazio (o registro não chegou a ser criado) ou mais de um.
export async function registrosDaTravada(p: PropostaCompleta): Promise<RegistroCandidato[]> {
  if (p.tabela_registro_gerado && p.registro_id_gerado) {
    return [{ tabela: p.tabela_registro_gerado, id: p.registro_id_gerado, quando: p.conferido_em ?? p.criado_em }];
  }
  if (!p.conferido_por || !p.conferido_em) return [];
  await requerSessao();
  const alvo = TABELA_POR_TIPO[p.tipo];
  const base = new Date(p.conferido_em).getTime();
  let consulta = supabase
    .from(alvo.tabela)
    .select(`${alvo.id}, ${alvo.coluna_data}`)
    .eq("registrado_por", p.conferido_por)
    .gte(alvo.coluna_data, new Date(base - 60_000).toISOString())
    .lte(alvo.coluna_data, new Date(base + 15 * 60_000).toISOString());
  if (alvo.observacao) consulta = consulta.ilike("observacao", "%via relato do turno%");
  const { data, error } = await consulta;
  if (error) throw error;
  const linhas = (data ?? []) as unknown as Record<string, string>[];
  const vistos = new Map<string, RegistroCandidato>();
  for (const l of linhas) {
    const id = l[alvo.id];
    if (id && !vistos.has(id)) vistos.set(id, { tabela: alvo.tabela, id, quando: l[alvo.coluna_data] });
  }
  return [...vistos.values()];
}

// "Marcar como aprovada (o registro já existe)". conferido_por passa a
// ser quem marcou: a policy só aceita conferido_por = auth.uid().
export async function marcarTravadaComoAprovada(p: PropostaCompleta, registro: RegistroCandidato): Promise<void> {
  const eu = await meuUsuario();
  const { data, error } = await supabase
    .from("relato_turno_propostas")
    .update({
      status: "aprovada",
      tabela_registro_gerado: registro.tabela,
      registro_id_gerado: registro.id,
      conferido_por: eu,
      conferido_em: new Date().toISOString(),
    })
    .eq("id", p.id)
    .eq("status", "pendente")
    .eq("conferido_por", p.conferido_por as string)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Esta proposta mudou enquanto você olhava. Recarregue a fila.");
  await vincularAoChecklist(propostaParaItem(p).item_planejado_id, registro.tabela, registro.id);
}

// "Liberar para conferir de novo": volta a pendente sem dono e sem
// vínculo. Só faz sentido quando o registro NÃO foi criado (senão a
// próxima aprovação duplica) — a tela avisa.
export async function liberarTravada(p: PropostaCompleta): Promise<void> {
  await requerSessao();
  const { data, error } = await supabase
    .from("relato_turno_propostas")
    .update({ conferido_por: null, conferido_em: null, tabela_registro_gerado: null, registro_id_gerado: null })
    .eq("id", p.id)
    .eq("status", "pendente")
    .eq("conferido_por", p.conferido_por as string)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Esta proposta mudou enquanto você olhava. Recarregue a fila.");
}

// -----------------------------------------------------------------------------
// Culturas novas (A.1 9b item 5)
// -----------------------------------------------------------------------------

export async function listarCulturasParaRevisar(): Promise<{ id: string; nome: string; criada_por: string | null }[]> {
  await requerSessao();
  const { data, error } = await supabase.from("culturas").select("id, nome, criada_por").eq("revisar", true).order("nome");
  if (error) throw error;
  return data ?? [];
}

// "Está certo assim": limpa a flag sem editar (editar a ficha é em Mais ->
// Cadastro -> Culturas).
export async function confirmarCultura(id: string): Promise<void> {
  await requerSessao();
  const { error } = await supabase.from("culturas").update({ revisar: false }).eq("id", id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Fotos de doação pendentes (B2c)
// -----------------------------------------------------------------------------

export interface DoacaoFotoPendente {
  id: string;
  cultura_id: string | null;
  quantidade: number | null;
  unidade: string;
  destino: string | null;
  criado_em: string;
  cultura_nome: string | null;
}

// ids: só essas (ex.: as doações geradas por um relatório). Sem ids: todas.
export async function listarDoacoesFotoPendente(ids?: string[]): Promise<DoacaoFotoPendente[]> {
  if (ids && ids.length === 0) return [];
  await requerSessao();
  let consulta = supabase
    .from("doacoes_alimento")
    .select("id, cultura_id, quantidade, unidade, destino, criado_em, culturas(nome)")
    .eq("foto_pendente", true)
    .order("criado_em", { ascending: false });
  if (ids) consulta = consulta.in("id", ids);
  const { data, error } = await consulta;
  if (error) throw error;
  return (data ?? []).map(({ culturas, ...d }) => ({
    ...(d as Omit<DoacaoFotoPendente, "cultura_nome">),
    cultura_nome: (culturas as { nome?: string } | null)?.nome ?? null,
  }));
}

// UPDATE só de foto_url: o gatilho da B2c confere quem pode e zera
// foto_pendente sozinho.
export async function anexarFotoDoacao(id: string, foto: File): Promise<void> {
  const caminho = await enviarFotoRegistro(foto, "doacao-alimento");
  const { error } = await supabase.from("doacoes_alimento").update({ foto_url: caminho }).eq("id", id);
  if (error) throw error;
}
