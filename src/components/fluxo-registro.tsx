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
  // valor 0 começa com o campo vazio (Sprint A.1: a pessoa digita direto,
  // sem apagar um "0" ou "1" de partida antes).
  const [texto, setTexto] = useState(() => (valor ? formatarPeso(valor) : ""));

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
        onBlur={() => setTexto(valor ? formatarPeso(valor) : "")}
        placeholder="0"
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

// -----------------------------------------------------------------------------
// Sprint A.1 — Menos toques (SPRINT_A1_MENOS_TOQUES.md, seção 2). Peças pra
// telas de registro em TELA ÚNICA: o essencial na frente, o resto recolhido,
// o botão Salvar já mostrando o resumo (sem tela "Confere antes de salvar"),
// escolhas em botões grandes e o contexto já respondido como cabeçalho.
// `PontosPasso`/`Passo`/`LinhaResumo` continuam aqui só pras telas que
// ainda não passaram pra tela única.
// -----------------------------------------------------------------------------

// P2 — bloco "＋ Mais detalhes", fechado por padrão. Mostra quantos campos
// opcionais já foram preenchidos lá dentro, pra a pessoa não esquecer que
// mexeu (ex.: "2 fotos").
export function BlocoRecolhivel({
  titulo = "Mais detalhes",
  resumo,
  children,
}: {
  titulo?: string;
  resumo?: string | null;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="mt-3 rounded-xl border-2 border-dashed border-zinc-300 bg-white">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-bold text-zinc-700"
      >
        <span>
          {aberto ? "－" : "＋"} {titulo}
          {!aberto && resumo ? <span className="ml-1 font-normal text-zinc-500">({resumo})</span> : null}
        </span>
        <span className="text-zinc-400">{aberto ? "▲" : "▼"}</span>
      </button>
      {aberto && <div className="flex flex-col gap-3 border-t-2 border-dashed border-zinc-200 p-3">{children}</div>}
    </div>
  );
}

// P3 — botão Salvar que já é o resumo do que vai ser gravado ("Salvar: 3 kg
// de Rúcula · Canteiro 5"). `pendencia` troca o texto quando ainda falta
// algo obrigatório, em vez de só ficar cinza sem explicar.
export function BotaoSalvar({
  resumo,
  pendencia,
  salvando,
  onClick,
}: {
  resumo: string;
  pendencia?: string | null;
  salvando: boolean;
  onClick: () => void;
}) {
  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={salvando || !!pendencia}
        onClick={onClick}
        className="w-full rounded-xl bg-[#2e6b3e] px-3 py-3.5 text-sm font-bold text-white disabled:opacity-40"
      >
        {salvando ? "Salvando…" : pendencia ? pendencia : `✅ ${resumo}`}
      </button>
    </div>
  );
}

// P7 — escolha em botões/chips grandes, não em lista. `colunas` = 0 deixa
// os chips quebrarem linha soltos (bom pra rótulos de tamanho variado,
// como motivos de perda).
export function SeletorBotoes<T extends string>({
  opcoes,
  valor,
  onEscolher,
  colunas = 0,
}: {
  opcoes: { valor: T; rotulo: string; icone?: string }[];
  valor: T | null;
  onEscolher: (v: T) => void;
  colunas?: 0 | 2 | 3 | 4 | 5;
}) {
  const grade =
    colunas === 0
      ? "flex flex-wrap gap-1.5"
      : `grid gap-1.5 ${{ 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" }[colunas]}`;
  return (
    <div className={grade}>
      {opcoes.map((o) => {
        const selecionado = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            onClick={() => onEscolher(o.valor)}
            aria-pressed={selecionado}
            className={[
              "rounded-xl border-2 px-3 py-2.5 text-center text-xs font-bold",
              selecionado ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]" : "border-zinc-300 bg-white text-zinc-700",
            ].join(" ")}
          >
            {o.icone && <span className={colunas === 0 ? "mr-1" : "mb-0.5 block text-lg"}>{o.icone}</span>}
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

// P4 — o que já foi respondido (canteiro, plantio, item do relatório) vira
// cabeçalho da tela, com um "trocar" discreto em vez de ser perguntado de
// novo.
export function CabecalhoContexto({
  texto,
  onTrocar,
}: {
  texto: string;
  onTrocar?: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border-2 border-[#2e6b3e] bg-[#eaf3ea] px-3 py-2.5">
      <span className="text-sm font-bold text-[#2e6b3e]">{texto}</span>
      {onTrocar && (
        <button type="button" onClick={onTrocar} className="shrink-0 text-[11px] text-zinc-600 underline">
          trocar
        </button>
      )}
    </div>
  );
}

// Rótulo pequeno em cima de um campo da tela única.
export function RotuloCampo({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{children}</p>;
}

// Formata número pro resumo do botão Salvar ("2,5"), sem casas sobrando.
export function formatarNumero(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
