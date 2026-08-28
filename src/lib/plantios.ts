// Funções de acesso a dados do rastreio de plantio ponta a ponta (Horta →
// Registrar plantio / Confirmar germinação / Transplantar / Mapa /
// Registrar colheita / Registrar perda / Registrar doação / Manejo).
// Mesmo padrão de patio.ts/horta.ts: centraliza as chamadas ao Supabase
// pra não espalhar `.from(...)` pelas telas.
//
// Ver supabase/migrations/20260827130000_horta_plantios.sql e
// HANDOFF_HORTA_COMPLETO.md (v3) pro modelo completo.

import { supabase } from "./supabase";
import { requerSessao } from "./auth";
import { listarCanteiros } from "./patio";
import type {
  CicloProdutivo,
  EstoqueViveiroCultura,
  NovaPlantioDoacao,
  NovoPlantio,
  NovoRegistroPerda,
  Plantio,
  PlantioComCultura,
  PlantioDoacao,
  RegimeManejoCultura,
  RegistroPerda,
  TipoCanteiro,
  TipoManejoRegime,
} from "./types";

// Tipos de canteiro que contam como "viveiro" pro Estoque do viveiro —
// cobre muda em bandeja/saco e germinação em geodésica. Ver
// HANDOFF_HORTA_COMPLETO.md e pedido do usuário, 2026-08-28.
const TIPOS_CANTEIRO_VIVEIRO: TipoCanteiro[] = ["geodesica", "bandeja_muda", "saco_muda"];

// plantios com o nome e o ciclo_produtivo da cultura já resolvidos (join),
// status ativo ou germinando — é o que as telas de seleção (Registrar
// colheita, Manejo, Transplantar, Registrar perda/doação) mostram no passo
// "qual plantio?". ciclo_produtivo alimenta o valor de partida do
// checkbox "essa colheita encerra o plantio?" em Registrar colheita.
function mapearComCultura(
  linhas: (Plantio & { culturas: { nome: string; ciclo_produtivo: CicloProdutivo } | null })[],
): PlantioComCultura[] {
  return linhas.map(({ culturas, ...plantio }) => ({
    ...plantio,
    cultura_nome: culturas?.nome ?? "—",
    cultura_ciclo_produtivo: culturas?.ciclo_produtivo ?? "unico",
  }));
}

export async function listarPlantiosAtivosPorCanteiro(canteiroId: string): Promise<PlantioComCultura[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("plantios")
    .select("*, culturas(nome, ciclo_produtivo)")
    .eq("canteiro_id", canteiroId)
    .in("status", ["ativo", "germinando"])
    .order("criado_em", { ascending: false });

  if (error) throw error;
  return mapearComCultura(data ?? []);
}

// Plantios do canteiro pro Mapa: além de ativo/germinando, inclui também
// status="transplantado" — o lote segue existindo como nó da linhagem (a
// planta não sumiu, só se moveu 100% pra outro canteiro), e precisa
// continuar aparecendo (como nó fechado/histórico) pra rastreabilidade de
// ponta a ponta não virar beco sem saída. As demais telas (Registrar
// colheita, Manejo, Transplantar) usam listarPlantiosAtivosPorCanteiro, que
// segue mostrando só o que ainda está de pé.
export async function listarPlantiosParaMapaPorCanteiro(canteiroId: string): Promise<PlantioComCultura[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("plantios")
    .select("*, culturas(nome, ciclo_produtivo)")
    .eq("canteiro_id", canteiroId)
    .in("status", ["ativo", "germinando", "transplantado"])
    .order("criado_em", { ascending: false });

  if (error) throw error;
  return mapearComCultura(data ?? []);
}

// Plantios só em status "germinando" — é o que Confirmar germinação
// mostra pra escolher qual lote confirmar.
export async function listarPlantiosGerminando(): Promise<PlantioComCultura[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("plantios")
    .select("*, culturas(nome, ciclo_produtivo)")
    .eq("status", "germinando")
    .order("data_inicio", { ascending: true });

  if (error) throw error;
  return mapearComCultura(data ?? []);
}

