"use client";

// Tela "Bem-vindo(a), [nome]" do convite. Ainda não existe login
// (PIN/biometria/social — ver Registro Geral, seção 4) então o botão de
// "concluir acesso" fica como placeholder por enquanto, só preparando a
// estrutura: a pessoa já é reconhecida pelo pré-cadastro que a
// coordenação fez, falta só o fluxo técnico de autenticação de verdade.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { buscarConvitePorToken } from "@/lib/equipe";
import type { ConvitePreCadastro } from "@/lib/types";

export function ConviteConteudo() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [convite, setConvite] = useState<ConvitePreCadastro | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      if (!token) {
        if (!cancelado) {
          setErro("Link de convite inválido.");
          setCarregando(false);
        }
        return;
      }
      try {
        const resultado = await buscarConvitePorToken(token);
        if (!cancelado) setConvite(resultado);
      } catch {
        if (!cancelado) {
          setErro("Não deu pra carregar esse convite agora. Confira a internet e tente de novo.");
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    carregar();
    return () => {
      cancelado = true;
    };
  }, [token]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#2e6b3e] text-2xl text-white">
        🌿
      </span>

      {carregando && <p className="text-sm text-zinc-600">Carregando convite…</p>}

      {!carregando && erro && <p className="text-sm text-red-700">{erro}</p>}

      {!carregando && !erro && !convite && (
        <>
          <p className="text-base font-semibold text-zinc-900">Convite não encontrado</p>
          <p className="mt-2 text-sm text-zinc-600">
            Esse link pode estar errado ou incompleto. Confira com quem te mandou o convite.
          </p>
        </>
      )}

      {!carregando && !erro && convite && !convite.valido && (
        <>
          <p className="text-base font-semibold text-zinc-900">Convite expirado</p>
          <p className="mt-2 text-sm text-zinc-600">
            O link de {convite.nome} não vale mais. Peça pra coordenação gerar um novo convite pela
            tela de Cadastro.
          </p>
        </>
      )}

      {!carregando && !erro && convite && convite.valido && (
        <>
          <p className="text-lg font-bold text-zinc-900">Bem-vindo(a), {convite.nome}!</p>
          <p className="mt-2 text-sm text-zinc-600">
            Você foi convidado(a) como{" "}
            {convite.papel === "coordenacao" ? "coordenação" : "funcionária"} do App Coletivo.
            Falta só concluir seu acesso pra começar a usar.
          </p>
          <button
            type="button"
            disabled
            className="mt-6 w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white opacity-60"
          >
            Concluir acesso (em breve)
          </button>
          <p className="mt-2 text-[11px] text-zinc-500">
            O login por PIN, biometria ou redes sociais ainda está sendo construído.
          </p>
        </>
      )}
    </main>
  );
}
