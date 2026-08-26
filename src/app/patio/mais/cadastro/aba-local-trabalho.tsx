"use client";

// Cadastro → aba Local de trabalho: edita o geofence usado por Meu Ponto
// (coordenada + raio em metros). Só existe uma linha em `local_trabalho`
// (seed feito na migration 20260826090000) — esta aba edita essa linha, sem
// criar/excluir. Editável por qualquer pessoa autenticada por enquanto,
// mesma pendência de controle de acesso por papel das demais telas.

import { useEffect, useState } from "react";
import { atualizarLocalTrabalho, buscarLocalTrabalho, obterLocalizacaoAtual } from "@/lib/ponto";
import type { LocalTrabalho } from "@/lib/types";

export function AbaLocalTrabalho() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [local, setLocal] = useState<LocalTrabalho | null>(null);

  const [nome, setNome] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [raio, setRaio] = useState(20);

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [obtendoLocalizacao, setObtendoLocalizacao] = useState(false);
  const [erroLocalizacao, setErroLocalizacao] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await buscarLocalTrabalho();
      setLocal(dados);
      if (dados) {
        setNome(dados.nome);
        setLatitude(String(dados.latitude));
        setLongitude(String(dados.longitude));
        setRaio(dados.raio_metros);
      }
    } catch {
      setErro("Não deu pra carregar o local de trabalho agora. Confira a internet e tente de novo.");
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

  async function usarLocalizacaoAtual() {
    setObtendoLocalizacao(true);
    setErroLocalizacao(null);
    try {
      const coordenada = await obterLocalizacaoAtual();
      setLatitude(String(coordenada.latitude));
      setLongitude(String(coordenada.longitude));
    } catch (e) {
      setErroLocalizacao(e instanceof Error ? e.message : "Não foi possível obter sua localização.");
    } finally {
      setObtendoLocalizacao(false);
    }
  }

  async function salvar() {
    if (!local) return;
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!nome.trim() || Number.isNaN(lat) || Number.isNaN(lon) || raio <= 0) return;

    setSalvando(true);
    setErroSalvar(null);
    setSalvo(false);
    try {
      await atualizarLocalTrabalho(local.id, { nome, latitude: lat, longitude: lon, raio_metros: raio });
      setSalvo(true);
      await carregar();
    } catch {
      setErroSalvar("Não deu pra salvar agora. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p className="text-center text-sm text-zinc-600">Carregando…</p>;
  if (erro) return <p className="text-center text-sm text-red-700">{erro}</p>;

  if (!local) {
    return (
      <p className="text-center text-xs text-zinc-500">
        Nenhum local de trabalho configurado ainda — verifique a migration de setup.
      </p>
    );
  }

  return (
    <div className="rounded-xl border-2 border-zinc-800 bg-white p-3">
      <p className="mb-3 text-[11px] text-zinc-500">
        Coordenada e raio (metros) usados por Meu Ponto pra decidir se alguém está no pátio na hora de bater ponto.
      </p>

      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Nome do local
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>

      <div className="mb-2 flex gap-2">
        <label className="block flex-1 text-[11px] font-semibold text-zinc-600">
          Latitude
          <input
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
          />
        </label>
        <label className="block flex-1 text-[11px] font-semibold text-zinc-600">
          Longitude
          <input
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={obtendoLocalizacao}
        onClick={usarLocalizacaoAtual}
        className="mb-2 w-full rounded-lg border-2 border-dashed border-[#2e6b3e] py-2 text-[11px] font-bold text-[#2e6b3e] disabled:opacity-40"
      >
        {obtendoLocalizacao ? "Obtendo localização…" : "📍 Usar minha localização atual"}
      </button>
      {erroLocalizacao && <p className="mb-2 text-[11px] text-red-700">{erroLocalizacao}</p>}

      <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
        Raio (metros)
        <input
          type="number"
          value={raio}
          onChange={(e) => setRaio(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>

      {erroSalvar && <p className="mb-2 text-[11px] text-red-700">{erroSalvar}</p>}
      {salvo && <p className="mb-2 text-[11px] text-[#2e6b3e]">Salvo!</p>}

      <button
        type="button"
        disabled={salvando}
        onClick={salvar}
        className="w-full rounded-lg bg-[#2e6b3e] py-2 text-xs font-bold text-white disabled:opacity-40"
      >
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
