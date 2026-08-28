"use client";

// Horta → Registrar plantio
//
// Primeiro passo do rastreio ponta a ponta (ver HANDOFF_HORTA_COMPLETO.md,
// v3): cria um lote (`plantios`) com origem (semente/muda comprada/estaca/
// já existente), canteiro, cultura e quantidade. Se origem = semente, o
// lote entra como "germinando" (precisa confirmar germinação depois, ver
// /patio/horta/confirmar-germinacao); as demais entram direto "ativo".
//
// "Quem registrou" e "data de início" nunca são perguntados — vêm da
// sessão de login e do relógio do aparelho (mesmo espírito de Registrar
// colheita/Manejo). previsão de colheita é calculada na hora, copiando o
// dado da ficha de cultura (memória histórica — se a ficha mudar depois,
// este plantio não muda).

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listarCanteiros } from "@/lib/patio";
import { iconeTipoCanteiro } from "@/lib/horta";
import { listarCulturasAtivas } from "@/lib/culturas";
import { calcularPrevisaoColheita, criarPlantio } from "@/lib/plantios";
import type { Canteiro, Cultura, OrigemPlantio } from "@/lib/types";
import { BotaoAvancar, BotaoGrande, LinhaResumo, Passo, PontosPasso, TelaBase } from "@/components/fluxo-registro";

const TOTAL_PASSOS = 5;

const ORIGENS: { valor: OrigemPlantio; icone: string; rotulo: string }[] = [
  { valor: "semente", icone: "🌱", rotulo: "Semente" },
  { valor: "muda_comprada", icone: "🛒", rotulo: "Muda comprada" },
  { valor: "estaca", icone: "🌿", rotulo: "Estaca" },
  { valor: "ja_existente", icone: "🌳", rotulo: "Já existente" },
];

