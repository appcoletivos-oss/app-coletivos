"use client";

// Hub do bloco "Mais" (ver wireframe, seção 6).
//
// Acesso por papel (Leva 1, matriz da decisão de 2026-08-27):
//   - Cadastro, avisos ao shopping, financeiro, relatórios ESG/ODS, arquivo
//     de fotos  -> coordenação e consultor;
//   - Registrar ocorrência atípica -> qualquer papel (equipe inclusive).
// A RLS do banco reforça isso; aqui é só a UI coerente.

import Link from "next/link";
import { useEffect, useState } from "react";
import { obterMeuMembro } from "@/lib/auth";
import type { PapelEquipe } from "@/lib/types";

type Item = {
  href: string;
  icone: string;
  rotulo: string;
  pronto: boolean;
  // true = também visível pra equipe; senão só coordenação/consultor.
  abertoAEquipe?: boolean;
};

const ITENS: Item[] = [
  { href: "/patio/mais/cadastro", icone: "📋", rotulo: "Cadastro", pronto: true },
  { href: "/patio/mais/avisos-shopping", icone: "📣", rotulo: "Avisos ao shopping", pronto: true },
  { href: "/patio/mais/financeiro", icone: "💰", rotulo: "Financeiro", pronto: true },
  { href: "#", icone: "📊", rotulo: "Relatórios ESG/ODS", pronto: false },
  { href: "/patio/mais/galeria", icone: "🖼️", rotulo: "Arquivo de fotos", pronto: true },
  { href: "/patio/mais/ocorrencia-atipica", icone: "⚠️", rotulo: "Ocorrência atípica", pronto: true, abertoAEquipe: true },
];

export default function MaisPage() {
  const [papel, setPapel] = useState<PapelEquipe | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const membro = await obterMeuMembro();
        if (!cancelado) setPapel(membro?.papel ?? null);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const ehGestor = papel === "coordenacao" || papel === "consultor";
  const itensVisiveis = ITENS.filter((item) => ehGestor || item.abertoAEquipe);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-zinc-800 bg-white px-3 py-2">
        <span className="text-sm font-bold text-zinc-900">⚙️ Mais</span>
        <Link href="/patio" className="text-lg" aria-label="Voltar">
          ←
        </Link>
      </div>

      {!carregando && !ehGestor && (
        <p className="mb-4 rounded-lg border border-dashed border-zinc-400 bg-[#f1efe6] px-3 py-2 text-center text-[11px] text-zinc-600">
          🔒 A maior parte deste bloco é da coordenação. Você tem acesso só a Ocorrência
          atípica.
        </p>
      )}

      {carregando ? (
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      ) : (
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
              <span className="mb-1 block text-2xl">{item.icone}</span>
              {item.rotulo}
              {!item.pronto && <span className="mt-1 block text-[10px] font-normal">em breve</span>}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
