"use client";

// Agenda → Planejamento semanal (Sprint A, item 5 —
// SPRINT_A_REGISTRO_SIMPLIFICADO_ETAPA2.md, seção 9).
//
// Visão de uma semana (segunda a sexta por padrão, com botão pra mostrar o
// fim de semana), dois blocos por dia (Manhã/Tarde), cada um com linhas de
// texto livre — checklist simples, do mesmo jeito que o planejamento real
// já circula no WhatsApp. Coordenação/Consultor criam, editam e apagam
// linhas; qualquer outro papel autenticado só lê (RLS já bloqueia escrita,
// esta tela só evita mostrar um formulário que vai falhar).
//
// Um bloco (data+turno) fica somente leitura pra todo mundo, inclusive
// coordenação, depois que existir um Relatório do Turno pra ele — os
// itens já foram copiados pro relatório (proposta P2 do sprint doc; o
// Relatório do Turno em si é o item 6, fora desta entrega).
//
// `new Date()` só dentro de useEffect pós-mount (regra da sprint, bug real
// com Next 16 + useOffline) — por isso a semana de partida só é calculada
// depois de montar, nunca direto no corpo do componente.

import { useEffect, useMemo, useState } from "react";
import {
  TURNOS_PLANEJAMENTO,
  apagarItemPlanejamento,
  chavesComRelatorioTurno,
  criarItemPlanejamento,
  editarItemPlanejamento,
  listarItensPlanejamento,
} from "@/lib/planejamento";
import { obterMeuMembro } from "@/lib/auth";
import type { ItemPlanejamentoSemanal, TurnoPlanejamento } from "@/lib/types";
import { TelaBase } from "@/components/fluxo-registro";

const DIAS_SEMANA_UTIL = 5; // segunda a sexta
const DIAS_SEMANA_COMPLETA = 7;

const NOMES_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function formatarDataISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function somarDiasISO(dataISO: string, dias: number): string {
  const data = new Date(`${dataISO}T00:00:00`);
  data.setDate(data.getDate() + dias);
  return formatarDataISO(data);
}

// Segunda-feira da semana de `base`, deslocada `offsetSemanas` semanas.
function calcularSegundaDaSemana(base: Date, offsetSemanas: number): string {
  const diaDaSemana = base.getDay(); // 0 = domingo
  const deslocamentoParaSegunda = diaDaSemana === 0 ? -6 : 1 - diaDaSemana;
  const copia = new Date(base);
  copia.setDate(copia.getDate() + deslocamentoParaSegunda + offsetSemanas * 7);
  return formatarDataISO(copia);
}

function formatarDataBR(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export default function PlanejamentoSemanalPage() {
  const [offsetSemanas, setOffsetSemanas] = useState(0);
  const [segundaFeira, setSegundaFeira] = useState<string | null>(null);
  const [mostrarFimDeSemana, setMostrarFimDeSemana] = useState(false);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemPlanejamentoSemanal[]>([]);
  const [bloqueados, setBloqueados] = useState<Set<string>>(new Set());
  const [podeEditar, setPodeEditar] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- new Date() só pode rodar pós-mount (regra da sprint, bug com Next 16 + useOffline), mesmo padrão de FormEvento em agenda/page.tsx
    setSegundaFeira(calcularSegundaDaSemana(new Date(), offsetSemanas));
  }, [offsetSemanas]);

  const totalDias = mostrarFimDeSemana ? DIAS_SEMANA_COMPLETA : DIAS_SEMANA_UTIL;
  const dias = useMemo(() => {
    if (!segundaFeira) return [];
    return Array.from({ length: totalDias }, (_, i) => somarDiasISO(segundaFeira, i));
  }, [segundaFeira, totalDias]);

  useEffect(() => {
    if (!segundaFeira) return;
    const inicioSemana = segundaFeira;
    let cancelado = false;
    async function carregar() {
      setCarregando(true);
      setErro(null);
      const dataFim = somarDiasISO(inicioSemana, DIAS_SEMANA_COMPLETA - 1);
      try {
        const [listaItens, chavesBloqueadas, meuMembro] = await Promise.all([
          listarItensPlanejamento(inicioSemana, dataFim),
          chavesComRelatorioTurno(inicioSemana, dataFim),
          obterMeuMembro(),
        ]);
        if (cancelado) return;
        setItens(listaItens);
        setBloqueados(chavesBloqueadas);
        setPodeEditar(meuMembro?.papel === "coordenacao" || meuMembro?.papel === "consultor");
      } catch {
        if (!cancelado) {
          setErro("Não deu pra carregar o planejamento agora. Confira a internet e tente de novo.");
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    carregar();
    return () => {
      cancelado = true;
    };
  }, [segundaFeira]);

  async function recarregarItens() {
    if (!segundaFeira) return;
    const dataFim = somarDiasISO(segundaFeira, DIAS_SEMANA_COMPLETA - 1);
    try {
      setItens(await listarItensPlanejamento(segundaFeira, dataFim));
    } catch {
      setErro("Não deu pra atualizar a lista agora. Confira a internet e tente de novo.");
    }
  }

  return (
    <TelaBase titulo="Planejamento semanal" icone="📝" voltarHref="/patio/agenda">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOffsetSemanas((o) => o - 1)}
          className="rounded-full border-2 border-zinc-300 px-3 py-1.5 text-xs font-bold text-zinc-700"
        >
          ← semana anterior
        </button>
        <button
          type="button"
          onClick={() => setOffsetSemanas((o) => o + 1)}
          className="rounded-full border-2 border-zinc-300 px-3 py-1.5 text-xs font-bold text-zinc-700"
        >
          próxima semana →
        </button>
      </div>

      <label className="mb-4 flex items-center justify-center gap-2 text-[11px] font-semibold text-zinc-600">
        <input
          type="checkbox"
          checked={mostrarFimDeSemana}
          onChange={(e) => setMostrarFimDeSemana(e.target.checked)}
          className="h-4 w-4"
        />
        Mostrar fim de semana
      </label>

      {!podeEditar && !carregando && (
        <p className="mb-4 rounded-lg border border-dashed border-zinc-400 bg-[#f1efe6] px-3 py-2 text-center text-[11px] text-zinc-600">
          Modo leitura — só Coordenação/Consultor editam o planejamento.
        </p>
      )}

      {carregando && <p className="text-center text-sm text-zinc-600">Carregando…</p>}
      {erro && <p className="text-center text-sm text-red-700">{erro}</p>}

      {!carregando && !erro && (
        <div className="flex flex-col gap-4">
          {dias.map((diaISO) => (
            <DiaPlanejamento
              key={diaISO}
              diaISO={diaISO}
              itens={itens.filter((i) => i.data === diaISO)}
              bloqueados={bloqueados}
              podeEditar={podeEditar}
              onMudou={recarregarItens}
            />
          ))}
        </div>
      )}
    </TelaBase>
  );
}

function DiaPlanejamento({
  diaISO,
  itens,
  bloqueados,
  podeEditar,
  onMudou,
}: {
  diaISO: string;
  itens: ItemPlanejamentoSemanal[];
  bloqueados: Set<string>;
  podeEditar: boolean;
  onMudou: () => Promise<void>;
}) {
  const nomeDia = NOMES_DIA[new Date(`${diaISO}T00:00:00`).getDay()];

  return (
    <div className="rounded-xl border-2 border-zinc-800 bg-white p-3">
      <p className="mb-2 text-xs font-bold text-zinc-900">
        {nomeDia} · {formatarDataBR(diaISO)}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TURNOS_PLANEJAMENTO.map((turno) => (
          <BlocoTurno
            key={turno.valor}
            diaISO={diaISO}
            turno={turno.valor}
            rotuloTurno={turno.rotulo}
            itens={itens.filter((i) => i.turno === turno.valor)}
            bloqueado={bloqueados.has(`${diaISO}|${turno.valor}`)}
            podeEditar={podeEditar}
            onMudou={onMudou}
          />
        ))}
      </div>
    </div>
  );
}

