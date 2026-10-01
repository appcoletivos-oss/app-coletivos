"use client";

// Relatório do Turno (Sprint A, item 6 —
// SPRINT_A_REGISTRO_SIMPLIFICADO_ETAPA2.md, seção 11a/11b).
//
// Ponto de entrada: descobre a data+turno de agora e abre (ou cria) o
// relatório correspondente, redirecionando pra tela do relatório
// (/patio/relatorio-turno/[id]). Quando a pessoa bateu ponto de entrada
// hoje, o turno já vem decidido pelo ponto e a tela nem aparece — só
// quando não há ponto de entrada hoje (consultor, ou equipe que ainda não
// bateu) é que mostra o seletor de turno antes de abrir.
//
// Também lista os últimos relatórios, pra reabrir um relatório recente
// sem precisar que seja exatamente o turno de agora.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TURNOS_PLANEJAMENTO } from "@/lib/planejamento";
import { abrirOuCriarRelatorioTurno, determinarDataTurnoAtual, listarUltimosRelatorios } from "@/lib/relatorio-turno";
import type { RelatorioTurno, TurnoPlanejamento } from "@/lib/types";
import { TelaBase } from "@/components/fluxo-registro";

function formatarDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function RelatorioTurnoEntradaPage() {
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [precisaEscolherTurno, setPrecisaEscolherTurno] = useState(false);
  const [dataAtual, setDataAtual] = useState<string | null>(null);
  const [turnoEscolhido, setTurnoEscolhido] = useState<TurnoPlanejamento>("manha");
  const [abrindo, setAbrindo] = useState(false);
  const [ultimos, setUltimos] = useState<RelatorioTurno[]>([]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [infoTurno, lista] = await Promise.all([determinarDataTurnoAtual(), listarUltimosRelatorios()]);
        if (cancelado) return;
        setUltimos(lista);

        if (!infoTurno.trocavel) {
          const relatorio = await abrirOuCriarRelatorioTurno(infoTurno.data, infoTurno.turno);
          if (!cancelado) router.replace(`/patio/relatorio-turno/${relatorio.id}`);
          return;
        }

        setDataAtual(infoTurno.data);
        setTurnoEscolhido(infoTurno.turno);
        setPrecisaEscolherTurno(true);
      } catch {
        if (!cancelado) {
          setErro("Não deu pra abrir o relatório agora. Confira a internet e tente de novo.");
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [router]);

  async function abrir() {
    if (!dataAtual) return;
    setAbrindo(true);
    setErro(null);
    try {
      const relatorio = await abrirOuCriarRelatorioTurno(dataAtual, turnoEscolhido);
      router.replace(`/patio/relatorio-turno/${relatorio.id}`);
    } catch {
      setErro("Não deu pra abrir o relatório agora. Confira a internet e tente de novo.");
      setAbrindo(false);
    }
  }

  return (
    <TelaBase titulo="Relatório do turno" icone="📋" voltarHref="/patio">
      {carregando && <p className="text-center text-sm text-zinc-600">Abrindo…</p>}
      {erro && <p className="text-center text-sm text-red-700">{erro}</p>}

      {!carregando && precisaEscolherTurno && (
        <div className="mb-5 rounded-xl border-2 border-zinc-800 bg-white p-3">
          <p className="mb-2 text-xs font-bold text-zinc-800">
            Sem ponto de entrada hoje ainda — qual turno é agora?
          </p>
          <div className="mb-3 flex gap-2">
            {TURNOS_PLANEJAMENTO.map((t) => (
              <button
                key={t.valor}
                type="button"
                onClick={() => setTurnoEscolhido(t.valor)}
                className={[
                  "flex-1 rounded-lg border-2 py-2 text-sm font-bold",
                  turnoEscolhido === t.valor
                    ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]"
                    : "border-zinc-300 bg-white text-zinc-700",
                ].join(" ")}
              >
                {t.rotulo}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={abrindo}
            onClick={abrir}
            className="w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {abrindo ? "Abrindo…" : "📋 Abrir relatório do turno"}
          </button>
        </div>
      )}

      {!carregando && (
        <>
          <p className="mb-2 text-xs font-bold text-zinc-500">Últimos relatórios</p>
          <div className="flex flex-col gap-2">
            {ultimos.map((r) => (
              <Link
                key={r.id}
                href={`/patio/relatorio-turno/${r.id}`}
                className="flex items-center justify-between rounded-xl border-2 border-zinc-800 bg-white p-3"
              >
                <span className="text-sm font-semibold text-zinc-900">
                  {formatarDataBR(r.data)} · {r.turno === "manha" ? "Manhã" : "Tarde"}
                </span>
                {r.fechado_em && (
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                    fechado
                  </span>
                )}
              </Link>
            ))}
            {ultimos.length === 0 && (
              <p className="text-center text-xs text-zinc-500">Nenhum relatório registrado ainda.</p>
            )}
          </div>
        </>
      )}
    </TelaBase>
  );
}
