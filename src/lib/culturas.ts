// Funções de acesso a dados de Cadastro → Culturas (ficha de cultura +
// regime de manejo por tipo). Mesmo padrão de patio.ts/horta.ts: centraliza
// as chamadas ao Supabase pra não espalhar `.from(...)` pelas telas.
//
// Ver supabase/migrations/20260827130000_horta_plantios.sql e
// HANDOFF_HORTA_COMPLETO.md (v3), seções 3.2 e 3.3.

import { supabase } from "./supabase";
import { requerSessao } from "./auth";
import type { Cultura, NovaCultura, NovoRegimeManejoCultura, RegimeManejoCultura } from "./types";

// Lista todas as culturas (ativas e inativas) — Cadastro → Culturas mostra
// tudo pra poder editar/reativar, diferente das telas de registro
// (listarCulturasAtivas) que só mostram as selecionáveis.
export async function listarCulturas(): Promise<Cultura[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("culturas")
    .select("*")
    .order("nome", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Lista só as culturas ativas — é o que Registrar plantio mostra no passo
// "Qual cultura?".
export async function listarCulturasAtivas(): Promise<Cultura[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("culturas")
    .select("*")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

function dadosCultura(dados: NovaCultura) {
  return {
    nome: dados.nome.trim(),
    solo_ideal: dados.solo_ideal?.trim() || null,
    rega_ideal: dados.rega_ideal?.trim() || null,
    ciclo_produtivo: dados.ciclo_produtivo,
    dias_para_germinacao: dados.dias_para_germinacao ?? null,
    dias_para_transplante: dados.dias_para_transplante ?? null,
    dias_para_colheita: dados.dias_para_colheita ?? null,
    observacoes: dados.observacoes?.trim() || null,
  };
}

export async function criarCultura(dados: NovaCultura): Promise<Cultura> {
  await requerSessao();
  const { data, error } = await supabase
    .from("culturas")
    .insert(dadosCultura(dados))
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarCultura(id: string, dados: NovaCultura): Promise<void> {
  await requerSessao();
  const { error } = await supabase.from("culturas").update(dadosCultura(dados)).eq("id", id);
  if (error) throw error;
}

// Culturas não têm o padrão "encerrar e substituir" de parceiros/canteiros
// (não existe turnover de espécie) — só ativo/inativo, pra tirar das
// telas de registro sem apagar o histórico que já aponta pra ela.
export async function definirAtivoCultura(id: string, ativo: boolean): Promise<void> {
  await requerSessao();
  const { error } = await supabase.from("culturas").update({ ativo }).eq("id", id);
  if (error) throw error;
}

export async function listarRegimeManejo(culturaId: string): Promise<RegimeManejoCultura[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("culturas_regime_manejo")
    .select("*")
    .eq("cultura_id", culturaId);

  if (error) throw error;
  return data ?? [];
}

// Upsert pela chave única (cultura_id, tipo_manejo) — cada cultura tem no
// máximo uma regra por tipo de manejo (ver migration), então salvar uma
// regra nova ou corrigir uma existente é a mesma chamada.
export async function salvarRegraManejo(
  dados: NovoRegimeManejoCultura,
): Promise<RegimeManejoCultura> {
  await requerSessao();
  const { data, error } = await supabase
    .from("culturas_regime_manejo")
    .upsert(
      {
        cultura_id: dados.cultura_id,
        tipo_manejo: dados.tipo_manejo,
        referencia: dados.referencia,
        dias_inicio: dados.dias_inicio,
        intervalo_dias: dados.intervalo_dias,
        observacao: dados.observacao?.trim() || null,
      },
      { onConflict: "cultura_id,tipo_manejo" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function removerRegraManejo(id: string): Promise<void> {
  await requerSessao();
  const { error } = await supabase.from("culturas_regime_manejo").delete().eq("id", id);
  if (error) throw error;
}
