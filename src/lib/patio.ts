// Funções de acesso a dados do Módulo 1 (Pátio de Compostagem).
// Centralizam as chamadas ao Supabase pra não espalhar `.from(...)` pelas
// telas — se o schema mudar, o ajuste fica só aqui.

import { supabase } from "./supabase";
import { requerSessao } from "./auth";
import type {
  Caixa,
  Canteiro,
  LocalCanteiro,
  NovoRegistroAlimentacao,
  NovoRegistroAnaliseSensorial,
  NovoRegistroBombona,
  Parceiro,
  RegistroAlimentacaoResumo,
  StatusCaixa,
  TipoCanteiro,
  TipoParceiro,
} from "./types";

// Texto pro status de uma caixa quando ela não está em uso normal — usado
// tanto no seletor de caixa de Registrar alimentação (como `title` de um
// botão desabilitado) quanto nos badges de Ver caixas. Devolve null pra
// "ativa" porque nos dois lugares esse é o status "sem aviso especial";
// quem chama decide o texto a mostrar nesse caso (Ver caixas mostra
// "ativa" explicitamente, Registrar alimentação não precisa de título).
export function rotuloStatusCaixa(status: StatusCaixa): string | null {
  if (status === "nao_ativada") return "não ativada";
  if (status === "nova") return "nova, aguardando";
  if (status === "desativada") return "desativada";
  if (status === "descanso") return "em descanso";
  return null;
}

