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

// -----------------------------------------------------------------------------
// Sessão anônima (correção de piloto — 2026-08-22)
//
// Todas as tabelas do app têm RLS com políticas `to authenticated` (ver
// migrations). Sem login de verdade implementado ainda (só decidido:
// PIN/biometria/social, nenhuma tela existe), o cliente do navegador
// nunca teria sessão nenhuma e ficaria só como role "anon" pro Postgres —
// aí toda leitura volta vazia em silêncio (RLS filtra as linhas sem
// erro) e todo insert/update é rejeitado com 42501 ("new row violates
// row-level security policy"). Foi exatamente isso que quebrava
// Cadastro → Canteiros/Caixas.
//
// Enquanto o login de verdade não fica pronto, abrir uma sessão anônima
// (supabase.auth.signInAnonymously) já satisfaz "authenticated" sem
// mexer em nenhuma política/migration. Requer a opção "Allow anonymous
// sign-ins" ativada em Authentication → Settings no painel do Supabase
// do projeto — se estiver desligada, a chamada abaixo falha com um erro
// claro, e as telas mostram a mensagem de "não deu pra carregar/salvar"
// que já existia.
//
// `garantirSessaoAnonima` é chamada no início de toda função de
// lib/patio.ts, lib/horta.ts e lib/equipe.ts que fala com o Supabase
// (exceto buscarConvitePorToken, que é pública de propósito — ver
// comentário lá). Cache da promise em andamento evita disparar vários
// signInAnonymously em paralelo quando várias telas carregam junto; se a
// tentativa falhar (ex.: sem internet), o cache é limpo pra próxima
// chamada tentar de novo, em vez de travar o app pra sempre num erro
// antigo.
let sessaoAnonimaPromise: Promise<void> | null = null;

async function iniciarSessaoAnonima(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;

  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

export function garantirSessaoAnonima(): Promise<void> {
  if (!sessaoAnonimaPromise) {
    sessaoAnonimaPromise = iniciarSessaoAnonima().catch((error) => {
      sessaoAnonimaPromise = null;
      throw error;
    });
  }
  return sessaoAnonimaPromise;
}

// Dispara a sessão assim que o módulo carrega no navegador (import de
// qualquer tela), sem esperar nenhum efeito de componente — reduz a
// janela de corrida em que uma tela tenta ler/salvar antes da sessão
// existir. Erro aqui é só log: quem chama garantirSessaoAnonima() de novo
// (dentro de cada função de lib/patio.ts etc.) trata o erro de verdade.
//
// Só roda no navegador: este módulo também é importado por código que
// executa no servidor (ex.: a rota /convite/[token] é pré-renderizada),
// e lá não existe (nem faz sentido abrir) sessão de navegador — disparar
// a chamada nesse contexto só gera fetch órfão e erro de log no build.
if (typeof window !== "undefined") {
  void garantirSessaoAnonima().catch((error) => {
    console.error("Não foi possível abrir sessão anônima do Supabase:", error);
  });
}
