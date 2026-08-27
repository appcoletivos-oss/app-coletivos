"use client";

// Teclado numérico pro PIN (telas /criar-pin e /desbloquear). Componente
// controlado: o pai guarda o valor e decide o que fazer quando enche.

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "apagar"];

export function TecladoPin({
  valor,
  onChange,
  max = 6,
}: {
  valor: string;
  onChange: (novo: string) => void;
  max?: number;
}) {
  function digitar(tecla: string) {
    if (tecla === "apagar") {
      onChange(valor.slice(0, -1));
      return;
    }
    if (tecla === "" || valor.length >= max) return;
    onChange(valor + tecla);
  }

  return (
    <div>
      <div className="mb-8 flex justify-center gap-3">
        {Array.from({ length: max }, (_, i) => i).map((i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 ${
              i < valor.length ? "border-[#2e6b3e] bg-[#2e6b3e]" : "border-zinc-300"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {TECLAS.map((tecla, i) => (
          <button
            key={i}
            type="button"
            disabled={tecla === ""}
            onClick={() => digitar(tecla)}
            className={[
              "h-14 rounded-xl text-lg font-bold",
              tecla === ""
                ? "invisible"
                : "border-2 border-zinc-800 bg-white text-zinc-900 active:bg-[#eaf3ea]",
            ].join(" ")}
            aria-label={tecla === "apagar" ? "apagar" : tecla || undefined}
          >
            {tecla === "apagar" ? "⌫" : tecla}
          </button>
        ))}
      </div>
    </div>
  );
}
