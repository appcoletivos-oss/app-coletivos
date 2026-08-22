// Fila offline genérica: se salvar um registro falhar por falta de
// internet, ele fica guardado no localStorage do celular e é reenviado
// sozinho assim que a conexão voltar. Cada tela de registro (Registrar
// compostagem, Registrar colheita, e as próximas que vierem) cria sua
// própria fila com `criarFilaOffline<TipoDoRegistro>("chave-única")` — é
// uma primeira versão: guarda só os dados de texto/número, então se a
// pessoa tirou foto sem internet, ela precisa tirar de novo ao reenviar
// (limitação conhecida, ver Registro Geral).
//
// Generalizado em 2026-08-22: antes era uma fila fixa só pra
// NovoRegistroAlimentacao; virou genérica pra não duplicar essa lógica a
// cada tela nova de registro (Compostagem hoje tem uma, Horta ganha outra
// agora, e o app deve ser modular desde o início — ver Registro Geral).

export interface FilaOffline<T> {
  enfileirar: (registro: T) => void;
  contar: () => number;
  tentarEnviar: (
    salvar: (registro: T) => Promise<void>,
  ) => Promise<{ enviados: number; restantes: number }>;
}

export function criarFilaOffline<T>(chave: string): FilaOffline<T> {
  function lerFila(): T[] {
    if (typeof window === "undefined") return [];
    try {
      const bruto = window.localStorage.getItem(chave);
      return bruto ? (JSON.parse(bruto) as T[]) : [];
    } catch {
      return [];
    }
  }

  function salvarFila(fila: T[]): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(chave, JSON.stringify(fila));
  }

  function enfileirar(registro: T): void {
    const fila = lerFila();
    fila.push(registro);
    salvarFila(fila);
  }

  function contar(): number {
    return lerFila().length;
  }

  // Tenta enviar tudo que está na fila usando a função de salvar passada
  // por quem chama (evita import circular com patio.ts/horta.ts).
  // Registros que falharem de novo continuam na fila pra próxima tentativa.
  async function tentarEnviar(
    salvar: (registro: T) => Promise<void>,
  ): Promise<{ enviados: number; restantes: number }> {
    const fila = lerFila();
    if (fila.length === 0) return { enviados: 0, restantes: 0 };

    const restantes: T[] = [];
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

  return { enfileirar, contar, tentarEnviar };
}
