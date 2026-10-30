// POST /api/relato-turno/interpretar — Relato do turno com IA (Sprint B,
// item B3; SPRINT_B2_HOME_RELATO_FILA.md seção 3).
//
// Entrada: { relatorio_turno_id, texto } (até 8.000 caracteres).
// Saída: RelatoInterpretado (itens já casados com o cadastro + cadastros
// pros chips da conferência). NÃO cria propostas: quem cria é a
// confirmação da pessoa na tela "Entendi isto" (src/lib/relato.ts).
//
// Qualquer papel (papel_atual() is not null), equipe incluída. Mesmo
// cliente de IA e mesma sessão do B5 (chamarIAComJson,
// obterSessaoDaRequisicao). Grava, como a pessoa (RLS normal):
//   * relatos_turno: o texto como veio (depois de a IA responder, porque a
//     tabela não tem UPDATE e interpretado_em vai no insert);
//   * relatos_ia_log: uma linha com os tokens.
// Teto: 30 chamadas por pessoa por dia (America/Recife), contadas em
// relatos_ia_log (registrado_por + criado_em).

import type { NextRequest } from "next/server";
import { ErroIA, chamarIAComJson } from "@/lib/ia/anthropic";
import { obterSessaoDaRequisicao } from "@/lib/ia/sessao-servidor";
import {
  LIMITE_TEXTO_RELATO_SERVIDOR,
  SCHEMA_RELATO,
  SISTEMA_RELATO,
  TETO_DIARIO_IA,
  montarPedidoRelato,
  posProcessarRelato,
  type ContextoRelato,
  type SaidaIARelato,
} from "@/lib/ia/relato";
import type { RelatoInterpretado } from "@/lib/relato";

export const maxDuration = 120;

