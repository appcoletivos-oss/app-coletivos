"use client";

import { useOffline } from "next/offline";

// Aviso simples e visível de que o app está sem internet. Não bloqueia o
// uso — a pessoa continua preenchendo o que precisar, e o Next.js reenvia
// tudo sozinho assim que a conexão 4G voltar (configurado em next.config.ts).
export function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) {
    return null;
  }

  return (
    <div
      role="status"
      className="w-full bg-amber-100 px-4 py-3 text-center text-sm font-medium text-amber-900"
    >
      Sem internet no momento. O que você preencher fica guardado e é
      enviado sozinho quando a conexão voltar.
    </div>
  );
}