// Lista só os parceiros ativos, em ordem alfabética — é o que a tela de
// Registrar alimentação mostra no passo "De qual loja veio esse resíduo?".
// Parceiros desativados (turnover) não aparecem aqui, mas continuam
// existindo pros registros antigos que já apontam pra eles.
export async function listarParceirosAtivos(): Promise<Parceiro[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("parceiros")
    .select("*")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Lista todas as 26 caixas, ativas ou não — a tela mostra as inativas
// desabilitadas, em vez de escondê-las, pra equipe ver o estado real do
// pátio (ver wireframe, seção 6).
export async function listarCaixas(): Promise<Caixa[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("caixas")
    .select("*")
    .order("numero", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Busca só os campos que a tela Ver caixas precisa pra somar peso e achar
// a última alimentação de cada caixa. Volume ainda pequeno (fase piloto),
// então trazer tudo e agregar em JS (resumoAlimentacaoPorCaixa) é
// aceitável — sem view/RPC no Supabase só pra isso por enquanto.
export async function listarRegistrosAlimentacaoResumo(): Promise<
  RegistroAlimentacaoResumo[]
> {
  await requerSessao();
  const { data, error } = await supabase
    .from("registros_alimentacao")
    .select("caixa_id, peso_kg, registrado_em");

  if (error) throw error;
  return data ?? [];
}

export interface ResumoAlimentacaoCaixa {
  pesoTotalKg: number;
  quantidadeRegistros: number;
  ultimaAlimentacaoEm: string | null;
}

// Agrega registros de alimentação por caixa: soma de peso, contagem e
// data do registro mais recente. Comparação de string funciona pra achar
// a data mais recente porque registrado_em vem em ISO 8601
// (timestamptz), que ordena igual lexicograficamente e cronologicamente.
export function resumoAlimentacaoPorCaixa(
  registros: RegistroAlimentacaoResumo[],
): Map<string, ResumoAlimentacaoCaixa> {
  const mapa = new Map<string, ResumoAlimentacaoCaixa>();

  for (const registro of registros) {
    const atual = mapa.get(registro.caixa_id) ?? {
      pesoTotalKg: 0,
      quantidadeRegistros: 0,
      ultimaAlimentacaoEm: null,
    };

    atual.pesoTotalKg += registro.peso_kg;
    atual.quantidadeRegistros += 1;
    if (!atual.ultimaAlimentacaoEm || registro.registrado_em > atual.ultimaAlimentacaoEm) {
      atual.ultimaAlimentacaoEm = registro.registrado_em;
    }

    mapa.set(registro.caixa_id, atual);
  }

  return mapa;
}

// Salva um registro de alimentação e devolve o id da linha criada (usado
// pra anexar fotos extras em fotos_registro — ver salvarFotosExtras
// abaixo). Lança erro se não houver internet ou se a sessão não estiver
// autenticada — quem chama decide o que fazer (ex.: guardar na fila
// offline). `registrado_por` é preenchido pelo banco (default auth.uid(),
// ver migration 20260827120000).
export async function salvarRegistroAlimentacao(
  registro: NovoRegistroAlimentacao,
): Promise<string> {
  await requerSessao();
  const { data, error } = await supabase
    .from("registros_alimentacao")
    .insert(registro)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// -----------------------------------------------------------------------------
// Fotos múltiplas (Etapa 1, item 2 — handoff "Registro simplificado").
//
// `foto_url` continua sendo a capa de cada tabela de registro (sem mudança
// de schema nela nem na Galeria, que só lê a capa). Fotos além da primeira
// viram linhas em `fotos_registro` (tabela nova, SQL já aplicada no
// Supabase — ver claude_handoff-registro-simplificado.md, Etapa 1 item 2).
// `tabela_origem` usa o nome real da tabela (ex.: "registros_colheita"),
// mesma convenção do nome da coluna.
// -----------------------------------------------------------------------------
export async function salvarFotosExtras(
  tabelaOrigem: string,
  registroId: string,
  caminhosFotos: string[],
): Promise<void> {
  if (caminhosFotos.length === 0) return;
  await requerSessao();
  const linhas = caminhosFotos.map((foto_url, ordem) => ({
    tabela_origem: tabelaOrigem,
    registro_id: registroId,
    foto_url,
    ordem,
  }));
  const { error } = await supabase.from("fotos_registro").insert(linhas);
  if (error) throw error;
}

// Envia a foto pro bucket privado "registros-fotos" e devolve o caminho
// interno (não uma URL pública — o bucket é privado). Se der erro (ex.:
// sem internet), quem chama decide se tenta de novo depois ou salva o
// registro sem foto por enquanto.
//
// `pasta` separa as fotos por tipo de registro dentro do mesmo bucket
// (ex.: "alimentacao", "colheita") — mesmo bucket e mesma política de
// acesso servem pra qualquer tela nova de registro com foto, sem precisar
// criar bucket novo a cada módulo.
export async function enviarFotoRegistro(
  foto: File,
  pasta: string = "alimentacao",
): Promise<string> {
  await requerSessao();
  const extensao = foto.name.split(".").pop() || "jpg";
  const caminho = `${pasta}/${crypto.randomUUID()}.${extensao}`;

  const { error } = await supabase.storage
    .from("registros-fotos")
    .upload(caminho, foto);

  if (error) throw error;
  return caminho;
}

// -----------------------------------------------------------------------------
// Compostagem → Análise sensorial
// -----------------------------------------------------------------------------

// Salva um registro de análise sensorial (visão, olfato, tato — texto
// livre). Lança erro se não houver internet ou sessão autenticada — quem
// chama decide o que fazer (ex.: fila offline). `registrado_por` vem do
// banco (default auth.uid()).
export async function salvarRegistroAnaliseSensorial(
  registro: NovoRegistroAnaliseSensorial,
): Promise<void> {
  await requerSessao();
  const { error } = await supabase.from("registros_analise_sensorial").insert(registro);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Compostagem → Controle de bombonas
// -----------------------------------------------------------------------------

// Salva um registro de controle de bombona. `registrado_por` vem do
// próprio formulário (texto livre digitado pela pessoa), não da sessão —
// ver NovoRegistroBombona em types.ts e a migration 20260822180000.
export async function salvarRegistroBombona(
  registro: NovoRegistroBombona,
): Promise<void> {
  await requerSessao();
  const { error } = await supabase.from("registros_bombonas").insert(registro);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Cadastro → Parceiros e Canteiros
//
// As duas tabelas seguem a mesma lógica de memória histórica (ver
// comentário no topo da migration): "corrigir nome" atualiza a mesma
// linha; "encerrar e substituir" marca a linha atual como encerrada e
// cadastra uma linha nova, sem nunca sobrescrever a antiga.
// -----------------------------------------------------------------------------

export async function criarParceiro(dados: {
  nome: string;
  tipo: TipoParceiro;
}): Promise<Parceiro> {
  await requerSessao();
  const { data, error } = await supabase
    .from("parceiros")
    .insert({ nome: dados.nome.trim(), tipo: dados.tipo })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

// Corrige o nome de um parceiro já cadastrado (ex.: "Loja 1" → nome
// real). Não mexe em `ativo` nem em vínculo — é só um ajuste de texto.
export async function renomearParceiro(id: string, nome: string): Promise<void> {
  await requerSessao();
  const { error } = await supabase
    .from("parceiros")
    .update({ nome: nome.trim() })
    .eq("id", id);

  if (error) throw error;
}

// Turnover de verdade: encerra o parceiro atual (ativo = false,
// vinculado_ate = hoje) e cadastra o novo que entra no lugar — os
// registros antigos continuam apontando pro parceiro encerrado, intactos.
export async function encerrarESubstituirParceiro(
  idAntigo: string,
  novo: { nome: string; tipo: TipoParceiro },
): Promise<Parceiro> {
  await requerSessao();
  const hoje = new Date().toISOString().slice(0, 10);

  const { error: erroEncerrar } = await supabase
    .from("parceiros")
    .update({ ativo: false, vinculado_ate: hoje })
    .eq("id", idAntigo);
  if (erroEncerrar) throw erroEncerrar;

  return criarParceiro(novo);
}

export async function listarCanteiros(incluirInativos = false): Promise<Canteiro[]> {
  await requerSessao();
  let consulta = supabase.from("canteiros").select("*").order("nome", { ascending: true });
  if (!incluirInativos) consulta = consulta.eq("ativo", true);

  const { data, error } = await consulta;
  if (error) throw error;
  return data ?? [];
}

// -----------------------------------------------------------------------------
// Cadastro → Canteiros: exclusão real x inativação (handoff Mais/Pacote 1,
// seção 1). Canteiro que nunca teve nenhum plantio/registro pode ser
// apagado de verdade; qualquer histórico -> só inativação. Um canteiro com
// plantio ativo (ativo/germinando) bloqueia as duas ações até mover/colher.
// -----------------------------------------------------------------------------

// Plantios que ainda seguram a remoção do canteiro — mesma lista de
// listarPlantiosAtivosPorCanteiro (status ativo/germinando), duplicada aqui
// só pra evitar import circular entre patio.ts e plantios.ts.
export async function plantiosPendentesDoCanteiro(
  canteiroId: string,
): Promise<{ id: string; cultura_nome: string; status: string }[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("plantios")
    .select("id, status, culturas(nome)")
    .eq("canteiro_id", canteiroId)
    .in("status", ["ativo", "germinando"]);

  if (error) throw error;
  type Linha = { id: string; status: string; culturas: { nome: string }[] | { nome: string } | null };
  return ((data ?? []) as Linha[]).map((l) => ({
    id: l.id,
    status: l.status,
    cultura_nome: Array.isArray(l.culturas) ? (l.culturas[0]?.nome ?? "—") : (l.culturas?.nome ?? "—"),
  }));
}

// true = o canteiro já teve QUALQUER plantio ou registro (colheita/manejo)
// vinculado -> só inativação. false = nunca teve nada -> exclusão real
// permitida. registros_perdas/plantio_doacoes/registros_manejo_plantios não
// têm canteiro_id (referenciam plantio_id), então já entram na contagem de
// plantios — se não há plantio no canteiro, não há como haver esses.
export async function canteiroTemHistorico(canteiroId: string): Promise<boolean> {
  await requerSessao();
  const contar = (tabela: string) =>
    supabase.from(tabela).select("id", { count: "exact", head: true }).eq("canteiro_id", canteiroId);

  const [plantios, colheitas, manejos] = await Promise.all([
    contar("plantios"),
    contar("registros_colheita"),
    contar("registros_manejo"),
  ]);
  for (const r of [plantios, colheitas, manejos]) if (r.error) throw r.error;
  return (plantios.count ?? 0) + (colheitas.count ?? 0) + (manejos.count ?? 0) > 0;
}

export async function excluirCanteiro(id: string): Promise<void> {
  await requerSessao();
  const { error } = await supabase.from("canteiros").delete().eq("id", id);
  if (error) throw error;
}

// Inativa o canteiro (estrutura quebrada, perene encerrada) — reaproveita
// `ativo=false` (some das listas de novo plantio, continua no histórico) e
// guarda o motivo/autor. inativado_por vem do banco? não: canteiros não tem
// default auth.uid() nessa coluna nova, então preenche aqui.
export async function inativarCanteiro(id: string, motivo: string): Promise<void> {
  await requerSessao();
  const { data: sessao } = await supabase.auth.getSession();
  const { error } = await supabase
    .from("canteiros")
    .update({
      ativo: false,
      motivo_inativacao: motivo.trim() || null,
      inativado_em: new Date().toISOString(),
      inativado_por: sessao.session?.user.id ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function reativarCanteiro(id: string): Promise<void> {
  await requerSessao();
  const { error } = await supabase
    .from("canteiros")
    .update({ ativo: true, motivo_inativacao: null, inativado_em: null, inativado_por: null })
    .eq("id", id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Fotos: signed URLs pra exibir imagens do bucket privado "registros-fotos"
// (a galeria é a primeira tela que EXIBE foto, não só faz upload). Devolve
// um Map caminho -> URL assinada (1h). Caminhos que falharem ficam de fora.
// -----------------------------------------------------------------------------
export async function urlsAssinadasFotos(caminhos: string[]): Promise<Map<string, string>> {
  await requerSessao();
  const mapa = new Map<string, string>();
  const unicos = [...new Set(caminhos.filter(Boolean))];
  if (unicos.length === 0) return mapa;

  const { data, error } = await supabase.storage
    .from("registros-fotos")
    .createSignedUrls(unicos, 3600);
  if (error) throw error;

  for (const item of data ?? []) {
    if (item.signedUrl && item.path) mapa.set(item.path, item.signedUrl);
  }
  return mapa;
}

export async function criarCanteiro(dados: {
  nome: string;
  tipo: TipoCanteiro;
  local?: LocalCanteiro;
  area_m2?: number | null;
  capacidade_texto?: string | null;
}): Promise<Canteiro> {
  await requerSessao();
  const { data, error } = await supabase
    .from("canteiros")
    .insert({
      nome: dados.nome.trim(),
      tipo: dados.tipo,
      local: dados.local ?? "patio",
      area_m2: dados.area_m2 ?? null,
      capacidade_texto: dados.capacidade_texto?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function renomearCanteiro(id: string, nome: string): Promise<void> {
  await requerSessao();
  const { error } = await supabase
    .from("canteiros")
    .update({ nome: nome.trim() })
    .eq("id", id);

  if (error) throw error;
}

export async function encerrarESubstituirCanteiro(
  idAntigo: string,
  novo: {
    nome: string;
    tipo: TipoCanteiro;
    local?: LocalCanteiro;
    area_m2?: number | null;
    capacidade_texto?: string | null;
  },
): Promise<Canteiro> {
  await requerSessao();
  const hoje = new Date().toISOString().slice(0, 10);

  const { error: erroEncerrar } = await supabase
    .from("canteiros")
    .update({ ativo: false, vinculado_ate: hoje })
    .eq("id", idAntigo);
  if (erroEncerrar) throw erroEncerrar;

  return criarCanteiro(novo);
}

// -----------------------------------------------------------------------------
// Cadastro → Caixas
//
// Diferente de parceiros/canteiros, uma caixa não "vira" outra caixa —
// ela só entra ou sai de operação. Por isso não tem o padrão de
// renomear/substituir: só cadastrar caixa nova e mudar o `status` (que já
// existe desde a migration original, incluindo "desativada" pra uma
// caixa com defeito retirada de circulação).
// -----------------------------------------------------------------------------

// Sugestão do próximo número livre — só um ponto de partida pro
// formulário; a coordenação pode digitar outro número se quiser.
export function proximoNumeroCaixa(caixas: Caixa[]): number {
  return caixas.reduce((maior, c) => Math.max(maior, c.numero), 0) + 1;
}

// Cadastrar já em descanso (Etapa 1, item 6) também marca
// data_inicio_descanso = hoje, pro card já nascer coerente (sem precisar
// de um segundo passo "mover pra descanso" logo depois do cadastro).
export async function criarCaixa(dados: {
  numero: number;
  status: StatusCaixa;
  capacidade_kg: number;
  observacoes?: string | null;
}): Promise<Caixa> {
  await requerSessao();
  const { data, error } = await supabase
    .from("caixas")
    .insert({
      numero: dados.numero,
      status: dados.status,
      capacidade_kg: dados.capacidade_kg,
      observacoes: dados.observacoes?.trim() || null,
      data_inicio_descanso: dados.status === "descanso" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

// Editar o status pela aba Caixas não mexe em data_inicio_descanso —
// "mover pra descanso" (abaixo) é a ação dedicada pra isso. Se a edição
// tirar a caixa do descanso (ex.: corrigir engano), a data permanece como
// histórico; só é limpa se a caixa voltar a ficar ativa por essa mesma
// ação (ver moverCaixaParaDescanso).
export async function atualizarCaixa(
  id: string,
  dados: { status: StatusCaixa; capacidade_kg: number; observacoes?: string | null },
): Promise<void> {
  await requerSessao();
  const { error } = await supabase
    .from("caixas")
    .update({
      status: dados.status,
      capacidade_kg: dados.capacidade_kg,
      observacoes: dados.observacoes?.trim() || null,
      ...(dados.status !== "descanso" ? { data_inicio_descanso: null } : {}),
    })
    .eq("id", id);

  if (error) throw error;
}

// "Retirar" uma caixa com defeito = marcar desativada, nunca apagar a
// linha — registros_alimentacao antigos continuam apontando pra ela.
export async function desativarCaixa(id: string): Promise<void> {
  await requerSessao();
  const { error } = await supabase
    .from("caixas")
    .update({ status: "desativada" as StatusCaixa })
    .eq("id", id);

  if (error) throw error;
}

// Mover uma caixa já existente pra descanso (Etapa 1, item 6) — restrito a
// Coordenação/Consultor pela RLS real de `caixas` (uma única política
// cobrindo toda escrita na tabela; equipe só lê — ver
// claude_handoff-registro-simplificado.md, Etapa 1 item 6).
export async function moverCaixaParaDescanso(id: string): Promise<void> {
  await requerSessao();
  const { error } = await supabase
    .from("caixas")
    .update({ status: "descanso" as StatusCaixa, data_inicio_descanso: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
