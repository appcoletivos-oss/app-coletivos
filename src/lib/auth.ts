// Sessão e identidade — centraliza tudo que fala com o Supabase Auth.
//
// Desde a Leva 1 (2026-08-27) o app tem login de verdade: Google OAuth
// (preferencial) ou e-mail + senha (fallback). O primeiro acesso vem sempre
// por um convite (/convite/[token]) que a coordenação manda; o token
// carrega o papel pretendido e, no aceite, a function `aceitar_convite`
// vincula a conta ao pré-cadastro em membros_equipe.
//
// Ver src/lib/supabase.ts (opções do cliente), src/lib/pin.ts (trava de UI)
// e a migration 20260827120000 (papéis, RLS, aceitar_convite).

import { supabase } from "./supabase";
import { limparPin } from "./pin";
import type { MembroEquipe } from "./types";

const CHAVE_CONVITE_PENDENTE = "app-coletivo:convite-pendente";

export class SemSessaoError extends Error {
  constructor() {
    super("Você precisa entrar no app para continuar.");
    this.name = "SemSessaoError";
  }
}

// -----------------------------------------------------------------------------
// Entrar / sair
// -----------------------------------------------------------------------------

export async function entrarComGoogle(redirectTo: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function entrarComEmail(email: string, senha: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: senha,
  });
  if (error) throw error;
}

export async function cadastrarComEmail(email: string, senha: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password: senha,
  });
  if (error) throw error;
}

export async function recuperarSenha(email: string, redirectTo: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
}

export async function redefinirSenha(novaSenha: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) throw error;
}

export async function sair(): Promise<void> {
  membroCache = undefined;
  limparPin();
  await supabase.auth.signOut();
}

// -----------------------------------------------------------------------------
// Estado da sessão
// -----------------------------------------------------------------------------

export async function temSessao(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}

// Chamada no topo de toda função de lib que fala com o Supabase (substitui
// a antiga `garantirSessaoAnonima`). Não abre sessão nenhuma — só rejeita
// cedo, com erro tipado, se não houver login. As telas tratam
// SemSessaoError redirecionando pra /entrar (o gate em app/patio/layout.tsx
// já faz isso pro caso normal).
export async function requerSessao(): Promise<void> {
  if (!(await temSessao())) throw new SemSessaoError();
}

// -----------------------------------------------------------------------------
// Vínculo com membros_equipe (quem sou eu, e qual meu papel)
// -----------------------------------------------------------------------------
// Cache em módulo: o papel é lido em várias telas (gate, Meu Ponto, Agenda,
// Mais) e não muda durante o uso. `undefined` = ainda não buscado; `null` =
// buscado e sem vínculo.

let membroCache: MembroEquipe | null | undefined = undefined;

export async function obterMeuMembro(forcar = false): Promise<MembroEquipe | null> {
  if (!forcar && membroCache !== undefined) return membroCache;

  const { data: sessao } = await supabase.auth.getSession();
  if (!sessao.session) {
    membroCache = null;
    return null;
  }

  const { data, error } = await supabase
    .from("membros_equipe")
    .select("*")
    .eq("user_id", sessao.session.user.id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const resultado = data ?? null;
  membroCache = resultado;
  return resultado;
}

export function limparCacheMembro(): void {
  membroCache = undefined;
}

// -----------------------------------------------------------------------------
// Convite
// -----------------------------------------------------------------------------

// Guarda o token antes de um redirect de login social (o app sai da página
// e volta em /auth/callback, onde o token é lido e consumido).
export function guardarConvitePendente(token: string): void {
  try {
    window.sessionStorage.setItem(CHAVE_CONVITE_PENDENTE, token);
  } catch {
    // sem sessionStorage: o aceite por e-mail/senha ainda funciona (não sai
    // da página); só o fluxo Google que depende disso.
  }
}

export function lerConvitePendente(): string | null {
  try {
    return window.sessionStorage.getItem(CHAVE_CONVITE_PENDENTE);
  } catch {
    return null;
  }
}

export function limparConvitePendente(): void {
  try {
    window.sessionStorage.removeItem(CHAVE_CONVITE_PENDENTE);
  } catch {
    // ignora
  }
}

// Vincula a conta logada ao pré-cadastro do convite. Retorna true se
// vinculou, false se o convite não vale mais (expirado / já aceito / conta
// já vinculada a outro membro). Ver function aceitar_convite na migration.
export async function aceitarConvite(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("aceitar_convite", { p_token: token });
  if (error) throw error;
  limparCacheMembro();
  return data === true;
}
