// Cliente da API da Anthropic, SÓ PARA O SERVIDOR (route handlers em
// src/app/api/**). Sprint B (SPRINT_B_RELATO_DO_TURNO.md, seções 5b e 7):
// mesmo cliente e mesma conferência de modelo pro Relato do turno (B3) e
// pro Lançar a semana (B5).
//
// - A chave vem de ANTHROPIC_API_KEY, sem prefixo NEXT_PUBLIC_: o Next só
//   expõe ao navegador variáveis com esse prefixo, então ela nunca vai pro
//   bundle do cliente. Este arquivo não pode ser importado por componente
//   "use client" (a guarda abaixo derruba na hora, se alguém tentar).
// - Chamada por fetch, sem SDK (decisão da sprint: nenhuma dependência nova).
// - Modelo conferido na documentação da Anthropic em 28/10/2026: o Haiku
//   atual é `claude-haiku-5-5`.
// - API version 2026-10-21: `temperature`/`top_p`/`top_k` dão erro 400 em
//   qualquer modelo nessa versão (e o Haiku 5.5 já recusa valor que não
//   seja o padrão). Por isso a spec pedia "temperature baixa", mas aqui não
//   vai temperatura nenhuma; a constância vem do JSON schema (saída
//   estruturada) e das regras do prompt.

if (typeof window !== "undefined") {
  throw new Error("src/lib/ia/anthropic.ts só pode rodar no servidor.");
}

export const MODELO_IA = "claude-haiku-5-5";

const URL_API = "https://api.anthropic.com/v1/messages";
const VERSAO_API = "2026-10-21";

// Erro com mensagem pronta pra mostrar à pessoa (curta, sem detalhe técnico).
export class ErroIA extends Error {
  readonly status: number;
  readonly detalhe?: string;

  constructor(mensagem: string, status: number, detalhe?: string) {
    super(mensagem);
    this.name = "ErroIA";
    this.status = status;
    this.detalhe = detalhe;
  }
}

export interface RespostaIA<T> {
  dados: T;
  tokensEntrada: number;
  tokensSaida: number;
}

// Uma chamada, uma resposta em JSON validado pelo schema (output_config.format).
export async function chamarIAComJson<T>({
  sistema,
  usuario,
  schema,
  maxTokens = 16000,
}: {
  sistema: string;
  usuario: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<RespostaIA<T>> {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) {
    throw new ErroIA("A leitura por IA ainda não está configurada no servidor.", 500, "ANTHROPIC_API_KEY ausente");
  }

  let resposta: Response;
  try {
    resposta = await fetch(URL_API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": chave,
        "anthropic-version": VERSAO_API,
      },
      body: JSON.stringify({
        model: MODELO_IA,
        max_tokens: maxTokens,
        system: sistema,
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema },
        },
        messages: [{ role: "user", content: usuario }],
      }),
    });
  } catch (e) {
    throw new ErroIA("Não deu pra falar com a IA agora. Confira a internet e tente de novo.", 502, String(e));
  }

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    const mensagem =
      resposta.status === 429 || resposta.status === 529
        ? "A IA está ocupada agora. Espere um minuto e tente de novo."
        : "A IA não conseguiu ler o texto agora. Tente de novo daqui a pouco.";
    throw new ErroIA(mensagem, 502, `HTTP ${resposta.status}: ${corpo.slice(0, 500)}`);
  }

  const json = (await resposta.json()) as {
    stop_reason?: string;
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  if (json.stop_reason === "refusal") {
    throw new ErroIA("A IA não aceitou ler este texto. Confira se colou a mensagem certa.", 422, "refusal");
  }
  if (json.stop_reason === "max_tokens") {
    throw new ErroIA("O texto ficou grande demais pra ler de uma vez. Tente colar em partes.", 422, "max_tokens");
  }

  const texto = (json.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  let dados: T;
  try {
    dados = JSON.parse(texto) as T;
  } catch {
    throw new ErroIA("A IA devolveu uma resposta que o app não entendeu. Tente de novo.", 502, texto.slice(0, 500));
  }

  return {
    dados,
    tokensEntrada: json.usage?.input_tokens ?? 0,
    tokensSaida: json.usage?.output_tokens ?? 0,
  };
}
