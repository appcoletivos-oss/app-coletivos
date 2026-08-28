"use client";

// Horta → Estoque do viveiro
//
// Agrupa plantios_saldo por cultura, olhando todo plantio germinando/ativo
// cujo canteiro é do tipo geodesica/bandeja_muda/saco_muda — cobre
// qualquer origem (compra, sobra de transplante, germinação própria ainda
// não alocada). Dois números sempre separados por cultura, nunca uma soma
// única: "germinando (aguardando confirmação)" e "disponível" (saldo já
// confirmado). Sem campo de custo/fornecedor — decisão explícita, controle
// financeiro fica fora do módulo Horta (ver lib/plantios.ts,
// listarEstoqueViveiro, e pedido do usuário, 2026-08-28).

import { useEffect, useState } from "react";
import { listarEstoqueViveiro } from "@/lib/plantios";
import type { EstoqueViveiroCultura, OrigemPlantio } from "@/lib/types";
import { TelaBase } from "@/components/fluxo-registro";

const ROTULO_ORIGEM: Record<OrigemPlantio, string> = {
  semente: "semente",
  muda_comprada: "muda comprada",
  estaca: "estaca",
  ja_existente: "já existente",
  divisao: "transplante",
};

export default function EstoqueViveiroPage() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [estoque, setEstoque] = useState<EstoqueViveiroCultura[]>([]);
  const [abertoId, setAbertoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const lista = await listarEstoqueViveiro();
        if (!cancelado) setEstoque(lista);
      } catch {
        if (!cancelado) setErro("Não deu pra carregar o estoque agora. Confira a internet e tente de novo.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  if (carregando) {
    return (
      <TelaBase titulo="Estoque do viveiro" icone="📦" voltarHref="/patio/horta">
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (erro) {
    return (
      <TelaBase titulo="Estoque do viveiro" icone="📦" voltarHref="/patio/horta">
        <p className="text-center text-sm text-red-700">{erro}</p>
      </TelaBase>
    );
  }

  return (
    <TelaBase titulo="Estoque do viveiro" icone="📦" voltarHref="/patio/horta">
      <p className="mb-3 text-center text-[11px] text-zinc-500">
        Muda/semente disponível em geodésica, bandeja e saco de muda — por cultura.
      </p>

      <div className="flex flex-col gap-2">
        {estoque.map((e) => {
          const aberto = abertoId === e.culturaId;
          return (
            <div key={e.culturaId} className="rounded-xl border-2 border-zinc-800 bg-white">
              <button
                type="button"
                onClick={() => setAbertoId(aberto ? null : e.culturaId)}
                className="flex w-full items-center justify-between px-3 py-2.5"
              >
                <span className="text-sm font-bold text-zinc-900">{e.culturaNome}</span>
                <span className="text-xs text-zinc-400">{aberto ? "▲" : "▼"}</span>
              </button>

              <div className="flex gap-2 px-3 pb-2.5">
                <span className="flex-1 rounded-lg bg-[#fff6e0] px-2 py-1.5 text-center text-[11px] font-bold text-[#8a6300]">
                  🌱 germinando: {e.germinando}
                </span>
                <span className="flex-1 rounded-lg bg-[#eaf3ea] px-2 py-1.5 text-center text-[11px] font-bold text-[#2e6b3e]">
                  ✅ disponível: {e.disponivel}
                </span>
              </div>

              {aberto && (
                <div className="border-t-2 border-dashed border-zinc-200 p-3">
                  <div className="flex flex-col gap-1.5">
                    {e.lotes.map((l) => (
                      <div key={l.plantioId} className="rounded-lg border border-zinc-300 bg-[#f1efe6] p-2 text-[11px] text-zinc-600">
                        <span className="font-semibold text-zinc-800">{l.canteiroNome}</span>
                        {" · "}
                        {ROTULO_ORIGEM[l.origem]}
                        {" · "}
                        {new Date(`${l.dataInicio}T00:00:00`).toLocaleDateString("pt-BR")}
                        {" · "}
                        {l.status === "germinando" ? "germinando" : "disponível"}
                        {": "}
                        {l.quantidade ?? "—"} {l.unidade ?? ""}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {estoque.length === 0 && (
          <p className="text-center text-sm text-zinc-600">
            Nenhuma muda/semente no viveiro agora (geodésica, bandeja ou saco de muda).
          </p>
        )}
      </div>
    </TelaBase>
  );
}
