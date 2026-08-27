import { createClient } from "@supabase/supabase-js";

// Lê a URL e a chave pública do Supabase das variáveis de ambiente.
// Esses valores não são segredo (a chave "anon"/publishable é feita para
// rodar no navegador) — mas ainda assim ficam fora do código, em
// .env.local, pra facilitar trocar de projeto Supabase (ex.: piloto ->
// produção) sem mexer em código. Veja .env.example.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltam as variáveis NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copie .env.example para .env.local e preencha com os dados do projeto Supabase.",
  );
}

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
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
