"use client";

// Bloco Agenda
//
// Lista de eventos (mutirão, oficina, visita, atividade de horta/
// compostagem, e a escala da equipe: turno_trabalho, folga, férias),
// agrupada por dia. Diferente das telas de registro, não é um fluxo de N
// passos — é uma lista com um formulário de criação que abre/fecha inline,
// mesmo padrão das abas de Cadastro (ver aba-equipe.tsx).
//
// Quando o tipo é "atividade", o card oferece links diretos pras telas de
// registro (Manejo, Registrar colheita, etc.) — o link carrega
// evento_agenda_id como query param, que a tela de registro lê e salva
// junto com o registro (ver lib/agenda.ts, LINKS_REGISTRO_ATIVIDADE).

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LINKS_REGISTRO_ATIVIDADE,
  TIPOS_EVENTO_AGENDA,
  TURNOS_DIA,
  agruparEventosPorDia,
  criarEvento,
  exigeMembro,
  iconeTipoEvento,
  linkComEvento,
  listarEventos,
  permiteDataFim,
  removerEvento,
  rotuloTipoEvento,
  rotuloTurno,
} from "@/lib/agenda";
import { listarMembrosAtivos } from "@/lib/equipe";
import { obterMeuMembro } from "@/lib/auth";
import type { EventoAgenda, MembroEquipe, NovoEventoAgenda, TipoEventoAgenda, TurnoDia } from "@/lib/types";
import { TelaBase } from "@/components/fluxo-registro";

type Filtro = "todos" | TipoEventoAgenda;

