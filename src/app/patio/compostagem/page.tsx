"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconeCaixaDagua } from "@/components/icone-caixa-dagua";
import { obterMeuMembro } from "@/lib/auth";

// Hub do bloco Compostagem (ver wireframe, seção 1 e 2). "Registrar
// compostagem", "Ver caixas", "Análise sensorial" e "Controle de
// bombonas" estão construídas de verdade — as outras opções (adubo,
// água/energia, relatório da loja) ainda são placeholder, uma de cada vez.
//
// "Esvaziar caixa" só aparece pra Coordenação/Consultor (decisão do Thiago,
// 01/10/2026 — RLS e RPC registrar_esvaziamento_caixa reforçam no banco).
type Item = {
  href: string;
  icone: string | null;
  rotulo: string;
  pronto: boolean;
  soGestor?: boolean;
};

const ITENS: Item[] = [
  { href: "/patio/compostagem/registrar-alimentacao", icone: "📥", rotulo: "Registrar compostagem", pronto: true },
  { href: "/patio/compostagem/ver-caixas", icone: null, rotulo: "Ver caixas", pronto: true },
  { href: "#", icone: "🧪", rotulo: "Registrar adubo", pronto: false },
  { href: "/patio/compostagem/analise-sensorial", icone: "👃", rotulo: "Análise sensorial", pronto: true },
  { href: "/patio/compostagem/esvaziar-caixa", icone: "🧹", rotulo: "Esvaziar caixa", pronto: true, soGestor: true },
  { href: "#", icone: "💧", rotulo: "Água e energia", pronto: false },
  { href: "/patio/compostagem/bombonas", icone: "🛢️", rotulo: "Controle de bombonas", pronto: true },
];

export default function CompostagemPage() {
  // Começa false: o item restrito só aparece depois de confirmar o papel.
  const [ehGestor, setEhGestor] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const membro = await obterMeuMembro();
        if (!cancelado) setEhGestor(membro?.papel === "coordenacao" || membro?.papel === "consultor");
      } catch {
        // sem papel confirmado, o item restrito fica escondido
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const itensVisiveis = ITENS.filter((item) => ehGestor || !item.soGestor);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-zinc-800 bg-white px-3 py-2">
        <span className="text-sm font-bold text-zinc-900">🌱 Compostagem</span>
        <Link href="/patio" className="text-lg" aria-label="Voltar">
          ←
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {itensVisiveis.map((item) => (
          <Link
            key={item.rotulo}
            href={item.pronto ? item.href : "#"}
            aria-disabled={!item.pronto}
            className={[
              "rounded-xl border-2 py-5 text-center text-xs font-bold",
              item.pronto
                ? "border-zinc-800 bg-white text-zinc-800"
                : "pointer-events-none border-dashed border-zinc-300 text-zinc-400",
            ].join(" ")}
          >
            <span className="mb-1 block text-2xl">{item.icone ?? <IconeCaixaDagua className="mx-auto" />}</span>
            {item.rotulo}
            {!item.pronto && <span className="mt-1 block text-[10px] font-normal">em breve</span>}
          </Link>
        ))}
      </div>
    </main>
  );
}
