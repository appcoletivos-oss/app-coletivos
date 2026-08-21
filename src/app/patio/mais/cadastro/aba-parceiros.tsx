"use client";

// Cadastro → aba Parceiros. Duas ações por linha, de propósito bem
// separado (ver wireframe): ✏️ corrigir nome só ajusta o texto da mesma
// linha; 🔁 encerrar e substituir marca a linha atual como encerrada e
// já abre o cadastro de quem entra no lugar — nunca sobrescreve.

import { useEffect, useState } from "react";
import {
  criarParceiro,
  encerrarESubstituirParceiro,
  listarParceirosAtivos,
  renomearParceiro,
} from "@/lib/patio";
import type { Parceiro, TipoParceiro } from "@/lib/types";

const TIPOS: { valor: TipoParceiro; rotulo: string }[] = [
  { valor: "loja", rotulo: "Loja/restaurante" },
  { valor: "construtora", rotulo: "Construtora" },
  { valor: "outro", rotulo: "Outro" },
];

function rotuloTipo(tipo: TipoParceiro): string {
  return TIPOS.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}

export function AbaParceiros() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);

  const [formAberto, setFormAberto] = useState(false);
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [substituindoId, setSubstituindoId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setParceiros(await listarParceirosAtivos());
    } catch {
      setErro("Não deu pra carregar os parceiros agora. Confira a internet e tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    let cancelado = false;
    async function carregarInicial() {
      if (!cancelado) await carregar();
    }
    carregarInicial();
    return () => {
      cancelado = true;
    };
  }, []);

  function fecharTudo() {
    setFormAberto(false);
    setRenomeandoId(null);
    setSubstituindoId(null);
  }

  if (carregando) return <p className="text-center text-sm text-zinc-600">Carregando…</p>;
  if (erro) return <p className="text-center text-sm text-red-700">{erro}</p>;

  return (
    <div>
      {!formAberto && !renomeandoId && !substituindoId && (
        <button
          type="button"
          onClick={() => setFormAberto(true)}
          className="mb-3 w-full rounded-xl border-2 border-dashed border-[#2e6b3e] py-2.5 text-xs font-bold text-[#2e6b3e]"
        >
          + Adicionar parceiro
        </button>
      )}

      {formAberto && (
        <div className="mb-3">
          <FormParceiro
            titulo="Novo parceiro"
            onCancelar={fecharTudo}
            onSalvar={async (dados) => {
              await criarParceiro(dados);
              fecharTudo();
              await carregar();
            }}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {parceiros.map((p) => (
          <div key={p.id} className="rounded-xl border-2 border-zinc-800 bg-white p-3">
            {renomeandoId === p.id ? (
              <FormRenomear
                nomeAtual={p.nome}
                onCancelar={fecharTudo}
                onSalvar={async (nome) => {
                  await renomearParceiro(p.id, nome);
                  fecharTudo();
                  await carregar();
                }}
              />
            ) : substituindoId === p.id ? (
              <div>
                <p className="mb-2 text-[11px] text-zinc-600">
                  Encerrando <strong>{p.nome}</strong> hoje. Os registros já feitos continuam mostrando {p.nome}. Cadastre quem entra no lugar:
                </p>
                <FormParceiro
                  titulo="Novo parceiro no lugar"
                  onCancelar={fecharTudo}
                  onSalvar={async (dados) => {
                    await encerrarESubstituirParceiro(p.id, dados);
                    fecharTudo();
                    await carregar();
                  }}
                />
              </div>
            ) : (
              <>
                <p className="text-sm font-bold text-zinc-900">{p.nome}</p>
                <p className="text-[11px] text-zinc-500">{rotuloTipo(p.tipo)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRenomeandoId(p.id)}
                    className="rounded-full border-2 border-zinc-300 px-3 py-1 text-[11px] font-bold text-zinc-700"
                  >
                    ✏️ Corrigir nome
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubstituindoId(p.id)}
                    className="rounded-full border-2 border-zinc-300 px-3 py-1 text-[11px] font-bold text-zinc-700"
                  >
                    🔁 Encerrar e substituir
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {parceiros.length === 0 && (
          <p className="text-center text-xs text-zinc-500">Nenhum parceiro ativo ainda.</p>
        )}
      </div>
    </div>
  );
}

function FormParceiro({
  titulo,
  onSalvar,
  onCancelar,
}: {
  titulo: string;
  onSalvar: (dados: { nome: string; tipo: TipoParceiro }) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoParceiro>("loja");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({ nome, tipo });
    } catch {
      setErro("Não deu pra salvar agora. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-zinc-400 bg-[#f1efe6] p-3">
      <p className="mb-2 text-xs font-bold text-zinc-800">{titulo}</p>
      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Nome
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Padaria do Seu João"
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>
      <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
        Tipo
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoParceiro)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
        >
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </label>
      {erro && <p className="mb-2 text-[11px] text-red-700">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={salvando || !nome.trim()}
          onClick={salvar}
          className="flex-1 rounded-lg bg-[#2e6b3e] py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-lg border-2 border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function FormRenomear({
  nomeAtual,
  onSalvar,
  onCancelar,
}: {
  nomeAtual: string;
  onSalvar: (nome: string) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState(nomeAtual);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(nome);
    } catch {
      setErro("Não deu pra salvar agora. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Corrigir nome
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>
      {erro && <p className="mb-2 text-[11px] text-red-700">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={salvando || !nome.trim()}
          onClick={salvar}
          className="flex-1 rounded-lg bg-[#2e6b3e] py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-lg border-2 border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
