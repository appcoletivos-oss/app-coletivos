import { createClient } from "@supabase/supabase-js";

// Lê a URL e a chave pública do Supabase das variáveis de ambiente.
// Esses valores não são segredo (a chave "anon" é feita para rodar no
// navegador) — mas ainda assim ficam fora do código, em .env.local,
// pra facilitar trocar de projeto Supabase (ex.: piloto -> produção)
// sem mexer em código. Veja .env.example.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltam as variáveis NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copie .env.example para .env.local e preencha com os dados do projeto Supabase.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
