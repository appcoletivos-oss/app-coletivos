"use client";

// Cadastro → aba Canteiros. Mesmo padrão de Parceiros (memória
// histórica: corrigir nome vs. encerrar e substituir) — só muda os
// campos, porque um canteiro tem tipo (solo, bombona, galeia...) e
// capacidade em texto livre, já que a unidade de medida muda por tipo.
//
// Pacote 1 do bloco "Mais" (claude/handoff-mais-pacote1.md, seção 1): cada
// canteiro ganha "Remover", que decide sozinho entre EXCLUIR de verdade
// (canteiro que nunca teve nada vinculado) e INATIVAR (qualquer histórico).
// Canteiro com plantio ativo bloqueia as duas ações até mover/colher/
// encerrar os plantios. Toggle "mostrar inativos" na listagem.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  canteiroTemHistorico,
  criarCanteiro,
  encerrarESubstituirCanteiro,
  excluirCanteiro,
  inativarCanteiro,
  listarCanteiros,
  plantiosPendentesDoCanteiro,
  reativarCanteiro,
  renomearCanteiro,
} from "@/lib/patio";
import { encerrarPlantioPorDesativacao } from "@/lib/plantios";
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
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const [formAberto, setFormAberto] = useState(false);
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [substituindoId, setSubstituindoId] = useState<string | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setCanteiros(await listarCanteiros(true));
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
    setRemovendoId(null);
  }

  if (carregando) return <p className="text-center text-sm text-zinc-600">Carregando…</p>;
  if (erro) return <p className="text-center text-sm text-red-700">{erro}</p>;

  const visiveis = canteiros.filter((c) => mostrarInativos || c.ativo);

  return (
    <div>
      {!formAberto && !renomeandoId && !substituindoId && !removendoId && (
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

      <label className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-zinc-600">
        <input
          type="checkbox"
          checked={mostrarInativos}
          onChange={(e) => setMostrarInativos(e.target.checked)}
          className="h-4 w-4"
        />
        Mostrar canteiros inativos
      </label>

      <div className="flex flex-col gap-2">
        {visiveis.map((c) => (
          <div
            key={c.id}
            className={[
              "rounded-xl border-2 p-3",
              c.ativo ? "border-zinc-800 bg-white" : "border-zinc-300 bg-zinc-50 opacity-80",
            ].join(" ")}
          >
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
            ) : removendoId === c.id ? (
              <RemoverCanteiro
                canteiro={c}
                onCancelar={fecharTudo}
                onConcluido={async () => {
                  fecharTudo();
                  await carregar();
                }}
              />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-zinc-900">{c.nome}</p>
                  {!c.ativo && (
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                      inativo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500">
                  {rotuloTipo(c.tipo)} · {rotuloLocal(c.local)}
                  {c.area_m2 ? ` · ${c.area_m2} m²` : ""}
                  {c.capacidade_texto ? ` · ${c.capacidade_texto}` : ""}
                </p>
                {!c.ativo && c.motivo_inativacao && (
                  <p className="mt-1 text-[11px] text-zinc-500">Motivo: {c.motivo_inativacao}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.ativo ? (
                    <>
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
                      <button
                        type="button"
                        onClick={() => setRemovendoId(c.id)}
                        className="rounded-full border-2 border-red-300 px-3 py-1 text-[11px] font-bold text-red-700"
                      >
                        🗑️ Remover
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await reativarCanteiro(c.id);
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
          <p className="text-center text-xs text-zinc-500">Nenhum canteiro {mostrarInativos ? "" : "ativo "}ainda.</p>
        )}
      </div>
    </div>
  );
}

// Decide entre EXCLUIR (nunca teve nada) e INATIVAR (tem histórico), e
// bloqueia se houver plantio ativo no canteiro.
function RemoverCanteiro({
  canteiro,
  onCancelar,
  onConcluido,
}: {
  canteiro: Canteiro;
  onCancelar: () => void;
  onConcluido: () => Promise<void>;
}) {
  type Avaliacao =
    | { estado: "carregando" }
    | { estado: "erro"; msg: string }
    | { estado: "bloqueado"; pendentes: { id: string; cultura_nome: string; status: string }[] }
    | { estado: "excluir" }
    | { estado: "inativar" };

  const [av, setAv] = useState<Avaliacao>({ estado: "carregando" });
  const [motivo, setMotivo] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  async function avaliar() {
    setAv({ estado: "carregando" });
    try {
      const pendentes = await plantiosPendentesDoCanteiro(canteiro.id);
      if (pendentes.length > 0) {
        setAv({ estado: "bloqueado", pendentes });
        return;
      }
      const temHistorico = await canteiroTemHistorico(canteiro.id);
      setAv({ estado: temHistorico ? "inativar" : "excluir" });
    } catch {
      setAv({ estado: "erro", msg: "Não deu pra checar o canteiro agora. Tente de novo." });
    }
  }

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!cancelado) await avaliar();
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canteiro.id]);

  async function confirmarExcluir() {
    setProcessando(true);
    setErroAcao(null);
    try {
      await excluirCanteiro(canteiro.id);
      await onConcluido();
    } catch {
      setErroAcao("Não deu pra excluir agora. Tente de novo.");
      setProcessando(false);
    }
  }

  async function confirmarInativar() {
    if (!motivo.trim()) return;
    setProcessando(true);
    setErroAcao(null);
    try {
      await inativarCanteiro(canteiro.id, motivo);
      await onConcluido();
    } catch {
      setErroAcao("Não deu pra inativar agora. Tente de novo.");
      setProcessando(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-bold text-zinc-800">Remover {canteiro.nome}</p>

      {av.estado === "carregando" && <p className="text-[11px] text-zinc-500">Checando o canteiro…</p>}

      {av.estado === "erro" && (
        <>
          <p className="mb-2 text-[11px] text-red-700">{av.msg}</p>
          <BotaoVoltar onClick={onCancelar} />
        </>
      )}

      {av.estado === "bloqueado" && (
        <div>
          <p className="mb-2 text-[11px] text-zinc-600">
            Este canteiro ainda tem planta de pé. Antes de remover, transplante ou colha
            cada plantio — ou, se for perene que não dá pra mover, encerre por desativação
            da estrutura (isso não conta como perda).
          </p>
          <div className="mb-2 flex flex-col gap-1.5">
            {av.pendentes.map((p) => (
              <PlantioPendente key={p.id} plantio={p} onEncerrado={avaliar} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <Link
              href="/patio/horta/transplantar"
              className="rounded-full border-2 border-zinc-300 px-3 py-1 text-zinc-700"
            >
              → Transplantar
            </Link>
            <Link
              href="/patio/horta/registrar-colheita"
              className="rounded-full border-2 border-zinc-300 px-3 py-1 text-zinc-700"
            >
              → Registrar colheita
            </Link>
          </div>
          <BotaoVoltar onClick={onCancelar} />
        </div>
      )}

      {av.estado === "excluir" && (
        <div>
          <p className="mb-3 text-[11px] text-zinc-600">
            Este canteiro nunca teve nenhum plantio nem registro. Dá pra <strong>excluir de
            verdade</strong> — some da lista sem deixar rastro.
          </p>
          {erroAcao && <p className="mb-2 text-[11px] text-red-700">{erroAcao}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={processando}
              onClick={confirmarExcluir}
              className="flex-1 rounded-lg bg-red-700 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              {processando ? "Excluindo…" : "🗑️ Excluir de vez"}
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
      )}

      {av.estado === "inativar" && (
        <div>
          <p className="mb-2 text-[11px] text-zinc-600">
            Este canteiro já tem histórico, então não dá pra excluir — só <strong>inativar</strong>.
            Ele some das opções de novo plantio, mas continua no histórico e navegável.
          </p>
          <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
            Motivo da inativação
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder='Ex.: "galeia rachou", "estrutura desmontada", "pé de uva morreu"…'
              className="mt-1 min-h-16 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
            />
          </label>
          {erroAcao && <p className="mb-2 text-[11px] text-red-700">{erroAcao}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={processando || !motivo.trim()}
              onClick={confirmarInativar}
              className="flex-1 rounded-lg bg-[#2e6b3e] py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              {processando ? "Inativando…" : "🚫 Inativar canteiro"}
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
      )}
    </div>
  );
}

function PlantioPendente({
  plantio,
  onEncerrado,
}: {
  plantio: { id: string; cultura_nome: string; status: string };
  onEncerrado: () => Promise<void> | void;
}) {
  const [abrindo, setAbrindo] = useState(false);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function encerrar() {
    if (!obs.trim()) return;
    setEnviando(true);
    try {
      await encerrarPlantioPorDesativacao(plantio.id, obs);
      await onEncerrado();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-300 bg-[#f1efe6] px-2.5 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-zinc-800">
          {plantio.cultura_nome}
          <span className="ml-1 font-normal text-zinc-500">· {plantio.status}</span>
        </span>
        {!abrindo && (
          <button
            type="button"
            onClick={() => setAbrindo(true)}
            className="rounded-full border-2 border-zinc-300 bg-white px-2 py-0.5 text-[10px] font-bold text-zinc-700"
          >
            encerrar por desativação
          </button>
        )}
      </div>
      {abrindo && (
        <div className="mt-1.5">
          <input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Ex.: perene, canteiro foi desmontado"
            className="mb-1.5 w-full rounded-lg border-2 border-zinc-300 p-1.5 text-xs"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={enviando || !obs.trim()}
              onClick={encerrar}
              className="rounded-lg bg-[#2e6b3e] px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-40"
            >
              {enviando ? "…" : "Confirmar"}
            </button>
            <button
              type="button"
              onClick={() => setAbrindo(false)}
              className="rounded-lg border-2 border-zinc-300 px-2.5 py-1 text-[10px] font-bold text-zinc-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BotaoVoltar({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 block w-full text-center text-[11px] text-zinc-500 underline"
    >
      voltar
    </button>
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
