// Funções de acesso a dados da aba Cadastro → Equipe.
// Mesmo padrão de src/lib/patio.ts: centraliza as chamadas ao Supabase
// pra não espalhar `.from(...)` pelas telas.

import { supabase } from "./supabase";
import type { ConvitePreCadastro, MembroEquipe, PapelEquipe } from "./types";

// Convite válido por 7 dias — prazo suficiente pra coordenação repassar o
// link pelo WhatsApp sem pressa, mas sem deixar um link antigo utilizável
// pra sempre. É só uma constante local: se a equipe achar curto/longo na
// prática, é só ajustar aqui.
const DIAS_VALIDADE_CONVITE = 7;

// Lista membros "convidado" ou "ativo" — é o que a aba Equipe mostra por
// padrão. Membros "inativo" (removidos) continuam no banco, mas somem
// dessa lista, igual parceiros/canteiros desativados.
export async function listarMembrosAtivos(): Promise<MembroEquipe[]> {
  const { data, error } = await supabase
    .from("membros_equipe")
    .select("*")
    .in("status", ["convidado", "ativo"])
    .order("nome", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Pré-cadastra um novo membro e já gera o link de convite (token +
// validade). A coordenação copia o link gerado e manda pelo próprio
// WhatsApp — o app não envia nada sozinho.
export async function criarMembro(dados: {
  nome: string;
  papel: PapelEquipe;
  whatsapp: string;
}): Promise<MembroEquipe> {
  const agora = new Date();
  const expira = new Date(agora.getTime() + DIAS_VALIDADE_CONVITE * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("membros_equipe")
    .insert({
      nome: dados.nome.trim(),
      papel: dados.papel,
      whatsapp: dados.whatsapp.trim(),
      status: "convidado",
      convite_token: crypto.randomUUID(),
      convite_criado_em: agora.toISOString(),
      convite_expira_em: expira.toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

// Corrige nome/papel/WhatsApp de um membro já cadastrado — não mexe em
// status nem em vínculo.
export async function atualizarContatoMembro(
  id: string,
  dados: { nome: string; papel: PapelEquipe; whatsapp: string },
): Promise<void> {
  const { error } = await supabase
    .from("membros_equipe")
    .update({
      nome: dados.nome.trim(),
      papel: dados.papel,
      whatsapp: dados.whatsapp.trim(),
    })
    .eq("id", id);

  if (error) throw error;
}

// Gera um novo link pra quem ainda não aceitou o convite (ex.: o antigo
// expirou). Só se aplica a quem está com status "convidado".
export async function reenviarConvite(id: string): Promise<void> {
  const agora = new Date();
  const expira = new Date(agora.getTime() + DIAS_VALIDADE_CONVITE * 24 * 60 * 60 * 1000);

  const { error } = await supabase
    .from("membros_equipe")
    .update({
      convite_token: crypto.randomUUID(),
      convite_criado_em: agora.toISOString(),
      convite_expira_em: expira.toISOString(),
    })
    .eq("id", id)
    .eq("status", "convidado");

  if (error) throw error;
}

// "Remover" = desativar, nunca apagar (mesma lógica de parceiros/
// canteiros) — mantém rastreável quem registrou o quê enquanto era parte
// da equipe, mesmo depois de sair.
export async function desativarMembro(id: string): Promise<void> {
  const { error } = await supabase
    .from("membros_equipe")
    .update({
      status: "inativo",
      vinculado_ate: new Date().toISOString().slice(0, 10),
    })
    .eq("id", id);

  if (error) throw error;
}

// Monta o link direto do WhatsApp pro contato oficial de um membro.
// Aceita o número já com DDI (55...) ou só DDD+número — completa com
// "55" na frente quando faltar, e limpa qualquer formatação (espaços,
// parênteses, traço) que a coordenação tenha digitado.
export function linkWhatsapp(whatsapp: string): string {
  const digitos = whatsapp.replace(/\D/g, "");
  const comDdi = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${comDdi}`;
}

// Monta o link de convite completo (ex.: pra copiar e mandar pelo
// WhatsApp). Recebe a origem (protocolo + domínio) de quem chama, porque
// isso só existe no navegador — não dá pra saber esse valor aqui.
export function linkConvite(origem: string, token: string): string {
  return `${origem}/convite/${token}`;
}

// Busca os dados públicos de um convite pelo token (rota /convite/[token]).
// Usa a function `buscar_convite_por_token` (security definer) em vez de
// ler a tabela membros_equipe direto — quem abre esse link ainda não fez
// login, então não tem sessão autenticada pra passar pela RLS normal (que
// só libera pra "authenticated"). Ver nota de segurança na migration.
export async function buscarConvitePorToken(
  token: string,
): Promise<ConvitePreCadastro | null> {
  const { data, error } = await supabase
    .rpc("buscar_convite_por_token", { p_token: token })
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data as ConvitePreCadastro;
}
