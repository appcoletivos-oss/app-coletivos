// Relato do turno com IA (Sprint B, item B3 — SPRINT_B_RELATO_DO_TURNO.md
// seção 5 e SPRINT_B2_HOME_RELATO_FILA.md seção 3): tipos compartilhados
// entre a rota de API e as telas, chamada da rota, rascunho no aparelho e
// envio do que a pessoa confirmou.
//
// Fluxo:
//   1. a tela manda { relatorio_turno_id, texto } pra
//      /api/relato-turno/interpretar (src/lib/ia/relato.ts faz o prompt,
//      o schema e o casamento com o cadastro);
//   2. a pessoa confere em "Entendi isto" e responde até 3 perguntas;
//   3. enviarRelato(): itens de checklist marcam o Relatório do Turno; os
//      demais viram relato_turno_propostas (status 'pendente'). Nada vira
//      registro oficial aqui: só a aprovação da coordenação (B4) cria.
//
// O texto colado nunca se perde: fica guardado no aparelho (rascunho por
// relatório) até o envio dar certo. Sem internet nada é interpretado em
// segundo plano; a pessoa reabre a tela e toca "Entender".

import { supabase } from "./supabase";
import type { OrigemPlantio } from "./types";
import { requerSessao } from "./auth";
import { criarItemExtra, escolherTipoRegistro, marcarItemFeito } from "./relatorio-turno";

export const LIMITE_TEXTO_RELATO = 8000;

// nao_cadastrado: o texto diz um nome (cultura ou canteiro) que não existe
// no cadastro. A pessoa escolhe um que existe ou segue com o nome cru; a
// coordenação decide na fila (usar existente, cadastrar cultura, rejeitar).
// Bloqueia a aprovação enquanto existir.
export type StatusCampo = "certo" | "inferido" | "faltando" | "nao_cadastrado";

export type TipoItemRelato =
  | "checklist"
  | "compostagem"
  | "plantio"
  | "colheita"
  | "manejo"
  | "doacao"
  | "ronda";

// Tipos que viram proposta (os demais só mexem no checklist).
export type TipoProposta = "compostagem" | "plantio" | "colheita" | "manejo" | "doacao";

export function ehTipoProposta(tipo: TipoItemRelato): tipo is TipoProposta {
  return tipo !== "checklist" && tipo !== "ronda";
}

export interface BombonaRelato {
  numero: string | null;
  peso_kg: number | null;
  observacao: string | null;
}

export interface DadosCompostagem {
  parceiro_id: string | null;
  loja_no_texto: string | null;
  qtd_bombonas: number | null;
  peso_total_kg: number | null;
  // Opções quando a soma das bombonas não bate com o total escrito.
  peso_total_opcoes: number[];
  caixa_ids: string[];
  caixas_numeros: number[];
  // null = a pessoa não disse quanto foi pra cada caixa (a RPC divide
  // igual e marca como estimado).
  peso_por_caixa: { caixa_id: string; peso_kg: number }[] | null;
  bombonas: BombonaRelato[];
  observacao: string | null;
}

export interface DadosPlantio {
  cultura_id: string | null;
  cultura_no_texto: string | null;
  canteiro_id: string | null;
  canteiro_no_texto: string | null;
  quantidade: number | null;
  unidade: string | null;
  // Pela unidade: semente(s) -> semente, muda(s) -> muda (muda_comprada,
  // rótulo "Muda" em Registrar plantio). Fileira/cova: faltando.
  origem: OrigemPlantio | null;
  observacao: string | null;
}

export interface DadosColheita {
  cultura_id: string | null;
  cultura_no_texto: string | null;
  peso_kg: number | null;
  canteiro_id: string | null;
  canteiro_no_texto: string | null;
  plantio_id: string | null;
  observacao: string | null;
}

export type AcaoManejoRelato = "composto" | "poda_triturada" | "poda_planta" | "outro";

export interface DadosManejo {
  acao: AcaoManejoRelato;
  canteiro_ids: string[];
  canteiros_no_texto: string[];
  // Os nomes de canteiros_no_texto que não existem no cadastro.
  canteiros_nao_cadastrados?: string[];
  quantidade_carrinhos: number | null;
  tipo_carrinho_id: string | null;
  tipo_carrinho_assumido: boolean;
  peso_kg_calculado: number | null;
  cultura_id: string | null;
  cultura_no_texto: string | null;
  observacao: string | null;
}

