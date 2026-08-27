"use client";

// Tela de login do dia a dia (quem já tem conta) e primeiro acesso fora do
// convite. O caminho normal de primeiro acesso é pelo link de convite
// (/convite/[token]) — esta tela é pra quem já se cadastrou e voltou.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  cadastrarComEmail,
  entrarComEmail,
  entrarComGoogle,
  temSessao,
} from "@/lib/auth";

export default function EntrarPage() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (await temSessao()) {
        router.replace("/patio");
        return;
      }
      if (!cancelado) setVerificando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [router]);

  async function comGoogle() {
    setErro(null);
    setProcessando(true);
    try {
      await entrarComGoogle(`${window.location.origin}/auth/callback`);
      // redireciona a página inteira — nada a fazer aqui.
    } catch {
      setErro("Não deu pra abrir o login do Google agora. Tente de novo.");
      setProcessando(false);
    }
  }

  async function comEmail() {
    if (!email.trim() || senha.length < 6) return;
    setErro(null);
    setAviso(null);
    setProcessando(true);
    try {
      if (modo === "criar") {
        await cadastrarComEmail(email, senha);
        // Se a confirmação de e-mail estiver ligada no projeto, não vem
        // sessão na hora.
        if (!(await temSessao())) {
          setAviso("Conta criada! Confira seu e-mail pra confirmar e depois entre.");
          setModo("entrar");
          setProcessando(false);
          return;
        }
      } else {
        await entrarComEmail(email, senha);
      }
      router.replace("/patio");
    } catch {
      setErro(
        modo === "criar"
          ? "Não deu pra criar a conta. O e-mail pode já estar em uso."
          : "E-mail ou senha incorretos.",
      );
      setProcessando(false);
    }
  }

  if (verificando) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <p className="text-sm text-zinc-600">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <div className="text-center">
        <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#2e6b3e] text-2xl text-white">
          🌿
        </span>
        <h1 className="text-xl font-bold text-zinc-900">App Coletivo</h1>
        <p className="mt-1 text-sm text-zinc-600">Entre pra continuar.</p>
      </div>

      <button
        type="button"
        disabled={processando}
        onClick={comGoogle}
        className="mt-8 w-full rounded-xl border-2 border-zinc-800 bg-white py-3 text-sm font-bold text-zinc-800 disabled:opacity-40"
      >
        Entrar com Google
      </button>

      <div className="my-5 flex items-center gap-3 text-[11px] text-zinc-400">
        <span className="h-px flex-1 bg-zinc-300" />
        ou com e-mail
        <span className="h-px flex-1 bg-zinc-300" />
      </div>

      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        E-mail
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>
      <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
        Senha
        <input
          type="password"
          autoComplete={modo === "criar" ? "new-password" : "current-password"}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>

      {erro && <p className="mb-2 text-[11px] text-red-700">{erro}</p>}
      {aviso && <p className="mb-2 text-[11px] font-semibold text-[#2e6b3e]">{aviso}</p>}

      <button
        type="button"
        disabled={processando || !email.trim() || senha.length < 6}
        onClick={comEmail}
        className="w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {processando ? "Aguarde…" : modo === "criar" ? "Criar conta" : "Entrar"}
      </button>

      <div className="mt-4 flex justify-between text-[11px]">
        <button
          type="button"
          onClick={() => {
            setModo((m) => (m === "entrar" ? "criar" : "entrar"));
            setErro(null);
          }}
          className="font-bold text-[#2e6b3e] underline"
        >
          {modo === "entrar" ? "Criar uma conta" : "Já tenho conta"}
        </button>
        <Link href="/recuperar-senha" className="font-bold text-zinc-600 underline">
          Esqueci a senha
        </Link>
      </div>
    </main>
  );
}