export default function RegistrarPlantioPage() {
  const [passo, setPasso] = useState(1);

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [canteiros, setCanteiros] = useState<Canteiro[]>([]);
  const [culturas, setCulturas] = useState<Cultura[]>([]);
  const [buscaCultura, setBuscaCultura] = useState("");

  const [canteiroId, setCanteiroId] = useState<string | null>(null);
  const [culturaId, setCulturaId] = useState<string | null>(null);
  const [origem, setOrigem] = useState<OrigemPlantio | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"ok" | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        const [listaCanteiros, listaCulturas] = await Promise.all([
          listarCanteiros(),
          listarCulturasAtivas(),
        ]);
        if (!cancelado) {
          setCanteiros(listaCanteiros);
          setCulturas(listaCulturas);
        }
      } catch {
        if (!cancelado) {
          setErroCarregamento(
            "Não deu pra carregar canteiros/culturas agora. Confira a internet e tente de novo.",
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

  function irPara(novoPasso: number) {
    setPasso(Math.min(Math.max(novoPasso, 1), TOTAL_PASSOS));
  }

  const canteiroSelecionado = canteiros.find((c) => c.id === canteiroId);
  const culturaSelecionada = culturas.find((c) => c.id === culturaId);
  const origemSelecionada = ORIGENS.find((o) => o.valor === origem);

  const culturasFiltradas = useMemo(() => {
    const alvo = buscaCultura.trim().toLowerCase();
    if (!alvo) return culturas;
    return culturas.filter((c) => c.nome.toLowerCase().includes(alvo));
  }, [culturas, buscaCultura]);

  async function salvar() {
    if (!canteiroId || !culturaId || !origem || !culturaSelecionada) return;
    setSalvando(true);
    setErroSalvar(null);

    const hoje = new Date().toISOString().slice(0, 10);
    const { snapshot, previsao } = calcularPrevisaoColheita(
      culturaSelecionada.dias_para_colheita,
      hoje,
    );

    try {
      await criarPlantio({
        cultura_id: culturaId,
        canteiro_id: canteiroId,
        origem,
        data_inicio: hoje,
        quantidade_inicial: quantidade.trim() ? Number(quantidade) : null,
        unidade: unidade.trim() || null,
        dias_para_colheita_snapshot: snapshot,
        previsao_colheita: previsao,
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
    setCanteiroId(null);
    setCulturaId(null);
    setBuscaCultura("");
    setOrigem(null);
    setQuantidade("");
    setUnidade("");
    setResultado(null);
    setErroSalvar(null);
  }

  if (carregando) {
    return (
      <TelaBase titulo="Registrar plantio" icone="🌱" voltarHref="/patio/horta">
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (erroCarregamento) {
    return (
      <TelaBase titulo="Registrar plantio" icone="🌱" voltarHref="/patio/horta">
        <p className="text-center text-sm text-red-700">{erroCarregamento}</p>
      </TelaBase>
    );
  }

  if (resultado) {
    return (
      <TelaBase titulo="Registrar plantio" icone="🌱" voltarHref="/patio/horta">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2e6b3e] text-2xl text-white">
            ✅
          </span>
          <p className="text-base font-semibold text-zinc-900">Plantio registrado!</p>
          <p className="max-w-xs text-sm text-zinc-600">
            {origem === "semente"
              ? "Lote criado como \"germinando\" — confirme a germinação assim que der (Horta → Confirmar germinação)."
              : "Lote criado e ativo no canteiro escolhido."}
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <button
              type="button"
              onClick={recomecar}
              className="rounded-full bg-[#2e6b3e] px-6 py-3 text-sm font-semibold text-white"
            >
              Registrar outro plantio
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
    <TelaBase titulo="Registrar plantio" icone="🌱" voltarHref="/patio/horta">
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
                onClick={() => {
                  setCanteiroId(c.id);
                  irPara(2);
                }}
              />
            ))}
          </div>
          {canteiros.length === 0 && (
            <p className="text-center text-sm text-zinc-600">
              Nenhum canteiro cadastrado ainda. Cadastre pelo menos um canteiro (Mais → Cadastro) pra continuar.
            </p>
          )}
        </Passo>
      )}

      {passo === 2 && (
        <Passo titulo="Qual cultura?">
          <input
            autoFocus
            value={buscaCultura}
            onChange={(e) => setBuscaCultura(e.target.value)}
            placeholder="🔎 Buscar cultura…"
            className="mb-3 w-full rounded-lg border-2 border-zinc-300 p-2.5 text-sm"
          />
          <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {culturasFiltradas.map((cu) => (
              <button
                key={cu.id}
                type="button"
                onClick={() => {
                  setCulturaId(cu.id);
                  irPara(3);
                }}
                className={[
                  "rounded-lg border-2 px-3 py-2 text-left text-sm font-semibold",
                  cu.id === culturaId
                    ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]"
                    : "border-zinc-300 bg-white text-zinc-800",
                ].join(" ")}
              >
                {cu.nome}
              </button>
            ))}
            {culturasFiltradas.length === 0 && (
              <p className="text-center text-xs text-zinc-500">
                Nenhuma cultura encontrada. Cadastre pela tela Mais → Cadastro → Culturas.
              </p>
            )}
          </div>
        </Passo>
      )}

      {passo === 3 && (
        <Passo titulo="Qual a origem do plantio?">
          <div className="grid grid-cols-2 gap-3">
            {ORIGENS.map((o) => (
              <BotaoGrande
                key={o.valor}
                icone={o.icone}
                rotulo={o.rotulo}
                selecionado={o.valor === origem}
                onClick={() => {
                  setOrigem(o.valor);
                  irPara(4);
                }}
              />
            ))}
          </div>
        </Passo>
      )}

      {passo === 4 && (
        <Passo titulo="Quantidade (opcional)">
          <p className="mb-3 text-center text-[11px] text-zinc-500">
            {origem === "ja_existente"
              ? "Planta que já existia antes do sistema — pode deixar em branco se não souber."
              : "Ex.: 50 sementes, 12 mudas, 6 estacas…"}
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="block text-[11px] font-semibold text-zinc-600">
              Quantidade
              <input
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                inputMode="decimal"
                placeholder="—"
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
          <BotaoAvancar onClick={() => irPara(5)} />
        </Passo>
      )}

      {passo === 5 && (
        <Passo titulo="Confere antes de salvar">
          <div className="rounded-xl border-2 border-zinc-800 bg-white p-3 text-sm">
            <LinhaResumo rotulo="Canteiro" valor={canteiroSelecionado?.nome ?? "—"} onEditar={() => irPara(1)} />
            <LinhaResumo rotulo="Cultura" valor={culturaSelecionada?.nome ?? "—"} onEditar={() => irPara(2)} />
            <LinhaResumo rotulo="Origem" valor={origemSelecionada?.rotulo ?? "—"} onEditar={() => irPara(3)} />
            <LinhaResumo
              rotulo="Quantidade"
              valor={quantidade.trim() ? `${quantidade} ${unidade.trim() || ""}`.trim() : "não informada"}
              onEditar={() => irPara(4)}
              ultima
            />
          </div>

          {erroSalvar && <p className="mt-3 text-center text-xs text-red-700">{erroSalvar}</p>}

          <button
            type="button"
            disabled={salvando}
            onClick={salvar}
            className="mt-4 w-full rounded-xl border-2 border-[#2e6b3e] bg-[#eaf3ea] py-3 text-sm font-bold text-[#2e6b3e] disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "✅ Salvar plantio"}
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