export interface DadosDoacao {
  cultura_id: string | null;
  cultura_no_texto: string | null;
  quantidade: number | null;
  unidade: string;
  destino: string | null;
  natureza: "alimento" | "muda";
  registro_colheita_id: string | null;
  observacao: string | null;
}

export interface DadosChecklist {
  descricao: string;
  observacao: string | null;
}

export type DadosItem =
  | DadosCompostagem
  | DadosPlantio
  | DadosColheita
  | DadosManejo
  | DadosDoacao
  | DadosChecklist;

export interface ItemRelato {
  chave: string;
  tipo: TipoItemRelato;
  trecho_origem: string;
  // Item do checklist do relatório a marcar como feito (veio da lista
  // enviada à IA e foi conferido no servidor). null = item extra.
  item_planejado_id: string | null;
  dados: DadosItem;
  campos_status: Record<string, StatusCampo>;
  avisos: string[];
}

// Cadastros já filtrados (só ativos), pros chips da conferência. Vêm na
// resposta da rota pra tela não precisar de mais 5 consultas com internet
// ruim.
export interface CadastrosRelato {
  parceiros: { id: string; nome: string }[];
  caixas: { id: string; numero: number }[];
  canteiros: { id: string; nome: string; tipo: string }[];
  culturas: { id: string; nome: string }[];
  tipos_carrinho: { id: string; nome: string; peso_estimado_kg: number }[];
}

export interface RelatoInterpretado {
  relato_id: string;
  log_id: string | null;
  itens: ItemRelato[];
  avisos: string[];
  // Trechos que não viram item nem proposta (ex.: "Materiais utilizados").
  // Ficam guardados no texto do relato.
  observacoes: string[];
  cadastros: CadastrosRelato;
}

// -----------------------------------------------------------------------------
// Chamada da rota
// -----------------------------------------------------------------------------

export class ErroRelato extends Error {
  // true = não chegou no servidor (sem internet): a tela guarda o texto.
  readonly semRede: boolean;
  constructor(mensagem: string, semRede: boolean) {
    super(mensagem);
    this.name = "ErroRelato";
    this.semRede = semRede;
  }
}

export async function interpretarRelato(relatorioTurnoId: string, texto: string): Promise<RelatoInterpretado> {
  await requerSessao();
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new ErroRelato("Sua sessão expirou. Entre de novo no app.", false);

  let resposta: Response;
  try {
    resposta = await fetch("/api/relato-turno/interpretar", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ relatorio_turno_id: relatorioTurnoId, texto }),
    });
  } catch {
    throw new ErroRelato("Sem internet agora.", true);
  }

  const corpo = (await resposta.json().catch(() => null)) as (RelatoInterpretado & { erro?: string }) | null;
  if (!resposta.ok || !corpo || corpo.erro) {
    throw new ErroRelato(corpo?.erro ?? "A IA não conseguiu ler o texto agora. Tente de novo daqui a pouco.", false);
  }
  return corpo;
}

// -----------------------------------------------------------------------------
// Rascunho no aparelho (mesmo padrão de fila-offline.ts: localStorage, uma
// chave própria, JSON). Um rascunho por relatório. Some só depois que o
// envio dá certo, ou quando a pessoa apaga o texto.
// -----------------------------------------------------------------------------

const CHAVE_RASCUNHOS = "app-coletivo:relatos-rascunho";

export interface RascunhoRelato {
  relatorio_turno_id: string;
  texto: string;
  guardado_em: string;
  // true = a pessoa tentou "Entender" sem internet (mostra a faixa
  // "Você tem um relato para enviar").
  aguardando_internet: boolean;
}

function lerRascunhos(): RascunhoRelato[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE_RASCUNHOS);
    return bruto ? (JSON.parse(bruto) as RascunhoRelato[]) : [];
  } catch {
    return [];
  }
}

function gravarRascunhos(lista: RascunhoRelato[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_RASCUNHOS, JSON.stringify(lista));
  } catch {
    // localStorage cheio/bloqueado: o texto continua na tela.
  }
}

export function lerRascunhoRelato(relatorioTurnoId: string): RascunhoRelato | null {
  return lerRascunhos().find((r) => r.relatorio_turno_id === relatorioTurnoId) ?? null;
}

