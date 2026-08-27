"use client";

// "Esqueci a senha" — só pra contas de e-mail/senha. Quem entra com Google
// não tem senha nossa: é só entrar com o Google de novo.

import { useState } from "react";
import Link from "next/link";
import { recuperarSenha } from "@/lib/auth";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [processando, setProcessando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (!email.trim()) return;
    setProcessando(true);
    setErro(null);
    try {
      await recuperarSenha(email, `${window.location.origin}/redefinir-senha`);
      setEnviado(true);
    } catch {
      setErro("Não deu pra enviar o e-mail agora. Confira o endereço e tente de novo.");
      setProcessando(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-lg font-bold text-zinc-900">Recuperar senha</h1>

      {enviado ? (
        <>
          <p className="mt-3 text-sm text-zinc-600">
            Se existe uma conta com esse e-mail, um link de redefinição foi enviado.
            Abra o link no mesmo aparelho.
          </p>
          <Link
            href="/entrar"
            className="mt-6 rounded-xl border-2 border-[#2e6b3e] px-6 py-2 text-center text-sm font-bold text-[#2e6b3e]"
          >
            Voltar pro login
          </Link>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-zinc-600">
            Enviamos um link pro seu e-mail pra você criar uma senha nova.
          </p>
          <label className="mt-4 block text-[11px] font-semibold text-zinc-600">
            E-mail
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
            />
          </label>
          {erro && <p className="mt-2 text-[11px] text-red-700">{erro}</p>}
          <button
            type="button"
            disabled={processando || !email.trim()}
            onClick={enviar}
            className="mt-4 w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {processando ? "Enviando…" : "Enviar link"}
          </button>
          <Link href="/entrar" className="mt-4 text-center text-[11px] font-bold text-zinc-600 underline">
            Voltar
          </Link>
        </>
      )}
    </main>
  );
}
