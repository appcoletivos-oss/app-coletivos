// Funções de acesso a dados do Esvaziamento de caixa (Sprint A, item 4 —
// SPRINT_A_REGISTRO_SIMPLIFICADO_ETAPA2.md, seção 8). Mesmo padrão de
// venda.ts/carrinhos.ts: centraliza as chamadas ao Supabase pra não
// espalhar `.from(...)` pela tela.

import { supabase } from "./supabase";
import { requerSessao } from "./auth";
import type { NovoRegistroEsvaziamentoCaixa } from "./types";

// Erro de validação devolvido pelo RPC (raise exception → SQLSTATE
// 'P0001'): papel sem permissão, caixa fora do descanso, status inválido
// etc. Mesmo tratamento do ErroValidacaoBombonas (lib/patio.ts): a
// mensagem já vem em português e vai direto pra tela — não adianta tentar
// de novo, é erro de dado, não de rede.
export class ErroValidacaoEsvaziamento extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroValidacaoEsvaziamento";
  }
}

// Desde 01/10/2026 o esvaziamento passa pelo RPC
// registrar_esvaziamento_caixa (migration 20261001030000, security
// invoker): valida o papel (só Coordenação/Consultor), tira a caixa do
// descanso pra `novo_status` (limpando data_inicio_descanso) e grava o
// registro com o peso calculado no banco — tudo numa transação só. Devolve
// o id do registro criado (usado pro vínculo com o Relatório do Turno).
export async function registrarEsvaziamentoCaixa(dados: NovoRegistroEsvaziamentoCaixa): Promise<string> {
  await requerSessao();
  const { data, error } = await supabase.rpc("registrar_esvaziamento_caixa", {
    p_caixa_id: dados.caixa_id,
    p_tipo_carrinho_id: dados.tipo_carrinho_id,
    p_quantidade_carrinhos: dados.quantidade_carrinhos,
    p_novo_status: dados.novo_status,
    p_observacao: dados.observacao?.trim() || null,
    p_evento_agenda_id: dados.evento_agenda_id ?? null,
  });

  if (error) {
    if (error.code === "P0001") throw new ErroValidacaoEsvaziamento(error.message);
    throw error;
  }
  return data as string;
}
