import Link from "next/link";

// Hub do bloco Venda (Etapa 1, item 5 — handoff "Registro simplificado").
// Parado desde a sessão G (ver registro_geral_app_coletivos.md, seção 0);
// ativado nesta rodada só pra "Registrar doação de alimento" — "Planejamento
// da feira" continua placeholder, sem discovery técnico ainda.
const ITENS = [
  { href: "/patio/venda/registrar-doacao", icone: "🎁", rotulo: "Registrar doação de alimento", pronto: true },
  { href: "#", icone: "🗓️", rotulo: "Planejamento da feira", pronto: false },
];

export default function VendaPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-zinc-800 bg-white px-3 py-2">
        <span className="text-sm font-bold text-zinc-900">📦 Venda</span>
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
