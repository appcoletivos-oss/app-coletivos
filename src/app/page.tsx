import Link from "next/link";

// Tela inicial: escolha do módulo. Poucos passos, ícone grande, texto curto
// — pensada para quem tem pouca familiaridade com aplicativos de gestão.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12 sm:py-20">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-[#2e6b3e] sm:text-3xl">
          App Coletivos
        </h1>
        <p className="mt-2 text-base text-zinc-600">
          Escolha onde você quer trabalhar hoje.
        </p>
      </div>

      <div className="mt-10 grid w-full max-w-md gap-5">
        <ModuleCard
          href="/patio"
          icon={<LeafIcon />}
          title="Pátio de Compostagem"
          description="Produção, ciclo do composto, doações e ponto da equipe."
        />
        <ModuleCard
          href="/coletivo"
          icon={<HandsIcon />}
          title="Gestão do Coletivo"
          description="Atividades, mutirões, reuniões e projetos do Chié do Entra."
        />
      </div>
    </main>
  );
}

function ModuleCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border-2 border-[#2e6b3e]/15 bg-white p-5 shadow-sm transition-colors hover:border-[#2e6b3e]/40 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#2e6b3e]/40 active:bg-[#f4f7f2]"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#2e6b3e] text-white">
        {icon}
      </span>
      <span className="text-left">
        <span className="block text-lg font-semibold text-zinc-900">
          {title}
        </span>
        <span className="block text-sm text-zinc-600">{description}</span>
      </span>
    </Link>
  );
}

function LeafIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 11 13 11 11" />
    </svg>
  );
}

function HandsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.2" />
      <path d="M4.5 20c.9-3.4 3.7-5.5 7.5-5.5s6.6 2.1 7.5 5.5" />
    </svg>
  );
}
