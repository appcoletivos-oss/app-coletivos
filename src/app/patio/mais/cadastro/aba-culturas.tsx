"use client";

// Cadastro → aba Culturas. Ficha de cultura (solo, rega, ciclo, dias de
// germinação/transplante/colheita) + regime de manejo por tipo (capina
// seletiva, adubação, poda, raleamento), cada um com marco de referência
// próprio — ver HANDOFF_HORTA_COMPLETO.md (v3), seções 3.2 e 3.3.
//
// Diferente de Parceiros/Canteiros: não tem o padrão "encerrar e
// substituir" (não existe turnover de espécie) — só editar e ativar/
// desativar, mesmo espírito de Caixas. A lista já vem com 73 espécies
// (seed_culturas.sql), então tem busca por nome pra não virar uma rolagem
// infinita.

import { useEffect, useMemo, useState } from "react";
import {
  atualizarCultura,
  criarCultura,
  definirAtivoCultura,
  listarCulturas,
  listarRegimeManejo,
  removerRegraManejo,
  salvarRegraManejo,
} from "@/lib/culturas";
import type {
  CicloProdutivo,
  Cultura,
  NovaCultura,
  NovoRegimeManejoCultura,
  ReferenciaManejo,
  RegimeManejoCultura,
  TipoManejoRegime,
} from "@/lib/types";

const CICLOS: { valor: CicloProdutivo; rotulo: string }[] = [
  { valor: "unico", rotulo: "Único (colheita encerra o plantio)" },
  { valor: "continuo", rotulo: "Contínuo (planta segue produzindo)" },
];

const TIPOS_REGRA: { valor: TipoManejoRegime; icone: string; rotulo: string }[] = [
  { valor: "adubacao", icone: "🧪", rotulo: "Adubação" },
  { valor: "capina_seletiva", icone: "🌾", rotulo: "Capina seletiva" },
  { valor: "poda", icone: "✂️", rotulo: "Poda" },
  { valor: "raleamento", icone: "🍃", rotulo: "Raleamento" },
];

const REFERENCIAS: { valor: ReferenciaManejo; rotulo: string }[] = [
  { valor: "plantio", rotulo: "do plantio" },
  { valor: "germinacao", rotulo: "da germinação" },
  { valor: "transplante", rotulo: "do transplante" },
];

function rotuloReferencia(referencia: ReferenciaManejo): string {
  return REFERENCIAS.find((r) => r.valor === referencia)?.rotulo ?? referencia;
}

