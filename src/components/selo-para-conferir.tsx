"use client";

// Selo "Para conferir (N)" (Sprint B, B4): topo do Relatório do Turno e de
// /patio, só pra coordenação/consultor. N = propostas pendentes + culturas
// com revisar = true. Sem nada pendente, não aparece.

import Link from "next/link";
import { useEffect, useState } from "react";
import { obterMeuMembro } from "@/lib/auth";
import { contarParaConferir } from "@/lib/conferir";

export function SeloParaConferir() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const membro = await obterMeuMembro();
        if (membro?.papel !== "coordenacao" && membro?.papel !== "consultor") return;
        const n = await contarParaConferir();
        if (!cancelado) setTotal(n);
      } catch {
        // Sem internet: sem selo.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  if (total === 0) return null;
  return (
    <Link
      href="/patio/conferir"
      className="mb-3 flex items-center justify-between rounded-xl border-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"
    >
      <span>🔎 Para conferir ({total})</span>
      <span>→</span>
    </Link>
  );
}
