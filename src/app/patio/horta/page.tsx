import { Suspense } from "react";
import { MapaHorta } from "./mapa-horta";

// Horta: a tela inicial agora é o Mapa (Sprint A.1, item 1 —
// SPRINT_A1_MENOS_TOQUES.md, seção 4). O hub de 10 botões saiu: as ações
// ficam nos cards de canteiro/plantio e as telas secundárias (Avisos,
// Estoque do viveiro, Confirmar germinação) no link "Mais" do topo.
//
// MapaHorta lê ?salvo= (aviso de volta das telas de ação) com
// useSearchParams, que exige um limite de Suspense em volta.
export default function HortaPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-6">
          <p className="text-center text-sm text-zinc-600">Carregando…</p>
        </main>
      }
    >
      <MapaHorta />
    </Suspense>
  );
}
