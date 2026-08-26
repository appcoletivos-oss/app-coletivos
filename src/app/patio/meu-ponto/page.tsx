"use client";

// Meu Ponto
//
// Bater ponto exige geolocalização dentro do raio do pátio (local_trabalho)
// — sem exceção manual, pra entrada e pra saída igualmente. Se a pessoa
// está fora do raio, OU se o GPS falha (permissão negada, timeout, sem
// sinal), o registro é bloqueado com uma mensagem clara — nunca um
// fallback silencioso (decisão de produto, ver Registro Geral).
//
// Sem login implementado ainda, a tela usa um seletor de membro (persistido
// no localStorage do aparelho pra não pedir de novo a cada visita) — mesma
// pendência de controle de acesso das demais telas do app.
//
// Escala da semana e banco de horas são calculados no cliente a partir de
// eventos_agenda (turno_trabalho) e pontos — sem tabela própria de banco de
// horas nesta versão (ver lib/ponto.ts, calcularBancoDeHoras).

import { useEffect, useState } from "react";
import { listarMembrosAtivos } from "@/lib/equipe";
import {
  buscarLocalTrabalho,
  calcularBancoDeHoras,
  calcularDistanciaMetros,
  limitesDaSemana,
  listarPontosDaSemana,
  listarTurnosDaSemana,
  obterLocalizacaoAtual,
  salvarPonto,
  type BancoDeHoras,
} from "@/lib/ponto";
import { rotuloTurno } from "@/lib/agenda";
import { criarFilaOffline } from "@/lib/fila-offline";
import type { EventoAgenda, LocalTrabalho, MembroEquipe, NovoPonto, TipoPonto } from "@/lib/types";
import { TelaBase } from "@/components/fluxo-registro";

const CHAVE_MEMBRO_SELECIONADO = "app-coletivo:meu-ponto-membro-id";

const filaOffline = criarFilaOffline<NovoPonto>("app-coletivo:fila-pontos");

type ResultadoPonto = { tipo: TipoPonto; offline: boolean } | null;

