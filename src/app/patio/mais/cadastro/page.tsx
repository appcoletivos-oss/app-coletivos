"use client";

// Cadastro (dentro de "Mais", restrito à coordenação) — ver wireframe
// (Registro Geral, seção "Decisão de modelagem: memória histórica de
// parceiros e canteiros") e a decisão de ampliar com a aba Equipe.
//
// Quatro abas, cada uma sobre sua própria tabela do banco:
// Parceiros e Canteiros compartilham o padrão "corrigir nome" vs.
// "encerrar e substituir" (memória histórica); Caixas usa só o campo
// `status` que já existia; Equipe soma isso ao fluxo de convite.

import Link from "next/link";
import { useState } from "react";
import { AbaCaixas } from "./aba-caixas";
import { AbaCanteiros } from "./aba-canteiros";
import { AbaEquipe } from "./aba-equipe";
import { AbaLocalTrabalho } from "./aba-local-trabalho";
import { AbaParceiros } from "./aba-parceiros";

type Aba = "parceiros" | "canteiros" | "caixas" | "equipe" | "local";

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: "parceiros", rotulo: "Parceiros" },
  { valor: "canteiros", rotulo: "Canteiros" },
  { valor: "caixas", rotulo: "Caixas" },
  { valor: "equipe", rotulo: "Equipe" },
  { valor: "local", rotulo: "Local de trabalho" },
];

export default function CadastroPage() {
  const [aba, setAba] = useState<Aba>("parceiros");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-zinc-800 bg-white px-3 py-2">
        <span className="text-sm font-bold text-zinc-900">📋 Cadastro</span>
        <Link href="/patio/mais" className="text-lg" aria-label="Voltar">
          ←
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {ABAS.map((item) => (
          <button
            key={item.valor}
            type="button"
            onClick={() => setAba(item.valor)}
            className={[
              "rounded-lg border-2 px-2.5 py-2 text-[11px] font-bold",
              aba === item.valor
                ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]"
                : "border-zinc-300 bg-white text-zinc-600",
            ].join(" ")}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      {aba === "parceiros" && <AbaParceiros />}
      {aba === "canteiros" && <AbaCanteiros />}
      {aba === "caixas" && <AbaCaixas />}
      {aba === "equipe" && <AbaEquipe />}
      {aba === "local" && <AbaLocalTrabalho />}
    </main>
  );
}
