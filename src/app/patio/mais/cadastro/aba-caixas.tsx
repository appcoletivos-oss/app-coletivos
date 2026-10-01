"use client";

// Cadastro → aba Caixas. Diferente de Parceiros/Canteiros: uma caixa não
// "vira" outra caixa, ela só entra ou sai de operação — por isso não tem
// o padrão renomear/substituir, só editar (status, capacidade,
// observações) e desativar (ex.: caixa com defeito, retirada de
// circulação). O campo `status` já existia desde a migration original.

import { useEffect, useState } from "react";
import {
  atualizarCaixa,
  criarCaixa,
  desativarCaixa,
  listarCaixas,
  moverCaixaParaDescanso,
  proximoNumeroCaixa,
} from "@/lib/patio";
import type { Caixa, StatusCaixa } from "@/lib/types";

const STATUS: { valor: StatusCaixa; rotulo: string }[] = [
  { valor: "ativa", rotulo: "Ativa" },
  { valor: "nao_ativada", rotulo: "Não ativada" },
  { valor: "nova", rotulo: "Nova, aguardando" },
  { valor: "descanso", rotulo: "Em descanso" },
  { valor: "desativada", rotulo: "Desativada" },
];

function rotuloStatus(status: StatusCaixa): string {
  return STATUS.find((s) => s.valor === status)?.rotulo ?? status;
}

export function AbaCaixas() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [caixas, setCaixas] = useState<Caixa[]>([]);

  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setCaixas(await listarCaixas());
    } catch {
      setErro("Não deu pra carregar as caixas agora. Confira a internet e tente de novo.");
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

  return (
    <div>
      {!formAberto && !editandoId && (
        <button
          type="button"
          onClick={() => setFormAberto(true)}
          className="mb-3 w-full rounded-xl border-2 border-dashed border-[#2e6b3e] py-2.5 text-xs font-bold text-[#2e6b3e]"
        >
          + Adicionar caixa
        </button>
      )}

      {formAberto && (
        <div className="mb-3">
          <FormCaixa
            titulo="Nova caixa"
            valoresIniciais={{ numero: proximoNumeroCaixa(caixas), status: "nova", capacidade_kg: 620, observacoes: "" }}
            onCancelar={fecharTudo}
            onSalvar={async (dados) => {
              await criarCaixa(dados);
              fecharTudo();
              await carregar();
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {caixas.map((c) => (
          <div key={c.id} className="rounded-xl border-2 border-zinc-800 bg-white p-3">
            {editandoId === c.id ? (
              <FormCaixa
                titulo={`Caixa ${c.numero}`}
                somenteStatus
                valoresIniciais={{ numero: c.numero, status: c.status, capacidade_kg: c.capacidade_kg, observacoes: c.observacoes ?? "" }}
                onCancelar={fecharTudo}
                onSalvar={async (dados) => {
                  await atualizarCaixa(c.id, dados);
                  fecharTudo();
                  await carregar();
                }}
              />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-zinc-900">Caixa {c.numero}</p>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      c.status === "ativa" ? "bg-[#eaf3ea] text-[#2e6b3e]" : "bg-zinc-100 text-zinc-500",
                    ].join(" ")}
                  >
                    {rotuloStatus(c.status)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">{c.capacidade_kg} kg de capacidade</p>
                {c.observacoes && <p className="mt-1 text-[11px] text-zinc-500">{c.observacoes}</p>}
                {c.status === "descanso" && c.data_inicio_descanso && (
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Em descanso desde {new Date(c.data_inicio_descanso).toLocaleDateString("pt-BR")}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditandoId(c.id)}
                    className="rounded-full border-2 border-zinc-300 px-3 py-1 text-[11px] font-bold text-zinc-700"
                  >
                    ✏️ Editar
                  </button>
                  {c.status !== "descanso" && c.status !== "desativada" && (
                    <button
                      type="button"
                      onClick={async () => {
                        await moverCaixaParaDescanso(c.id);
                        await carregar();
                      }}
                      className="rounded-full border-2 border-amber-300 px-3 py-1 text-[11px] font-bold text-amber-800"
                    >
                      🌙 Mover pra descanso
                    </button>
                  )}
                  {c.status !== "desativada" && (
                    <button
                      type="button"
                      onClick={async () => {
                        await desativarCaixa(c.id);
                        await carregar();
                      }}
                      className="rounded-full border-2 border-red-300 px-3 py-1 text-[11px] font-bold text-red-700"
                    >
                      🚫 Retirar (defeito)
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        {caixas.length === 0 && <p className="text-center text-xs text-zinc-500">Nenhuma caixa cadastrada ainda.</p>}
      </div>
    </div>
  );
}

type DadosCaixa = { numero: number; status: StatusCaixa; capacidade_kg: number; observacoes: string | null };

function FormCaixa({
  titulo,
  valoresIniciais,
  somenteStatus = false,
  onSalvar,
  onCancelar,
}: {
  titulo: string;
  valoresIniciais: { numero: number; status: StatusCaixa; capacidade_kg: number; observacoes: string };
  somenteStatus?: boolean;
  onSalvar: (dados: DadosCaixa) => Promise<void>;
  onCancelar: () => void;
}) {
  const [numero, setNumero] = useState(valoresIniciais.numero);
  const [status, setStatus] = useState<StatusCaixa>(valoresIniciais.status);
  const [capacidade, setCapacidade] = useState(valoresIniciais.capacidade_kg);
  const [observacoes, setObservacoes] = useState(valoresIniciais.observacoes);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({ numero, status, capacidade_kg: capacidade, observacoes: observacoes.trim() || null });
    } catch {
      setErro("Não deu pra salvar agora. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-zinc-400 bg-[#f1efe6] p-3">
      <p className="mb-2 text-xs font-bold text-zinc-800">{titulo}</p>
      {!somenteStatus && (
        <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
          Número
          <input
            type="number"
            value={numero}
            onChange={(e) => setNumero(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
          />
        </label>
      )}
      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Status
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusCaixa)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
        >
          {STATUS.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Capacidade (kg)
        <input
          type="number"
          value={capacidade}
          onChange={(e) => setCapacidade(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>
      <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
        Observações (opcional)
        <input
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Ex.: aguardando brita"
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>
      {erro && <p className="mb-2 text-[11px] text-red-700">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={salvando}
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
