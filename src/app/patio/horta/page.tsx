import Link from "next/link";

// Hub do bloco Horta (ver HANDOFF_HORTA_COMPLETO.md, v3, seções 4 e 5).
// Ordem de construção: plantio/germinação → transplante/mapa → colheita
// ajustada → perda/doação → manejo ajustado → avisos automáticos. Itens
// sem tela real ainda ficam com pronto:false, mesmo padrão do hub de
// Compostagem.
const ITENS = [
  { href: "/patio/horta/registrar-plantio", icone: "🌱", rotulo: "Registrar plantio", pronto: true },
  { href: "/patio/horta/confirmar-germinacao", icone: "🌿", rotulo: "Confirmar germinação", pronto: true },
  { href: "/patio/horta/transplantar", icone: "🔀", rotulo: "Transplantar", pronto: true },
  { href: "/patio/horta/mapa", icone: "🗺️", rotulo: "Mapa", pronto: true },
  { href: "/patio/horta/registrar-colheita", icone: "🧺", rotulo: "Registrar colheita", pronto: true },
  { href: "/patio/horta/registrar-perda", icone: "📉", rotulo: "Registrar perda", pronto: true },
  { href: "/patio/horta/registrar-doacao", icone: "🎁", rotulo: "Registrar doação", pronto: true },
  { href: "/patio/horta/manejo", icone: "🌾", rotulo: "Manejo", pronto: true },
  { href: "/patio/horta/avisos", icone: "🔔", rotulo: "Avisos", pronto: true },
  { href: "/patio/horta/estoque-viveiro", icone: "📦", rotulo: "Estoque do viveiro", pronto: true },
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