function BlocoTurno({
  diaISO,
  turno,
  rotuloTurno,
  itens,
  bloqueado,
  podeEditar,
  onMudou,
}: {
  diaISO: string;
  turno: TurnoPlanejamento;
  rotuloTurno: string;
  itens: ItemPlanejamentoSemanal[];
  bloqueado: boolean;
  podeEditar: boolean;
  onMudou: () => Promise<void>;
}) {
  const [novoTexto, setNovoTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdicao, setTextoEdicao] = useState("");

  const editavel = podeEditar && !bloqueado;

  async function adicionar() {
    if (!novoTexto.trim()) return;
    setEnviando(true);
    try {
      await criarItemPlanejamento({ data: diaISO, turno, descricao: novoTexto });
      setNovoTexto("");
      await onMudou();
    } finally {
      setEnviando(false);
    }
  }

  async function salvarEdicao(id: string) {
    if (!textoEdicao.trim()) return;
    await editarItemPlanejamento(id, textoEdicao);
    setEditandoId(null);
    await onMudou();
  }

  async function apagar(id: string) {
    await apagarItemPlanejamento(id);
    await onMudou();
  }

  return (
    <div className="rounded-lg border border-zinc-300 bg-[#f1efe6] p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] font-bold text-zinc-700">{rotuloTurno}</p>
        {bloqueado && (
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[9px] font-bold text-zinc-500">
            turno já relatado
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {itens.map((item) =>
          editandoId === item.id ? (
            <div key={item.id} className="flex gap-1">
              <input
                autoFocus
                value={textoEdicao}
                onChange={(e) => setTextoEdicao(e.target.value)}
                className="flex-1 rounded-lg border-2 border-zinc-300 p-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => salvarEdicao(item.id)}
                className="rounded-lg bg-[#2e6b3e] px-2 text-[10px] font-bold text-white"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={() => setEditandoId(null)}
                className="rounded-lg border-2 border-zinc-300 px-2 text-[10px] font-bold text-zinc-600"
              >
                ✕
              </button>
            </div>
          ) : (
            <div key={item.id} className="flex items-start justify-between gap-1 rounded-lg bg-white px-2 py-1.5">
              <span className="text-xs text-zinc-800">{item.descricao}</span>
              {editavel && (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditandoId(item.id);
                      setTextoEdicao(item.descricao);
                    }}
                    aria-label="Editar"
                    className="text-[11px]"
                  >
                    ✏️
                  </button>
                  <button type="button" onClick={() => apagar(item.id)} aria-label="Apagar" className="text-[11px]">
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ),
        )}
        {itens.length === 0 && <p className="px-1 text-[11px] text-zinc-400">Nada planejado ainda.</p>}
      </div>

      {editavel && (
        <div className="mt-1.5 flex gap-1">
          <input
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") adicionar();
            }}
            placeholder="+ item…"
            className="flex-1 rounded-lg border-2 border-dashed border-zinc-400 bg-white p-1.5 text-xs"
          />
          <button
            type="button"
            disabled={enviando || !novoTexto.trim()}
            onClick={adicionar}
            className="rounded-lg bg-[#2e6b3e] px-2.5 text-[10px] font-bold text-white disabled:opacity-40"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
