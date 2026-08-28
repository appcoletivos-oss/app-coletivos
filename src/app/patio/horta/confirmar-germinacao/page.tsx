"use client";

// Horta → Confirmar germinação
//
// Só aparece pra plantios com origem=semente ainda em status "germinando"
// (ver HANDOFF_HORTA_COMPLETO.md, v3, seção 3.4). Edição simples: data e
// quantidade germinada, move o status pra "ativo". Não é um fluxo de N
// passos — é uma lista + um form curto, porque normalmente tem só um ou
// dois lotes germinando de cada vez.

import Link from "next/link";
import { useEffect, useState } from "react";
import { confirmarGerminacao, listarPlantiosGerminando } from "@/lib/plantios";
import type { PlantioComCultura } from "@/lib/types";
import { TelaBase } from "@/components/fluxo-registro";

export default function ConfirmarGerminacaoPage() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [plantios, setPlantios] = useState<PlantioComCultura[]>([]);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [ultimoConfirmado, setUltimoConfirmado] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setPlantios(await listarPlantiosGerminando());
    } catch {
      setErro("Não deu pra carregar os plantios agora. Confira a internet e tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!cancelado) await carregar();
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  if (carregando) {
    return (
      <TelaBase titulo="Confirmar germinação" icone="🌱" voltarHref="/patio/horta">
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (erro) {
    return (
      <TelaBase titulo="Confirmar germinação" icone="🌱" voltarHref="/patio/horta">
        <p className="text-center text-sm text-red-700">{erro}</p>
      </TelaBase>
    );
  }

  return (
    <TelaBase titulo="Confirmar germinação" icone="🌱" voltarHref="/patio/horta">
      {ultimoConfirmado && (
        <p className="mb-3 rounded-lg border-2 border-[#2e6b3e] bg-[#eaf3ea] px-3 py-2 text-center text-xs font-semibold text-[#2e6b3e]">
          ✅ Germinação confirmada — o lote já está ativo.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {plantios.map((p) =>
          confirmandoId === p.id ? (
            <FormConfirmar
              key={p.id}
              plantio={p}
              onCancelar={() => setConfirmandoId(null)}
              onSalvar={async (dados) => {
                await confirmarGerminacao(p.id, dados);
                setConfirmandoId(null);
                setUltimoConfirmado(p.id);
                await carregar();
              }}
            />
          ) : (
            <div key={p.id} className="rounded-xl border-2 border-zinc-800 bg-white p-3">
              <p className="text-sm font-bold text-zinc-900">{p.cultura_nome}</p>
              <p className="text-[11px] text-zinc-500">
                Plantado em {new Date(`${p.data_inicio}T00:00:00`).toLocaleDateString("pt-BR")}
                {p.quantidade_inicial ? ` · ${p.quantidade_inicial} ${p.unidade ?? ""}`.trim() : ""}
              </p>
              <button
                type="button"
                onClick={() => setConfirmandoId(p.id)}
                className="mt-2 rounded-full border-2 border-[#2e6b3e] px-3 py-1 text-[11px] font-bold text-[#2e6b3e]"
              >
                🌱 Confirmar germinação
              </button>
            </div>
          ),
        )}
        {plantios.length === 0 && (
          <p className="text-center text-sm text-zinc-600">Nenhum plantio esperando confirmação de germinação.</p>
        )}
      </div>

      <Link
        href="/patio/horta"
        className="mt-4 block w-full rounded-xl border-2 border-[#2e6b3e] py-3 text-center text-sm font-semibold text-[#2e6b3e]"
      >
        Voltar pra Horta
      </Link>
    </TelaBase>
  );
}

function FormConfirmar({
  plantio,
  onSalvar,
  onCancelar,
}: {
  plantio: PlantioComCultura;
  onSalvar: (dados: { data_germinacao: string; quantidade_germinada: number }) => Promise<void>;
  onCancelar: () => void;
}) {
  const [dataGerminacao, setDataGerminacao] = useState(new Date().toISOString().slice(0, 10));
  const [quantidadeGerminada, setQuantidadeGerminada] = useState(
    plantio.quantidade_inicial?.toString() ?? "",
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!quantidadeGerminada.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({
        data_germinacao: dataGerminacao,
        quantidade_germinada: Number(quantidadeGerminada),
      });
    } catch {
      setErro("Não deu pra salvar agora. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-[#2e6b3e] bg-[#eaf3ea] p-3">
      <p className="mb-2 text-xs font-bold text-[#2e6b3e]">{plantio.cultura_nome}</p>
      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Data da germinação
        <input
          type="date"
          value={dataGerminacao}
          onChange={(e) => setDataGerminacao(e.target.value)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
        />
      </label>
      <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
        Quantas germinaram{plantio.quantidade_inicial ? ` (de ${plantio.quantidade_inicial} plantadas)` : ""}
        <input
          value={quantidadeGerminada}
          onChange={(e) => setQuantidadeGerminada(e.target.value)}
          inputMode="decimal"
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
        />
      </label>
      {erro && <p className="mb-2 text-[11px] text-red-700">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={salvando || !quantidadeGerminada.trim()}
          onClick={salvar}
          className="flex-1 rounded-lg bg-[#2e6b3e] py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          {salvando ? "Salvando…" : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-lg border-2 border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
