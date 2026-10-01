"use client";

// Meu Ponto
//
// Bater ponto exige geolocalização dentro do raio do pátio (local_trabalho)
// — sem exceção manual, pra entrada e pra saída igualmente. Se a pessoa
// está fora do raio, OU se o GPS falha (permissão negada, timeout, sem
// sinal), o registro é bloqueado com uma mensagem clara — nunca um
// fallback silencioso (decisão de produto, ver Registro Geral).
//
// Desde a Leva 1 (2026-08-27) a pessoa é identificada pela sessão real (não
// mais por um seletor "Quem é você?"). Por papel (ver matriz da decisão):
//   - equipe:      bate o próprio ponto, vê a própria escala/banco de horas
//                  (a RLS de `pontos` já esconde o de terceiros);
//   - coordenação: bate o próprio ponto E vê o de todo mundo;
//   - consultor:   não bate ponto, mas vê o de todo mundo.
//
// Escala da semana e banco de horas são calculados no cliente a partir de
// eventos_agenda (turno_trabalho) e pontos — sem tabela própria de banco de
// horas nesta versão (ver lib/ponto.ts, calcularBancoDeHoras).

import { useCallback, useEffect, useState } from "react";
import { obterMeuMembro } from "@/lib/auth";
import { listarMembrosAtivos } from "@/lib/equipe";
import {
  buscarLocalTrabalho,
  calcularBancoDeHoras,
  calcularDistanciaMetros,
  decidirPonto,
  limitesDaSemana,
  listarPontosDaSemana,
  listarPontosPendentes,
  listarTurnosDaSemana,
  obterLocalizacaoAtual,
  salvarPonto,
  type BancoDeHoras,
  type CoordenadaAtual,
} from "@/lib/ponto";
import { rotuloTurno } from "@/lib/agenda";
import { criarFilaOffline } from "@/lib/fila-offline";
import type { EventoAgenda, LocalTrabalho, MembroEquipe, NovoPonto, Ponto, TipoPonto } from "@/lib/types";
import { TelaBase } from "@/components/fluxo-registro";

const filaOffline = criarFilaOffline<NovoPonto>("app-coletivo:fila-pontos");

type ResultadoPonto = { tipo: TipoPonto; offline: boolean } | null;

interface ResumoMembro {
  membro: MembroEquipe;
  turnos: EventoAgenda[];
  banco: BancoDeHoras;
}

