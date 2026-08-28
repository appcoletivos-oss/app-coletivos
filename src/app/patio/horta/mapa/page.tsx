"use client";

// Horta → Mapa
//
// Canteiro × plantios ativos (origem, quantidade, previsão de colheita),
// sinaliza consórcio (mais de um plantio ativo no mesmo canteiro) e deixa
// ver a linhagem completa de um plantio (de onde veio / pra onde foi) —
// ver HANDOFF_HORTA_COMPLETO.md (v3), seção 4. Também é daqui que se marca
// um plantio como perdido/doado/encerrado/colhido direto, pros casos que
// não vêm de um registro formal (ex.: planta morreu sem "perda" detalhada).

import { useEffect, useState } from "react";
import { listarCanteiros } from "@/lib/patio";
import { iconeTipoCanteiro } from "@/lib/horta";
import { linhagemPlantio, listarPlantiosParaMapaPorCanteiro, marcarStatusPlantio } from "@/lib/plantios";
import type { Canteiro, Plantio, PlantioComCultura } from "@/lib/types";
import { TelaBase } from "@/components/fluxo-registro";

const ROTULO_ORIGEM: Record<Plantio["origem"], string> = {
  semente: "semente",
  muda_comprada: "muda comprada",
  estaca: "estaca",
  ja_existente: "já existente",
  divisao: "transplante",
};

