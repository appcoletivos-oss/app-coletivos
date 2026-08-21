import { Suspense } from "react";
import { ConviteConteudo } from "./convite-conteudo";

// Rota que a pessoa convidada abre a partir do link que a coordenação
// manda pelo WhatsApp (ver Registro Geral, "Cadastro → Equipe: gestão de
// membros e convite"). O conteúdo em si mora num Client Component
// (`ConviteConteudo`, que lê o token via useParams) porque precisa
// chamar o Supabase no navegador — por isso fica dentro de <Suspense>,
// exigido pelo Next quando um parâmetro de rota só é conhecido em tempo
// de requisição (ver node_modules/next/dist/docs/.../use-params.md).
export default function ConvitePage() {
  return (
    <Suspense fallback={<ConviteCarregando />}>
      <ConviteConteudo />
    </Suspense>
  );
}

function ConviteCarregando() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm text-zinc-600">Carregando convite…</p>
    </main>
  );
}
