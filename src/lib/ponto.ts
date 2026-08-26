// Funções de acesso a dados de Meu Ponto: geofence (local_trabalho),
// geolocalização do navegador, registro de entrada/saída (pontos) e cálculo
// de banco de horas (derivado — sem tabela própria, ver Registro Geral).
// Mesmo padrão de patio.ts/horta.ts: centraliza as chamadas ao Supabase.

import { garantirSessaoAnonima, supabase } from "./supabase";
import type { EventoAgenda, LocalTrabalho, NovoPonto, Ponto } from "./types";

// -----------------------------------------------------------------------------
// Local de trabalho (geofence)
// -----------------------------------------------------------------------------

export async function buscarLocalTrabalho(): Promise<LocalTrabalho | null> {
  await garantirSessaoAnonima();
  const { data, error } = await supabase
    .from("local_trabalho")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function atualizarLocalTrabalho(
  id: string,
  dados: { nome: string; latitude: number; longitude: number; raio_metros: number },
): Promise<void> {
  await garantirSessaoAnonima();
  const { error } = await supabase
    .from("local_trabalho")
    .update({
      nome: dados.nome.trim(),
      latitude: dados.latitude,
      longitude: dados.longitude,
      raio_metros: dados.raio_metros,
    })
    .eq("id", id);

  if (error) throw error;
}

// Fórmula de Haversine: distância em linha reta (metros) entre duas
// coordenadas — precisão suficiente pra um raio de dezenas de metros como
// o do pátio, sem precisar de nenhuma biblioteca de geolocalização.
const RAIO_TERRA_METROS = 6371000;

export function calcularDistanciaMetros(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const paraRad = (graus: number) => (graus * Math.PI) / 180;
  const deltaLat = paraRad(latitude2 - latitude1);
  const deltaLon = paraRad(longitude2 - longitude1);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(paraRad(latitude1)) * Math.cos(paraRad(latitude2)) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return RAIO_TERRA_METROS * c;
}

// -----------------------------------------------------------------------------
// Geolocalização do navegador — funciona offline (não depende de rede).
// Falha em obter GPS (permissão negada, timeout, sem sinal) é tratada como
// bloqueio no fluxo de bater ponto, igual a estar fora do raio — nunca um
// fallback manual (decisão de produto, ver Registro Geral).
// -----------------------------------------------------------------------------

export interface CoordenadaAtual {
  latitude: number;
  longitude: number;
}

export function obterLocalizacaoAtual(): Promise<CoordenadaAtual> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocalização não disponível neste aparelho."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        resolve({ latitude: posicao.coords.latitude, longitude: posicao.coords.longitude });
      },
      () => {
        reject(
          new Error(
            "Não foi possível confirmar sua localização — verifique se o GPS está ativado.",
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

// -----------------------------------------------------------------------------
// Registro de ponto
// -----------------------------------------------------------------------------

export async function salvarPonto(registro: NovoPonto): Promise<void> {
  await garantirSessaoAnonima();
  const { error } = await supabase.from("pontos").insert(registro);
  if (error) throw error;
}

export async function listarPontosDaSemana(
  membroEquipeId: string,
  inicioSemanaISO: string,
  fimSemanaISO: string,
): Promise<Ponto[]> {
  await garantirSessaoAnonima();
  const { data, error } = await supabase
    .from("pontos")
    .select("*")
    .eq("membro_equipe_id", membroEquipeId)
    .gte("horario", `${inicioSemanaISO}T00:00:00`)
    .lte("horario", `${fimSemanaISO}T23:59:59.999`)
    .order("horario", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listarTurnosDaSemana(
  membroEquipeId: string,
  inicioSemanaISO: string,
  fimSemanaISO: string,
): Promise<EventoAgenda[]> {
  await garantirSessaoAnonima();
  const { data, error } = await supabase
    .from("eventos_agenda")
    .select("*")
    .eq("membro_equipe_id", membroEquipeId)
    .eq("tipo", "turno_trabalho")
    .gte("data", inicioSemanaISO)
    .lte("data", fimSemanaISO)
    .order("data", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// -----------------------------------------------------------------------------
// Semana (segunda a domingo) e banco de horas
// -----------------------------------------------------------------------------

export function limitesDaSemana(referencia: Date): { inicio: string; fim: string } {
  const diaSemana = referencia.getDay(); // 0 (domingo) .. 6 (sábado)
  const deslocamentoSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;

  const segunda = new Date(referencia);
  segunda.setHours(0, 0, 0, 0);
  segunda.setDate(segunda.getDate() + deslocamentoSegunda);

  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);

  return { inicio: paraDataISO(segunda), fim: paraDataISO(domingo) };
}

function paraDataISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

const HORAS_POR_TURNO = 3;

export interface BancoDeHoras {
  esperadoHoras: number;
  realizadoHoras: number;
  saldoHoras: number;
}

// Pareia entrada/saída em ordem cronológica pra somar horas trabalhadas. Um
// par incompleto (ex.: pessoa esqueceu de bater a saída) não soma nada até
// aparecer uma saída depois dele — não há correção manual nesta versão.
export function calcularHorasRealizadas(pontosDaSemana: Ponto[]): number {
  const ordenados = [...pontosDaSemana].sort((a, b) => a.horario.localeCompare(b.horario));

  let totalMs = 0;
  let entradaAberta: string | null = null;

  for (const ponto of ordenados) {
    if (ponto.tipo === "entrada") {
      entradaAberta = ponto.horario;
    } else if (ponto.tipo === "saida" && entradaAberta) {
      totalMs += new Date(ponto.horario).getTime() - new Date(entradaAberta).getTime();
      entradaAberta = null;
    }
  }

  return totalMs / (1000 * 60 * 60);
}

export function calcularBancoDeHoras(
  turnosDaSemana: EventoAgenda[],
  pontosDaSemana: Ponto[],
): BancoDeHoras {
  const esperadoHoras = turnosDaSemana.length * HORAS_POR_TURNO;
  const realizadoHoras = calcularHorasRealizadas(pontosDaSemana);
  return { esperadoHoras, realizadoHoras, saldoHoras: realizadoHoras - esperadoHoras };
}
