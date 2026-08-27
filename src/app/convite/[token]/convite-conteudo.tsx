"use client";

// Tela "Bem-vindo(a), [nome]" do convite. Desde a Leva 1 (2026-08-27) é
// aqui que o primeiro acesso acontece de verdade: a pessoa escolhe entrar
// com Google ou com e-mail/senha, e no fim a function `aceitar_convite`
// liga a conta ao pré-cadastro que a coordenação fez (com o papel do
// convite). Depois vai pra tela de criar o PIN.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { buscarConvitePorToken } from "@/lib/equipe";
import {
  aceitarConvite,
  cadastrarComEmail,
  entrarComEmail,
  entrarComGoogle,
  guardarConvitePendente,
  temSessao,
} from "@/lib/auth";
import { temPin } from "@/lib/pin";
import type { ConvitePreCadastro, PapelEquipe } from "@/lib/types";

function rotuloPapel(papel: PapelEquipe): string {
  if (papel === "coordenacao") return "coordenação";
  if (papel === "consultor") return "consultoria";
  return "equipe";
}

export function ConviteConteudo() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [convite, setConvite] = useState<ConvitePreCadastro | null>(null);
  const [jaLogado, setJaLogado] = useState(false);

  const [modoEmail, setModoEmail] = useState<null | "criar" | "entrar">(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

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
        const [resultado, logado] = await Promise.all([
          buscarConvitePorToken(token),
          temSessao(),
        ]);
        if (!cancelado) {
          setConvite(resultado);
          setJaLogado(logado);
        }
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

  async function concluir() {
    setErroAcao(null);
    try {
      const ok = await aceitarConvite(token);
      if (!ok) {
        setErroAcao(
          "Esse convite não vale mais (expirou ou já foi aceito). Peça um novo à coordenação.",
        );
        return;
      }
      router.replace(temPin() ? "/desbloquear" : "/criar-pin");
    } catch {
      setErroAcao(
        "Essa conta já está vinculada a outro cadastro, ou o convite não pôde ser usado.",
      );
    }
  }

  async function comGoogle() {
    setErroAcao(null);
    setProcessando(true);
    try {
      guardarConvitePendente(token);
      await entrarComGoogle(`${window.location.origin}/auth/callback`);
    } catch {
      setErroAcao("Não deu pra abrir o login do Google. Tente de novo.");
      setProcessando(false);
    }
  }

  async function comEmail() {
    if (!email.trim() || senha.length < 6) return;
    setErroAcao(null);
    setAviso(null);
    setProcessando(true);
    try {
      if (modoEmail === "criar") {
        await cadastrarComEmail(email, senha);
      } else {
        await entrarComEmail(email, senha);
      }
      if (!(await temSessao())) {
        setAviso("Conta criada! Confirme pelo e-mail e depois abra este mesmo link de novo.");
        setProcessando(false);
        return;
      }
      await concluir();
      setProcessando(false);
    } catch {
      setErroAcao(
        modoEmail === "criar"
          ? "Não deu pra criar a conta — o e-mail pode já estar em uso (tente \"já tenho conta\")."
          : "E-mail ou senha incorretos.",
      );
      setProcessando(false);
    }
  }

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
            Você foi convidado(a) para {rotuloPapel(convite.papel)} do App Coletivo. Falta só concluir
            seu acesso.
          </p>

          <div className="mt-6 w-full">
            {jaLogado ? (
              <button
                type="button"
                disabled={processando}
                onClick={concluir}
                className="w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                Concluir acesso
              </button>
            ) : modoEmail ? (
              <div className="text-left">
                <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
                  E-mail
                  <input
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
                  />
                </label>
                <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
                  Senha {modoEmail === "criar" && "(mín. 6 caracteres)"}
                  <input
                    type="password"
                    autoComplete={modoEmail === "criar" ? "new-password" : "current-password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={processando || !email.trim() || senha.length < 6}
                  onClick={comEmail}
                  className="w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white disabled:opacity-40"
                >
                  {processando ? "Aguarde…" : "Concluir acesso"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModoEmail(modoEmail === "criar" ? "entrar" : "criar");
                    setErroAcao(null);
                  }}
                  className="mt-3 w-full text-center text-[11px] font-bold text-[#2e6b3e] underline"
                >
                  {modoEmail === "criar" ? "Já tenho uma conta" : "Criar uma conta"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={processando}
                  onClick={comGoogle}
                  className="w-full rounded-xl border-2 border-zinc-800 bg-white py-3 text-sm font-bold text-zinc-800 disabled:opacity-40"
                >
                  Entrar com Google
                </button>
                <button
                  type="button"
                  onClick={() => setModoEmail("criar")}
                  className="w-full rounded-xl border-2 border-zinc-300 bg-white py-3 text-sm font-bold text-zinc-600"
                >
                  Usar e-mail e senha
                </button>
              </div>
            )}
          </div>

          {erroAcao && <p className="mt-3 text-[11px] text-red-700">{erroAcao}</p>}
          {aviso && <p className="mt-3 text-[11px] font-semibold text-[#2e6b3e]">{aviso}</p>}
        </>
      )}
    </main>
  );
}
