import { Suspense } from "react";
import { TelaBase } from "@/components/fluxo-registro";
import { RelatorioTurnoConteudo } from "./relatorio-turno-conteudo";

// O conteúdo mora num Client Component (lê o id da rota via useParams)
// porque precisa chamar o Supabase no navegador — por isso fica dentro de
// <Suspense>, mesmo padrão de /convite/[token] (ver convite-conteudo.tsx).
export default function RelatorioTurnoPage() {
  return (
    <Suspense
      fallback={
        <TelaBase titulo="Relatório do turno" icone="📋" voltarHref="/patio/relatorio-turno">
          <p className="text-center text-sm text-zinc-600">Carregando…</p>
        </TelaBase>
      }
    >
      <RelatorioTurnoConteudo />
    </Suspense>
  );
}