function diasRestantes(previsao: string | null): string | null {
  if (!previsao) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${previsao}T00:00:00`);
  const dias = Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) return `atrasado ${Math.abs(dias)}d`;
  if (dias === 0) return "hoje";
  return `em ${dias}d`;
}

export default function MapaPage() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [canteiros, setCanteiros] = useState<Canteiro[]>([]);
  const [plantiosPorCanteiro, setPlantiosPorCanteiro] = useState<Map<string, PlantioComCultura[]>>(new Map());
  const [abertoId, setAbertoId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const listaCanteiros = await listarCanteiros();
      const listas = await Promise.all(
        listaCanteiros.map((c) => listarPlantiosParaMapaPorCanteiro(c.id)),
      );
      const mapa = new Map<string, PlantioComCultura[]>();
      listaCanteiros.forEach((c, i) => mapa.set(c.id, listas[i]));
      setCanteiros(listaCanteiros);
      setPlantiosPorCanteiro(mapa);
    } catch {
      setErro("Não deu pra carregar o mapa agora. Confira a internet e tente de novo.");
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

  async function atualizarStatus(plantioId: string, canteiroId: string, status: "perdido" | "doado" | "encerrado" | "colhido") {
    await marcarStatusPlantio(plantioId, status);
    const lista = await listarPlantiosParaMapaPorCanteiro(canteiroId);
    setPlantiosPorCanteiro((mapa) => new Map(mapa).set(canteiroId, lista));
  }

  if (carregando) {
    return (
      <TelaBase titulo="Mapa" icone="🗺️" voltarHref="/patio/horta">
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (erro) {
    return (
      <TelaBase titulo="Mapa" icone="🗺️" voltarHref="/patio/horta">
        <p className="text-center text-sm text-red-700">{erro}</p>
      </TelaBase>
    );
  }

  return (
    <TelaBase titulo="Mapa" icone="🗺️" voltarHref="/patio/horta">
      <div className="flex flex-col gap-2">
        {canteiros.map((c) => {
          const plantios = plantiosPorCanteiro.get(c.id) ?? [];
          const aberto = abertoId === c.id;
          return (
            <div key={c.id} className="rounded-xl border-2 border-zinc-800 bg-white">
              <button
                type="button"
                onClick={() => setAbertoId(aberto ? null : c.id)}
                className="flex w-full items-center justify-between px-3 py-2.5"
              >
                <span className="text-sm font-bold text-zinc-900">
                  {iconeTipoCanteiro(c.tipo)} {c.nome}
                </span>
                <span className="flex items-center gap-2">
                  {plantios.filter((p) => p.status !== "transplantado").length > 1 && (
                    <span className="rounded-full bg-[#eaf3ea] px-2 py-0.5 text-[10px] font-bold text-[#2e6b3e]">
                      consórcio · {plantios.filter((p) => p.status !== "transplantado").length}
                    </span>
                  )}
                  <span className="text-xs text-zinc-400">{aberto ? "▲" : "▼"}</span>
                </span>
              </button>

              {aberto && (
                <div className="border-t-2 border-dashed border-zinc-200 p-3">
                  {plantios.length === 0 ? (
                    <p className="text-center text-xs text-zinc-500">Nenhum plantio ativo nesse canteiro.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {plantios.map((p) => (
                        <CardPlantio
                          key={p.id}
                          plantio={p}
                          onMudarStatus={(status) => atualizarStatus(p.id, c.id, status)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {canteiros.length === 0 && (
          <p className="text-center text-sm text-zinc-600">Nenhum canteiro cadastrado ainda.</p>
        )}
      </div>
    </TelaBase>
  );
}

function CardPlantio({
  plantio,
  onMudarStatus,
}: {
  plantio: PlantioComCultura;
  onMudarStatus: (status: "perdido" | "doado" | "encerrado" | "colhido") => Promise<void>;
}) {
  const [linhagemAberta, setLinhagemAberta] = useState(false);
  const [linhagem, setLinhagem] = useState<Plantio[] | null>(null);
  const [carregandoLinhagem, setCarregandoLinhagem] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const restante = diasRestantes(plantio.previsao_colheita);
  const fechado = plantio.status === "transplantado";

  async function abrirLinhagem() {
    setLinhagemAberta(true);
    if (linhagem) return;
    setCarregandoLinhagem(true);
    try {
      setLinhagem(await linhagemPlantio(plantio.id));
    } finally {
      setCarregandoLinhagem(false);
    }
  }

  async function acionar(status: "perdido" | "doado" | "encerrado" | "colhido") {
    setEnviando(true);
    try {
      await onMudarStatus(status);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={["rounded-lg border p-2.5", fechado ? "border-dashed border-zinc-300 bg-zinc-100" : "border-zinc-300 bg-[#f1efe6]"].join(" ")}>
      <div className="flex items-start justify-between">
        <div>
          <p className={["text-sm font-bold", fechado ? "text-zinc-500" : "text-zinc-900"].join(" ")}>
            {fechado ? "🔒 " : ""}
            {plantio.cultura_nome}
          </p>
          <p className="text-[11px] text-zinc-500">
            {ROTULO_ORIGEM[plantio.origem]}
            {plantio.status === "germinando" ? " · germinando" : ""}
            {fechado ? " · encerrado (transplantado — veja pra onde foi na linhagem)" : ""}
            {(plantio.quantidade_germinada ?? plantio.quantidade_inicial) != null
              ? ` · ${plantio.quantidade_germinada ?? plantio.quantidade_inicial} ${plantio.unidade ?? ""}`.trim()
              : ""}
          </p>
          {restante && !fechado && <p className="text-[11px] font-semibold text-[#2e6b3e]">colheita prevista: {restante}</p>}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={abrirLinhagem}
          className="rounded-full border-2 border-zinc-300 bg-white px-2.5 py-1 text-[10px] font-bold text-zinc-700"
        >
          🧬 Linhagem
        </button>
        {!fechado && (
          <>
            <button
              type="button"
              disabled={enviando}
              onClick={() => acionar("colhido")}
              className="rounded-full border-2 border-zinc-300 bg-white px-2.5 py-1 text-[10px] font-bold text-zinc-700 disabled:opacity-40"
            >
              🧺 Encerrar (colhido)
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => acionar("perdido")}
              className="rounded-full border-2 border-red-300 bg-white px-2.5 py-1 text-[10px] font-bold text-red-700 disabled:opacity-40"
            >
              💀 Perdido
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => acionar("doado")}
              className="rounded-full border-2 border-zinc-300 bg-white px-2.5 py-1 text-[10px] font-bold text-zinc-700 disabled:opacity-40"
            >
              🎁 Doado
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => acionar("encerrado")}
              className="rounded-full border-2 border-zinc-300 bg-white px-2.5 py-1 text-[10px] font-bold text-zinc-700 disabled:opacity-40"
            >
              🚫 Encerrar
            </button>
          </>
        )}
      </div>

      {linhagemAberta && (
        <div className="mt-2 rounded-lg border border-dashed border-zinc-400 bg-white p-2">
          {carregandoLinhagem ? (
            <p className="text-[10px] text-zinc-500">Carregando linhagem…</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {/* linhagem_plantio() já devolve em ordem cronológica (mais antigo primeiro), ancestrais e descendentes juntos */}
              {(linhagem ?? []).map((l, i) => (
                <li key={l.id} className="text-[10px] text-zinc-600">
                  {i + 1}. {ROTULO_ORIGEM[l.origem]} — {new Date(`${l.data_inicio}T00:00:00`).toLocaleDateString("pt-BR")}
                  {l.status === "transplantado" ? " (encerrado — virou outro lote)" : ""}
                  {l.id === plantio.id ? " (este lote)" : ""}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
