"use client";

// Cadastro do PIN, logo depois do primeiro login. Só uma trava de tela pro
// dia a dia — ver src/lib/pin.ts.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obterMeuMembro, temSessao } from "@/lib/auth";
import { definirPin, temPin } from "@/lib/pin";
import { TecladoPin } from "@/components/teclado-pin";

const MIN = 4;

export default function CriarPinPage() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);
  const [fase, setFase] = useState<"definir" | "confirmar">("definir");
  const [pin, setPin] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!(await temSessao())) {
        router.replace("/entrar");
        return;
      }
      if (temPin()) {
        router.replace("/patio");
        return;
      }
      const membro = await obterMeuMembro();
      if (cancelado) return;
      if (!membro) {
        router.replace("/patio"); // o gate mostra a mensagem de "sem vínculo"
        return;
      }
      setVerificando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [router]);

  async function avancar() {
    setErro(null);
    if (fase === "definir") {
      if (pin.length < MIN) return;
      setFase("confirmar");
      return;
    }
    if (confirma !== pin) {
      setErro("Os dois PINs não bateram. Tente de novo.");
      setConfirma("");
      return;
    }
    setSalvando(true);
    try {
      await definirPin(pin);
      router.replace("/patio");
    } catch {
      setErro("Não deu pra salvar o PIN. Tente de novo.");
      setSalvando(false);
    }
  }

  if (verificando) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <p className="text-sm text-zinc-600">Carregando…</p>
      </main>
    );
  }

  const valorAtual = fase === "definir" ? pin : confirma;
  const setValorAtual = fase === "definir" ? setPin : setConfirma;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-lg font-bold text-zinc-900">
          {fase === "definir" ? "Crie um PIN" : "Repita o PIN"}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {fase === "definir"
            ? "De 4 a 6 números. Vai ser pedido pra abrir o app."
            : "Só pra confirmar que você lembra."}
        </p>
      </div>

      <TecladoPin valor={valorAtual} onChange={setValorAtual} max={6} />

      {erro && <p className="mt-4 text-center text-[11px] text-red-700">{erro}</p>}

      <button
        type="button"
        disabled={salvando || valorAtual.length < MIN}
        onClick={avancar}
        className="mt-6 w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {fase === "definir" ? "Continuar" : salvando ? "Salvando…" : "Confirmar"}
      </button>

      {fase === "confirmar" && (
        <button
          type="button"
          onClick={() => {
            setFase("definir");
            setConfirma("");
            setErro(null);
          }}
          className="mt-3 text-center text-[11px] font-bold text-zinc-600 underline"
        >
          voltar
        </button>
      )}
    </main>
  );
}
