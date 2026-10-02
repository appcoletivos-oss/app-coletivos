// "Usados por último" por aparelho (Sprint A.1, princípio P5 —
// SPRINT_A1_MENOS_TOQUES.md, seção 2): guarda no localStorage os ids que a
// pessoa escolheu por último (canteiro, cultura, loja, caixa...) pra a tela
// mostrar esses primeiro, e alguns valores padrão (ex.: a última origem de
// plantio usada). É conveniência de tela, não dado: se o localStorage
// falhar (aba anônima, armazenamento bloqueado), a tela segue funcionando
// na ordem normal — por isso todo acesso fica em try/catch.
//
// Só ler daqui depois do mount (useEffect / handler), nunca durante o
// render — o servidor não tem localStorage e daria diferença de hidratação.

const PREFIXO = "app-coletivo:recentes:";
const MAXIMO = 8;

export function lerRecentes(lista: string): string[] {
  try {
    const bruto = window.localStorage.getItem(PREFIXO + lista);
    const valor: unknown = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function lembrarRecentes(lista: string, ids: string[]): void {
  if (ids.length === 0) return;
  try {
    const atual = lerRecentes(lista).filter((id) => !ids.includes(id));
    window.localStorage.setItem(PREFIXO + lista, JSON.stringify([...ids, ...atual].slice(0, MAXIMO)));
  } catch {
    // sem armazenamento — fica sem "usados por último", não trava nada.
  }
}

// Coloca na frente os itens usados por último (na ordem de uso), e depois o
// resto na ordem original.
export function ordenarPorRecentes<T extends { id: string }>(itens: T[], recentes: string[]): T[] {
  const posicao = new Map(recentes.map((id, i) => [id, i]));
  return [...itens].sort((a, b) => (posicao.get(a.id) ?? Infinity) - (posicao.get(b.id) ?? Infinity));
}

// Valores padrão soltos (ex.: última origem de plantio, última unidade de
// uma cultura) — mesmo cuidado de try/catch.
export function lerPadrao(chave: string): string | null {
  try {
    return window.localStorage.getItem(PREFIXO + "padrao:" + chave);
  } catch {
    return null;
  }
}

export function guardarPadrao(chave: string, valor: string): void {
  try {
    window.localStorage.setItem(PREFIXO + "padrao:" + chave, valor);
  } catch {
    // idem lembrarRecentes
  }
}