export default function MeuPontoPage() {
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [localTrabalho, setLocalTrabalho] = useState<LocalTrabalho | null>(null);
  const [membroId, setMembroId] = useState("");

  const [turnosDaSemana, setTurnosDaSemana] = useState<EventoAgenda[]>([]);
  const [banco, setBanco] = useState<BancoDeHoras | null>(null);

  const [processando, setProcessando] = useState<TipoPonto | null>(null);
  const [erroPonto, setErroPonto] = useState<string | null>(null);
  const [resultadoPonto, setResultadoPonto] = useState<ResultadoPonto>(null);
  const [pendentesOffline, setPendentesOffline] = useState(() => filaOffline.contar());

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [listaMembros, local] = await Promise.all([listarMembrosAtivos(), buscarLocalTrabalho()]);
        if (cancelado) return;
        setMembros(listaMembros);
        setLocalTrabalho(local);

        const salvo = window.localStorage.getItem(CHAVE_MEMBRO_SELECIONADO);
        if (salvo && listaMembros.some((m) => m.id === salvo)) {
          setMembroId(salvo);
        } else if (listaMembros.length === 1) {
          setMembroId(listaMembros[0].id);
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
  }, []);

  useEffect(() => {
    async function tentarEnviar() {
      const { restantes } = await filaOffline.tentarEnviar(salvarPonto);
      setPendentesOffline(restantes);
    }
    tentarEnviar();
    window.addEventListener("online", tentarEnviar);
    return () => window.removeEventListener("online", tentarEnviar);
  }, []);

  // Não zera turnosDaSemana/banco sincronamente quando `id` está vazio —
  // a exibição condiciona em `membroId` na renderização (ver JSX abaixo),
  // então basta não buscar nada nesse caso. Zerar aqui dispararia
  // setState direto no corpo do efeito (react-hooks/set-state-in-effect).
  async function carregarSemana(id: string) {
    if (!id) return;
    const { inicio, fim } = limitesDaSemana(new Date());
    try {
      const [turnos, pontos] = await Promise.all([
        listarTurnosDaSemana(id, inicio, fim),
        listarPontosDaSemana(id, inicio, fim),
      ]);
      setTurnosDaSemana(turnos);
      setBanco(calcularBancoDeHoras(turnos, pontos));
    } catch {
      setTurnosDaSemana([]);
      setBanco(null);
    }
  }

  useEffect(() => {
    async function executar() {
      await carregarSemana(membroId);
    }
    executar();
  }, [membroId]);

  function selecionarMembro(id: string) {
    setMembroId(id);
    setErroPonto(null);
    setResultadoPonto(null);
    window.localStorage.setItem(CHAVE_MEMBRO_SELECIONADO, id);
  }

  async function baterPonto(tipo: TipoPonto) {
    if (!membroId || !localTrabalho) return;
    setProcessando(tipo);
    setErroPonto(null);
    setResultadoPonto(null);

    try {
      const coordenada = await obterLocalizacaoAtual();
      const distancia = calcularDistanciaMetros(
        coordenada.latitude,
        coordenada.longitude,
        localTrabalho.latitude,
        localTrabalho.longitude,
      );

      if (distancia > localTrabalho.raio_metros) {
        setErroPonto(
          `Você está a ${Math.round(distancia)}m do pátio — o ponto só pode ser batido lá.`,
        );
        return;
      }

      const registro: NovoPonto = {
        membro_equipe_id: membroId,
        tipo,
        horario: new Date().toISOString(),
        latitude: coordenada.latitude,
        longitude: coordenada.longitude,
        distancia_metros: distancia,
      };

      try {
        await salvarPonto(registro);
        setResultadoPonto({ tipo, offline: false });
        await carregarSemana(membroId);
      } catch {
        filaOffline.enfileirar(registro);
        setPendentesOffline(filaOffline.contar());
        setResultadoPonto({ tipo, offline: true });
      }
    } catch (erro) {
      setErroPonto(
        erro instanceof Error
          ? erro.message
          : "Não foi possível confirmar sua localização — verifique se o GPS está ativado.",
      );
    } finally {
      setProcessando(null);
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
      <label className="mb-4 block text-[11px] font-semibold text-zinc-600">
        Quem é você?
        <select
          value={membroId}
          onChange={(e) => selecionarMembro(e.target.value)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
        >
          <option value="">selecione seu nome</option>
          {membros.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </label>

      {pendentesOffline > 0 && (
        <p className="mb-3 rounded-lg border border-dashed border-zinc-400 bg-white px-3 py-2 text-center text-[11px] text-zinc-600">
          📶 {pendentesOffline} ponto(s) esperando internet pra enviar.
        </p>
      )}

      {!localTrabalho && (
        <p className="mb-3 text-center text-xs text-red-700">
          Local de trabalho ainda não configurado (Mais → Cadastro).
        </p>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!membroId || !localTrabalho || processando !== null}
          onClick={() => baterPonto("entrada")}
          className="rounded-xl bg-[#2e6b3e] py-4 text-sm font-bold text-white disabled:opacity-40"
        >
          {processando === "entrada" ? "Confirmando…" : "🟢 Bater entrada"}
        </button>
        <button
          type="button"
          disabled={!membroId || !localTrabalho || processando !== null}
          onClick={() => baterPonto("saida")}
          className="rounded-xl border-2 border-zinc-800 bg-white py-4 text-sm font-bold text-zinc-800 disabled:opacity-40"
        >
          {processando === "saida" ? "Confirmando…" : "🔴 Bater saída"}
        </button>
      </div>

      {erroPonto && (
        <p className="mb-3 rounded-lg border-2 border-red-300 bg-red-50 p-2 text-center text-xs text-red-800">
          {erroPonto}
        </p>
      )}

      {resultadoPonto && (
        <p className="mb-3 rounded-lg border-2 border-[#2e6b3e] bg-[#eaf3ea] p-2 text-center text-xs text-[#2e6b3e]">
          {resultadoPonto.offline
            ? `${resultadoPonto.tipo === "entrada" ? "Entrada" : "Saída"} guardada no celular — envia sozinha quando a internet voltar.`
            : `${resultadoPonto.tipo === "entrada" ? "Entrada" : "Saída"} registrada! ✅`}
        </p>
      )}

      <div className="mb-3 rounded-xl border-2 border-zinc-800 bg-white p-3">
        <p className="mb-2 text-xs font-bold text-zinc-800">Escala da semana</p>
        {!membroId && <p className="text-[11px] text-zinc-500">Selecione seu nome pra ver a escala.</p>}
        {membroId && turnosDaSemana.length === 0 && (
          <p className="text-[11px] text-zinc-500">Nenhum turno de trabalho agendado pra esta semana.</p>
        )}
        {membroId && turnosDaSemana.map((turno) => (
          <div key={turno.id} className="flex justify-between border-b border-dashed border-zinc-200 py-1 last:border-0">
            <span className="text-xs text-zinc-700">{formatarDataBR(turno.data)}</span>
            <span className="text-xs font-semibold text-zinc-900">{rotuloTurno(turno.turno)}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border-2 border-zinc-800 bg-white p-3">
        <p className="mb-2 text-xs font-bold text-zinc-800">Banco de horas (semana atual)</p>
        {!banco || !membroId ? (
          <p className="text-[11px] text-zinc-500">Selecione seu nome pra ver o resumo.</p>
        ) : (
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
        )}
      </div>
    </TelaBase>
  );
}

function formatarHoras(horas: number): string {
  return `${horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
}

function formatarDataBR(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}
