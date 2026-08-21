// Ícone da caixa d'água azul de 1000L usada na compostagem — não existe
// emoji que represente esse objeto direito (📦 é caixa de papelão, objeto
// bem diferente), então é um SVG simples desenhado à mão: tampa, aro e
// corpo cilíndrico na cor azul-padrão de caixa d'água.
//
// Usa width/height "1em" de propósito: em qualquer lugar onde entrar no
// lugar de um emoji (ex.: dentro de um <span className="text-2xl">), o
// ícone acompanha o tamanho da fonte ao redor, igual um emoji acompanharia.

export function IconeCaixaDagua({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      className={className}
      role="img"
      aria-label="Caixa d'água"
    >
      <rect x="3.5" y="6.6" width="17" height="13" rx="8.5" fill="#1e73be" />
      <ellipse cx="12" cy="19.6" rx="8.5" ry="2.2" fill="#145a94" opacity="0.35" />
      <ellipse cx="12" cy="6.6" rx="8.5" ry="2.2" fill="#145a94" />
      <ellipse cx="10.2" cy="7.4" rx="4.4" ry="1" fill="#5aa8e0" opacity="0.6" />
      <rect x="9.5" y="2" width="5" height="2.4" rx="1" fill="#145a94" />
    </svg>
  );
}
