"use client";

// Banner de ocorrências atípicas pendentes na home do Pátio — aparece assim
// que alguém abre o app, enquanto houver ocorrência não resolvida. Ver
// claude/handoff-mais-pacote1.md, seção 2.2. (Notificação push real fica
// pra rodada de finalização do app.)

import Link from "next/link";
import { useEffect, useState } from "react";
import { contarOcorrenciasPendentes } from "@/lib/ocorrencias";

export function OcorrenciasBanner() {
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const qtd = await contarOcorrenciasPendentes();
        if (!cancelado) setPendentes(qtd);
      } catch {
        // silencioso: o banner é um extra, não pode quebrar a home
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  if (pendentes === 0) return null;

  return (
    <Link
      href="/patio/mais/ocorrencia-atipica"
      className="mb-4 flex items-center justify-between rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"
    >
      <span>
        ⚠️ {pendentes} {pendentes === 1 ? "ocorrência atípica pendente" : "ocorrências atípicas pendentes"}
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}
