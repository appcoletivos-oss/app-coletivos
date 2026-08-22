"use client";

// Compostagem → Ver caixas
//
// Diferente de Registrar compostagem/colheita, esta tela não é um fluxo
// de N passos — é só leitura do estado das 26 caixas (peso acumulado,
// última alimentação, situação), por isso usa só TelaBase de
// @/components/fluxo-registro, sem Passo/Stepper/etc.
//
// Peso acumulado e última alimentação vêm de registros_alimentacao,
// agregados no cliente (resumoAlimentacaoPorCaixa) — volume ainda pequeno
// (fase piloto), sem view/RPC no Supabase só pra isso agora.

import { useEffect, useState } from "react";
import {
  listarCaixas,
  listarRegistrosAlimentacaoResumo,
  resumoAlimentacaoPorCaixa,
  rotuloStatusCaixa,
  type ResumoAlimentacaoCaixa,
} from "@/lib/patio";
import type { Caixa } from "@/lib/types";
import { IconeCaixaDagua } from "@/components/icone-caixa-dagua";
import { TelaBase } from "@/components/fluxo-registro";

export default function VerCaixasPage() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [caixas, setCaixas] = useState<Caixa[]>([]);
  const [resumos, setResumos] = useState<Map<string, ResumoAlimentacaoCaixa>>(
    new Map(),
  );

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        const [listaCaixas, registros] = await Promise.all([
          listarCaixas(),
          listarRegistrosAlimentacaoResumo(),
        ]);
        if (cancelado) return;
        setCaixas(listaCaixas);
        setResumos(resumoAlimentacaoPorCaixa(registros));
      } catch {
        if (!cancelado) {
          setErro(
            "Não deu pra carregar as caixas agora. Confira a internet e tente de novo.",
          );
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <TelaBase titulo="Ver caixas" icone={<IconeCaixaDagua />} voltarHref="/patio/compostagem">
      {carregando && (
        <p className="text-center text-sm text-zinc-600">Carregando caixas…</p>
      )}
      {erro && <p className="text-center text-sm text-red-700">{erro}</p>}

      {!carregando && !erro && (
        <div className="flex flex-col gap-3">
          {caixas.map((c) => (
            <CartaoCaixa key={c.id} caixa={c} resumo={resumos.get(c.id)} />
          ))}
        </div>
      )}
    </TelaBase>
  );
}

function CartaoCaixa({
  caixa,
  resumo,
}: {
  caixa: Caixa;
  resumo?: ResumoAlimentacaoCaixa;
}) {
  const ativa = caixa.status === "ativa";
  const rotuloStatus = ativa ? "ativa" : rotuloStatusCaixa(caixa.status);

  const pesoTotalKg = resumo?.pesoTotalKg ?? 0;
  const quantidadeRegistros = resumo?.quantidadeRegistros ?? 0;
  const ultimaAlimentacaoEm = resumo?.ultimaAlimentacaoEm ?? null;

  return (
    <div
      className={[
        "rounded-xl border-2 bg-white p-4",
        ativa ? "border-zinc-800" : "border-dashed border-zinc-300",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span
          className={[
            "inline-flex items-center gap-1.5 text-sm font-bold",
            ativa ? "text-zinc-900" : "text-zinc-400",
          ].join(" ")}
        >
          <IconeCaixaDagua /> Caixa {caixa.numero}
        </span>
        <span
          className={[
            "rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
            ativa
              ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]"
              : "border-zinc-300 bg-zinc-50 text-zinc-400",
          ].join(" ")}
        >
          {ativa ? "🟢 ativa" : rotuloStatus}
        </span>
      </div>

      <div className={`mt-3 grid grid-cols-2 gap-2 text-center ${ativa ? "" : "opacity-60"}`}>
        <div className="rounded-lg bg-[#f1efe6] py-2">
          <p className="text-lg font-bold text-zinc-900">
            {pesoTotalKg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg
          </p>
          <p className="text-[10px] text-zinc-500">peso acumulado</p>
        </div>
        <div className="rounded-lg bg-[#f1efe6] py-2">
          <p className="text-lg font-bold text-zinc-900">{quantidadeRegistros}</p>
          <p className="text-[10px] text-zinc-500">
            {quantidadeRegistros === 1 ? "alimentação" : "alimentações"}
          </p>
        </div>
      </div>

      <p className={`mt-2 text-center text-xs ${ativa ? "text-zinc-600" : "text-zinc-400"}`}>
        {ultimaAlimentacaoEm
          ? `Última alimentação: ${formatarData(ultimaAlimentacaoEm)}`
          : "Nunca alimentada"}
      </p>

      {caixa.observacoes && (
        <p className="mt-2 text-center text-[11px] text-zinc-500 italic">
          {caixa.observacoes}
        </p>
      )}
    </div>
  );
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}
