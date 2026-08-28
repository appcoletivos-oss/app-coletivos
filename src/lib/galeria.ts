// Funções de acesso a dados de Mais → Arquivo de fotos (galeria).
//
// Sem tabela própria: a função listar_galeria_fotos() no banco une o
// foto_url + metadados de todas as tabelas que já guardam foto (colheita,
// doação, perda, transplante, alimentação, manejo, ocorrência atípica). Ela
// já filtra por papel (coordenação/consultor). As fotos ficam no bucket
// privado "registros-fotos" — aqui trocamos o caminho por signed URL pra
// exibir.
//
// Ver supabase/migrations/20260830000000_mais_pacote1.sql e
// claude/handoff-mais-pacote1.md, seção 4.

import { supabase } from "./supabase";
import { requerSessao } from "./auth";
import { urlsAssinadasFotos } from "./patio";
import type { GaleriaFoto } from "./types";

export interface FotoGaleriaExibivel extends GaleriaFoto {
  // URL assinada (1h) pronta pra <img src>. null se o signed URL falhou.
  url: string | null;
}

export async function listarGaleria(): Promise<FotoGaleriaExibivel[]> {
  await requerSessao();
  const { data, error } = await supabase.rpc("listar_galeria_fotos");
  if (error) throw error;

  const fotos = (data ?? []) as GaleriaFoto[];
  const urls = await urlsAssinadasFotos(fotos.map((f) => f.foto_url));
  return fotos.map((f) => ({ ...f, url: urls.get(f.foto_url) ?? null }));
}

export const ROTULO_ORIGEM_GALERIA: Record<string, string> = {
  colheita: "Colheita",
  doacao: "Doação",
  perda: "Perda",
  transplante: "Transplante",
  alimentacao: "Alimentação",
  manejo: "Manejo",
  ocorrencia_atipica: "Ocorrência atípica",
};
