import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lê a URL e a chave pública do Supabase das variáveis de ambiente.
// Esses valores não são segredo (a chave "anon"/publishable é feita para
// rodar no navegador) — mas ainda assim ficam fora do código, em
// .env.local, pra facilitar trocar de projeto Supabase (ex.: piloto ->
// produção) sem mexer em código. Veja .env.example.
//
// Autenticação real desde a Leva 1 (2026-08-27, ver
// supabase/migrations/20260827120000_auth_papeis_rls_leva1.sql e
// src/lib/auth.ts). Antes o app abria uma sessão anônima
// (`signInAnonymously`) só pra satisfazer as policies `to authenticated`;
// agora cada pessoa tem conta de verdade (Google OAuth ou e-mail/senha) e
// a RLS é por papel.
//
//   - persistSession + autoRefreshToken: a sessão fica guardada no
//     localStorage e se renova sozinha. Isso é o que faz o app funcionar
//     offline depois do primeiro login (a trava por PIN também é local —
//     ver src/lib/pin.ts).
//   - detectSessionInUrl + flowType 'pkce': necessário pro retorno do
//     login social do Google e pro link de redefinição de senha, que
//     voltam pro app com `?code=...` na URL.
//
// O cliente é criado sob demanda (não no topo do módulo) e guardado em
// cache depois da primeira vez. Motivo: a Leva 1 trouxe páginas novas
// (/auth/callback etc.) que o Next tenta pré-renderizar de forma estática
// no build, em Node — nesse momento não há garantia de que
// process.env esteja disponível do mesmo jeito que em runtime, e criar o
// cliente (ou checar as variáveis) direto no topo do arquivo derrubava o
// build mesmo com as variáveis certas configuradas na Vercel. Com o
// Proxy abaixo, a checagem e a criação só acontecem no primeiro uso real
// (ex.: dentro de um useEffect, já no navegador) — o resto do código
// continua usando `supabase.auth...`, `supabase.from(...)` normalmente,
// sem precisar mudar nada em quem importa este arquivo.
let clienteCache: SupabaseClient | undefined;

function obterCliente(): SupabaseClient {
  if (clienteCache) return clienteCache;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltam as variáveis NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copie .env.example para .env.local e preencha com os dados do projeto Supabase.",
    );
  }

  clienteCache = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
  return clienteCache;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const cliente = obterCliente();
    const valor = Reflect.get(cliente, prop, receiver);
    return typeof valor === "function" ? valor.bind(cliente) : valor;
  },
});