export function AbaCulturas() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [culturas, setCulturas] = useState<Cultura[]>([]);
  const [busca, setBusca] = useState("");

  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setCulturas(await listarCulturas());
    } catch {
      setErro("Não deu pra carregar as culturas agora. Confira a internet e tente de novo.");
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

  const culturasFiltradas = useMemo(() => {
    const alvo = busca.trim().toLowerCase();
    if (!alvo) return culturas;
    return culturas.filter((c) => c.nome.toLowerCase().includes(alvo));
  }, [culturas, busca]);

  if (carregando) return <p className="text-center text-sm text-zinc-600">Carregando…</p>;
  if (erro) return <p className="text-center text-sm text-red-700">{erro}</p>;

  return (
    <div>
      {!formAberto && !editandoId && (
        <>
          <button
            type="button"
            onClick={() => setFormAberto(true)}
            className="mb-3 w-full rounded-xl border-2 border-dashed border-[#2e6b3e] py-2.5 text-xs font-bold text-[#2e6b3e]"
          >
            + Adicionar cultura
          </button>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="🔎 Buscar cultura pelo nome…"
            className="mb-3 w-full rounded-lg border-2 border-zinc-300 p-2.5 text-sm"
          />
        </>
      )}

      {formAberto && (
        <div className="mb-3">
          <FormCultura
            titulo="Nova cultura"
            onCancelar={fecharTudo}
            onSalvar={async (dados) => {
              await criarCultura(dados);
              fecharTudo();
              await carregar();
            }}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {culturasFiltradas.map((c) =>
          editandoId === c.id ? (
            <div key={c.id} className="rounded-xl border-2 border-zinc-800 bg-white p-3">
              <FormCultura
                titulo={c.nome}
                valoresIniciais={c}
                onCancelar={fecharTudo}
                onSalvar={async (dados) => {
                  await atualizarCultura(c.id, dados);
                  fecharTudo();
                  await carregar();
                }}
              />
              <div className="mt-4 border-t-2 border-dashed border-zinc-200 pt-3">
                <RegimeManejoCultivo culturaId={c.id} />
              </div>
            </div>
          ) : (
            <div
              key={c.id}
              className={[
                "rounded-xl border-2 p-3",
                c.ativo ? "border-zinc-800 bg-white" : "border-zinc-300 bg-zinc-50 opacity-70",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-zinc-900">{c.nome}</p>
                {!c.ativo && (
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                    inativa
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                {c.ciclo_produtivo === "unico" ? "Ciclo único" : "Ciclo contínuo"}
                {c.dias_para_colheita ? ` · ${c.dias_para_colheita}d até colher` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditandoId(c.id)}
                  className="rounded-full border-2 border-zinc-300 px-3 py-1 text-[11px] font-bold text-zinc-700"
                >
                  ✏️ Editar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await definirAtivoCultura(c.id, !c.ativo);
                    await carregar();
                  }}
                  className="rounded-full border-2 border-zinc-300 px-3 py-1 text-[11px] font-bold text-zinc-700"
                >
                  {c.ativo ? "🚫 Desativar" : "✅ Reativar"}
                </button>
              </div>
            </div>
          ),
        )}
        {culturasFiltradas.length === 0 && (
          <p className="text-center text-xs text-zinc-500">Nenhuma cultura encontrada.</p>
        )}
      </div>
    </div>
  );
}

function FormCultura({
  titulo,
  valoresIniciais,
  onSalvar,
  onCancelar,
}: {
  titulo: string;
  valoresIniciais?: Cultura;
  onSalvar: (dados: NovaCultura) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState(valoresIniciais?.nome ?? "");
  const [soloIdeal, setSoloIdeal] = useState(valoresIniciais?.solo_ideal ?? "");
  const [regaIdeal, setRegaIdeal] = useState(valoresIniciais?.rega_ideal ?? "");
  const [ciclo, setCiclo] = useState<CicloProdutivo>(valoresIniciais?.ciclo_produtivo ?? "unico");
  const [diasGerminacao, setDiasGerminacao] = useState(
    valoresIniciais?.dias_para_germinacao?.toString() ?? "",
  );
  const [diasTransplante, setDiasTransplante] = useState(
    valoresIniciais?.dias_para_transplante?.toString() ?? "",
  );
  const [diasColheita, setDiasColheita] = useState(
    valoresIniciais?.dias_para_colheita?.toString() ?? "",
  );
  const [observacoes, setObservacoes] = useState(valoresIniciais?.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({
        nome,
        solo_ideal: soloIdeal || null,
        rega_ideal: regaIdeal || null,
        ciclo_produtivo: ciclo,
        dias_para_germinacao: diasGerminacao.trim() ? Number(diasGerminacao) : null,
        dias_para_transplante: diasTransplante.trim() ? Number(diasTransplante) : null,
        dias_para_colheita: diasColheita.trim() ? Number(diasColheita) : null,
        observacoes: observacoes || null,
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
          placeholder="Ex.: Tomate"
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>

      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Ciclo produtivo
        <select
          value={ciclo}
          onChange={(e) => setCiclo(e.target.value as CicloProdutivo)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
        >
          {CICLOS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.rotulo}
            </option>
          ))}
        </select>
      </label>

      <div className="mb-2 grid grid-cols-3 gap-2">
        <label className="block text-[11px] font-semibold text-zinc-600">
          Germinação (d)
          <input
            value={diasGerminacao}
            onChange={(e) => setDiasGerminacao(e.target.value)}
            inputMode="numeric"
            placeholder="—"
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
          />
        </label>
        <label className="block text-[11px] font-semibold text-zinc-600">
          Transplante (d)
          <input
            value={diasTransplante}
            onChange={(e) => setDiasTransplante(e.target.value)}
            inputMode="numeric"
            placeholder="—"
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
          />
        </label>
        <label className="block text-[11px] font-semibold text-zinc-600">
          Colheita (d)
          <input
            value={diasColheita}
            onChange={(e) => setDiasColheita(e.target.value)}
            inputMode="numeric"
            placeholder="—"
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
          />
        </label>
      </div>

      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Solo ideal (opcional)
        <input
          value={soloIdeal}
          onChange={(e) => setSoloIdeal(e.target.value)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>

      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Rega ideal (opcional)
        <input
          value={regaIdeal}
          onChange={(e) => setRegaIdeal(e.target.value)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>

      <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
        Observações (opcional)
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          className="mt-1 min-h-16 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
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

// Regime de manejo da cultura sendo editada: uma linha por tipo (adubação,
// capina seletiva, poda, raleamento). Só aparece dentro do form de edição
// (precisa do id da cultura já salva) — cultura nova primeiro salva a
// ficha, depois a pessoa reabre pra editar e cadastrar as regras.
function RegimeManejoCultivo({ culturaId }: { culturaId: string }) {
  const [carregando, setCarregando] = useState(true);
  const [regras, setRegras] = useState<RegimeManejoCultura[]>([]);
  const [editandoTipo, setEditandoTipo] = useState<TipoManejoRegime | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      setRegras(await listarRegimeManejo(culturaId));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!cancelado) await carregar();
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [culturaId]);

  if (carregando) return <p className="text-[11px] text-zinc-500">Carregando regras de manejo…</p>;

  return (
    <div>
      <p className="mb-2 text-[11px] font-bold text-zinc-700">Regime de manejo</p>
      <div className="flex flex-col gap-2">
        {TIPOS_REGRA.map((t) => {
          const regra = regras.find((r) => r.tipo_manejo === t.valor);
          if (editandoTipo === t.valor) {
            return (
              <FormRegraManejo
                key={t.valor}
                culturaId={culturaId}
                tipo={t.valor}
                valoresIniciais={regra}
                onCancelar={() => setEditandoTipo(null)}
                onSalvar={async (dados) => {
                  await salvarRegraManejo(dados);
                  setEditandoTipo(null);
                  await carregar();
                }}
                onRemover={
                  regra
                    ? async () => {
                        await removerRegraManejo(regra.id);
                        setEditandoTipo(null);
                        await carregar();
                      }
                    : undefined
                }
              />
            );
          }
          return (
            <div key={t.valor} className="flex items-center justify-between rounded-lg border border-zinc-300 bg-white px-2.5 py-2">
              <div>
                <p className="text-[11px] font-bold text-zinc-800">
                  {t.icone} {t.rotulo}
                </p>
                {regra ? (
                  <p className="text-[10px] text-zinc-500">
                    a partir de {regra.dias_inicio}d {rotuloReferencia(regra.referencia)}, repete a cada {regra.intervalo_dias}d
                  </p>
                ) : (
                  <p className="text-[10px] text-zinc-400">sem regra cadastrada</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditandoTipo(t.valor)}
                className="rounded-full border-2 border-zinc-300 px-2.5 py-1 text-[10px] font-bold text-zinc-700"
              >
                {regra ? "editar" : "+ adicionar"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormRegraManejo({
  culturaId,
  tipo,
  valoresIniciais,
  onSalvar,
  onCancelar,
  onRemover,
}: {
  culturaId: string;
  tipo: TipoManejoRegime;
  valoresIniciais?: RegimeManejoCultura;
  onSalvar: (dados: NovoRegimeManejoCultura) => Promise<void>;
  onCancelar: () => void;
  onRemover?: () => Promise<void>;
}) {
  const [referencia, setReferencia] = useState<ReferenciaManejo>(valoresIniciais?.referencia ?? "plantio");
  const [diasInicio, setDiasInicio] = useState(valoresIniciais?.dias_inicio?.toString() ?? "0");
  const [intervaloDias, setIntervaloDias] = useState(valoresIniciais?.intervalo_dias?.toString() ?? "");
  const [observacao, setObservacao] = useState(valoresIniciais?.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!intervaloDias.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({
        cultura_id: culturaId,
        tipo_manejo: tipo,
        referencia,
        dias_inicio: Number(diasInicio || 0),
        intervalo_dias: Number(intervaloDias),
        observacao: observacao || null,
      });
    } catch {
      setErro("Não deu pra salvar agora. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-lg border-2 border-dashed border-zinc-400 bg-[#f1efe6] p-2.5">
      <label className="mb-2 block text-[10px] font-semibold text-zinc-600">
        Conta a partir…
        <select
          value={referencia}
          onChange={(e) => setReferencia(e.target.value as ReferenciaManejo)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-xs"
        >
          {REFERENCIAS.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.rotulo}
            </option>
          ))}
        </select>
      </label>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="block text-[10px] font-semibold text-zinc-600">
          Começa em (dias)
          <input
            value={diasInicio}
            onChange={(e) => setDiasInicio(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-xs"
          />
        </label>
        <label className="block text-[10px] font-semibold text-zinc-600">
          Repete a cada (dias)
          <input
            value={intervaloDias}
            onChange={(e) => setIntervaloDias(e.target.value)}
            inputMode="numeric"
            placeholder="Ex.: 15"
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-xs"
          />
        </label>
      </div>
      <label className="mb-2 block text-[10px] font-semibold text-zinc-600">
        Observação (opcional)
        <input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-xs"
        />
      </label>
      {erro && <p className="mb-2 text-[10px] text-red-700">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={salvando || !intervaloDias.trim()}
          onClick={salvar}
          className="flex-1 rounded-lg bg-[#2e6b3e] py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        {onRemover && (
          <button
            type="button"
            onClick={onRemover}
            className="rounded-lg border-2 border-red-300 px-2.5 py-1.5 text-[11px] font-bold text-red-700"
          >
            Remover
          </button>
        )}
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-lg border-2 border-zinc-300 px-2.5 py-1.5 text-[11px] font-bold text-zinc-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
