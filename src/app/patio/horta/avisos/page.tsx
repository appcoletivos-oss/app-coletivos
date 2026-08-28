"use client";

// Horta → Avisos automáticos
//
// Germinação/transplante/colheita previstos + manejo periódico devido, por
// plantio — motor de "demandas do dia" (HANDOFF_HORTA_COMPLETO.md, v3,
// seção 3.10a). Essa lista se SOMA (não substitui) às tarefas fixas já
// existentes na Agenda (mutirões, turnos, rega manual geral, ronda
// observativa) — aqui é só o painel específico da Horta; onde mais isso
// aparece (ex.: dentro da própria Agenda) fica pra quando fizer sentido de
// produto, o handoff já deixa isso como decisão de UI em aberto.

import Link from "next/link";
import { useEffect, useState } from "react";
import { listarCanteiros } from "@/lib/patio";
import { calcularDemandasHorta, type DemandaHorta, type SituacaoDemanda, type TipoDemanda } from "@/lib/plantios";
import type { Canteiro } from "@/lib/types";
import { TelaBase } from "@/components/fluxo-registro";

const ROTULO_TIPO: Record<TipoDemanda, { icone: string; rotulo: string; href: string }> = {
  germinacao: { icone: "🌱", rotulo: "confirmar germinação", href: "/patio/horta/confirmar-germinacao" },
  transplante: { icone: "🔀", rotulo: "transplantar", href: "/patio/horta/transplantar" },
  colheita: { icone: "🧺", rotulo: "colher", href: "/patio/horta/registrar-colheita" },
  capina_seletiva: { icone: "🌾", rotulo: "capina seletiva", href: "/patio/horta/manejo" },
  adubacao: { icone: "🧪", rotulo: "adubação", href: "/patio/horta/manejo" },
  poda: { icone: "✂️", rotulo: "poda", href: "/patio/horta/manejo" },
  raleamento: { icone: "🍃", rotulo: "raleamento", href: "/patio/horta/manejo" },
};

const ROTULO_SITUACAO: Record<SituacaoDemanda, { titulo: string; cor: string }> = {
  atrasado: { titulo: "⚠️ Atrasado", cor: "border-red-300 bg-red-50 text-red-700" },
  hoje: { titulo: "📌 Hoje", cor: "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]" },
  em_breve: { titulo: "🗓️ Em breve", cor: "border-zinc-300 bg-white text-zinc-700" },
};

function formatarData(data: string): string {
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
}

export default function AvisosPage() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [demandas, setDemandas] = useState<DemandaHorta[]>([]);
  const [canteiros, setCanteiros] = useState<Canteiro[]>([]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [listaDemandas, listaCanteiros] = await Promise.all([
          calcularDemandasHorta(),
          listarCanteiros(),
        ]);
        if (!cancelado) {
          setDemandas(listaDemandas);
          setCanteiros(listaCanteiros);
        }
      } catch {
        if (!cancelado) setErro("Não deu pra carregar os avisos agora. Confira a internet e tente de novo.");
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
      <TelaBase titulo="Avisos" icone="🔔" voltarHref="/patio/horta">
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (erro) {
    return (
      <TelaBase titulo="Avisos" icone="🔔" voltarHref="/patio/horta">
        <p className="text-center text-sm text-red-700">{erro}</p>
      </TelaBase>
    );
  }

  const grupos: Record<SituacaoDemanda, DemandaHorta[]> = {
    atrasado: demandas.filter((d) => d.situacao === "atrasado"),
    hoje: demandas.filter((d) => d.situacao === "hoje"),
    em_breve: demandas.filter((d) => d.situacao === "em_breve").slice(0, 20),
  };

  return (
    <TelaBase titulo="Avisos" icone="🔔" voltarHref="/patio/horta">
      {demandas.length === 0 && (
        <p className="text-center text-sm text-zinc-600">Nenhum aviso pendente agora — tudo em dia.</p>
      )}

      <div className="flex flex-col gap-4">
        {(["atrasado", "hoje", "em_breve"] as const).map((situacao) => {
          const lista = grupos[situacao];
          if (lista.length === 0) return null;
          return (
            <div key={situacao}>
              <p className="mb-2 text-xs font-bold text-zinc-700">{ROTULO_SITUACAO[situacao].titulo}</p>
              <div className="flex flex-col gap-2">
                {lista.map((d, i) => {
                  const tipo = ROTULO_TIPO[d.tipo];
                  const canteiro = canteiros.find((c) => c.id === d.canteiroId);
                  return (
                    <Link
                      key={`${d.plantioId}-${d.tipo}-${i}`}
                      href={tipo.href}
                      className={`flex items-center justify-between rounded-lg border-2 px-3 py-2 ${ROTULO_SITUACAO[situacao].cor}`}
                    >
                      <span>
                        <span className="block text-sm font-bold">
                          {tipo.icone} {d.culturaNome} — {tipo.rotulo}
                        </span>
                        <span className="block text-[11px] opacity-80">
                          {canteiro?.nome ?? "—"} · {formatarData(d.dataDevida)}
                        </span>
                      </span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </TelaBase>
  );
}
