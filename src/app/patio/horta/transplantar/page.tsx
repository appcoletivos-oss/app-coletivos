"use client";

// Horta → Transplantar
//
// Move um plantio pra outro canteiro, com ou sem divisão de lote (ver
// HANDOFF_HORTA_COMPLETO.md, v3, seção 3.5). Se a quantidade informada for
// menor que o saldo disponível do lote de origem, o lote de origem
// continua ativo com o resto; senão (ou se a quantidade ficar em branco =
// "lote inteiro"), o lote de origem vira "transplantado". O lote-filho
// nasce com origem="divisao", ligado ao pai — dá pra reconstruir a
// linhagem completa depois (ver Mapa).

import Link from "next/link";
import { useEffect, useState } from "react";
import { enviarFotoRegistro, listarCanteiros } from "@/lib/patio";
import { iconeTipoCanteiro } from "@/lib/horta";
import { buscarSaldoPlantio, listarPlantiosAtivosPorCanteiro, registrarTransplante } from "@/lib/plantios";
import type { Canteiro, PlantioComCultura } from "@/lib/types";
import { BotaoAvancar, BotaoGrande, LinhaResumo, Passo, PontosPasso, TelaBase } from "@/components/fluxo-registro";

const TOTAL_PASSOS = 6;

export default function TransplantarPage() {
  const [passo, setPasso] = useState(1);

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [canteiros, setCanteiros] = useState<Canteiro[]>([]);

  const [canteiroOrigemId, setCanteiroOrigemId] = useState<string | null>(null);
  const [plantiosOrigem, setPlantiosOrigem] = useState<PlantioComCultura[]>([]);
  const [carregandoPlantios, setCarregandoPlantios] = useState(false);
  const [plantioOrigem, setPlantioOrigem] = useState<PlantioComCultura | null>(null);
  const [saldo, setSaldo] = useState<number | null>(null);

  const [canteiroDestinoId, setCanteiroDestinoId] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");

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

  async function escolherCanteiroOrigem(id: string) {
    setCanteiroOrigemId(id);
    setCarregandoPlantios(true);
    try {
      const lista = await listarPlantiosAtivosPorCanteiro(id);
      setPlantiosOrigem(lista.filter((p) => p.status === "ativo"));
      irPara(2);
    } catch {
      setErroCarregamento("Não deu pra carregar os plantios desse canteiro agora.");
    } finally {
      setCarregandoPlantios(false);
    }
  }

  async function escolherPlantioOrigem(p: PlantioComCultura) {
    setPlantioOrigem(p);
    setSaldo(await buscarSaldoPlantio(p.id).catch(() => null));
    irPara(3);
  }

  function irPara(novoPasso: number) {
    setPasso(Math.min(Math.max(novoPasso, 1), TOTAL_PASSOS));
  }

  function selecionarFoto(arquivo: File | null) {
    setFoto(arquivo);
    setFotoPreview((antigo) => {
      if (antigo) URL.revokeObjectURL(antigo);
      return arquivo ? URL.createObjectURL(arquivo) : null;
    });
  }

  const canteiroOrigem = canteiros.find((c) => c.id === canteiroOrigemId);
  const canteiroDestino = canteiros.find((c) => c.id === canteiroDestinoId);

  async function salvar() {
    if (!plantioOrigem || !canteiroDestinoId) return;
    setSalvando(true);
    setErroSalvar(null);

    let fotoUrl: string | null = null;
    if (foto) {
      try {
        fotoUrl = await enviarFotoRegistro(foto, "transplante");
      } catch {
        fotoUrl = null;
      }
    }

    try {
      await registrarTransplante({
        plantioOrigem,
        canteiroDestinoId,
        quantidade: quantidade.trim() ? Number(quantidade) : null,
        observacao: observacao.trim() || null,
        fotoUrl,
      });
      setResultado("ok");
    } catch {
      setErroSalvar("Não deu pra salvar agora. Confira a internet e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  function recomecar() {
    setPasso(1);
    setCanteiroOrigemId(null);
    setPlantiosOrigem([]);
    setPlantioOrigem(null);
    setSaldo(null);
    setCanteiroDestinoId(null);
    setQuantidade("");
    selecionarFoto(null);
    setObservacao("");
    setResultado(null);
    setErroSalvar(null);
  }

  if (carregando) {
    return (
      <TelaBase titulo="Transplantar" icone="🔀" voltarHref="/patio/horta">
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (erroCarregamento) {
    return (
      <TelaBase titulo="Transplantar" icone="🔀" voltarHref="/patio/horta">
        <p className="text-center text-sm text-red-700">{erroCarregamento}</p>
      </TelaBase>
    );
  }

  if (resultado) {
    return (
      <TelaBase titulo="Transplantar" icone="🔀" voltarHref="/patio/horta">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2e6b3e] text-2xl text-white">
            ✅
          </span>
          <p className="text-base font-semibold text-zinc-900">Transplante registrado!</p>
          <p className="max-w-xs text-sm text-zinc-600">
            Novo lote criado em {canteiroDestino?.nome ?? "—"}, ligado ao lote de origem.
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <button
              type="button"
              onClick={recomecar}
              className="rounded-full bg-[#2e6b3e] px-6 py-3 text-sm font-semibold text-white"
            >
              Registrar outro transplante
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
    <TelaBase titulo="Transplantar" icone="🔀" voltarHref="/patio/horta">
      <PontosPasso passo={passo} total={TOTAL_PASSOS} />

      {passo === 1 && (
        <Passo titulo="De qual canteiro?">
          <div className="grid grid-cols-2 gap-3">
            {canteiros.map((c) => (
              <BotaoGrande
                key={c.id}
                icone={iconeTipoCanteiro(c.tipo)}
                rotulo={c.nome}
                selecionado={c.id === canteiroOrigemId}
                onClick={() => escolherCanteiroOrigem(c.id)}
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
              {plantiosOrigem.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => escolherPlantioOrigem(p)}
                  className={[
                    "rounded-lg border-2 px-3 py-2 text-left",
                    p.id === plantioOrigem?.id
                      ? "border-[#2e6b3e] bg-[#eaf3ea]"
                      : "border-zinc-300 bg-white",
                  ].join(" ")}
                >
                  <span className="block text-sm font-bold text-zinc-900">{p.cultura_nome}</span>
                  <span className="block text-[11px] text-zinc-500">
                    {p.quantidade_germinada ?? p.quantidade_inicial ?? "—"} {p.unidade ?? ""}
                  </span>
                </button>
              ))}
              {plantiosOrigem.length === 0 && (
                <p className="text-center text-xs text-zinc-500">
                  Nenhum plantio ativo nesse canteiro pra transplantar.
                </p>
              )}
            </div>
          )}
        </Passo>
      )}

      {passo === 3 && (
        <Passo titulo="Para qual canteiro?">
          <div className="grid grid-cols-2 gap-3">
            {canteiros.map((c) => (
              <BotaoGrande
                key={c.id}
                icone={iconeTipoCanteiro(c.tipo)}
                rotulo={c.nome}
                selecionado={c.id === canteiroDestinoId}
                onClick={() => {
                  setCanteiroDestinoId(c.id);
                  irPara(4);
                }}
              />
            ))}
          </div>
        </Passo>
      )}

      {passo === 4 && (
        <Passo titulo="Quanto foi transplantado?">
          <p className="mb-3 text-center text-[11px] text-zinc-500">
            {saldo !== null
              ? `Saldo disponível no lote de origem: ${saldo} ${plantioOrigem?.unidade ?? ""}`.trim()
              : "Saldo do lote de origem não disponível."}
            {" — deixe em branco pra transplantar o lote inteiro."}
          </p>
          <input
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            inputMode="decimal"
            placeholder="Ex.: 8 (em branco = lote inteiro)"
            className="w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
          />
          <BotaoAvancar onClick={() => irPara(5)} />
        </Passo>
      )}

      {passo === 5 && (
        <Passo titulo="Foto e observação (opcionais)">
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-zinc-800 bg-[#f1efe6] p-6 text-center">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => selecionarFoto(e.target.files?.[0] ?? null)}
            />
            {fotoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoPreview} alt="Prévia da foto" className="mx-auto max-h-32 rounded-lg" />
            ) : (
              <span className="text-sm font-bold text-zinc-800">📷 Tirar foto</span>
            )}
          </label>

          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder='Ex.: "dividi em 3 vasos"...'
            className="mt-4 min-h-24 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
          />

          <BotaoAvancar onClick={() => irPara(6)} />
        </Passo>
      )}

      {passo === 6 && (
        <Passo titulo="Confere antes de salvar">
          <div className="rounded-xl border-2 border-zinc-800 bg-white p-3 text-sm">
            <LinhaResumo rotulo="De" valor={canteiroOrigem?.nome ?? "—"} onEditar={() => irPara(1)} />
            <LinhaResumo rotulo="Plantio" valor={plantioOrigem?.cultura_nome ?? "—"} onEditar={() => irPara(2)} />
            <LinhaResumo rotulo="Para" valor={canteiroDestino?.nome ?? "—"} onEditar={() => irPara(3)} />
            <LinhaResumo
              rotulo="Quantidade"
              valor={quantidade.trim() ? quantidade : "lote inteiro"}
              onEditar={() => irPara(4)}
            />
            <LinhaResumo rotulo="Foto" valor={foto ? "1 anexada" : "sem foto"} onEditar={() => irPara(5)} ultima />
          </div>

          {erroSalvar && <p className="mt-3 text-center text-xs text-red-700">{erroSalvar}</p>}

          <button
            type="button"
            disabled={salvando}
            onClick={salvar}
            className="mt-4 w-full rounded-xl border-2 border-[#2e6b3e] bg-[#eaf3ea] py-3 text-sm font-bold text-[#2e6b3e] disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "✅ Salvar transplante"}
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