export async function listarPlantioPorId(id: string): Promise<PlantioComCultura | null> {
  await requerSessao();
  const { data, error } = await supabase
    .from("plantios")
    .select("*, culturas(nome, ciclo_produtivo)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapearComCultura([data])[0] : null;
}

// Cria um lote novo. dias_para_colheita_snapshot/previsao_colheita vêm
// prontos de quem chama (a tela já tem a ficha da cultura carregada — ver
// Registrar plantio, calcularPrevisaoColheita). origem=semente entra como
// "germinando"; as demais entram direto como "ativo" (ver handoff, seção 4).
export async function criarPlantio(dados: NovoPlantio): Promise<Plantio> {
  await requerSessao();
  const { data, error } = await supabase
    .from("plantios")
    .insert({
      cultura_id: dados.cultura_id,
      canteiro_id: dados.canteiro_id,
      origem: dados.origem,
      data_inicio: dados.data_inicio ?? new Date().toISOString().slice(0, 10),
      quantidade_inicial: dados.quantidade_inicial ?? null,
      unidade: dados.unidade?.trim() || null,
      dias_para_colheita_snapshot: dados.dias_para_colheita_snapshot ?? null,
      previsao_colheita: dados.previsao_colheita ?? null,
      status: dados.status ?? (dados.origem === "semente" ? "germinando" : "ativo"),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

// Confirma a germinação de um lote (origem=semente): registra data e
// quantidade germinada, e move o status pra "ativo".
export async function confirmarGerminacao(
  plantioId: string,
  dados: { data_germinacao: string; quantidade_germinada: number },
): Promise<void> {
  await requerSessao();
  const { error } = await supabase
    .from("plantios")
    .update({
      data_germinacao: dados.data_germinacao,
      quantidade_germinada: dados.quantidade_germinada,
      status: "ativo",
    })
    .eq("id", plantioId);

  if (error) throw error;
}

// Marca um plantio como perdido/doado/encerrado direto pelo card (sem
// passar por um registro formal de registros_perdas/plantio_doacoes) — ver
// handoff, seção 4, linha "Plantio → marcar como perdido/doado/encerrado".
//
// Regra de negócio (pedido do usuário, 2026-08-28): nada pode ficar sem
// status — ao encerrar um plantio que ainda tem saldo não transplantado
// (plantios_saldo > 0, descontando o que já virou transplante/perda/
// doação formal), o sistema cria sozinho um registro de perda automática
// com esse saldo, ANTES de confirmar a mudança de status. Chamadas
// sequenciais (não é uma transação real) — mesmo risco aceito já descrito
// no topo da migration 20260827130000 pra registrarTransplante.
export async function marcarStatusPlantio(
  plantioId: string,
  status: "perdido" | "doado" | "encerrado" | "colhido",
): Promise<void> {
  await requerSessao();

  if (status === "encerrado") {
    const saldo = await buscarSaldoPlantio(plantioId);
    if (saldo !== null && saldo > 0) {
      const { data: plantio, error: erroPlantio } = await supabase
        .from("plantios")
        .select("unidade")
        .eq("id", plantioId)
        .single();
      if (erroPlantio) throw erroPlantio;

      const { error: erroPerda } = await supabase.from("registros_perdas").insert({
        plantio_id: plantioId,
        quantidade: saldo,
        unidade: plantio?.unidade ?? null,
        motivo: "perda automática — bandeja encerrada, saldo não transplantado",
      });
      if (erroPerda) throw erroPerda;
    }
  }

  const { error } = await supabase.from("plantios").update({ status }).eq("id", plantioId);
  if (error) throw error;
}

// Encerra um plantio "por desativação da estrutura" (handoff Mais/Pacote 1,
// seção 1): o canteiro foi inativado e a planta é perene, não dava pra
// mover nem colher. Diferente de marcarStatusPlantio("encerrado"): NÃO cria
// perda automática — encerramento por decisão operacional não é perda real
// e não pode poluir os relatórios de produtividade. Guarda o motivo em
// observacao_encerramento.
export async function encerrarPlantioPorDesativacao(
  plantioId: string,
  observacao: string,
): Promise<void> {
  await requerSessao();
  const { error } = await supabase
    .from("plantios")
    .update({
      status: "encerrado_por_desativacao",
      observacao_encerramento: observacao.trim() || null,
    })
    .eq("id", plantioId);
  if (error) throw error;
}

// Saldo disponível de um plantio (view plantios_saldo — sempre calculado).
export async function buscarSaldoPlantio(plantioId: string): Promise<number | null> {
  await requerSessao();
  const { data, error } = await supabase
    .from("plantios_saldo")
    .select("quantidade_disponivel")
    .eq("id", plantioId)
    .maybeSingle();

  if (error) throw error;
  return data?.quantidade_disponivel ?? null;
}

// Estoque do viveiro (Horta → Estoque do viveiro): agrupa plantios_saldo
// por cultura, olhando todo plantio germinando/ativo cujo canteiro é do
// tipo geodesica/bandeja_muda/saco_muda — cobre qualquer origem (compra,
// sobra de transplante, germinação própria ainda não alocada). Dois
// números sempre separados (germinando vs. disponível, nunca somados) —
// pedido explícito do usuário, 2026-08-28. Consulta pura sobre
// plantios_saldo/plantios/culturas já existentes, sem mudança de schema —
// mesmo espírito client-side de calcularDemandasHorta.
export async function listarEstoqueViveiro(): Promise<EstoqueViveiroCultura[]> {
  await requerSessao();

  const canteiros = await listarCanteiros();
  const canteirosViveiro = canteiros.filter((c) => TIPOS_CANTEIRO_VIVEIRO.includes(c.tipo));
  if (canteirosViveiro.length === 0) return [];
  const canteiroNomePorId = new Map(canteirosViveiro.map((c) => [c.id, c.nome]));

  const { data: plantiosData, error: erroPlantios } = await supabase
    .from("plantios")
    .select("id, cultura_id, canteiro_id, origem, data_inicio, unidade, status, culturas(nome)")
    .in("canteiro_id", canteirosViveiro.map((c) => c.id))
    .in("status", ["germinando", "ativo"]);
  if (erroPlantios) throw erroPlantios;

  // Supabase-js sem tipagem de schema infere relação embutida como array
  // mesmo sendo many-to-one (mesma nota de calcularDemandasHorta acima) —
  // na prática vem sempre com 0 ou 1 item.
  type LinhaPlantioViveiro = {
    id: string;
    cultura_id: string;
    canteiro_id: string;
    origem: Plantio["origem"];
    data_inicio: string;
    unidade: string | null;
    status: "germinando" | "ativo";
    culturas: { nome: string }[];
  };
  const plantios = (plantiosData ?? []) as LinhaPlantioViveiro[];
  if (plantios.length === 0) return [];

  const { data: saldosData, error: erroSaldos } = await supabase
    .from("plantios_saldo")
    .select("id, quantidade_disponivel")
    .in("id", plantios.map((p) => p.id));
  if (erroSaldos) throw erroSaldos;
  const saldoPorId = new Map((saldosData ?? []).map((s) => [s.id, s.quantidade_disponivel ?? 0]));

  const porCultura = new Map<string, EstoqueViveiroCultura>();
  for (const p of plantios) {
    const saldo = saldoPorId.get(p.id) ?? 0;
    const atual = porCultura.get(p.cultura_id) ?? {
      culturaId: p.cultura_id,
      culturaNome: p.culturas[0]?.nome ?? "—",
      germinando: 0,
      disponivel: 0,
      lotes: [],
    };
    if (p.status === "germinando") atual.germinando += saldo;
    else atual.disponivel += saldo;
    atual.lotes.push({
      plantioId: p.id,
      canteiroId: p.canteiro_id,
      canteiroNome: canteiroNomePorId.get(p.canteiro_id) ?? "—",
      origem: p.origem,
      dataInicio: p.data_inicio,
      quantidade: saldo,
      unidade: p.unidade,
      status: p.status,
    });
    porCultura.set(p.cultura_id, atual);
  }

  return [...porCultura.values()].sort((a, b) => a.culturaNome.localeCompare(b.culturaNome));
}

// Linhagem completa de um plantio (semente → germinação → transplante(s) →
// lote atual + descendentes, "pra onde foi"), subindo/descendo por
// plantio_pai_id — ver função linhagem_plantio() na migration.
export async function linhagemPlantio(plantioId: string): Promise<Plantio[]> {
  await requerSessao();
  const { data, error } = await supabase.rpc("linhagem_plantio", { p_plantio_id: plantioId });
  if (error) throw error;
  return data ?? [];
}

// Registra um transplante, com ou sem divisão de lote. Chamadas
// sequenciais (não é uma transação real) — mesmo padrão já usado em
// encerrarESubstituirParceiro/Canteiro (lib/patio.ts): 1) cria o lote
// filho (origem=divisao); 2) registra o vínculo em plantio_transplantes;
// 3) se a quantidade transplantada esgotou o saldo do lote de origem (ou
// nenhuma quantidade foi informada), marca o lote de origem como
// "transplantado".
export async function registrarTransplante(dados: {
  plantioOrigem: Plantio;
  canteiroDestinoId: string;
  quantidade: number | null;
  observacao?: string | null;
  fotoUrl?: string | null;
}): Promise<Plantio> {
  await requerSessao();
  const { plantioOrigem, canteiroDestinoId, quantidade, observacao, fotoUrl } = dados;

  const destino = await criarPlantio({
    cultura_id: plantioOrigem.cultura_id,
    canteiro_id: canteiroDestinoId,
    origem: "divisao",
    quantidade_inicial: quantidade,
    unidade: plantioOrigem.unidade,
    dias_para_colheita_snapshot: plantioOrigem.dias_para_colheita_snapshot,
    previsao_colheita: plantioOrigem.dias_para_colheita_snapshot
      ? new Date(Date.now() + plantioOrigem.dias_para_colheita_snapshot * 86400000)
          .toISOString()
          .slice(0, 10)
      : null,
    status: "ativo",
  });

  const { error: erroVinculo } = await supabase.from("plantio_transplantes").insert({
    plantio_origem_id: plantioOrigem.id,
    plantio_destino_id: destino.id,
    canteiro_destino_id: canteiroDestinoId,
    quantidade,
    observacao: observacao?.trim() || null,
    foto_url: fotoUrl ?? null,
  });
  if (erroVinculo) throw erroVinculo;

  const saldo = await buscarSaldoPlantio(plantioOrigem.id);
  if (quantidade === null || saldo === null || saldo <= 0) {
    await supabase.from("plantios").update({ status: "transplantado" }).eq("id", plantioOrigem.id);
  }

  return destino;
}

export async function registrarPerda(dados: NovoRegistroPerda): Promise<RegistroPerda> {
  await requerSessao();
  const { data, error } = await supabase
    .from("registros_perdas")
    .insert({
      plantio_id: dados.plantio_id,
      quantidade: dados.quantidade ?? null,
      unidade: dados.unidade?.trim() || null,
      motivo: dados.motivo?.trim() || null,
      foto_url: dados.foto_url ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function registrarDoacaoPlantio(dados: NovaPlantioDoacao): Promise<PlantioDoacao> {
  await requerSessao();
  const { data, error } = await supabase
    .from("plantio_doacoes")
    .insert({
      plantio_id: dados.plantio_id,
      quantidade: dados.quantidade ?? null,
      unidade: dados.unidade?.trim() || null,
      destino: dados.destino?.trim() || null,
      observacao: dados.observacao?.trim() || null,
      foto_url: dados.foto_url ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

// Vincula um registro de manejo já salvo aos plantios afetados
// (registros_manejo_plantios). Adubação/capina: quem chama já sabe quais
// plantios estão ativos no canteiro (mesma lista de
// listarPlantiosAtivosPorCanteiro) e passa todos, sem pedir escolha na
// tela. Poda/raleamento: quem chama passa só os plantios escolhidos
// manualmente.
export async function vincularManejoAPlantios(
  registroManejoId: string,
  plantioIds: string[],
): Promise<void> {
  if (plantioIds.length === 0) return;
  await requerSessao();
  const { error } = await supabase
    .from("registros_manejo_plantios")
    .insert(plantioIds.map((plantio_id) => ({ registro_manejo_id: registroManejoId, plantio_id })));

  if (error) throw error;
}

// Calcula dias_para_colheita_snapshot/previsao_colheita a partir da ficha
// de cultura escolhida — cópia do valor no momento do plantio (memória
// histórica: se a ficha for editada depois, o plantio já criado não muda).
export function calcularPrevisaoColheita(
  diasParaColheita: number | null,
  dataInicio: string,
): { snapshot: number | null; previsao: string | null } {
  if (!diasParaColheita) return { snapshot: null, previsao: null };
  return { snapshot: diasParaColheita, previsao: somarDias(dataInicio, diasParaColheita) };
}

function somarDias(dataBase: string, dias: number): string {
  const data = new Date(`${dataBase}T00:00:00`);
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

// -----------------------------------------------------------------------------
// Motor de "demandas do dia" (HANDOFF_HORTA_COMPLETO.md, v3, seção 3.10a) —
// germinação/transplante/colheita previstos + manejo periódico devido, por
// plantio. Não é uma view no banco (o handoff é explícito: "fica como
// implementação de aplicação") — recalculada sempre que a tela é aberta,
// volume ainda pequeno o bastante (fase piloto) pra agregar em JS, mesmo
// espírito de resumoAlimentacaoPorCaixa (lib/patio.ts).
// -----------------------------------------------------------------------------

export type TipoDemanda = "germinacao" | "transplante" | "colheita" | TipoManejoRegime;
export type SituacaoDemanda = "atrasado" | "hoje" | "em_breve";

export interface DemandaHorta {
  tipo: TipoDemanda;
  plantioId: string;
  culturaNome: string;
  canteiroId: string;
  dataDevida: string;
  situacao: SituacaoDemanda;
}

type LinhaPlantioParaDemanda = Plantio & {
  culturas: { nome: string; dias_para_germinacao: number | null; dias_para_transplante: number | null } | null;
};

// Supabase-js sem tipagem de schema (createClient sem generic, ver
// lib/supabase.ts) infere relação embutida como array mesmo sendo
// many-to-one (registros_manejo_plantios.registro_manejo_id -> um único
// registros_manejo) — na prática vem sempre com 0 ou 1 item.
type LinhaManejoPlantio = {
  plantio_id: string;
  registros_manejo: { tipo_manejo: TipoManejoRegime; registrado_em: string }[];
};

function situacaoDemanda(dataDevida: string): SituacaoDemanda {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${dataDevida}T00:00:00`);
  const dias = Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) return "atrasado";
  if (dias === 0) return "hoje";
  return "em_breve";
}

// IDs "impossíveis" pra passar em `.in(...)` quando a lista real está
// vazia — o Postgrest aceita, e devolve nenhuma linha (equivalente a não
// fazer a consulta, sem precisar de um `if` separado pra cada chamada).
const NENHUM_ID = ["00000000-0000-0000-0000-000000000000"];

export async function calcularDemandasHorta(): Promise<DemandaHorta[]> {
  await requerSessao();

  const { data: plantiosData, error: erroPlantios } = await supabase
    .from("plantios")
    .select("*, culturas(nome, dias_para_germinacao, dias_para_transplante)")
    .in("status", ["ativo", "germinando"]);
  if (erroPlantios) throw erroPlantios;

  const plantios = (plantiosData ?? []) as LinhaPlantioParaDemanda[];
  const plantioIds = plantios.map((p) => p.id);
  const culturaIds = [...new Set(plantios.map((p) => p.cultura_id))];

  const [regimeRes, transplantesRes, manejoRes] = await Promise.all([
    supabase
      .from("culturas_regime_manejo")
      .select("*")
      .in("cultura_id", culturaIds.length ? culturaIds : NENHUM_ID),
    supabase
      .from("plantio_transplantes")
      .select("plantio_destino_id, registrado_em")
      .in("plantio_destino_id", plantioIds.length ? plantioIds : NENHUM_ID),
    supabase
      .from("registros_manejo_plantios")
      .select("plantio_id, registros_manejo(tipo_manejo, registrado_em)")
      .in("plantio_id", plantioIds.length ? plantioIds : NENHUM_ID),
  ]);
  if (regimeRes.error) throw regimeRes.error;
  if (transplantesRes.error) throw transplantesRes.error;
  if (manejoRes.error) throw manejoRes.error;

  const regimePorCultura = new Map<string, RegimeManejoCultura[]>();
  for (const regra of (regimeRes.data ?? []) as RegimeManejoCultura[]) {
    const lista = regimePorCultura.get(regra.cultura_id) ?? [];
    lista.push(regra);
    regimePorCultura.set(regra.cultura_id, lista);
  }

  const transplanteMarcoPorPlantio = new Map<string, string>();
  for (const t of (transplantesRes.data ?? []) as { plantio_destino_id: string; registrado_em: string }[]) {
    transplanteMarcoPorPlantio.set(t.plantio_destino_id, t.registrado_em.slice(0, 10));
  }

  // Última ocorrência de cada tipo de manejo, por plantio — base pra saber
  // se a regra já rodou alguma vez (senão a 1ª data devida é
  // marco+dias_inicio) ou já rodou antes (próxima é última+intervalo_dias).
  const ultimaOcorrencia = new Map<string, string>();
  for (const linha of (manejoRes.data ?? []) as LinhaManejoPlantio[]) {
    const manejo = linha.registros_manejo[0];
    if (!manejo) continue;
    const chave = `${linha.plantio_id}:${manejo.tipo_manejo}`;
    const atual = ultimaOcorrencia.get(chave);
    if (!atual || manejo.registrado_em > atual) {
      ultimaOcorrencia.set(chave, manejo.registrado_em);
    }
  }

  const demandas: DemandaHorta[] = [];

  for (const p of plantios) {
    const culturaNome = p.culturas?.nome ?? "—";

    // Germinação esperada — só plantios ainda "germinando".
    if (p.status === "germinando" && p.culturas?.dias_para_germinacao) {
      const data = somarDias(p.data_inicio, p.culturas.dias_para_germinacao);
      demandas.push({ tipo: "germinacao", plantioId: p.id, culturaNome, canteiroId: p.canteiro_id, dataDevida: data, situacao: situacaoDemanda(data) });
    }

    // Transplante recomendado — só plantios já ativos (germinação
    // confirmada) que a ficha da cultura recomenda mover.
    if (p.status === "ativo" && p.culturas?.dias_para_transplante) {
      const marco = p.data_germinacao ?? p.data_inicio;
      const data = somarDias(marco, p.culturas.dias_para_transplante);
      demandas.push({ tipo: "transplante", plantioId: p.id, culturaNome, canteiroId: p.canteiro_id, dataDevida: data, situacao: situacaoDemanda(data) });
    }

    // Colheita prevista — já calculada no plantio (snapshot da ficha no
    // momento do plantio).
    if (p.status === "ativo" && p.previsao_colheita) {
      demandas.push({ tipo: "colheita", plantioId: p.id, culturaNome, canteiroId: p.canteiro_id, dataDevida: p.previsao_colheita, situacao: situacaoDemanda(p.previsao_colheita) });
    }

    // Manejo periódico — cruza a regra da cultura com o histórico real
    // daquele plantio (ver handoff, seção 3.10a).
    for (const regra of regimePorCultura.get(p.cultura_id) ?? []) {
      let marco: string | null = null;
      if (regra.referencia === "plantio") marco = p.data_inicio;
      else if (regra.referencia === "germinacao") marco = p.data_germinacao;
      else if (regra.referencia === "transplante") marco = transplanteMarcoPorPlantio.get(p.id) ?? null;
      if (!marco) continue; // regra ainda não dispara pra este plantio

      const ultima = ultimaOcorrencia.get(`${p.id}:${regra.tipo_manejo}`);
      const data = ultima ? somarDias(ultima.slice(0, 10), regra.intervalo_dias) : somarDias(marco, regra.dias_inicio);

      demandas.push({ tipo: regra.tipo_manejo, plantioId: p.id, culturaNome, canteiroId: p.canteiro_id, dataDevida: data, situacao: situacaoDemanda(data) });
    }
  }

  return demandas.sort((a, b) => a.dataDevida.localeCompare(b.dataDevida));
}
