import Link from "next/link";

// Hub do bloco Horta (ver wireframe, seção 1 e 2). Só "Registrar colheita"
// tem tela real por trás por enquanto — cultivo (germinação→transplante),
// manejo e perdas/aproveitamento seguem placeholder, mesmo padrão do hub
// de Compostagem.
const ITENS = [
  { href: "/patio/horta/registrar-colheita", icone: "🧺", rotulo: "Registrar colheita", pronto: true },
  { href: "#", icone: "🌱", rotulo: "Cultivo", pronto: false },
  { href: "#", icone: "🌾", rotulo: "Manejo", pronto: false },
  { href: "#", icone: "📉", rotulo: "Perdas / aproveitamento", pronto: false },
];

export default function HortaPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-zinc-800 bg-white px-3 py-2">
        <span className="text-sm font-bold text-zinc-900">🌻 Horta</span>
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
            <span className="mb-1 block text-2xl">{item.icone}</span>
            {item.rotulo}
            {!item.pronto && <span className="mt-1 block text-[10px] font-normal">em breve</span>}
          </Link>
        ))}
      </div>
    </main>
  );
}
