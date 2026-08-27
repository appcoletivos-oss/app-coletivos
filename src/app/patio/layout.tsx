"use client";

// Gate de acesso do módulo Pátio (Leva 1, 2026-08-27).
//
// Tudo sob /patio/* exige: (1) sessão real do Supabase e (2) um vínculo em
// membros_equipe (a conta aceitou um convite) e (3) o app destravado por
// PIN nesta sessão do navegador. Qualquer coisa faltando redireciona pra
// tela certa — todas fora de /patio, pra não dar loop com este layout:
//   sem sessão            -> /entrar
//   sem PIN cadastrado    -> /criar-pin
//   com PIN, travado      -> /desbloquear
//   logado mas sem vínculo-> mensagem aqui mesmo (raro: conta sem convite)
//
// O gate é client-side de propósito: o app é offline-first, a sessão vive
// no localStorage e não há middleware/cookies (ver decisão de 2026-08-27).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { obterMeuMembro, sair, temSessao } from "@/lib/auth";
import { pinDesbloqueado, temPin } from "@/lib/pin";

type Estado = "verificando" | "ok" | "sem-vinculo";

export default function PatioLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("verificando");

  useEffect(() => {
    let cancelado = false;

    async function verificar() {
      if (!(await temSessao())) {
        router.replace("/entrar");
        return;
      }

      let membro;
      try {
        membro = await obterMeuMembro();
      } catch {
        // erro de rede: deixa passar pra tela decidir o que mostrar (o app
        // pode estar offline com sessão já válida).
        if (!cancelado) setEstado("ok");
        return;
      }
      if (cancelado) return;

      if (!membro) {
        setEstado("sem-vinculo");
        return;
      }

      if (!temPin()) {
        router.replace("/criar-pin");
        return;
      }
      if (!pinDesbloqueado()) {
        router.replace("/desbloquear");
        return;
      }

      setEstado("ok");
    }

    verificar();

    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") router.replace("/entrar");
    });

    return () => {
      cancelado = true;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (estado === "verificando") {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <p className="text-sm text-zinc-600">Carregando…</p>
      </main>
    );
  }

  if (estado === "sem-vinculo") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#2e6b3e] text-2xl text-white">
          🌿
        </span>
        <p className="text-base font-semibold text-zinc-900">Conta ainda não vinculada</p>
        <p className="mt-2 text-sm text-zinc-600">
          Seu login funcionou, mas essa conta ainda não está ligada a um cadastro da
          equipe. Peça um link de convite à coordenação e abra por ele.
        </p>
        <button
          type="button"
          onClick={async () => {
            await sair();
            router.replace("/entrar");
          }}
          className="mt-6 rounded-xl border-2 border-[#2e6b3e] px-6 py-2 text-sm font-bold text-[#2e6b3e]"
        >
          Sair
        </button>
      </main>
    );
  }

  return <>{children}</>;
}
