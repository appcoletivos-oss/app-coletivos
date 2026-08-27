"use client";

// Segunda etapa do "esqueci a senha": a pessoa chega aqui pelo link do
// e-mail. O cliente Supabase troca o `?code=...` da URL por uma sessão
// temporária (detectSessionInUrl + PKCE) e emite PASSWORD_RECOVERY — aí a
// gente pede a senha nova e chama updateUser.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { redefinirSenha, temSessao } from "@/lib/auth";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<"aguardando" | "pronto" | "sem-link">("aguardando");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      for (let i = 0; i < 40; i++) {
        if (cancelado) return;
        if (await temSessao()) {
          if (!cancelado) setEstado("pronto");
          return;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!cancelado) setEstado("sem-link");
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  async function salvar() {
    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setErro("As duas senhas não bateram.");
      return;
    }
    setErro(null);
    setProcessando(true);
    try {
      await redefinirSenha(senha);
      setOk(true);
      setTimeout(() => router.replace("/patio"), 1500);
    } catch {
      setErro("Não deu pra salvar a senha. O link pode ter expirado — peça outro.");
      setProcessando(false);
    }
  }

  if (estado === "aguardando") {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <p className="text-sm text-zinc-600">Abrindo o link…</p>
      </main>
    );
  }

  if (estado === "sem-link") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-base font-semibold text-zinc-900">Link inválido ou expirado</p>
        <p className="mt-2 text-sm text-zinc-600">Peça um novo link de redefinição.</p>
        <Link
          href="/recuperar-senha"
          className="mt-6 rounded-xl border-2 border-[#2e6b3e] px-6 py-2 text-sm font-bold text-[#2e6b3e]"
        >
          Pedir novo link
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-lg font-bold text-zinc-900">Nova senha</h1>

      {ok ? (
        <p className="mt-3 text-sm font-semibold text-[#2e6b3e]">Senha atualizada! Abrindo o app…</p>
      ) : (
        <>
          <label className="mt-4 block text-[11px] font-semibold text-zinc-600">
            Nova senha
            <input
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
            />
          </label>
          <label className="mt-2 block text-[11px] font-semibold text-zinc-600">
            Repita a nova senha
            <input
              type="password"
              autoComplete="new-password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
            />
          </label>
          {erro && <p className="mt-2 text-[11px] text-red-700">{erro}</p>}
          <button
            type="button"
            disabled={processando}
            onClick={salvar}
            className="mt-4 w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {processando ? "Salvando…" : "Salvar senha"}
          </button>
        </>
      )}
    </main>
  );
}
