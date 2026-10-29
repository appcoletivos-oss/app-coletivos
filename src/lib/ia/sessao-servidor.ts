// Sessão da pessoa dentro de um route handler (servidor).
//
// O app guarda a sessão do Supabase no localStorage (ver src/lib/supabase.ts),
// não em cookie, então o servidor não a enxerga sozinho: a tela manda o
// access token no cabeçalho `Authorization: Bearer <token>`. Aqui o token é
// conferido no Supabase Auth e vira um cliente Supabase "como a pessoa":
// toda leitura e escrita passa pela RLS dela, igual no navegador. Nenhuma
// chave de serviço é usada.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PapelEquipe } from "../types";

export interface SessaoServidor {
  supabase: SupabaseClient;
  userId: string;
  papel: PapelEquipe;
}

// null = sem sessão válida ou conta sem papel (a rota responde 401).
export async function obterSessaoDaRequisicao(request: Request): Promise<SessaoServidor | null> {
  const cabecalho = request.headers.get("authorization") ?? "";
  const token = cabecalho.toLowerCase().startsWith("bearer ") ? cabecalho.slice(7).trim() : "";
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chaveAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chaveAnon) throw new Error("Faltam as variáveis do Supabase no servidor.");

  const supabase = createClient(url, chaveAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: usuario, error: erroUsuario } = await supabase.auth.getUser(token);
  if (erroUsuario || !usuario.user) return null;

  const { data: papel, error: erroPapel } = await supabase.rpc("papel_atual");
  if (erroPapel || !papel) return null;

  return { supabase, userId: usuario.user.id, papel: papel as PapelEquipe };
}
