// Funções de acesso a dados do Planejamento semanal (Sprint A, item 5 —
// SPRINT_A_REGISTRO_SIMPLIFICADO_ETAPA2.md, seção 9). Mesmo padrão de
// agenda.ts/patio.ts: centraliza as chamadas ao Supabase pra não espalhar
// `.from(...)` pela tela.

import { supabase } from "./supabase";
import { requerSessao } from "./auth";
import type { ItemPlanejamentoSemanal, NovoItemPlanejamentoSemanal, TurnoPlanejamento } from "./types";

export const TURNOS_PLANEJAMENTO: { valor: TurnoPlanejamento; rotulo: string }[] = [
  { valor: "manha", rotulo: "Manhã" },
  { valor: "tarde", rotulo: "Tarde" },
];

// Lista os itens de planejamento num intervalo de datas (a tela pede uma
// semana por vez) — volume pequeno, sem paginação.
export async function listarItensPlanejamento(
  dataInicio: string,
  dataFim: string,
): Promise<ItemPlanejamentoSemanal[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("planejamento_semanal_itens")
    .select("*")
    .gte("data", dataInicio)
    .lte("data", dataFim)
    .order("data", { ascending: true })
    .order("criado_em", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// criado_por é NOT NULL e, até onde o schema real foi confirmado, sem
// default auth.uid() na coluna (diferente de registros_alimentacao etc. —
// esta tabela nunca passou pela migration de autoria automática,
// 20260827120000). Por segurança, preenche explicitamente a partir da
// sessão, mesmo padrão já usado em inativarCanteiro (lib/patio.ts).
export async function criarItemPlanejamento(
  dados: NovoItemPlanejamentoSemanal,
): Promise<ItemPlanejamentoSemanal> {
  await requerSessao();
  const { data: sessao } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from("planejamento_semanal_itens")
    .insert({
      data: dados.data,
      turno: dados.turno,
      descricao: dados.descricao.trim(),
      criado_por: sessao.session?.user.id,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function editarItemPlanejamento(id: string, descricao: string): Promise<void> {
  await requerSessao();
  const { error } = await supabase
    .from("planejamento_semanal_itens")
    .update({ descricao: descricao.trim() })
    .eq("id", id);
  if (error) throw error;
}

export async function apagarItemPlanejamento(id: string): Promise<void> {
  await requerSessao();
  const { error } = await supabase.from("planejamento_semanal_itens").delete().eq("id", id);
  if (error) throw error;
}

// Editável enquanto não existir Relatório do Turno daquela (data, turno) —
// proposta P2 do sprint doc. `relatorios_turno` já existe no banco (Sprint
// A, item 0) mesmo a tela do Relatório do Turno (item 6) ainda não tendo
// sido construída nesta rodada — por isso já dá pra consultar. Devolve um
// Set de chaves "data|turno" pra checar em O(1) na tela, numa única
// consulta pra semana inteira (em vez de uma por dia/turno).
export async function chavesComRelatorioTurno(
  dataInicio: string,
  dataFim: string,
): Promise<Set<string>> {
  await requerSessao();
  const { data, error } = await supabase
    .from("relatorios_turno")
    .select("data, turno")
    .gte("data", dataInicio)
    .lte("data", dataFim);

  if (error) throw error;
  return new Set((data ?? []).map((r) => `${r.data}|${r.turno}`));
}
