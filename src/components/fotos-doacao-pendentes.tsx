"use client";

// "Fotos de doação pendentes" (Sprint B, B2c/B4): doação de alimento
// aprovada pelo Relato do turno nasce sem foto. Um toque abre a câmera e
// anexa. Quem pode anexar quem decide é o gatilho do banco (autor do
// registro, quem relatou, coordenação/consultor).
//
// Aparece na fila /patio/conferir (todas), na tela de Venda (todas) e no
// Relatório do Turno (só as que saíram dele, via `ids`).

import { useCallback, useEffect, useState } from "react";
import { anexarFotoDoacao, listarDoacoesFotoPendente, type DoacaoFotoPendente } from "@/lib/conferir";

export function FotosDoacaoPendentes({ ids, titulo = "📷 Fotos de doação pendentes" }: { ids?: string[]; titulo?: string }) {
  const [lista, setLista] = useState<DoacaoFotoPendente[]>([]);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const chaveIds = ids?.join(",");

  const carregar = useCallback(async () => {
    try {
      setLista(await listarDoacoesFotoPendente(chaveIds === undefined ? undefined : chaveIds ? chaveIds.split(",") : []));
    } catch {
      // Silencioso: a seção só não aparece.
    }
  }, [chaveIds]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!cancelado) await carregar();
    })();
    return () => {
      cancelado = true;
    };
  }, [carregar]);

  async function anexar(id: string, foto: File | undefined) {
    if (!foto) return;
    setEnviando(id);
    setErro(null);
    try {
      await anexarFotoDoacao(id, foto);
      await carregar();
    } catch {
      setErro("Não deu pra anexar a foto agora. Confira a internet e tente de novo.");
    } finally {
      setEnviando(null);
    }
  }

  if (lista.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-bold text-zinc-800">
        {titulo} ({lista.length})
      </p>
      <div className="flex flex-col gap-2">
        {lista.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 p-2.5">
            <span className="text-[11px] text-zinc-800">
              <span className="font-bold">{d.cultura_nome ?? "Doação"}</span>
              {d.quantidade !== null && ` · ${d.quantidade} ${d.unidade}`}
              {d.destino && ` · ${d.destino}`}
              <span className="block text-[10px] text-zinc-500">{new Date(d.criado_em).toLocaleDateString("pt-BR")}</span>
            </span>
            <label className="shrink-0 cursor-pointer rounded-lg bg-[#2e6b3e] px-3 py-1.5 text-[11px] font-bold text-white">
              {enviando === d.id ? "Enviando…" : "📷 Foto"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={enviando !== null}
                onChange={(e) => anexar(d.id, e.target.files?.[0])}
              />
            </label>
          </div>
        ))}
      </div>
      {erro && <p className="mt-1 text-center text-[11px] text-red-700">{erro}</p>}
    </div>
  );
}
