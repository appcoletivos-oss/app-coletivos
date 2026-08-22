import Link from "next/link";

// Módulo 1 (Pátio de Compostagem). Os 6 blocos vêm do wireframe (estrutura
// fechada, rodada 7) — "Compostagem" (Registrar alimentação), "Horta"
// (Registrar colheita) e "Mais" (Cadastro) já têm tela real por trás; os
// outros ainda são placeholder.
const BLOCOS = [
  { href: "/patio/compostagem", icone: "🌱", rotulo: "Compostagem", pronto: true },
  { href: "/patio/horta", icone: "🌻", rotulo: "Horta", pronto: true },
  { href: "#", icone: "⏰", rotulo: "Meu Ponto", pronto: false },
  { href: "#", icone: "📅", rotulo: "Agenda", pronto: false },
  { href: "#", icone: "📦", rotulo: "Venda", pronto: false },
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
