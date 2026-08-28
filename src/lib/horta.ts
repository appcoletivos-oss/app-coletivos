// Funções de acesso a dados do bloco Horta. Mesmo padrão de patio.ts:
// centraliza as chamadas ao Supabase pra não espalhar `.from(...)` pelas
// telas. `listarCanteirosAtivos` fica em patio.ts (é a mesma tabela usada
// pela aba Canteiros do Cadastro) — este arquivo cuida só do que é
// específico da Horta.

import { supabase } from "./supabase";
import { requerSessao } from "./auth";
import { vincularManejoAPlantios } from "./plantios";
import type { NovoRegistroColheita, NovoRegistroManejo, TipoCanteiro } from "./types";

// Ícone por tipo de canteiro — mesma lógica do ícone por tipo de parceiro
// em Registrar compostagem (loja vs. construtora), só que com mais opções
// porque o regime de permacultura do coletivo usa formas diferentes de
// plantio (ver Registro Geral, seção 2).
const ICONES_TIPO_CANTEIRO: Record<TipoCanteiro, string> = {
  canteiro_solo: "🌾",
  bombona: "🪣",
  galeia: "🧺",
  geodesica: "⛰️",
  pergolado: "🍇",
  vaso: "🪴",
  bandeja_muda: "🌱",
  saco_muda: "🛍️",
  outro: "🪴",
};

export function iconeTipoCanteiro(tipo: TipoCanteiro): string {
  return ICONES_TIPO_CANTEIRO[tipo] ?? "🪴";
}

// Salva um registro de colheita. Lança erro se não houver internet ou
// sessão autenticada — quem chama decide o que fazer (ex.: fila offline).
// `registrado_por` é preenchido pelo banco (default auth.uid(), ver
// migration 20260827120000).
export async function salvarRegistroColheita(
  registro: NovoRegistroColheita,
): Promise<void> {
  await requerSessao();
  const { error } = await supabase.from("registros_colheita").insert(registro);
  if (error) throw error;
}

// Salva um registro de manejo (capina seletiva, adubação, poda,
// raleamento). Lança erro se não houver internet ou sessão autenticada —
// quem chama decide o que fazer (ex.: fila offline). `registrado_por` vem
// do banco (default auth.uid()).
//
// `registro.plantioIds` (se vier preenchido) é usado depois do insert pra
// vincular o manejo aos plantios afetados (registros_manejo_plantios) —
// adubação/capina: todos os plantios ativos do canteiro (auto, sem passo
// extra na tela); poda/raleamento: os escolhidos manualmente na tela. Ver
// handoff, seção 3.9. Centralizado aqui (não nas telas) pra que o retry da
// fila offline também vincule sozinho, sem duplicar lógica.
export async function salvarRegistroManejo(
  registro: NovoRegistroManejo,
): Promise<void> {
  await requerSessao();
  const { plantioIds, ...dados } = registro;
  const { data, error } = await supabase.from("registros_manejo").insert(dados).select("id").single();
  if (error) throw error;
  if (plantioIds && plantioIds.length > 0) {
    await vincularManejoAPlantios(data.id, plantioIds);
  }
}

// CULTURAS_COMUNS/CULTURAS_CONHECIDAS/sugerirCorrecaoCultura (grid fixo de
// cultura em texto livre + sugestão ortográfica) foram removidos em
// 2026-08-27: desde o handoff v3 (HANDOFF_HORTA_COMPLETO.md), Registrar
// colheita passou a exigir um plantio ativo (tabela `plantios`, com
// vínculo a `culturas`) em vez de cultura digitada — ver
// /patio/horta/registrar-colheita e lib/plantios.ts.
