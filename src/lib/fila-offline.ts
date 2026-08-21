// Fila offline simples pra Registrar alimentação: se salvar falhar por
// falta de internet, o registro fica guardado no localStorage do celular
// e é reenviado sozinho assim que a conexão voltar (ver aviso na tela,
// passo 6). É uma primeira versão — guarda só os dados de texto/número;
// se a pessoa tirou foto sem internet, ela precisa tirar de novo ao
// reenviar (limitação conhecida, ver Registro Geral).

import type { NovoRegistroAlimentacao } from "./types";

const CHAVE = "app-coletivo:fila-registros-alimentacao";

function lerFila(): NovoRegistroAlimentacao[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as NovoRegistroAlimentacao[]) : [];
  } catch {
    return [];
  }
}

function salvarFila(fila: NovoRegistroAlimentacao[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHAVE, JSON.stringify(fila));
}

export function enfileirarRegistroOffline(
  registro: NovoRegistroAlimentacao,
): void {
  const fila = lerFila();
  fila.push(registro);
  salvarFila(fila);
}

export function contarFilaOffline(): number {
  return lerFila().length;
}

// Tenta enviar tudo que está na fila usando a função de salvar passada por
// quem chama (evita import circular com patio.ts). Registros que falharem
// de novo continuam na fila pra próxima tentativa.
export async function tentarEnviarFilaOffline(
  salvar: (registro: NovoRegistroAlimentacao) => Promise<void>,
): Promise<{ enviados: number; restantes: number }> {
  const fila = lerFila();
  if (fila.length === 0) return { enviados: 0, restantes: 0 };

  const restantes: NovoRegistroAlimentacao[] = [];
  let enviados = 0;

  for (const registro of fila) {
    try {
      await salvar(registro);
      enviados += 1;
    } catch {
      restantes.push(registro);
    }
  }

  salvarFila(restantes);
  return { enviados, restantes: restantes.length };
}
