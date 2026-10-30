import { Suspense } from "react";
import { TelaBase } from "@/components/fluxo-registro";
import { RelatoConteudo } from "./relato-conteudo";

// Relato do turno com IA (Sprint B, B3). Mesmo padrão de ../page.tsx: o
// conteúdo é client (lê o id via useParams), dentro de <Suspense>.
export default function RelatoTurnoPage() {
  return (
    <Suspense
      fallback={
        <TelaBase titulo="Contar o turno" icone="📝" voltarHref="/patio/relatorio-turno">
          <p className="text-center text-sm text-zinc-600">Carregando…</p>
        </TelaBase>
      }
    >
      <RelatoConteudo />
    </Suspense>
  );
}
