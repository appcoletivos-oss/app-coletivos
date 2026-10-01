"use client";

// Horta → Registrar perda
//
// Perda de mudas/produção de um plantio específico, sempre amarrada a
// plantio_id (nunca só a um canteiro) — ver HANDOFF_HORTA_COMPLETO.md
// (v3), seção 3.7. Fluxo curto: canteiro → plantio → quantidade/motivo →
// confirmar. Não fecha o plantio sozinho — se a perda for total, quem
// registra fecha o plantio manualmente pelo Mapa ("marcar encerrado").

import Link from "next/link";
import { useEffect, useState } from "react";
import { enviarFotoRegistro, listarCanteiros, salvarFotosExtras } from "@/lib/patio";
import { iconeTipoCanteiro } from "@/lib/horta";
import { listarPlantiosAtivosPorCanteiro, registrarPerda } from "@/lib/plantios";
import type { Canteiro, NovoRegistroPerda, PlantioComCultura } from "@/lib/types";
import {
  BotaoAvancar,
  BotaoGrande,
  LinhaResumo,
  Passo,
  PontosPasso,
  SeletorFotos,
  TelaBase,
} from "@/components/fluxo-registro";

const TOTAL_PASSOS = 4;

export default function RegistrarPerdaPage() {
  const [passo, setPasso] = useState(1);

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [canteiros, setCanteiros] = useState<Canteiro[]>([]);

  const [canteiroId, setCanteiroId] = useState<string | null>(null);
  const [plantios, setPlantios] = useState<PlantioComCultura[]>([]);
  const [carregandoPlantios, setCarregandoPlantios] = useState(false);
  const [plantioId, setPlantioId] = useState<string | null>(null);

  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"ok" | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        const lista = await listarCanteiros();
        if (!cancelado) setCanteiros(lista);
      } catch {
        if (!cancelado) {
          setErroCarregamento("Não deu pra carregar os canteiros agora. Confira a internet e tente de novo.");
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

  function irPara(novoPasso: number) {
    setPasso(Math.min(Math.max(novoPasso, 1), TOTAL_PASSOS));
  }

  async function escolherCanteiro(id: string) {
    setCanteiroId(id);
    setPlantioId(null);
    setCarregandoPlantios(true);
    try {
      setPlantios(await listarPlantiosAtivosPorCanteiro(id));
      irPara(2);
    } catch {
      setErroCarregamento("Não deu pra carregar os plantios desse canteiro agora.");
    } finally {
      setCarregandoPlantios(false);
    }
  }

  const canteiroSelecionado = canteiros.find((c) => c.id === canteiroId);
  const plantioSelecionado = plantios.find((p) => p.id === plantioId);

  async function salvar() {
    if (!plantioId) return;
    setSalvando(true);
    setErroSalvar(null);

    let fotoUrl: string | null = null;
    if (fotos[0]) {
      try {
        fotoUrl = await enviarFotoRegistro(fotos[0], "perda");
      } catch {
        fotoUrl = null;
      }
    }

    const registro: NovoRegistroPerda = {
      plantio_id: plantioId,
      quantidade: quantidade.trim() ? Number(quantidade) : null,
      unidade: unidade.trim() || null,
      motivo: motivo.trim() || null,
      foto_url: fotoUrl,
    };

    try {
      const perda = await registrarPerda(registro);
      if (fotos.length > 1) {
        try {
          const extras = await Promise.all(fotos.slice(1).map((f) => enviarFotoRegistro(f, "perda")));
          await salvarFotosExtras("registros_perdas", perda.id, extras);
        } catch {
          // segue sem as extras — a capa já foi salva com o registro.
        }
      }
      setResultado("ok");
    } catch {
      setErroSalvar("Não deu pra salvar agora. Confira a internet e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  function recomecar() {
    setPasso(1);
    setCanteiroId(null);
    setPlantios([]);
    setPlantioId(null);
    setQuantidade("");
    setUnidade("");
    setMotivo("");
    setFotos([]);
    setResultado(null);
    setErroSalvar(null);
  }

  if (carregando) {
    return (
      <TelaBase titulo="Registrar perda" icone="📉" voltarHref="/patio/horta">
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (erroCarregamento) {
    return (
      <TelaBase titulo="Registrar perda" icone="📉" voltarHref="/patio/horta">
        <p className="text-center text-sm text-red-700">{erroCarregamento}</p>
      </TelaBase>
    );
  }

  if (resultado) {
    return (
      <TelaBase titulo="Registrar perda" icone="📉" voltarHref="/patio/horta">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2e6b3e] text-2xl text-white">
            ✅
          </span>
          <p className="text-base font-semibold text-zinc-900">Perda registrada!</p>
          <div className="mt-2 flex flex-col gap-3">
            <button
              type="button"
              onClick={recomecar}
              className="rounded-full bg-[#2e6b3e] px-6 py-3 text-sm font-semibold text-white"
            >
              Registrar outra perda
            </button>
            <Link
              href="/patio/horta"
              className="rounded-full border-2 border-[#2e6b3e] px-6 py-3 text-sm font-semibold text-[#2e6b3e]"
            >
              Voltar pra Horta
            </Link>
          </div>
        </div>
      </TelaBase>
    );
  }

  return (
    <TelaBase titulo="Registrar perda" icone="📉" voltarHref="/patio/horta">
      <PontosPasso passo={passo} total={TOTAL_PASSOS} />

      {passo === 1 && (
        <Passo titulo="Qual canteiro?">
          <div className="grid grid-cols-2 gap-3">
            {canteiros.map((c) => (
              <BotaoGrande
                key={c.id}
                icone={iconeTipoCanteiro(c.tipo)}
                rotulo={c.nome}
                selecionado={c.id === canteiroId}
                onClick={() => escolherCanteiro(c.id)}
              />
            ))}
          </div>
        </Passo>
      )}

      {passo === 2 && (
        <Passo titulo="Qual plantio?">
          {carregandoPlantios ? (
            <p className="text-center text-sm text-zinc-600">Carregando…</p>
          ) : (
            <div className="flex flex-col gap-2">
              {plantios.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPlantioId(p.id);
                    irPara(3);
                  }}
                  className={[
                    "rounded-lg border-2 px-3 py-2 text-left text-sm font-semibold",
                    p.id === plantioId ? "border-[#2e6b3e] bg-[#eaf3ea]" : "border-zinc-300 bg-white",
                  ].join(" ")}
                >
                  {p.cultura_nome}
                </button>
              ))}
              {plantios.length === 0 && (
                <p className="text-center text-xs text-zinc-500">Nenhum plantio nesse canteiro.</p>
              )}
            </div>
          )}
        </Passo>
      )}

      {passo === 3 && (
        <Passo titulo="Quanto se perdeu?">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="block text-[11px] font-semibold text-zinc-600">
              Quantidade (opcional)
              <input
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
              />
            </label>
            <label className="block text-[11px] font-semibold text-zinc-600">
              Unidade
              <input
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                placeholder="Ex.: mudas"
                className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
              />
            </label>
          </div>
          <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
            Motivo (opcional)
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder='Ex.: "praga", "sol forte", "geada"...'
              className="mt-1 min-h-20 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
            />
          </label>
          <SeletorFotos fotos={fotos} onMudar={setFotos} />

          <BotaoAvancar onClick={() => irPara(4)} />
        </Passo>
      )}

      {passo === 4 && (
        <Passo titulo="Confere antes de salvar">
          <div className="rounded-xl border-2 border-zinc-800 bg-white p-3 text-sm">
            <LinhaResumo rotulo="Canteiro" valor={canteiroSelecionado?.nome ?? "—"} onEditar={() => irPara(1)} />
            <LinhaResumo rotulo="Plantio" valor={plantioSelecionado?.cultura_nome ?? "—"} onEditar={() => irPara(2)} />
            <LinhaResumo
              rotulo="Quantidade"
              valor={quantidade.trim() ? `${quantidade} ${unidade.trim()}`.trim() : "não informada"}
              onEditar={() => irPara(3)}
            />
            <LinhaResumo rotulo="Motivo" valor={motivo.trim() || "não informado"} onEditar={() => irPara(3)} ultima />
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
