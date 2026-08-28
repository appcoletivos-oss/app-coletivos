// Funções de acesso a dados de Mais → Ocorrência atípica (tabela
// ocorrencias_atipicas). Registro aberto a qualquer papel (equipe
// inclusive); enquanto resolvido=false, alimenta o banner da home do Pátio.
//
// Ver supabase/migrations/20260830000000_mais_pacote1.sql e
// claude/handoff-mais-pacote1.md, seção 2.

import { supabase } from "./supabase";
import { requerSessao } from "./auth";
import { criarAvisoSemRetorno } from "./avisos";
import type { NovaOcorrenciaAtipica, OcorrenciaAtipica } from "./types";

export async function listarOcorrencias(apenasPendentes = false): Promise<OcorrenciaAtipica[]> {
  await requerSessao();
  let consulta = supabase
    .from("ocorrencias_atipicas")
    .select("*")
    .order("criado_em", { ascending: false });
  if (apenasPendentes) consulta = consulta.eq("resolvido", false);

  const { data, error } = await consulta;
  if (error) throw error;
  return data ?? [];
}

// Contador de ocorrências não resolvidas — usado pelo banner da home. Leve
// (head + count), não traz linha nenhuma.
export async function contarOcorrenciasPendentes(): Promise<number> {
  await requerSessao();
  const { count, error } = await supabase
    .from("ocorrencias_atipicas")
    .select("id", { count: "exact", head: true })
    .eq("resolvido", false);
  if (error) throw error;
  return count ?? 0;
}

// Cria a ocorrência. Se `virarAviso` vier preenchido, cria junto uma linha
// em avisos_shopping (assunto=ocorrencia_atipica, descrição copiada) — os
// dois registros ficam independentes depois (handoff, 2.3). A RLS deixa
// qualquer papel criar esse aviso específico, mesmo sem ser coordenação.
export async function criarOcorrencia(
  dados: NovaOcorrenciaAtipica,
  virarAviso?: { canal: "whatsapp" | "email" | "presencial" | "outro" },
): Promise<OcorrenciaAtipica> {
  await requerSessao();
  const { data, error } = await supabase
    .from("ocorrencias_atipicas")
    .insert({ descricao: dados.descricao.trim(), foto_url: dados.foto_url })
    .select("*")
    .single();
  if (error) throw error;

  if (virarAviso) {
    await criarAvisoSemRetorno({
      direcao: "para_shopping",
      canal: virarAviso.canal,
      assunto: "ocorrencia_atipica",
      descricao: dados.descricao.trim(),
      data: new Date().toISOString().slice(0, 10),
      ocorrencia_atipica_id: data.id,
    });
  }

  return data;
}

export async function resolverOcorrencia(id: string, resolvido: boolean): Promise<void> {
  await requerSessao();
  const { data: sessao } = await supabase.auth.getSession();
  const { error } = await supabase
    .from("ocorrencias_atipicas")
    .update({
      resolvido,
      resolvido_em: resolvido ? new Date().toISOString() : null,
      resolvido_por: resolvido ? (sessao.session?.user.id ?? null) : null,
    })
    .eq("id", id);
  if (error) throw error;
}
