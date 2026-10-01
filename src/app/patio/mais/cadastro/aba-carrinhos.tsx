"use client";

// Cadastro → aba Carrinhos (Sprint A, item 2 —
// SPRINT_A_REGISTRO_SIMPLIFICADO_ETAPA2.md, seção 6a). Mesmo padrão de
// aba-caixas.tsx: um tipo de carrinho não "vira" outro, só entra ou sai de
// uso — por isso não tem o padrão renomear/substituir de
// Parceiros/Canteiros, só editar (nome, peso estimado) e ativar/inativar.
// Sem excluir: o tipo pode estar referenciado por registros antigos.

import { useEffect, useState } from "react";
import {
  ativarTipoCarrinho,
  atualizarTipoCarrinho,
  criarTipoCarrinho,
  inativarTipoCarrinho,
  listarTiposCarrinho,
} from "@/lib/carrinhos";
import type { TipoCarrinho } from "@/lib/types";

export function AbaCarrinhos() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tipos, setTipos] = useState<TipoCarrinho[]>([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setTipos(await listarTiposCarrinho(true));
    } catch {
      setErro("Não deu pra carregar os tipos de carrinho agora. Confira a internet e tente de novo.");
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
    setEditandoId(null);
  }

  if (carregando) return <p className="text-center text-sm text-zinc-600">Carregando…</p>;
  if (erro) return <p className="text-center text-sm text-red-700">{erro}</p>;

  const visiveis = tipos.filter((t) => mostrarInativos || t.ativo);

  return (
    <div>
      {!formAberto && !editandoId && (
        <button
          type="button"
          onClick={() => setFormAberto(true)}
          className="mb-3 w-full rounded-xl border-2 border-dashed border-[#2e6b3e] py-2.5 text-xs font-bold text-[#2e6b3e]"
        >
          + Adicionar tipo de carrinho
        </button>
      )}

      {formAberto && (
        <div className="mb-3">
          <FormCarrinho
            titulo="Novo tipo de carrinho"
            valoresIniciais={{ nome: "", peso_estimado_kg: "" }}
            onCancelar={fecharTudo}
            onSalvar={async (dados) => {
              await criarTipoCarrinho(dados);
              fecharTudo();
              await carregar();
            }}
          />
        </div>
      )}

      <label className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-zinc-600">
        <input
          type="checkbox"
          checked={mostrarInativos}
          onChange={(e) => setMostrarInativos(e.target.checked)}
          className="h-4 w-4"
        />
        Mostrar inativos
      </label>

      <div className="grid grid-cols-1 gap-2">
        {visiveis.map((t) => (
          <div
            key={t.id}
            className={[
              "rounded-xl border-2 p-3",
              t.ativo ? "border-zinc-800 bg-white" : "border-zinc-300 bg-zinc-50 opacity-80",
            ].join(" ")}
          >
            {editandoId === t.id ? (
              <FormCarrinho
                titulo={t.nome}
                valoresIniciais={{ nome: t.nome, peso_estimado_kg: String(t.peso_estimado_kg) }}
                onCancelar={fecharTudo}
                onSalvar={async (dados) => {
                  await atualizarTipoCarrinho(t.id, dados);
                  fecharTudo();
                  await carregar();
                }}
              />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-zinc-900">{t.nome}</p>
                  {!t.ativo && (
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                      inativo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500">{t.peso_estimado_kg} kg (peso estimado)</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditandoId(t.id)}
                    className="rounded-full border-2 border-zinc-300 px-3 py-1 text-[11px] font-bold text-zinc-700"
                  >
                    ✏️ Editar
                  </button>
                  {t.ativo ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await inativarTipoCarrinho(t.id);
                        await carregar();
                      }}
                      className="rounded-full border-2 border-red-300 px-3 py-1 text-[11px] font-bold text-red-700"
                    >
                      🚫 Inativar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await ativarTipoCarrinho(t.id);
                        await carregar();
                      }}
                      className="rounded-full border-2 border-zinc-300 px-3 py-1 text-[11px] font-bold text-zinc-700"
                    >
                      ✅ Reativar
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        {visiveis.length === 0 && (
          <p className="text-center text-xs text-zinc-500">
            Nenhum tipo de carrinho {mostrarInativos ? "" : "ativo "}ainda.
          </p>
        )}
      </div>
    </div>
  );
}

type DadosCarrinho = { nome: string; peso_estimado_kg: number };

function FormCarrinho({
  titulo,
  valoresIniciais,
  onSalvar,
  onCancelar,
}: {
  titulo: string;
  valoresIniciais: { nome: string; peso_estimado_kg: string };
  onSalvar: (dados: DadosCarrinho) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState(valoresIniciais.nome);
  const [peso, setPeso] = useState(valoresIniciais.peso_estimado_kg);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valido = nome.trim().length > 0 && peso.trim().length > 0 && !Number.isNaN(Number(peso));

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({ nome, peso_estimado_kg: Number(peso) });
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
          placeholder="Ex.: Carrinho verde"
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>
      <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
        Peso estimado (kg)
        <input
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          inputMode="decimal"
          placeholder="Ex.: 20"
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>
      {erro && <p className="mb-2 text-[11px] text-red-700">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={salvando || !valido}
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
