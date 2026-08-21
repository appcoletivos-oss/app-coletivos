// Funções de acesso a dados do Módulo 1 (Pátio de Compostagem).
// Centralizam as chamadas ao Supabase pra não espalhar `.from(...)` pelas
// telas — se o schema mudar, o ajuste fica só aqui.

import { supabase } from "./supabase";
import type {
  Caixa,
  Canteiro,
  NovoRegistroAlimentacao,
  Parceiro,
  StatusCaixa,
  TipoCanteiro,
  TipoParceiro,
} from "./types";

// Lista só os parceiros ativos, em ordem alfabética — é o que a tela de
// Registrar alimentação mostra no passo "De qual loja veio esse resíduo?".
// Parceiros desativados (turnover) não aparecem aqui, mas continuam
// existindo pros registros antigos que já apontam pra eles.
export async function listarParceirosAtivos(): Promise<Parceiro[]> {
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
  const { data, error } = await supabase
    .from("caixas")
    .select("*")
    .order("numero", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Salva um registro de alimentação. Lança erro se não houver internet ou
// se a sessão não estiver autenticada — quem chama decide o que fazer
// (ex.: guardar na fila offline).
export async function salvarRegistroAlimentacao(
  registro: NovoRegistroAlimentacao,
): Promise<void> {
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
export async function enviarFotoRegistro(foto: File): Promise<string> {
  const extensao = foto.name.split(".").pop() || "jpg";
  const caminho = `alimentacao/${crypto.randomUUID()}.${extensao}`;

  const { error } = await supabase.storage
    .from("registros-fotos")
    .upload(caminho, foto);

  if (error) throw error;
  return caminho;
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
  const hoje = new Date().toISOString().slice(0, 10);

  const { error: erroEncerrar } = await supabase
    .from("parceiros")
    .update({ ativo: false, vinculado_ate: hoje })
    .eq("id", idAntigo);
  if (erroEncerrar) throw erroEncerrar;

  return criarParceiro(novo);
}

export async function listarCanteiros(): Promise<Canteiro[]> {
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
  const { error } = await supabase
    .from("caixas")
    .update({ status: "desativada" as StatusCaixa })
    .eq("id", id);

  if (error) throw error;
}
