// POST /api/semana/interpretar — Lançar a semana (Sprint B, item B5).
//
// Entrada: { segunda: "YYYY-MM-DD" (uma segunda-feira), texto }.
// Saída: SemanaInterpretada (escala + folgas + atividades + avisos), sem
// gravar nada na Agenda nem no Planejamento: quem grava é a tela, depois
// de a coordenação conferir (ver src/lib/lancar-semana.ts).
//
// Autenticação: access token do Supabase no cabeçalho Authorization (ver
// src/lib/ia/sessao-servidor.ts). Só coordenação e consultor.
// Grava uma linha em relatos_ia_log (modo 'texto', relatorio_turno_id
// nulo) com os tokens, como a própria pessoa (RLS normal).

import type { NextRequest } from "next/server";
import { ErroIA, chamarIAComJson } from "@/lib/ia/anthropic";
import { obterSessaoDaRequisicao } from "@/lib/ia/sessao-servidor";
import {
  LIMITE_TEXTO_SEMANA,
  SCHEMA_SEMANA,
  SISTEMA_SEMANA,
  montarPedidoSemana,
  posProcessarSemana,
  type SaidaIASemana,
} from "@/lib/ia/semana";
import type { SemanaInterpretada } from "@/lib/lancar-semana";

export const maxDuration = 120;

function erro(mensagem: string, status: number) {
  return Response.json({ erro: mensagem }, { status });
}

function ehSegundaFeira(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [a, m, d] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.toISOString().slice(0, 10) === iso && data.getUTCDay() === 1;
}

export async function POST(request: NextRequest) {
  const sessao = await obterSessaoDaRequisicao(request).catch(() => null);
  if (!sessao) return erro("Sua sessão expirou. Entre de novo no app.", 401);
  if (sessao.papel !== "coordenacao" && sessao.papel !== "consultor") {
    return erro("Só a coordenação ou o consultor lançam a semana.", 403);
  }

  const corpo = (await request.json().catch(() => null)) as { segunda?: unknown; texto?: unknown } | null;
  const segunda = typeof corpo?.segunda === "string" ? corpo.segunda : "";
  const texto = typeof corpo?.texto === "string" ? corpo.texto.trim() : "";
  if (!ehSegundaFeira(segunda)) return erro("Escolha a semana (a data tem que ser uma segunda-feira).", 400);
  if (!texto) return erro("Cole a mensagem da semana antes de pedir pra entender.", 400);
  if (texto.length > LIMITE_TEXTO_SEMANA) {
    return erro(`O texto passou de ${LIMITE_TEXTO_SEMANA.toLocaleString("pt-BR")} caracteres. Cole em partes.`, 400);
  }

  const { data: membros, error: erroMembros } = await sessao.supabase
    .from("membros_equipe")
    .select("id, nome")
    .eq("status", "ativo");
  if (erroMembros) return erro("Não deu pra carregar a equipe agora. Tente de novo.", 502);

  let saida: SaidaIASemana;
  let tokensEntrada = 0;
  let tokensSaida = 0;
  try {
    const resposta = await chamarIAComJson<SaidaIASemana>({
      sistema: SISTEMA_SEMANA,
      usuario: montarPedidoSemana(texto),
      schema: SCHEMA_SEMANA,
    });
    saida = resposta.dados;
    tokensEntrada = resposta.tokensEntrada;
    tokensSaida = resposta.tokensSaida;
  } catch (e) {
    if (e instanceof ErroIA) {
      console.error("[semana/interpretar]", e.detalhe ?? e.message);
      return erro(e.message, e.status);
    }
    console.error("[semana/interpretar]", e);
    return erro("A IA não conseguiu ler o texto agora. Tente de novo daqui a pouco.", 502);
  }

  const { data: log } = await sessao.supabase
    .from("relatos_ia_log")
    .insert({
      modo: "texto",
      relatorio_turno_id: null,
      tokens_entrada: tokensEntrada,
      tokens_saida: tokensSaida,
      registrado_por: sessao.userId,
    })
    .select("id")
    .single();

  const resultado: SemanaInterpretada = {
    ...posProcessarSemana(saida, segunda, membros ?? []),
    log_id: log?.id ?? null,
  };
  return Response.json(resultado);
}