export default function MeuPontoPage() {
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [meuMembro, setMeuMembro] = useState<MembroEquipe | null>(null);
  const [localTrabalho, setLocalTrabalho] = useState<LocalTrabalho | null>(null);

  const [meuResumo, setMeuResumo] = useState<ResumoMembro | null>(null);
  const [resumoEquipe, setResumoEquipe] = useState<ResumoMembro[]>([]);

  const [processando, setProcessando] = useState<TipoPonto | null>(null);
  const [resultadoPonto, setResultadoPonto] = useState<ResultadoPonto>(null);
  const [pendentesOffline, setPendentesOffline] = useState(() => filaOffline.contar());

  // Ponto fora do raio OU GPS indisponível/timeout (Etapa 1, item 7): em
  // vez de bloquear, guarda aqui os dados já obtidos enquanto espera a
  // justificativa, antes de confirmar o envio como pendente de aprovação.
  // coordenada/distancia ficam null no caso de GPS indisponível — a tela
  // distingue as duas mensagens, mas o fluxo de confirmação é o mesmo.
  const [foraDoRaioPendente, setForaDoRaioPendente] = useState<{
    tipo: TipoPonto;
    coordenada: CoordenadaAtual | null;
    distancia: number | null;
  } | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [enviandoForaDoRaio, setEnviandoForaDoRaio] = useState(false);

  // Aprovação de pontos fora do raio — só carregado/mostrado pra
  // coordenação/consultor.
  const [pontosPendentes, setPontosPendentes] = useState<Ponto[]>([]);
  const [decidindoPontoId, setDecidindoPontoId] = useState<string | null>(null);

  const papel = meuMembro?.papel ?? null;
  const podeBaterPonto = papel === "coordenacao" || papel === "equipe";
  const podeVerTodos = papel === "coordenacao" || papel === "consultor";

  const carregarResumoDe = useCallback(
    async (membro: MembroEquipe): Promise<ResumoMembro> => {
      const { inicio, fim } = limitesDaSemana(new Date());
      const [turnos, pontos] = await Promise.all([
        listarTurnosDaSemana(membro.id, inicio, fim),
        listarPontosDaSemana(membro.id, inicio, fim),
      ]);
      return { membro, turnos, banco: calcularBancoDeHoras(turnos, pontos) };
    },
    [],
  );

  const recarregarResumos = useCallback(
    async (membro: MembroEquipe, verTodos: boolean) => {
      try {
        setMeuResumo(await carregarResumoDe(membro));
        if (verTodos) {
          const membros = await listarMembrosAtivos();
          setResumoEquipe(await Promise.all(membros.map((m) => carregarResumoDe(m))));
        }
      } catch {
        // silencioso: a seção só não mostra o resumo. Bater ponto continua ok.
      }
    },
    [carregarResumoDe],
  );

  async function recarregarPendentes(verTodos: boolean) {
    if (!verTodos) return;
    try {
      setPontosPendentes(await listarPontosPendentes());
    } catch {
      // silencioso: a seção de aprovação só não aparece preenchida.
    }
  }

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [membro, local] = await Promise.all([obterMeuMembro(), buscarLocalTrabalho()]);
        if (cancelado) return;
        setMeuMembro(membro);
        setLocalTrabalho(local);
        if (membro) {
          const verTodos = membro.papel === "coordenacao" || membro.papel === "consultor";
          await Promise.all([recarregarResumos(membro, verTodos), recarregarPendentes(verTodos)]);
        }
      } catch {
        if (!cancelado) {
          setErroCarregamento("Não deu pra carregar os dados agora. Confira a internet e tente de novo.");
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [recarregarResumos]);

  useEffect(() => {
    async function tentarEnviar() {
      const { restantes } = await filaOffline.tentarEnviar(salvarPonto);
      setPendentesOffline(restantes);
    }
    tentarEnviar();
    window.addEventListener("online", tentarEnviar);
    return () => window.removeEventListener("online", tentarEnviar);
  }, []);

  // Salva o registro (online ou na fila offline) e atualiza os resumos —
  // compartilhado entre o caminho normal (dentro do raio) e a confirmação
  // de "bater fora do pátio" (ver confirmarForaDoRaio).
  async function salvarEAtualizar(registro: NovoPonto, tipo: TipoPonto) {
    if (!meuMembro) return;
    try {
      await salvarPonto(registro);
      setResultadoPonto({ tipo, offline: false });
      await recarregarResumos(meuMembro, podeVerTodos);
    } catch {
      filaOffline.enfileirar(registro);
      setPendentesOffline(filaOffline.contar());
      setResultadoPonto({ tipo, offline: true });
    }
  }

  async function baterPonto(tipo: TipoPonto) {
    if (!meuMembro || !localTrabalho) return;
    setProcessando(tipo);
    setResultadoPonto(null);
    setForaDoRaioPendente(null);

    try {
      const coordenada = await obterLocalizacaoAtual();
      const distancia = calcularDistanciaMetros(
        coordenada.latitude,
        coordenada.longitude,
        localTrabalho.latitude,
        localTrabalho.longitude,
      );

      if (distancia > localTrabalho.raio_metros) {
        // Etapa 1, item 7: fora do raio não bloqueia mais — oferece bater
        // mesmo assim, com justificativa obrigatória, pendente de
        // aprovação da coordenação/consultor.
        setJustificativa("");
        setForaDoRaioPendente({ tipo, coordenada, distancia });
        return;
      }

      const registro: NovoPonto = {
        membro_equipe_id: meuMembro.id,
        tipo,
        horario: new Date().toISOString(),
        latitude: coordenada.latitude,
        longitude: coordenada.longitude,
        distancia_metros: distancia,
      };
      await salvarEAtualizar(registro, tipo);
    } catch {
      // GPS indisponível/timeout (SQL de 01/10 — latitude/longitude/
      // distancia_metros aceitam null): mesmo caminho de "bater fora do
      // pátio" do caso acima, só que sem coordenada nenhuma pra mostrar.
      setJustificativa("");
      setForaDoRaioPendente({ tipo, coordenada: null, distancia: null });
    } finally {
      setProcessando(null);
    }
  }

  async function confirmarForaDoRaio() {
    if (!meuMembro || !foraDoRaioPendente || !justificativa.trim()) return;
    const { tipo, coordenada, distancia } = foraDoRaioPendente;
    setEnviandoForaDoRaio(true);

    const registro: NovoPonto = {
      membro_equipe_id: meuMembro.id,
      tipo,
      horario: new Date().toISOString(),
      latitude: coordenada?.latitude ?? null,
      longitude: coordenada?.longitude ?? null,
      distancia_metros: distancia,
      fora_do_raio: true,
      justificativa: justificativa.trim(),
      status_aprovacao: "pendente",
    };

    await salvarEAtualizar(registro, tipo);
    await recarregarPendentes(podeVerTodos);
    setForaDoRaioPendente(null);
    setJustificativa("");
    setEnviandoForaDoRaio(false);
  }

  async function decidir(id: string, aprovado: boolean) {
    setDecidindoPontoId(id);
    try {
      await decidirPonto(id, aprovado);
      await recarregarPendentes(true);
    } finally {
      setDecidindoPontoId(null);
    }
  }

  if (carregando) {
    return (
      <TelaBase titulo="Meu Ponto" icone="⏰" voltarHref="/patio">
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (erroCarregamento) {
    return (
      <TelaBase titulo="Meu Ponto" icone="⏰" voltarHref="/patio">
        <p className="text-center text-sm text-red-700">{erroCarregamento}</p>
      </TelaBase>
    );
  }

  return (
    <TelaBase titulo="Meu Ponto" icone="⏰" voltarHref="/patio">
      {pendentesOffline > 0 && (
        <p className="mb-3 rounded-lg border border-dashed border-zinc-400 bg-white px-3 py-2 text-center text-[11px] text-zinc-600">
          📶 {pendentesOffline} ponto(s) esperando internet pra enviar.
        </p>
      )}

      {podeBaterPonto && (
        <>
          {!localTrabalho && (
            <p className="mb-3 text-center text-xs text-red-700">
              Local de trabalho ainda não configurado (Mais → Cadastro).
            </p>
          )}

          <div className="mb-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!localTrabalho || processando !== null}
              onClick={() => baterPonto("entrada")}
              className="rounded-xl bg-[#2e6b3e] py-4 text-sm font-bold text-white disabled:opacity-40"
            >
              {processando === "entrada" ? "Confirmando…" : "🟢 Bater entrada"}
            </button>
            <button
              type="button"
              disabled={!localTrabalho || processando !== null}
              onClick={() => baterPonto("saida")}
              className="rounded-xl border-2 border-zinc-800 bg-white py-4 text-sm font-bold text-zinc-800 disabled:opacity-40"
            >
              {processando === "saida" ? "Confirmando…" : "🔴 Bater saída"}
            </button>
          </div>

          {foraDoRaioPendente && (
            <div className="mb-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-3">
              <p className="mb-2 text-xs font-bold text-amber-900">
                {foraDoRaioPendente.coordenada && foraDoRaioPendente.distancia !== null
                  ? `Você está a ${Math.round(foraDoRaioPendente.distancia)}m do pátio — fora do raio.`
                  : "Não foi possível confirmar sua localização (GPS indisponível ou demorou demais pra responder)."}
              </p>
              <p className="mb-2 text-[11px] text-amber-800">
                Pode bater mesmo assim, com uma justificativa. O registro fica pendente de aprovação
                da coordenação.
              </p>
              <textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder='Ex.: "cheguei direto de outra atividade, sem passar pelo pátio"...'
                className="mb-2 min-h-16 w-full rounded-lg border-2 border-amber-300 bg-white p-2 text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!justificativa.trim() || enviandoForaDoRaio}
                  onClick={confirmarForaDoRaio}
                  className="flex-1 rounded-lg bg-amber-600 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  {enviandoForaDoRaio ? "Enviando…" : "Bater mesmo assim"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForaDoRaioPendente(null);
                    setJustificativa("");
                  }}
                  className="rounded-lg border-2 border-amber-300 px-3 py-2 text-xs font-bold text-amber-800"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {resultadoPonto && (
            <p className="mb-3 rounded-lg border-2 border-[#2e6b3e] bg-[#eaf3ea] p-2 text-center text-xs text-[#2e6b3e]">
              {resultadoPonto.offline
                ? `${resultadoPonto.tipo === "entrada" ? "Entrada" : "Saída"} guardada no celular — envia sozinha quando a internet voltar.`
                : `${resultadoPonto.tipo === "entrada" ? "Entrada" : "Saída"} registrada! ✅`}
            </p>
          )}
        </>
      )}

      {!podeBaterPonto && (
        <p className="mb-3 rounded-lg border border-dashed border-zinc-400 bg-[#f1efe6] px-3 py-2 text-center text-[11px] text-zinc-600">
          Consultoria não bate ponto — abaixo, o ponto da equipe.
        </p>
      )}

      {podeVerTodos && pontosPendentes.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold text-zinc-800">
            ⏳ Pontos fora do pátio — aguardando aprovação
          </p>
          <div className="flex flex-col gap-2">
            {pontosPendentes.map((p) => (
              <CartaoPontoPendente
                key={p.id}
                ponto={p}
                nomeMembro={resumoEquipe.find((r) => r.membro.id === p.membro_equipe_id)?.membro.nome ?? "—"}
                decidindo={decidindoPontoId === p.id}
                onDecidir={(aprovado) => decidir(p.id, aprovado)}
              />
            ))}
          </div>
        </div>
      )}

      {podeVerTodos ? (
        <div className="flex flex-col gap-3">
          {resumoEquipe.length === 0 && (
            <p className="text-center text-xs text-zinc-500">Nenhum membro ativo pra mostrar.</p>
          )}
          {resumoEquipe.map((r) => (
            <CartaoResumo key={r.membro.id} resumo={r} titulo={r.membro.nome} />
          ))}
        </div>
      ) : (
        meuResumo && <CartaoResumo resumo={meuResumo} titulo="Sua semana" mostrarEscala />
      )}
    </TelaBase>
  );
}

function CartaoPontoPendente({
  ponto,
  nomeMembro,
  decidindo,
  onDecidir,
}: {
  ponto: Ponto;
  nomeMembro: string;
  decidindo: boolean;
  onDecidir: (aprovado: boolean) => void;
}) {
  return (
    <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-900">{nomeMembro}</span>
        <span className="text-[11px] font-semibold text-zinc-600">
          {ponto.tipo === "entrada" ? "🟢 entrada" : "🔴 saída"} · {new Date(ponto.horario).toLocaleString("pt-BR")}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-zinc-600">
        {ponto.distancia_metros !== null ? `${Math.round(ponto.distancia_metros)}m do pátio` : "Sem GPS — localização não confirmada"}
      </p>
      {ponto.justificativa && <p className="mt-1 text-[11px] italic text-zinc-700">“{ponto.justificativa}”</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={decidindo}
          onClick={() => onDecidir(true)}
          className="flex-1 rounded-lg bg-[#2e6b3e] py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
        >
          ✅ Aprovar
        </button>
        <button
          type="button"
          disabled={decidindo}
          onClick={() => onDecidir(false)}
          className="flex-1 rounded-lg border-2 border-red-300 py-1.5 text-[11px] font-bold text-red-700 disabled:opacity-40"
        >
          ❌ Rejeitar
        </button>
      </div>
    </div>
  );
}

function CartaoResumo({
  resumo,
  titulo,
  mostrarEscala = false,
}: {
  resumo: ResumoMembro;
  titulo: string;
  mostrarEscala?: boolean;
}) {
  const { turnos, banco } = resumo;
  return (
    <div className="rounded-xl border-2 border-zinc-800 bg-white p-3">
      <p className="mb-2 text-xs font-bold text-zinc-800">{titulo}</p>

      {mostrarEscala && (
        <div className="mb-3">
          <p className="mb-1 text-[11px] font-semibold text-zinc-500">Escala da semana</p>
          {turnos.length === 0 ? (
            <p className="text-[11px] text-zinc-500">Nenhum turno agendado pra esta semana.</p>
          ) : (
            turnos.map((turno) => (
              <div
                key={turno.id}
                className="flex justify-between border-b border-dashed border-zinc-200 py-1 last:border-0"
              >
                <span className="text-xs text-zinc-700">{formatarDataBR(turno.data)}</span>
                <span className="text-xs font-semibold text-zinc-900">{rotuloTurno(turno.turno)}</span>
              </div>
            ))
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-[#f1efe6] py-2">
          <p className="text-sm font-bold text-zinc-900">{formatarHoras(banco.esperadoHoras)}</p>
          <p className="text-[10px] text-zinc-500">esperado</p>
        </div>
        <div className="rounded-lg bg-[#f1efe6] py-2">
          <p className="text-sm font-bold text-zinc-900">{formatarHoras(banco.realizadoHoras)}</p>
          <p className="text-[10px] text-zinc-500">realizado</p>
        </div>
        <div className={`rounded-lg py-2 ${banco.saldoHoras >= 0 ? "bg-[#eaf3ea]" : "bg-red-50"}`}>
          <p className={`text-sm font-bold ${banco.saldoHoras >= 0 ? "text-[#2e6b3e]" : "text-red-700"}`}>
            {banco.saldoHoras >= 0 ? "+" : ""}
            {formatarHoras(banco.saldoHoras)}
          </p>
          <p className="text-[10px] text-zinc-500">saldo</p>
        </div>
      </div>
    </div>
  );
}

function formatarHoras(horas: number): string {
  return `${horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
}

function formatarDataBR(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}
