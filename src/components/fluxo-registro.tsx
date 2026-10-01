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
import { useEffect, useMemo, useState, type ReactNode } from "react";

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

// Campo numérico de peso (Etapa 1, item 1 — handoff "Registro
// simplificado"). Substitui o Stepper de +/- nos dois lugares que pedem
// peso digitado (Registrar compostagem, Registrar colheita): digitar é
// mais rápido que clicar dezenas de vezes num incremento de 0,5kg.
// `Stepper` continua existindo — ainda é usado pra temperatura.
//
// Mantém o texto digitado em estado próprio (não deriva direto de
// `valor`) pra não atrapalhar a pessoa enquanto ela ainda está no meio de
// digitar a vírgula decimal (ex.: "12," viraria "12" se o campo
// re-renderizasse a cada tecla a partir do number já convertido).
export function CampoPeso({
  valor,
  onMudar,
  autoFocus = false,
}: {
  valor: number;
  onMudar: (novo: number) => void;
  autoFocus?: boolean;
}) {
  const [texto, setTexto] = useState(() => formatarPeso(valor));

  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-zinc-800 bg-[#f1efe6] py-6">
      <input
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        value={texto}
        onChange={(e) => {
          // Aceita dígitos, vírgula e ponto digitados; qualquer outra
          // tecla (letra, símbolo) é ignorada em vez de travar o campo.
          const bruto = e.target.value.replace(/[^0-9,.]/g, "");
          setTexto(bruto);
          const numero = Number(bruto.replace(",", "."));
          if (!Number.isNaN(numero)) onMudar(numero);
        }}
        onBlur={() => setTexto(formatarPeso(valor))}
        className="w-24 border-b-2 border-zinc-800 bg-transparent text-center text-3xl font-bold tabular-nums text-zinc-900 focus:outline-none"
      />
      <span className="text-lg font-bold text-zinc-600">kg</span>
    </div>
  );
}

function formatarPeso(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

// Seletor de fotos múltiplas (Etapa 1, item 2 — handoff "Registro
// simplificado"). Substitui o padrão antigo de "uma foto só" repetido em
// cada tela de registro: aceita câmera e galeria (com seleção múltipla de
// uma vez na galeria). Quem chama decide o que fazer com a lista de
// arquivos — a primeira vira a capa (`foto_url` da tabela original), as
// demais viram linhas em `fotos_registro` (ver lib/patio.ts,
// salvarFotosExtras).
export function SeletorFotos({
  fotos,
  onMudar,
  obrigatoria = false,
}: {
  fotos: File[];
  onMudar: (novas: File[]) => void;
  obrigatoria?: boolean;
}) {
  const previews = useMemo(() => fotos.map((f) => URL.createObjectURL(f)), [fotos]);
  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  function adicionar(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    onMudar([...fotos, ...Array.from(lista)]);
  }

  function remover(indice: number) {
    onMudar(fotos.filter((_, i) => i !== indice));
  }

  return (
    <div>
      {previews.length > 0 && (
        <div className="mb-3 flex flex-wrap justify-center gap-2">
          {previews.map((src, i) => (
            <div key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Foto ${i + 1}`}
                className="h-16 w-16 rounded-lg border-2 border-zinc-800 object-cover"
              />
              <button
                type="button"
                onClick={() => remover(i)}
                aria-label={`Remover foto ${i + 1}`}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-700 text-[10px] font-bold text-white"
              >
                ✕
              </button>
              {i === 0 && (
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-[#2e6b3e] px-1.5 py-0.5 text-[8px] font-bold text-white">
                  capa
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <label className="flex-1 cursor-pointer rounded-xl border-2 border-dashed border-zinc-800 bg-[#f1efe6] p-4 text-center">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              adicionar(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="text-xs font-bold text-zinc-800">📷 Câmera</span>
        </label>
        <label className="flex-1 cursor-pointer rounded-xl border-2 border-dashed border-zinc-800 bg-[#f1efe6] p-4 text-center">
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              adicionar(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="text-xs font-bold text-zinc-800">🖼️ Galeria</span>
        </label>
      </div>

      {obrigatoria && fotos.length === 0 && (
        <span className="mt-1 block text-center text-[10px] text-red-800">obrigatório</span>
      )}
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
