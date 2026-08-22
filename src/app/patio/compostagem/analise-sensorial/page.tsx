"use client";

// Compostagem → Análise sensorial
//
// Registro qualitativo por caixa: visão, olfato e tato, cada um em texto
// livre e opcional. Fluxo de 5 passos, uma pergunta por tela — mesmo
// espírito de Registrar compostagem/colheita. "Quem registrou" e "data"
// nunca são perguntados: vêm da sessão de login e do relógio do aparelho.
//
// Decisão de produto (2026-08-22): sem gravação de áudio nesta primeira
// versão, mesmo com parte da equipe tendo baixo letramento (o que
// dificulta escrever) — texto livre foi o que deu pra fazer nesta rodada.
// Gravação de áudio (ou transcrição por voz) fica registrada aqui como
// melhoria futura possível, não descartada.

import Link from "next/link";
import { useEffect, useState } from "react";
import { listarCaixas, rotuloStatusCaixa, salvarRegistroAnaliseSensorial } from "@/lib/patio";
import { criarFilaOffline } from "@/lib/fila-offline";
import type { Caixa, NovoRegistroAnaliseSensorial } from "@/lib/types";
import { IconeCaixaDagua } from "@/components/icone-caixa-dagua";
import {
  BotaoAvancar,
  LinhaResumo,
  Passo,
  PontosPasso,
  TelaBase,
} from "@/components/fluxo-registro";

const TOTAL_PASSOS = 5;

const filaOffline = criarFilaOffline<NovoRegistroAnaliseSensorial>(
  "app-coletivo:fila-registros-analise-sensorial",
);

