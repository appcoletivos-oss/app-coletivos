"use client";

// Destrava o app com o PIN (uma vez por sessão do navegador). Esqueceu o
// PIN? Não há reset — é só "entrar com outra conta" (sair e logar de novo),
// aí a tela de criar PIN aparece de novo. Ver src/lib/pin.ts.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sair, temSessao } from "@/lib/auth";
import { marcarDesbloqueado, pinDesbloqueado, temPin, validarPin } from "@/lib/pin";
import { TecladoPin } from "@/components/teclado-pin";

const MIN = 4;

export default function DesbloquearPage() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState(false);
  const [checando, setChecando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!(await temSessao())) {
        router.replace("/entrar");
        return;
      }
      if (!temPin()) {
        router.replace("/criar-pin");
        return;
      }
      if (pinDesbloqueado()) {
        router.replace("/patio");
        return;
      }
      if (!cancelado) setVerificando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [router]);

  async function tentar() {
    if (pin.length < MIN || checando) return;
    setChecando(true);
    setErro(false);
    const ok = await validarPin(pin);
    if (ok) {
      marcarDesbloqueado();
      router.replace("/patio");
      return;
    }
    setErro(true);
    setPin("");
    setChecando(false);
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
      <div className="mb-8 text-center">
        <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#2e6b3e] text-2xl text-white">
          🔒
        </span>
        <h1 className="text-lg font-bold text-zinc-900">Digite seu PIN</h1>
      </div>

      <TecladoPin valor={pin} onChange={setPin} max={6} />

      {erro && <p className="mt-4 text-center text-[11px] text-red-700">PIN incorreto. Tente de novo.</p>}

      <button
        type="button"
        disabled={pin.length < MIN || checando}
        onClick={tentar}
        className="mt-6 w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {checando ? "Conferindo…" : "Entrar"}
      </button>

      <button
        type="button"
        onClick={async () => {
          await sair();
          router.replace("/entrar");
        }}
        className="mt-4 text-center text-[11px] font-bold text-zinc-600 underline"
      >
        Entrar com outra conta
      </button>
    </main>
  );
}