export default function AgendaPage() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [eventos, setEventos] = useState<EventoAgenda[]>([]);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  // Criar/editar/excluir evento (qualquer tipo, inclusive turno) é restrito
  // a coordenação e consultor — a RLS bloqueia de qualquer forma; aqui é só
  // pra não mostrar botão que vai falhar (ver matriz da decisão 2026-08-27).
  const [podeEditar, setPodeEditar] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [formAberto, setFormAberto] = useState(false);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [erroRemover, setErroRemover] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [listaEventos, listaMembros, meuMembro] = await Promise.all([
        listarEventos(),
        listarMembrosAtivos(),
        obterMeuMembro(),
      ]);
      setEventos(listaEventos);
      setMembros(listaMembros);
      setPodeEditar(meuMembro?.papel === "coordenacao" || meuMembro?.papel === "consultor");
    } catch {
      setErro("Não deu pra carregar a agenda agora. Confira a internet e tente de novo.");
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
  }, []);

  const eventosFiltrados = filtro === "todos" ? eventos : eventos.filter((e) => e.tipo === filtro);
  const gruposPorDia = agruparEventosPorDia(eventosFiltrados);
  const dias = Array.from(gruposPorDia.keys()).sort();

  function nomeMembro(id: string | null): string | null {
    if (!id) return null;
    return membros.find((m) => m.id === id)?.nome ?? "membro removido";
  }

  return (
    <TelaBase titulo="Agenda" icone="📅" voltarHref="/patio">
      <Link
        href="/patio/agenda/planejamento-semanal"
        className="mb-3 block w-full rounded-xl border-2 border-[#2e6b3e] bg-[#eaf3ea] py-2.5 text-center text-xs font-bold text-[#2e6b3e]"
      >
        📝 Planejamento semanal
      </Link>

      {carregando && <p className="text-center text-sm text-zinc-600">Carregando…</p>}
      {erro && <p className="text-center text-sm text-red-700">{erro}</p>}

      {!carregando && !erro && (
        <>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            <ChipFiltro rotulo="Todos" ativo={filtro === "todos"} onClick={() => setFiltro("todos")} />
            {TIPOS_EVENTO_AGENDA.map((t) => (
              <ChipFiltro
                key={t.valor}
                rotulo={`${t.icone} ${t.rotulo}`}
                ativo={filtro === t.valor}
                onClick={() => setFiltro(t.valor)}
              />
            ))}
          </div>

          {podeEditar &&
            (!formAberto ? (
              <button
                type="button"
                onClick={() => setFormAberto(true)}
                className="mb-3 w-full rounded-xl border-2 border-dashed border-[#2e6b3e] py-2.5 text-xs font-bold text-[#2e6b3e]"
              >
                + Novo evento
              </button>
            ) : (
              <div className="mb-3">
                <FormEvento
                  membros={membros}
                  onCancelar={() => setFormAberto(false)}
                  onSalvar={async (dados) => {
                    await criarEvento(dados);
                    setFormAberto(false);
                    await carregar();
                  }}
                />
              </div>
            ))}

          <div className="flex flex-col gap-4">
            {dias.map((dia) => (
              <div key={dia}>
                <p className="mb-2 text-xs font-bold text-zinc-500">{formatarDataBR(dia)}</p>
                <div className="flex flex-col gap-2">
                  {(gruposPorDia.get(dia) ?? []).map((evento) => (
                    <CartaoEvento
                      key={evento.id}
                      evento={evento}
                      podeEditar={podeEditar}
                      nomeMembro={nomeMembro(evento.membro_equipe_id)}
                      removendo={removendoId === evento.id}
                      erro={removendoId === evento.id ? erroRemover : null}
                      onPedirRemover={() => {
                        setErroRemover(null);
                        setRemovendoId(evento.id);
                      }}
                      onCancelarRemover={() => {
                        setErroRemover(null);
                        setRemovendoId(null);
                      }}
                      onConfirmarRemover={async () => {
                        setErroRemover(null);
                        try {
                          await removerEvento(evento.id);
                          setRemovendoId(null);
                          await carregar();
                        } catch {
                          setErroRemover("Não deu pra excluir agora. Tente de novo.");
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
            {dias.length === 0 && (
              <p className="text-center text-xs text-zinc-500">Nenhum evento encontrado.</p>
            )}
          </div>
        </>
      )}
    </TelaBase>
  );
}

function ChipFiltro({ rotulo, ativo, onClick }: { rotulo: string; ativo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "shrink-0 rounded-full border-2 px-3 py-1 text-[11px] font-bold whitespace-nowrap",
        ativo ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]" : "border-zinc-300 bg-white text-zinc-600",
      ].join(" ")}
    >
      {rotulo}
    </button>
  );
}

function CartaoEvento({
  evento,
  podeEditar,
  nomeMembro,
  removendo,
  erro,
  onPedirRemover,
  onCancelarRemover,
  onConfirmarRemover,
}: {
  evento: EventoAgenda;
  podeEditar: boolean;
  nomeMembro: string | null;
  removendo: boolean;
  erro: string | null;
  onPedirRemover: () => void;
  onCancelarRemover: () => void;
  onConfirmarRemover: () => Promise<void>;
}) {
  return (
    <div className="rounded-xl border-2 border-zinc-800 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-zinc-900">
            {iconeTipoEvento(evento.tipo)} {evento.titulo}
          </p>
          <p className="text-[11px] text-zinc-500">
            {rotuloTipoEvento(evento.tipo)}
            {evento.turno && ` · ${rotuloTurno(evento.turno)}`}
            {evento.data_fim && evento.data_fim !== evento.data && ` · até ${formatarDataBR(evento.data_fim)}`}
            {nomeMembro && ` · ${nomeMembro}`}
          </p>
        </div>
      </div>

      {evento.descricao && <p className="mt-2 text-xs text-zinc-600">{evento.descricao}</p>}

      {evento.tipo === "atividade" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {LINKS_REGISTRO_ATIVIDADE.map((link) => (
            <Link
              key={link.href}
              href={linkComEvento(link.href, evento.id)}
              className="rounded-full border-2 border-[#2e6b3e] px-3 py-1 text-[11px] font-bold text-[#2e6b3e]"
            >
              {link.icone} {link.rotulo}
            </Link>
          ))}
        </div>
      )}

      {podeEditar &&
        (removendo ? (
          <div className="mt-2 rounded-lg border-2 border-red-300 bg-red-50 p-2">
            <p className="mb-2 text-[11px] text-red-800">Excluir este evento da agenda?</p>
            {erro && <p className="mb-2 text-[11px] font-semibold text-red-800">{erro}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onConfirmarRemover}
                className="flex-1 rounded-lg bg-red-700 py-1.5 text-[11px] font-bold text-white"
              >
                Confirmar exclusão
              </button>
              <button
                type="button"
                onClick={onCancelarRemover}
                className="rounded-lg border-2 border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPedirRemover}
            className="mt-2 text-[11px] font-bold text-red-700 underline"
          >
            excluir
          </button>
        ))}
    </div>
  );
}

function FormEvento({
  membros,
  onSalvar,
  onCancelar,
}: {
  membros: MembroEquipe[];
  onSalvar: (dados: NovoEventoAgenda) => Promise<void>;
  onCancelar: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<TipoEventoAgenda>("atividade");
  const [data, setData] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [turno, setTurno] = useState<TurnoDia | "">("");
  const [membroId, setMembroId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Não usa inicializador preguiçoso com `new Date()`: o Next.js recusa
  // esse valor no prerender de um Client Component — preenche "hoje" só
  // depois de montar (mesmo padrão de Controle de bombonas).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ver comentário acima
    setData(new Date().toISOString().slice(0, 10));
  }, []);

  const precisaMembro = exigeMembro(tipo);
  const podeDataFim = permiteDataFim(tipo);
  const valido = titulo.trim().length > 0 && data.length > 0 && (!precisaMembro || membroId.length > 0);

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({
        titulo,
        descricao: descricao.trim() ? descricao.trim() : null,
        tipo,
        data,
        data_fim: podeDataFim && dataFim ? dataFim : null,
        turno: turno || null,
        membro_equipe_id: membroId || null,
      });
    } catch {
      setErro("Não deu pra salvar agora. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-zinc-400 bg-[#f1efe6] p-3">
      <p className="mb-2 text-xs font-bold text-zinc-800">Novo evento</p>

      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Título
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex.: Mutirão de plantio"
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>

      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Tipo
        <select
          value={tipo}
          onChange={(e) => {
            const novoTipo = e.target.value as TipoEventoAgenda;
            setTipo(novoTipo);
            if (!permiteDataFim(novoTipo)) setDataFim("");
            if (!exigeMembro(novoTipo)) setMembroId("");
          }}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
        >
          {TIPOS_EVENTO_AGENDA.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.icone} {t.rotulo}
            </option>
          ))}
        </select>
      </label>

      <div className="mb-2 flex gap-2">
        <label className="block flex-1 text-[11px] font-semibold text-zinc-600">
          Data
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
          />
        </label>
        {podeDataFim && (
          <label className="block flex-1 text-[11px] font-semibold text-zinc-600">
            Até (opcional)
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
            />
          </label>
        )}
      </div>

      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Turno (opcional)
        <select
          value={turno}
          onChange={(e) => setTurno(e.target.value as TurnoDia | "")}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
        >
          <option value="">sem turno definido</option>
          {TURNOS_DIA.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </label>

      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Pessoa {precisaMembro ? "" : "(opcional — vazio = evento geral da equipe)"}
        <select
          value={membroId}
          onChange={(e) => setMembroId(e.target.value)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
        >
          <option value="">evento geral da equipe</option>
          {membros.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
        Descrição (opcional)
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder='Ex.: "ver tela de Manejo — capina no canteiro 3"'
          className="mt-1 min-h-16 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
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
          {salvando ? "Salvando…" : "Salvar evento"}
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

function formatarDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
