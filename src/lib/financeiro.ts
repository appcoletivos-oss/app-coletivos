// Funções de acesso a dados de Mais → Financeiro (categorias_financeiras +
// lancamentos_financeiros). Restrito a coordenação/consultor (a RLS
// reforça). Comprovante é anexo obrigatório em todo lançamento.
//
// Ver supabase/migrations/20260830000000_mais_pacote1.sql e
// claude/handoff-mais-pacote1.md, seção 5.

import { supabase } from "./supabase";
import { requerSessao } from "./auth";
import type {
  CategoriaFinanceira,
  LancamentoComCategoria,
  LancamentoFinanceiro,
  NovaCategoriaFinanceira,
  NovoLancamentoFinanceiro,
} from "./types";

// --- Categorias ---

export async function listarCategorias(): Promise<CategoriaFinanceira[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("categorias_financeiras")
    .select("*")
    .order("tipo", { ascending: true })
    .order("nome", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function criarCategoria(dados: NovaCategoriaFinanceira): Promise<CategoriaFinanceira> {
  await requerSessao();
  const { data, error } = await supabase
    .from("categorias_financeiras")
    .insert({ nome: dados.nome.trim(), tipo: dados.tipo })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// --- Lançamentos ---

type LinhaLancamento = LancamentoFinanceiro & {
  categorias_financeiras: { nome: string } | { nome: string }[] | null;
};

function mapear(linhas: LinhaLancamento[]): LancamentoComCategoria[] {
  return linhas.map(({ categorias_financeiras, ...l }) => ({
    ...l,
    categoria_nome: Array.isArray(categorias_financeiras)
      ? (categorias_financeiras[0]?.nome ?? "—")
      : (categorias_financeiras?.nome ?? "—"),
  }));
}

export async function listarLancamentos(): Promise<LancamentoComCategoria[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("lancamentos_financeiros")
    .select("*, categorias_financeiras(nome)")
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return mapear((data ?? []) as LinhaLancamento[]);
}

export async function criarLancamento(
  dados: NovoLancamentoFinanceiro,
): Promise<LancamentoComCategoria> {
  await requerSessao();
  const { data, error } = await supabase
    .from("lancamentos_financeiros")
    .insert({
      tipo: dados.tipo,
      categoria_id: dados.categoria_id,
      valor: dados.valor,
      data: dados.data,
      descricao: dados.descricao?.trim() || null,
      comprovante_url: dados.comprovante_url,
      origem: dados.origem ?? "manual",
      aviso_id: dados.aviso_id ?? null,
    })
    .select("*, categorias_financeiras(nome)")
    .single();
  if (error) throw error;
  return mapear([data as LinhaLancamento])[0];
}

// Totais simples pra um cabeçalho de saldo (entradas − saídas). Agregação
// client-side, volume ainda pequeno — mesmo espírito de resumoAlimentacaoPorCaixa.
export function resumoFinanceiro(lancamentos: LancamentoComCategoria[]): {
  entradas: number;
  saidas: number;
  saldo: number;
} {
  let entradas = 0;
  let saidas = 0;
  for (const l of lancamentos) {
    if (l.tipo === "entrada") entradas += Number(l.valor);
    else saidas += Number(l.valor);
  }
  return { entradas, saidas, saldo: entradas - saidas };
}