function erro(mensagem: string, status: number) {
  return Response.json({ erro: mensagem }, { status });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Meia-noite de hoje em Recife (UTC-3, sem horário de verão), em ISO UTC.
function inicioDoDiaRecife(): string {
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${hoje}T00:00:00-03:00`).toISOString();
}

export async function POST(request: NextRequest) {
  const sessao = await obterSessaoDaRequisicao(request).catch(() => null);
  if (!sessao) return erro("Sua sessão expirou. Entre de novo no app.", 401);
  const { supabase, userId } = sessao;

  const corpo = (await request.json().catch(() => null)) as { relatorio_turno_id?: unknown; texto?: unknown } | null;
  const relatorioId = typeof corpo?.relatorio_turno_id === "string" ? corpo.relatorio_turno_id : "";
  const texto = typeof corpo?.texto === "string" ? corpo.texto.trim() : "";
  if (!UUID.test(relatorioId)) return erro("Relatório do turno inválido.", 400);
  if (!texto) return erro("Escreva ou cole o relato antes de pedir pra entender.", 400);
  if (texto.length > LIMITE_TEXTO_RELATO_SERVIDOR) {
    return erro(`O texto passou de ${LIMITE_TEXTO_RELATO_SERVIDOR.toLocaleString("pt-BR")} caracteres. Encurte ou divida.`, 400);
  }

  const { data: relatorio, error: erroRelatorio } = await supabase
    .from("relatorios_turno")
    .select("id, data, turno, fechado_em")
    .eq("id", relatorioId)
    .maybeSingle();
  if (erroRelatorio) return erro("Não deu pra abrir o relatório agora. Tente de novo.", 502);
  if (!relatorio) return erro("Relatório do turno não encontrado.", 404);
  if (relatorio.fechado_em) return erro("Este relatório já foi fechado. Peça à coordenação pra reabrir.", 409);

  // Teto diário (B2, seção 3.4).
  const { count, error: erroContagem } = await supabase
    .from("relatos_ia_log")
    .select("id", { count: "exact", head: true })
    .eq("registrado_por", userId)
    .gte("criado_em", inicioDoDiaRecife());
  if (erroContagem) return erro("Não deu pra conferir o uso da IA agora. Tente de novo.", 502);
  if ((count ?? 0) >= TETO_DIARIO_IA) {
    return erro("Você já usou a leitura por IA muitas vezes hoje. Fale com a coordenação.", 429);
  }

  const [itens, parceiros, caixas, canteiros, culturas, carrinhos, plantios] = await Promise.all([
    supabase.from("relatorio_turno_itens").select("id, descricao").eq("relatorio_turno_id", relatorioId).order("criado_em"),
    supabase.from("parceiros").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("caixas").select("id, numero, status").order("numero"),
    supabase.from("canteiros").select("id, nome, tipo").eq("ativo", true).order("nome"),
    supabase.from("culturas").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("tipos_carrinho").select("id, nome, peso_estimado_kg").eq("ativo", true).order("nome"),
    supabase.from("plantios").select("id, cultura_id, canteiro_id").in("status", ["ativo", "germinando"]),
  ]);
  const falhou = [itens, parceiros, caixas, canteiros, culturas, carrinhos, plantios].find((r) => r.error);
  if (falhou) {
    console.error("[relato-turno/interpretar] cadastro", falhou.error?.message);
    return erro("Não deu pra carregar o cadastro agora. Tente de novo.", 502);
  }

  const todasCaixas = (caixas.data ?? []) as { id: string; numero: number; status: string }[];
  const ctx: ContextoRelato = {
    dataISO: relatorio.data,
    checklist: itens.data ?? [],
    cadastros: {
      parceiros: parceiros.data ?? [],
      caixas: todasCaixas
        .filter((c) => c.status !== "desativada" && c.status !== "descanso")
        .map(({ id, numero }) => ({ id, numero })),
      canteiros: canteiros.data ?? [],
      culturas: culturas.data ?? [],
      tipos_carrinho: (carrinhos.data ?? []).map((t) => ({ ...t, peso_estimado_kg: Number(t.peso_estimado_kg) })),
    },
    plantios: plantios.data ?? [],
    caixasDescanso: todasCaixas.filter((c) => c.status === "descanso").map((c) => c.numero),
  };

  let saida: SaidaIARelato;
  let tokensEntrada = 0;
  let tokensSaida = 0;
  try {
    const resposta = await chamarIAComJson<SaidaIARelato>({
      sistema: SISTEMA_RELATO,
      usuario: montarPedidoRelato(texto, relatorio.data, relatorio.turno, ctx.checklist),
      schema: SCHEMA_RELATO,
    });
    saida = resposta.dados;
    tokensEntrada = resposta.tokensEntrada;
    tokensSaida = resposta.tokensSaida;
  } catch (e) {
    if (e instanceof ErroIA) {
      console.error("[relato-turno/interpretar]", e.detalhe ?? e.message);
      return erro(e.message, e.status);
    }
    console.error("[relato-turno/interpretar]", e);
    return erro("A IA não conseguiu ler o texto agora. Tente de novo daqui a pouco.", 502);
  }

  const { data: relato, error: erroRelato } = await supabase
    .from("relatos_turno")
    .insert({ relatorio_turno_id: relatorioId, texto, interpretado_em: new Date().toISOString(), criado_por: userId })
    .select("id")
    .single();
  if (erroRelato || !relato) {
    console.error("[relato-turno/interpretar] relatos_turno", erroRelato?.message);
    return erro("Não deu pra guardar o relato agora. O texto continua aqui: tente de novo.", 502);
  }

  const { data: log } = await supabase
    .from("relatos_ia_log")
    .insert({
      modo: "texto",
      relatorio_turno_id: relatorioId,
      tokens_entrada: tokensEntrada,
      tokens_saida: tokensSaida,
      registrado_por: userId,
    })
    .select("id")
    .single();

  const resultado: RelatoInterpretado = {
    ...posProcessarRelato(saida, ctx),
    relato_id: relato.id,
    log_id: log?.id ?? null,
    cadastros: ctx.cadastros,
  };
  return Response.json(resultado);
}
