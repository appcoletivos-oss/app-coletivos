"use client";

// Cadastro → aba Canteiros. Mesmo padrão de Parceiros (memória
// histórica: corrigir nome vs. encerrar e substituir) — só muda os
// campos, porque um canteiro tem tipo (solo, bombona, galeia...) e
// capacidade em texto livre, já que a unidade de medida muda por tipo.

import { useEffect, useState } from "react";
import {
  criarCanteiro,
  encerrarESubstituirCanteiro,
  listarCanteiros,
  renomearCanteiro,
} from "@/lib/patio";
import type { Canteiro, LocalCanteiro, TipoCanteiro } from "@/lib/types";

const TIPOS: { valor: TipoCanteiro; rotulo: string }[] = [
  { valor: "canteiro_solo", rotulo: "Canteiro no solo" },
  { valor: "bombona", rotulo: "Bombona" },
  { valor: "galeia", rotulo: "Galeia" },
  { valor: "geodesica", rotulo: "Geodésica" },
  { valor: "pergolado", rotulo: "Pergolado" },
  { valor: "vaso", rotulo: "Vaso" },
  { valor: "bandeja_muda", rotulo: "Bandeja de muda" },
  { valor: "saco_muda", rotulo: "Saco de muda" },
  { valor: "outro", rotulo: "Outro" },
];

const LOCAIS: { valor: LocalCanteiro; rotulo: string }[] = [
  { valor: "patio", rotulo: "Pátio" },
  { valor: "teto", rotulo: "Teto" },
];

function rotuloTipo(tipo: TipoCanteiro): string {
  return TIPOS.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}

function rotuloLocal(local: LocalCanteiro): string {
  return LOCAIS.find((l) => l.valor === local)?.rotulo ?? local;
}

type DadosCanteiro = {
  nome: string;
  tipo: TipoCanteiro;
  local: LocalCanteiro;
  area_m2: number | null;
  capacidade_texto: string | null;
};

export function AbaCanteiros() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [canteiros, setCanteiros] = useState<Canteiro[]>([]);

  const [formAberto, setFormAberto] = useState(false);
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [substituindoId, setSubstituindoId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setCanteiros(await listarCanteiros());
    } catch {
      setErro("Não deu pra carregar os canteiros agora. Confira a internet e tente de novo.");
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
          + Adicionar canteiro
        </button>
      )}

      {formAberto && (
        <div className="mb-3">
          <FormCanteiro
            titulo="Novo canteiro"
            onCancelar={fecharTudo}
            onSalvar={async (dados) => {
              await criarCanteiro(dados);
              fecharTudo();
              await carregar();
            }}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {canteiros.map((c) => (
          <div key={c.id} className="rounded-xl border-2 border-zinc-800 bg-white p-3">
            {renomeandoId === c.id ? (
              <FormRenomear
                nomeAtual={c.nome}
                onCancelar={fecharTudo}
                onSalvar={async (nome) => {
                  await renomearCanteiro(c.id, nome);
                  fecharTudo();
                  await carregar();
                }}
              />
            ) : substituindoId === c.id ? (
              <div>
                <p className="mb-2 text-[11px] text-zinc-600">
                  Encerrando <strong>{c.nome}</strong> hoje. Os registros já feitos continuam mostrando {c.nome}. Cadastre quem entra no lugar:
                </p>
                <FormCanteiro
                  titulo="Novo canteiro no lugar"
                  onCancelar={fecharTudo}
                  onSalvar={async (dados) => {
                    await encerrarESubstituirCanteiro(c.id, dados);
                    fecharTudo();
                    await carregar();
                  }}
                />
              </div>
            ) : (
              <>
                <p className="text-sm font-bold text-zinc-900">{c.nome}</p>
                <p className="text-[11px] text-zinc-500">
                  {rotuloTipo(c.tipo)} · {rotuloLocal(c.local)}
                  {c.area_m2 ? ` · ${c.area_m2} m²` : ""}
                  {c.capacidade_texto ? ` · ${c.capacidade_texto}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRenomeandoId(c.id)}
                    className="rounded-full border-2 border-zinc-300 px-3 py-1 text-[11px] font-bold text-zinc-700"
                  >
                    ✏️ Corrigir nome
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubstituindoId(c.id)}
                    className="rounded-full border-2 border-zinc-300 px-3 py-1 text-[11px] font-bold text-zinc-700"
                  >
                    🔁 Encerrar e substituir
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {canteiros.length === 0 && (
          <p className="text-center text-xs text-zinc-500">Nenhum canteiro ativo ainda.</p>
        )}
      </div>
    </div>
  );
}

function FormCanteiro({
  titulo,
  onSalvar,
  onCancelar,
}: {
  titulo: string;
  onSalvar: (dados: DadosCanteiro) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoCanteiro>("canteiro_solo");
  const [local, setLocal] = useState<LocalCanteiro>("patio");
  const [area, setArea] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({
        nome,
        tipo,
        local,
        area_m2: area.trim() ? Number(area) : null,
        capacidade_texto: capacidade.trim() || null,
      });
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
          placeholder="Ex.: Canteiro 8"
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>
      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Tipo
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoCanteiro)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
        >
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Local
        <select
          value={local}
          onChange={(e) => setLocal(e.target.value as LocalCanteiro)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
        >
          {LOCAIS.map((l) => (
            <option key={l.valor} value={l.valor}>
              {l.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Área (m², opcional)
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          inputMode="decimal"
          placeholder="Ex.: 4"
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>
      <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
        Capacidade (opcional — texto livre, porque a unidade muda por tipo)
        <input
          value={capacidade}
          onChange={(e) => setCapacidade(e.target.value)}
          placeholder="Ex.: 200 L"
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