export default function AnaliseSensorialPage() {
  const [passo, setPasso] = useState(1);

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [caixas, setCaixas] = useState<Caixa[]>([]);

  const [caixaId, setCaixaId] = useState<string | null>(null);
  const [visao, setVisao] = useState("");
  const [olfato, setOlfato] = useState("");
  const [tato, setTato] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"ok" | "offline" | null>(null);
  const [pendentesOffline, setPendentesOffline] = useState(() => filaOffline.contar());

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        const lista = await listarCaixas();
        if (!cancelado) setCaixas(lista);
      } catch {
        if (!cancelado) {
          setErroCarregamento(
            "Não deu pra carregar as caixas agora. Confira a internet e tente de novo.",
          );
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    async function tentarEnviar() {
      const { restantes } = await filaOffline.tentarEnviar(salvarRegistroAnaliseSensorial);
      setPendentesOffline(restantes);
    }
    tentarEnviar();
    window.addEventListener("online", tentarEnviar);
    return () => window.removeEventListener("online", tentarEnviar);
  }, []);

  function irPara(novoPasso: number) {
    setPasso(Math.min(Math.max(novoPasso, 1), TOTAL_PASSOS));
  }

  async function salvar() {
    if (!caixaId) return;
    setSalvando(true);
    setErroSalvar(null);

    const registro: NovoRegistroAnaliseSensorial = {
      caixa_id: caixaId,
      visao: visao.trim() ? visao.trim() : null,
      olfato: olfato.trim() ? olfato.trim() : null,
      tato: tato.trim() ? tato.trim() : null,
    };

    try {
      await salvarRegistroAnaliseSensorial(registro);
      setResultado("ok");
    } catch {
      filaOffline.enfileirar(registro);
      setPendentesOffline(filaOffline.contar());
      setResultado("offline");
    } finally {
      setSalvando(false);
    }
  }

  function recomecar() {
    setPasso(1);
    setCaixaId(null);
    setVisao("");
    setOlfato("");
    setTato("");
    setResultado(null);
    setErroSalvar(null);
  }

  const caixaSelecionada = caixas.find((c) => c.id === caixaId);

  if (carregando) {
    return (
      <TelaBase titulo="Análise sensorial" icone="👃" voltarHref="/patio/compostagem">
        <p className="text-center text-sm text-zinc-600">Carregando caixas…</p>
      </TelaBase>
    );
  }

  if (erroCarregamento) {
    return (
      <TelaBase titulo="Análise sensorial" icone="👃" voltarHref="/patio/compostagem">
        <p className="text-center text-sm text-red-700">{erroCarregamento}</p>
      </TelaBase>
    );
  }

  if (resultado) {
    return (
      <TelaBase titulo="Análise sensorial" icone="👃" voltarHref="/patio/compostagem">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2e6b3e] text-2xl text-white">
            {resultado === "ok" ? "✅" : "📶"}
          </span>
          <p className="text-base font-semibold text-zinc-900">
            {resultado === "ok"
              ? "Registro salvo!"
              : "Sem internet agora — guardado no celular"}
          </p>
          <p className="max-w-xs text-sm text-zinc-600">
            {resultado === "ok"
              ? "Análise sensorial salva com sucesso."
              : "Assim que a conexão voltar, este registro é enviado sozinho. Não precisa fazer nada."}
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <button
              type="button"
              onClick={recomecar}
              className="rounded-full bg-[#2e6b3e] px-6 py-3 text-sm font-semibold text-white"
            >
              Registrar outra análise
            </button>
            <Link
              href="/patio/compostagem"
              className="rounded-full border-2 border-[#2e6b3e] px-6 py-3 text-sm font-semibold text-[#2e6b3e]"
            >
              Voltar pra Compostagem
            </Link>
          </div>
        </div>
      </TelaBase>
    );
  }

  return (
    <TelaBase titulo="Análise sensorial" icone="👃" voltarHref="/patio/compostagem">
      <BarraContexto caixa={caixaSelecionada} passo={passo} />
      <PontosPasso passo={passo} total={TOTAL_PASSOS} />

      {pendentesOffline > 0 && (
        <p className="mb-3 rounded-lg border border-dashed border-zinc-400 bg-white px-3 py-2 text-center text-[11px] text-zinc-600">
          📶 {pendentesOffline} registro(s) esperando internet pra enviar.
        </p>
      )}

      {passo === 1 && (
        <Passo titulo="Qual caixa?">
          <div className="grid grid-cols-6 gap-2">
            {caixas.map((c) => {
              const desabilitada = c.status !== "ativa";
              const rotuloStatus = rotuloStatusCaixa(c.status);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={desabilitada}
                  title={rotuloStatus ?? undefined}
                  onClick={() => {
                    setCaixaId(c.id);
                    irPara(2);
                  }}
                  className={[
                    "rounded-lg border-2 py-2 text-xs font-bold",
                    desabilitada
                      ? "border-dashed border-zinc-300 text-zinc-300"
                      : c.id === caixaId
                        ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]"
                        : "border-zinc-800 bg-white text-zinc-800",
                  ].join(" ")}
                >
                  {c.numero}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[11px] text-zinc-500">
            Caixas apagadas ainda não estão em uso (não ativadas ou aguardando estrutura).
          </p>
        </Passo>
      )}

      {passo === 2 && (
        <Passo titulo="O que você vê na caixa?">
          <textarea
            autoFocus
            value={visao}
            onChange={(e) => setVisao(e.target.value)}
            placeholder='Ex.: "escuro, bem decomposto, sem pedaço grande"...'
            className="min-h-24 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
          />
          <div className="mt-4 flex flex-col gap-2">
            <BotaoAvancar onClick={() => irPara(3)} texto="Continuar" />
            <button
              type="button"
              onClick={() => {
                setVisao("");
                irPara(3);
              }}
              className="mx-auto text-[11px] text-zinc-400 underline"
            >
              pular, sem resposta
            </button>
          </div>
        </Passo>
      )}

      {passo === 3 && (
        <Passo titulo="Que cheiro tem?">
          <textarea
            autoFocus
            value={olfato}
            onChange={(e) => setOlfato(e.target.value)}
            placeholder='Ex.: "cheiro de terra, sem mau odor"...'
            className="min-h-24 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
          />
          <div className="mt-4 flex flex-col gap-2">
            <BotaoAvancar onClick={() => irPara(4)} texto="Continuar" />
            <button
              type="button"
              onClick={() => {
                setOlfato("");
                irPara(4);
              }}
              className="mx-auto text-[11px] text-zinc-400 underline"
            >
              pular, sem resposta
            </button>
          </div>
        </Passo>
      )}

      {passo === 4 && (
        <Passo titulo="Como está ao toque?">
          <textarea
            autoFocus
            value={tato}
            onChange={(e) => setTato(e.target.value)}
            placeholder='Ex.: "fofo, esfarela fácil na mão"...'
            className="min-h-24 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
          />
          <div className="mt-4 flex flex-col gap-2">
            <BotaoAvancar onClick={() => irPara(5)} texto="Continuar" />
            <button
              type="button"
              onClick={() => {
                setTato("");
                irPara(5);
              }}
              className="mx-auto text-[11px] text-zinc-400 underline"
            >
              pular, sem resposta
            </button>
          </div>
        </Passo>
      )}

      {passo === 5 && (
        <Passo titulo="Confere antes de salvar">
          <div className="rounded-xl border-2 border-zinc-800 bg-white p-3 text-sm">
            <LinhaResumo rotulo="Caixa" valor={caixaSelecionada ? `Caixa ${caixaSelecionada.numero}` : "—"} onEditar={() => irPara(1)} />
            <LinhaResumo rotulo="Visão" valor={visao.trim() || "sem resposta"} onEditar={() => irPara(2)} />
            <LinhaResumo rotulo="Olfato" valor={olfato.trim() || "sem resposta"} onEditar={() => irPara(3)} />
            <LinhaResumo rotulo="Tato" valor={tato.trim() || "sem resposta"} onEditar={() => irPara(4)} ultima />
          </div>

          {erroSalvar && <p className="mt-3 text-center text-xs text-red-700">{erroSalvar}</p>}

          <button
            type="button"
            disabled={salvando}
            onClick={salvar}
            className="mt-4 w-full rounded-xl border-2 border-[#2e6b3e] bg-[#eaf3ea] py-3 text-sm font-bold text-[#2e6b3e] disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "✅ Salvar registro"}
          </button>
          <p className="mt-2 text-center text-[10px] text-zinc-500">
            📶 Sem internet agora? Sem problema — fica guardado no celular e envia sozinho quando voltar o sinal.
          </p>
        </Passo>
      )}

      {passo > 1 && !resultado && (
        <button
          type="button"
          onClick={() => irPara(passo - 1)}
          className="mt-4 block w-full text-center text-xs text-zinc-500 underline"
        >
          voltar
        </button>
      )}
    </TelaBase>
  );
}

function BarraContexto({ caixa, passo }: { caixa?: Caixa; passo: number }) {
  if (passo === 1 || !caixa) return null;
  return (
    <div className="mb-2 flex justify-between rounded-lg border border-zinc-300 bg-[#f1efe6] px-3 py-1 text-[11px] text-zinc-600">
      <span className="inline-flex items-center gap-1">
        <IconeCaixaDagua /> Caixa {caixa.numero}
      </span>
    </div>
  );
}
