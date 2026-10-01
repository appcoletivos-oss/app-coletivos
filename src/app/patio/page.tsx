import Link from "next/link";
import { OcorrenciasBanner } from "./ocorrencias-banner";

// Módulo 1 (Pátio de Compostagem). Os 6 blocos vêm do wireframe (estrutura
// fechada, rodada 7) — "Compostagem" (Registrar alimentação), "Horta"
// (Registrar colheita), "Mais" (Cadastro) e, desde a Etapa 1 do Registro
// simplificado, "Venda" (Registrar doação de alimento) já têm tela real
// por trás; "Agenda" idem.
const BLOCOS = [
  { href: "/patio/compostagem", icone: "🌱", rotulo: "Compostagem", pronto: true },
  { href: "/patio/horta", icone: "🌻", rotulo: "Horta", pronto: true },
  { href: "/patio/meu-ponto", icone: "⏰", rotulo: "Meu Ponto", pronto: true },
  { href: "/patio/agenda", icone: "📅", rotulo: "Agenda", pronto: true },
  { href: "/patio/venda", icone: "📦", rotulo: "Venda", pronto: true },
  { href: "/patio/mais", icone: "⚙️", rotulo: "Mais", pronto: true },
];

export default function PatioPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-zinc-800 bg-white px-3 py-2">
        <span className="text-sm font-bold text-zinc-900">🌿 Pátio de Compostagem</span>
        <Link href="/" className="text-lg" aria-label="Voltar">
          ←
        </Link>
      </div>

      <OcorrenciasBanner />

      <Link
        href="/patio/relatorio-turno"
        className="mb-4 block rounded-xl border-2 border-[#2e6b3e] bg-[#eaf3ea] py-4 text-center text-sm font-bold text-[#2e6b3e]"
      >
        📋 Relatório do turno
      </Link>

      <div className="grid grid-cols-2 gap-3">
        {BLOCOS.map((bloco) => (
          <Link
            key={bloco.rotulo}
            href={bloco.pronto ? bloco.href : "#"}
            aria-disabled={!bloco.pronto}
            className={[
              "rounded-xl border-2 py-6 text-center text-sm font-bold",
              bloco.pronto
                ? "border-zinc-800 bg-white text-zinc-800"
                : "pointer-events-none border-dashed border-zinc-300 text-zinc-400",
            ].join(" ")}
          >
            <span className="mb-1 block text-2xl">{bloco.icone}</span>
            {bloco.rotulo}
            {!bloco.pronto && <span className="mt-1 block text-[10px] font-normal">em breve</span>}
          </Link>
        ))}
      </div>
    </main>
  );
}