export function guardarRascunhoRelato(relatorioTurnoId: string, texto: string, aguardandoInternet: boolean): void {
  const outros = lerRascunhos().filter((r) => r.relatorio_turno_id !== relatorioTurnoId);
  if (!texto.trim()) {
    gravarRascunhos(outros);
    return;
  }
  gravarRascunhos([
    ...outros,
    {
      relatorio_turno_id: relatorioTurnoId,
      texto,
      guardado_em: new Date().toISOString(),
      aguardando_internet: aguardandoInternet,
    },
  ]);
}

export function apagarRascunhoRelato(relatorioTurnoId: string): void {
  gravarRascunhos(lerRascunhos().filter((r) => r.relatorio_turno_id !== relatorioTurnoId));
}

export function relatosAguardandoInternet(): RascunhoRelato[] {
  return lerRascunhos().filter((r) => r.aguardando_internet);
}

// -----------------------------------------------------------------------------
// Envio (seção 5d)
// -----------------------------------------------------------------------------

function textoItemExtra(item: ItemRelato): string {
  if (item.tipo === "ronda") return `Ronda: ${(item.dados as DadosChecklist).descricao}`;
  const dados = item.dados as DadosChecklist;
  return dados.observacao ? `${dados.descricao} (${dados.observacao})` : dados.descricao;
}

// Idempotente por partes: as propostas vão num insert só (tudo ou nada) e
// `jaFeito` guarda o que já foi, pra um segundo toque em "Enviar" depois
// de uma falha no meio não duplicar nada.
export interface ProgressoEnvio {
  propostas: boolean;
  checklist: Set<string>;
}

export async function enviarRelato(
  relatorioTurnoId: string,
  relatoId: string,
  logId: string | null,
  itens: ItemRelato[],
  aceitoSemEdicao: boolean,
  progresso: ProgressoEnvio,
): Promise<{ propostas: number }> {
  await requerSessao();

  const propostas = itens.filter((i) => ehTipoProposta(i.tipo));
  if (!progresso.propostas && propostas.length > 0) {
    const { error } = await supabase.from("relato_turno_propostas").insert(
      propostas.map((i) => ({
        relato_turno_id: relatoId,
        relatorio_turno_id: relatorioTurnoId,
        tipo: i.tipo,
        dados: { ...i.dados, item_planejado_id: i.item_planejado_id },
        campos_status: i.campos_status,
        trecho_origem: i.trecho_origem || "(sem trecho)",
        avisos: i.avisos,
      })),
    );
    if (error) throw error;
  }
  progresso.propostas = true;

  // Checklist: item planejado correspondente vira feito; sem
  // correspondência, item extra já feito. Proposta com item planejado
  // (ex.: "Compostagem" do planejamento) também marca o item.
  for (const item of itens) {
    if (progresso.checklist.has(item.chave)) continue;
    if (item.item_planejado_id) {
      await marcarItemFeito(item.item_planejado_id, true);
    } else if (!ehTipoProposta(item.tipo)) {
      const extra = await criarItemExtra(relatorioTurnoId, textoItemExtra(item));
      if (item.tipo === "ronda") await escolherTipoRegistro(extra.id, "ronda");
      await marcarItemFeito(extra.id, true);
    }
    progresso.checklist.add(item.chave);
  }

  if (logId) {
    // Só informativo: se falhar, o envio continua valendo.
    await supabase.from("relatos_ia_log").update({ aceito_sem_edicao: aceitoSemEdicao }).eq("id", logId);
  }

  apagarRascunhoRelato(relatorioTurnoId);
  return { propostas: propostas.length };
}

// -----------------------------------------------------------------------------
// Status das propostas do relatório (B4, item 6: quem relatou vê)
// -----------------------------------------------------------------------------

export interface PropostaResumo {
  id: string;
  tipo: TipoProposta;
  status: "pendente" | "aprovada" | "rejeitada";
  trecho_origem: string;
  motivo_rejeicao: string | null;
  registro_id_gerado: string | null;
  criado_por: string;
  criado_em: string;
}

export async function listarPropostasDoRelatorio(relatorioTurnoId: string): Promise<PropostaResumo[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("relato_turno_propostas")
    .select("id, tipo, status, trecho_origem, motivo_rejeicao, registro_id_gerado, criado_por, criado_em")
    .eq("relatorio_turno_id", relatorioTurnoId)
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PropostaResumo[];
}
