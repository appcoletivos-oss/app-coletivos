// Funções de acesso a dados do Módulo 1 (Pátio de Compostagem).
// Centralizam as chamadas ao Supabase pra não espalhar `.from(...)` pelas
// telas — se o schema mudar, o ajuste fica só aqui.

import { garantirSessaoAnonima, supabase } from "./supabase";
import type {
  Caixa,
  Canteiro,
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
  return null;
}

// Lista só os parceiros ativos, em ordem alfabética — é o que a tela de
// Registrar alimentação mostra no passo "De qual loja veio esse resíduo?".
// Parceiros desativados (turnover) não aparecem aqui, mas continuam
// existindo pros registros antigos que já apontam pra eles.
export async function listarParceirosAtivos(): Promise<Parceiro[]> {
  await garantirSessaoAnonima();
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
  await garantirSessaoAnonima();
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
  await garantirSessaoAnonima();
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

// Salva um registro de alimentação. Lança erro se não houver internet ou
// se a sessão não estiver autenticada — quem chama decide o que fazer
// (ex.: guardar na fila offline).
export async function salvarRegistroAlimentacao(
  registro: NovoRegistroAlimentacao,
): Promise<void> {
  await garantirSessaoAnonima();
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from("registros_alimentacao").insert({
    ...registro,
    registrado_por: userData.user?.id ?? null,
  });

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
  await garantirSessaoAnonima();
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
// chama decide o que fazer (ex.: fila offline).
export async function salvarRegistroAnaliseSensorial(
  registro: NovoRegistroAnaliseSensorial,
): Promise<void> {
  await garantirSessaoAnonima();
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from("registros_analise_sensorial").insert({
    ...registro,
    registrado_por: userData.user?.id ?? null,
  });

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
  await garantirSessaoAnonima();
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
  await garantirSessaoAnonima();
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
  await garantirSessaoAnonima();
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
  await garantirSessaoAnonima();
  const hoje = new Date().toISOString().slice(0, 10);

  const { error: erroEncerrar } = await supabase
    .from("parceiros")
    .update({ ativo: false, vinculado_ate: hoje })
    .eq("id", idAntigo);
  if (erroEncerrar) throw erroEncerrar;

  return criarParceiro(novo);
}

export async function listarCanteiros(): Promise<Canteiro[]> {
  await garantirSessaoAnonima();
  const { data, error } = await supabase
    .from("canteiros")
    .select("*")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function criarCanteiro(dados: {
  nome: string;
  tipo: TipoCanteiro;
  area_m2?: number | null;
  capacidade_texto?: string | null;
}): Promise<Canteiro> {
  await garantirSessaoAnonima();
  const { data, error } = await supabase
    .from("canteiros")
    .insert({
      nome: dados.nome.trim(),
      tipo: dados.tipo,
      area_m2: dados.area_m2 ?? null,
      capacidade_texto: dados.capacidade_texto?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function renomearCanteiro(id: string, nome: string): Promise<void> {
  await garantirSessaoAnonima();
  const { error } = await supabase
    .from("canteiros")
    .update({ nome: nome.trim() })
    .eq("id", id);

  if (error) throw error;
}

export async function encerrarESubstituirCanteiro(
  idAntigo: string,
  novo: { nome: string; tipo: TipoCanteiro; area_m2?: number | null; capacidade_texto?: string | null },
): Promise<Canteiro> {
  await garantirSessaoAnonima();
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

export async function criarCaixa(dados: {
  numero: number;
  status: StatusCaixa;
  capacidade_kg: number;
  observacoes?: string | null;
}): Promise<Caixa> {
  await garantirSessaoAnonima();
  const { data, error } = await supabase
    .from("caixas")
    .insert({
      numero: dados.numero,
      status: dados.status,
      capacidade_kg: dados.capacidade_kg,
      observacoes: dados.observacoes?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarCaixa(
  id: string,
  dados: { status: StatusCaixa; capacidade_kg: number; observacoes?: string | null },
): Promise<void> {
  await garantirSessaoAnonima();
  const { error } = await supabase
    .from("caixas")
    .update({
      status: dados.status,
      capacidade_kg: dados.capacidade_kg,
      observacoes: dados.observacoes?.trim() || null,
    })
    .eq("id", id);

  if (error) throw error;
}

// "Retirar" uma caixa com defeito = marcar desativada, nunca apagar a
// linha — registros_alimentacao antigos continuam apontando pra ela.
export async function desativarCaixa(id: string): Promise<void> {
  await garantirSessaoAnonima();
  const { error } = await supabase
    .from("caixas")
    .update({ status: "desativada" as StatusCaixa })
    .eq("id", id);

  if (error) throw error;
}
