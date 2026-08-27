"use client";

// Retorno do login social do Google. O cliente Supabase (detectSessionInUrl
// + PKCE, ver src/lib/supabase.ts) troca o `?code=...` da URL por uma
// sessão sozinho, de forma assíncrona — aqui a gente espera isso acontecer,
// consome um convite pendente se houver, e manda a pessoa pro lugar certo.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  aceitarConvite,
  lerConvitePendente,
  limparConvitePendente,
  obterMeuMembro,
  temSessao,
} from "@/lib/auth";
import { temPin } from "@/lib/pin";

type Estado = "processando" | "sem-sessao" | "sem-vinculo" | "convite-invalido";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("processando");

  useEffect(() => {
    let cancelado = false;

    async function esperarSessao(): Promise<boolean> {
      for (let tentativa = 0; tentativa < 40; tentativa++) {
        if (cancelado) return false;
        if (await temSessao()) return true;
        await new Promise((r) => setTimeout(r, 250));
      }
      return false;
    }

    (async () => {
      const logado = await esperarSessao();
      if (cancelado) return;
      if (!logado) {
        setEstado("sem-sessao");
        return;
      }

      const token = lerConvitePendente();
      if (token) {
        try {
          const ok = await aceitarConvite(token);
          limparConvitePendente();
          if (!ok) {
            setEstado("convite-invalido");
            return;
          }
        } catch {
          limparConvitePendente();
          setEstado("convite-invalido");
          return;
        }
      }

      const membro = await obterMeuMembro(true);
      if (cancelado) return;
      if (!membro) {
        setEstado("sem-vinculo");
        return;
      }

      router.replace(temPin() ? "/desbloquear" : "/criar-pin");
    })();

    return () => {
      cancelado = true;
    };
  }, [router]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#2e6b3e] text-2xl text-white">
        🌿
      </span>

      {estado === "processando" && <p className="text-sm text-zinc-600">Entrando…</p>}

      {estado === "sem-sessao" && (
        <>
          <p className="text-base font-semibold text-zinc-900">Não deu pra concluir o login</p>
          <p className="mt-2 text-sm text-zinc-600">Tente entrar de novo.</p>
          <Link
            href="/entrar"
            className="mt-6 rounded-xl border-2 border-[#2e6b3e] px-6 py-2 text-sm font-bold text-[#2e6b3e]"
          >
            Voltar pro login
          </Link>
        </>
      )}

      {estado === "convite-invalido" && (
        <>
          <p className="text-base font-semibold text-zinc-900">Convite não pôde ser usado</p>
          <p className="mt-2 text-sm text-zinc-600">
            O link pode ter expirado ou já ter sido aceito. Peça um novo à coordenação.
          </p>
          <Link
            href="/entrar"
            className="mt-6 rounded-xl border-2 border-[#2e6b3e] px-6 py-2 text-sm font-bold text-[#2e6b3e]"
          >
            Continuar
          </Link>
        </>
      )}

      {estado === "sem-vinculo" && (
        <>
          <p className="text-base font-semibold text-zinc-900">Conta ainda não vinculada</p>
          <p className="mt-2 text-sm text-zinc-600">
            Seu login funcionou, mas essa conta ainda não está ligada a um cadastro da
            equipe. Abra o app pelo link de convite que a coordenação te mandou.
          </p>
          <Link
            href="/entrar"
            className="mt-6 rounded-xl border-2 border-[#2e6b3e] px-6 py-2 text-sm font-bold text-[#2e6b3e]"
          >
            Voltar
          </Link>
        </>
      )}
    </main>
  );
}
