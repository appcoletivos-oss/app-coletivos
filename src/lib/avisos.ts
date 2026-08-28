// Funções de acesso a dados de Mais → Avisos ao shopping (tabela
// avisos_shopping). Log cronológico bidirecional de comunicação com o
// shopping. Restrito a coordenação/consultor (a RLS reforça) — a única
// exceção é o INSERT de um aviso amarrado a uma ocorrência atípica, que
// qualquer papel pode fazer (ver criarOcorrencia em lib/ocorrencias.ts).
//
// Ver supabase/migrations/20260830000000_mais_pacote1.sql e
// claude/handoff-mais-pacote1.md, seção 3.

import { supabase } from "./supabase";
import { requerSessao } from "./auth";
import type { AvisoShopping, NovoAvisoShopping, StatusAviso } from "./types";

export async function listarAvisos(): Promise<AvisoShopping[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("avisos_shopping")
    .select("*")
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function linhaAviso(dados: NovoAvisoShopping) {
  return {
    direcao: dados.direcao,
    canal: dados.canal,
    assunto: dados.assunto,
    descricao: dados.descricao.trim(),
    data: dados.data,
    ocorrencia_atipica_id: dados.ocorrencia_atipica_id ?? null,
    lancamento_financeiro_id: dados.lancamento_financeiro_id ?? null,
  };
}

export async function criarAviso(dados: NovoAvisoShopping): Promise<AvisoShopping> {
  await requerSessao();
  const { data, error } = await supabase
    .from("avisos_shopping")
    .insert(linhaAviso(dados))
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Insert sem SELECT de volta — pra quem NÃO tem permissão de ler
// avisos_shopping (equipe criando o aviso amarrado a uma ocorrência
// atípica). A RLS deixa esse INSERT específico passar, mas o SELECT
// depois falharia. Ver lib/ocorrencias.ts (criarOcorrencia).
export async function criarAvisoSemRetorno(dados: NovoAvisoShopping): Promise<void> {
  await requerSessao();
  const { error } = await supabase.from("avisos_shopping").insert(linhaAviso(dados));
  if (error) throw error;
}

export async function definirStatusAviso(id: string, status: StatusAviso): Promise<void> {
  await requerSessao();
  const { error } = await supabase.from("avisos_shopping").update({ status }).eq("id", id);
  if (error) throw error;
}

// Amarra um aviso a um lançamento financeiro nos dois sentidos (handoff,
// 5.5 — vínculo por atalho). Chamadas sequenciais, mesmo risco aceito do
// resto do módulo (sem transação real).
export async function vincularAvisoALancamento(
  avisoId: string,
  lancamentoId: string,
): Promise<void> {
  await requerSessao();
  const { error: e1 } = await supabase
    .from("avisos_shopping")
    .update({ lancamento_financeiro_id: lancamentoId })
    .eq("id", avisoId);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from("lancamentos_financeiros")
    .update({ aviso_id: avisoId })
    .eq("id", lancamentoId);
  if (e2) throw e2;
}
