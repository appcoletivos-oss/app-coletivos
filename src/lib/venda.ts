// Funções de acesso a dados do bloco Venda. Nesta rodada só existe
// "Registrar doação de alimento" (Etapa 1, item 5 — handoff "Registro
// simplificado") — o bloco ficava parado desde a sessão G, aguardando a
// feira (ver registro_geral_app_coletivos.md, seção 0).
//
// Distinta de plantio_doacoes (doação de muda/produção, lib/plantios.ts):
// aqui o rastreio é pela colheita, não pelo canteiro. Sem geofence — pode
// ser registrada fora da área de trabalho.

import { supabase } from "./supabase";
import { requerSessao } from "./auth";
import type { ColheitaRecente, DoacaoAlimento, NovaDoacaoAlimento } from "./types";

// Últimas colheitas registradas, pra escolher "doei isso que já tinha sido
// colhido" sem digitar cultura/peso de novo. Sem filtro de canteiro — a
// pessoa já reconhece a colheita pela cultura + data + peso.
export async function listarColheitasRecentes(limite = 20): Promise<ColheitaRecente[]> {
  await requerSessao();
  const { data, error } = await supabase
    .from("registros_colheita")
    .select("id, cultura, peso_kg, registrado_em")
    .order("registrado_em", { ascending: false })
    .limit(limite);

  if (error) throw error;
  return data ?? [];
}

// `registrado_por` é not null em doacoes_alimento (sem default auth.uid()
// confirmado no schema real) — preenchido aqui explicitamente, mesmo
// padrão de resolverOcorrencia (lib/ocorrencias.ts) pras tabelas que não
// têm o default já aplicado.
export async function criarDoacaoAlimento(dados: NovaDoacaoAlimento): Promise<DoacaoAlimento> {
  await requerSessao();
  const { data: sessao, error: erroSessao } = await supabase.auth.getSession();
  if (erroSessao) throw erroSessao;
  if (!sessao.session) throw new Error("Sessão expirada — entre de novo pra registrar a doação.");

  const { data, error } = await supabase
    .from("doacoes_alimento")
    .insert({
      registro_colheita_id: dados.registro_colheita_id ?? null,
      cultura_id: dados.cultura_id ?? null,
      quantidade: dados.quantidade ?? null,
      unidade: dados.unidade?.trim() || "kg",
      destino: dados.destino?.trim() || null,
      foto_url: dados.foto_url,
      observacao: dados.observacao?.trim() || null,
      registrado_por: sessao.session.user.id,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
