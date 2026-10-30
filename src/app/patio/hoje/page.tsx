"use client";

// Home do dia (Sprint B, item B1 — SPRINT_B_RELATO_DO_TURNO.md seção 2 e
// SPRINT_B2_HOME_RELATO_FILA.md seção 2).
//
// Não tem conteúdo próprio: decide pra onde a pessoa vai e redireciona.
//   - equipe/coordenação SEM entrada hoje (Recife) -> /patio/meu-ponto?voltar=/patio/hoje
//     (o ponto volta pra cá depois de salvar a entrada);
//   - equipe/coordenação COM entrada hoje -> abre (ou cria) o relatório do
//     turno e vai direto pra /patio/relatorio-turno/[id];
//   - consultor (não bate ponto) e qualquer outro papel -> /patio, como antes.
//
// Entrada guardada na fila offline (sem internet na hora de bater) conta
// como entrada batida: sem isso a pessoa voltaria pro ponto em loop. Nesse
// caso vai pra /patio/relatorio-turno, que pergunta o turno (o banco ainda
// não tem o ponto).
//
// O gate de sessão/PIN é o de app/patio/layout.tsx, que roda antes daqui.
// Tudo acontece no useEffect (navegador), nunca no render: a página é
// pré-renderizada no build sem sessão (lição da sessão G).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { obterMeuMembro } from "@/lib/auth";
import { filaPontosOffline } from "@/lib/ponto";
import { abrirOuCriarRelatorioTurno, dataHojeRecife, dataRecife, determinarDataTurnoAtual } from "@/lib/relatorio-turno";
import { TelaBase } from "@/components/fluxo-registro";

const DESTINO_PONTO = "/patio/meu-ponto?voltar=/patio/hoje";

export default function HojePage() {
  const router = useRouter();
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const membro = await obterMeuMembro();
        if (cancelado) return;
        if (!membro || (membro.papel !== "equipe" && membro.papel !== "coordenacao")) {
          router.replace("/patio");
          return;
        }

        const infoTurno = await determinarDataTurnoAtual();
        if (cancelado) return;

        if (!infoTurno.trocavel) {
          // Direto pro relatório: poupa a ida e volta por
          // /patio/relatorio-turno, que faria as mesmas consultas de novo.
          const relatorio = await abrirOuCriarRelatorioTurno(infoTurno.data, infoTurno.turno);
          if (!cancelado) router.replace(`/patio/relatorio-turno/${relatorio.id}`);
          return;
        }

        const hoje = dataHojeRecife();
        const entradaNaFila = filaPontosOffline
          .listar()
          .some((p) => p.tipo === "entrada" && p.membro_equipe_id === membro.id && dataRecife(p.horario) === hoje);
        router.replace(entradaNaFila ? "/patio/relatorio-turno" : DESTINO_PONTO);
      } catch {
        if (!cancelado) setFalhou(true);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [router]);

  if (!falhou) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <p className="text-sm text-zinc-600">Abrindo o seu dia…</p>
      </main>
    );
  }

  // Sem internet (ou erro): não dá pra saber se já bateu entrada. Deixa a
  // pessoa escolher, sem prender ninguém aqui.
  return (
    <TelaBase titulo="Hoje" icone="🌿" voltarHref="/patio">
      <p className="mb-4 text-center text-sm text-zinc-600">
        Não deu pra conferir o seu ponto agora (internet fraca?).
      </p>
      <div className="flex flex-col gap-3">
        <Link href={DESTINO_PONTO} className="rounded-xl bg-[#2e6b3e] py-4 text-center text-sm font-bold text-white">
          ⏰ Bater ponto
        </Link>
        <Link
          href="/patio/relatorio-turno"
          className="rounded-xl border-2 border-[#2e6b3e] bg-[#eaf3ea] py-4 text-center text-sm font-bold text-[#2e6b3e]"
        >
          📋 Relatório do turno
        </Link>
        <Link href="/patio" className="text-center text-xs font-bold text-zinc-600 underline">
          Outras telas
        </Link>
      </div>
    </TelaBase>
  );
}
