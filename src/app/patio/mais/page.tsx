import Link from "next/link";

// Hub do bloco "Mais" (ver wireframe, seção 6). Majoritariamente restrito
// à coordenação — única exceção confirmada é "Registrar ocorrência
// atípica", aberta a qualquer funcionária (ver Registro Geral, seção 2.1).
//
// Nota: o controle de acesso por papel ainda não existe tecnicamente —
// depende do login (PIN/biometria/social), que também ainda não foi
// implementado (ver Registro Geral, seção 4). Por enquanto este aviso é
// só visual; a RLS do banco libera qualquer autenticado, igual nas outras
// tabelas do piloto.
const ITENS = [
  { href: "/patio/mais/cadastro", icone: "📋", rotulo: "Cadastro", pronto: true },
  { href: "#", icone: "📣", rotulo: "Avisos ao shopping", pronto: false },
  { href: "#", icone: "💰", rotulo: "Financeiro", pronto: false },
  { href: "#", icone: "📊", rotulo: "Relatórios ESG/ODS", pronto: false },
  { href: "#", icone: "🖼️", rotulo: "Arquivo de fotos", pronto: false },
  { href: "#", icone: "⚠️", rotulo: "Ocorrência atípica", pronto: false },
];

export default function MaisPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-zinc-800 bg-white px-3 py-2">
        <span className="text-sm font-bold text-zinc-900">⚙️ Mais</span>
        <Link href="/patio" className="text-lg" aria-label="Voltar">
          ←
        </Link>
      </div>

      <p className="mb-4 rounded-lg border border-dashed border-zinc-400 bg-[#f1efe6] px-3 py-2 text-center text-[11px] text-zinc-600">
        🔒 Bloco restrito à coordenação (exceto Ocorrência atípica, aberta a
        qualquer funcionária). Controle de acesso por papel ainda depende do
        login, que ainda não existe.
      </p>

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
