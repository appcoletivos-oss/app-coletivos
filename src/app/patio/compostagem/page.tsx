import Link from "next/link";
import { IconeCaixaDagua } from "@/components/icone-caixa-dagua";

// Hub do bloco Compostagem (ver wireframe, seção 1 e 2). "Registrar
// compostagem", "Ver caixas", "Análise sensorial" e "Controle de
// bombonas" estão construídas de verdade — as outras opções (adubo,
// água/energia, relatório da loja) ainda são placeholder, uma de cada vez.
const ITENS = [
  { href: "/patio/compostagem/registrar-alimentacao", icone: "📥", rotulo: "Registrar compostagem", pronto: true },
  { href: "/patio/compostagem/ver-caixas", icone: null, rotulo: "Ver caixas", pronto: true },
  { href: "#", icone: "🧪", rotulo: "Registrar adubo", pronto: false },
  { href: "/patio/compostagem/analise-sensorial", icone: "👃", rotulo: "Análise sensorial", pronto: true },
  { href: "#", icone: "💧", rotulo: "Água e energia", pronto: false },
  { href: "/patio/compostagem/bombonas", icone: "🛢️", rotulo: "Controle de bombonas", pronto: true },
];

export default function CompostagemPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-zinc-800 bg-white px-3 py-2">
        <span className="text-sm font-bold text-zinc-900">🌱 Compostagem</span>
        <Link href="/patio" className="text-lg" aria-label="Voltar">
          ←
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {ITENS.map((item) => (
          <Link
            key={item.rotulo}
            href={item.pronto ? item.href : "#"}
            aria-disabled={!item.pronto}
            className={[
              "rounded-xl border-2 py-5 text-center text-xs font-bold",
              item.pronto
                ? "border-zinc-800 bg-white text-zinc-800"
                : "pointer-events-none border-dashed border-zinc-300 text-zinc-400",
            ].join(" ")}
          >
            <span className="mb-1 block text-2xl">{item.icone ?? <IconeCaixaDagua className="mx-auto" />}</span>
            {item.rotulo}
            {!item.pronto && <span className="mt-1 block text-[10px] font-normal">em breve</span>}
          </Link>
        ))}
      </div>
    </main>
  );
}
