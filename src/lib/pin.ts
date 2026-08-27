// Trava de UI por PIN — local, por aparelho.
//
// Depois do primeiro login (Google ou e-mail/senha, ver src/lib/auth.ts) a
// pessoa cadastra um PIN de 4 a 6 dígitos. A partir daí o app pede só o PIN
// pra destravar, sem repetir o login toda vez.
//
// IMPORTANTE: o PIN é uma trava de tela, NÃO uma re-autenticação. A sessão
// do Supabase continua viva em background (refresh token). Por isso:
//   - esqueceu o PIN  -> não há "reset": é só sair (auth.ts `sair()`) e
//     entrar de novo com Google/e-mail, aí recadastra o PIN;
//   - o hash é local e simples (SHA-256 com salt por aparelho) — serve pra
//     não deixar o PIN em texto puro no localStorage, não é cofre.
//
// Biometria (WebAuthn) ficou fora da Leva 1 (só se sobrar tempo, ver
// decisão de 2026-08-27).

const CHAVE_PIN = "app-coletivo:pin";
const CHAVE_DESBLOQUEADO = "app-coletivo:pin-ok";

interface PinGuardado {
  salt: string;
  hash: string;
}

function temStorage(): boolean {
  return typeof window !== "undefined";
}

function paraHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPin(pin: string, saltHex: string): Promise<string> {
  const dados = new TextEncoder().encode(`${saltHex}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", dados);
  return paraHex(digest);
}

function lerPin(): PinGuardado | null {
  if (!temStorage()) return null;
  try {
    const bruto = window.localStorage.getItem(CHAVE_PIN);
    return bruto ? (JSON.parse(bruto) as PinGuardado) : null;
  } catch {
    return null;
  }
}

export function temPin(): boolean {
  return lerPin() !== null;
}

export async function definirPin(pin: string): Promise<void> {
  const salt = paraHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPin(pin, salt);
  window.localStorage.setItem(CHAVE_PIN, JSON.stringify({ salt, hash }));
  marcarDesbloqueado();
}

export async function validarPin(pin: string): Promise<boolean> {
  const guardado = lerPin();
  if (!guardado) return false;
  const hash = await hashPin(pin, guardado.salt);
  return hash === guardado.hash;
}

export function limparPin(): void {
  if (!temStorage()) return;
  window.localStorage.removeItem(CHAVE_PIN);
  window.sessionStorage.removeItem(CHAVE_DESBLOQUEADO);
}

// "Destravado" vale por sessão do navegador (sessionStorage) — fechar o
// app e abrir de novo pede o PIN outra vez.
export function pinDesbloqueado(): boolean {
  if (!temStorage()) return false;
  try {
    return window.sessionStorage.getItem(CHAVE_DESBLOQUEADO) === "1";
  } catch {
    return false;
  }
}

export function marcarDesbloqueado(): void {
  if (!temStorage()) return;
  try {
    window.sessionStorage.setItem(CHAVE_DESBLOQUEADO, "1");
  } catch {
    // sessionStorage indisponível (aba privada em alguns navegadores) —
    // sem problema, o app só vai pedir o PIN de novo.
  }
}
