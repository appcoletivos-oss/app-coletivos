import Link from "next/link";

// Placeholder do Módulo 2 (Gestão do Coletivo — Chié do Entra). Cobre a
// vida e as frentes de atuação do coletivo: mutirões, visitas, produção de
// sabão, reuniões e projetos. Ainda a desenhar — ver Registro Geral.
export default function ColetivoPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2e6b3e] text-white">
        <span aria-hidden="true" className="text-2xl">
          🤝
        </span>
      </span>
      <h1 className="mt-4 text-xl font-bold text-zinc-900">
        Gestão do Coletivo
      </h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-600">
        Este módulo ainda está em construção. As próximas telas vão cobrir
        mutirões, visitas, reuniões e projetos do coletivo.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full border-2 border-[#2e6b3e] px-6 py-2 text-sm font-semibold text-[#2e6b3e] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#2e6b3e]/40"
      >
        Voltar
      </Link>
    </main>
  );
}
