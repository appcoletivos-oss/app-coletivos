// Funções de acesso a dados de Tipos de carrinho (Sprint A, item 2 —
// SPRINT_A_REGISTRO_SIMPLIFICADO_ETAPA2.md, seção 6). Mesmo padrão de
// patio.ts/horta.ts: centraliza as chamadas ao Supabase pra não espalhar
// `.from(...)` pelas telas.
//
// Unidade de medida de composto/poda retirada da caixa — vale em manejo de
// canteiro e esvaziamento de caixa (item 4). "Inativo" só some das opções
// de registro novo; nunca é apagado porque pode estar referenciado por
// registros antigos (sem policy de DELETE, mesmo espírito de
// tipos_carrinho).

import { supabase } from "./supabase";
import { requerSessao } from "./auth";
import type { NovoTipoCarrinho, TipoCarrinho } from "./types";

export async function listarTiposCarrinho(incluirInativos = false): Promise<TipoCarrinho[]> {
  await requerSessao();
  let consulta = supabase.from("tipos_carrinho").select("*").order("nome", { ascending: true });
  if (!incluirInativos) consulta = consulta.eq("ativo", true);

  const { data, error } = await consulta;
  if (error) throw error;
  return data ?? [];
}

export async function criarTipoCarrinho(dados: NovoTipoCarrinho): Promise<TipoCarrinho> {
  await requerSessao();
  const { data, error } = await supabase
    .from("tipos_carrinho")
    .insert({ nome: dados.nome.trim(), peso_estimado_kg: dados.peso_estimado_kg })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

// Edita nome/peso estimado de um tipo já cadastrado. Mudar o peso aqui não
// altera `peso_kg_calculado` de registros já salvos — é sempre snapshot
// (ver NovoRegistroManejo em lib/types.ts).
export async function atualizarTipoCarrinho(
  id: string,
  dados: { nome: string; peso_estimado_kg: number },
): Promise<void> {
  await requerSessao();
  const { error } = await supabase
    .from("tipos_carrinho")
    .update({
      nome: dados.nome.trim(),
      peso_estimado_kg: dados.peso_estimado_kg,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function ativarTipoCarrinho(id: string): Promise<void> {
  await requerSessao();
  const { error } = await supabase
    .from("tipos_carrinho")
    .update({ ativo: true, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function inativarTipoCarrinho(id: string): Promise<void> {
  await requerSessao();
  const { error } = await supabase
    .from("tipos_carrinho")
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Peso calculado como snapshot (quantidade × peso_estimado_kg no momento
// do registro) — usado em manejo (item 2) e esvaziamento de caixa (item
// 4). Arredonda pra 2 casas só pra não acumular ruído de ponto flutuante
// (ex.: 0.5 × 18 = 9, mas 0.1 × 3 pode sobrar 0.30000000000000004).
export function calcularPesoCarrinho(quantidadeCarrinhos: number, pesoEstimadoKg: number): number {
  return Math.round(quantidadeCarrinhos * pesoEstimadoKg * 100) / 100;
}
