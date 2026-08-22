"use client";

// Pedaços de tela reutilizados por qualquer fluxo de "registrar algo em N
// passos" (Registrar compostagem foi o primeiro; Registrar colheita é o
// segundo). Extraído de registrar-alimentacao/page.tsx em 2026-08-22 pra
// não duplicar essa UI a cada tela nova — o app deve ser modular desde o
// início (ver Registro Geral, seção 3/"Natureza").
//
// Continua sendo estilo/comportamento, não dado — cada tela de registro
// ainda define seus próprios passos, campos e regras de negócio.

import Link from "next/link";
import type { ReactNode } from "react";

export function TelaBase({
  titulo,
  icone,
  voltarHref,
  children,
}: {
  titulo: string;
  icone: ReactNode;
  voltarHref: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-zinc-800 bg-white px-3 py-2">
        <span className="text-sm font-bold text-zinc-900">
          {icone} {titulo}
        </span>
        <Link href={voltarHref} className="text-lg" aria-label="Fechar">
          ✕
        </Link>
      </div>
      {children}
    </main>
  );
}

export function PontosPasso({ passo, total }: { passo: number; total: number }) {
  return (
    <div className="mb-4 flex justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <span
          key={n}
          className={`h-1.5 w-1.5 rounded-full ${n <= passo ? "bg-[#2e6b3e]" : "bg-zinc-300"}`}
        />
      ))}
    </div>
  );
}

export function Passo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-center text-sm font-bold text-zinc-900">{titulo}</h2>
      {children}
    </div>
  );
}

export function BotaoGrande({
  icone,
  rotulo,
  selecionado,
  onClick,
}: {
  icone: string;
  rotulo: string;
  selecionado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border-2 py-4 text-center text-xs font-bold",
        selecionado ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]" : "border-zinc-800 bg-white text-zinc-800",
      ].join(" ")}
    >
      <span className="mb-1 block text-2xl">{icone}</span>
      {rotulo}
    </button>
  );
}

export function Stepper({
  valor,
  unidade,
  passoIncremento,
  minimo,
  onMudar,
}: {
  valor: number;
  unidade: string;
  passoIncremento: number;
  minimo: number;
  onMudar: (novo: number) => void;
}) {
  const casasDecimais = passoIncremento < 1 ? 1 : 0;
  return (
    <div className="flex items-center justify-center gap-4 rounded-xl border-2 border-zinc-800 bg-[#f1efe6] py-4">
      <button
        type="button"
        onClick={() => onMudar(Math.max(minimo, Number((valor - passoIncremento).toFixed(casasDecimais))))}
        className="h-9 w-9 rounded-lg border-2 border-zinc-800 bg-white text-lg font-bold"
        aria-label="diminuir"
      >
        −
      </button>
      <span className="min-w-20 text-center text-2xl font-bold tabular-nums text-zinc-900">
        {valor} {unidade}
      </span>
      <button
        type="button"
        onClick={() => onMudar(Number((valor + passoIncremento).toFixed(casasDecimais)))}
        className="h-9 w-9 rounded-lg border-2 border-zinc-800 bg-white text-lg font-bold"
        aria-label="aumentar"
      >
        +
      </button>
    </div>
  );
}

export function BotaoAvancar({
  onClick,
  texto = "Continuar",
  desabilitado = false,
}: {
  onClick: () => void;
  texto?: string;
  desabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={desabilitado}
      onClick={onClick}
      className="mt-4 w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white disabled:opacity-40"
    >
      {texto}
    </button>
  );
}

export function LinhaResumo({
  rotulo,
  valor,
  onEditar,
  ultima = false,
}: {
  rotulo: string;
  valor: string;
  onEditar: () => void;
  ultima?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${ultima ? "" : "border-b border-dashed border-zinc-200"}`}>
      <span className="text-xs text-zinc-500">{rotulo}</span>
      <button type="button" onClick={onEditar} className="text-xs font-bold text-zinc-900">
        {valor} <span aria-hidden="true">✏️</span>
      </button>
    </div>
  );
}
