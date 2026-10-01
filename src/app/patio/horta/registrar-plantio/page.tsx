"use client";

// Horta → Registrar plantio
//
// Primeiro passo do rastreio ponta a ponta (ver HANDOFF_HORTA_COMPLETO.md,
// v3): cria um lote (`plantios`) com origem (semente/muda comprada/estaca/
// já existente), canteiro, cultura e quantidade. Se origem = semente, o
// lote entra como "germinando" (precisa confirmar germinação depois, ver
// /patio/horta/confirmar-germinacao); as demais entram direto "ativo".
//
// Sprint A, item 1 (SPRINT_A_REGISTRO_SIMPLIFICADO_ETAPA2.md, seção 5):
// plantio em consórcio — 1 canteiro + N linhas de (cultura, origem,
// quantidade, unidade), todas com o mesmo canteiro_id/data_inicio. Cada
// linha segue as mesmas regras de sempre (reaproveitadas de
// lib/plantios.ts, construirLinhaPlantio); salvar grava as N linhas de uma
// vez com criarPlantios (um único insert com array — transacional).
//
// "Quem registrou" e "data de início" nunca são perguntados — vêm da
// sessão de login e do relógio do aparelho (mesmo espírito de Registrar
// colheita/Manejo). previsão de colheita é calculada na hora, copiando o
// dado da ficha de cultura (memória histórica — se a ficha mudar depois,
// este plantio não muda).

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { listarCanteiros } from "@/lib/patio";
import { iconeTipoCanteiro } from "@/lib/horta";
import { listarCulturasAtivas } from "@/lib/culturas";
import { calcularPrevisaoColheita, criarPlantios } from "@/lib/plantios";
import { vincularPlantiosAoItem } from "@/lib/relatorio-turno";
import type { Canteiro, Cultura, NovoPlantio, OrigemPlantio } from "@/lib/types";
import { BotaoAvancar, LinhaResumo, Passo, PontosPasso, TelaBase } from "@/components/fluxo-registro";

const TOTAL_PASSOS = 3;

const ORIGENS: { valor: OrigemPlantio; icone: string; rotulo: string }[] = [
  { valor: "semente", icone: "🌱", rotulo: "Semente" },
  { valor: "muda_comprada", icone: "🛒", rotulo: "Muda comprada" },
  { valor: "estaca", icone: "🌿", rotulo: "Estaca" },
  { valor: "ja_existente", icone: "🌳", rotulo: "Já existente" },
];

// Uma linha do consórcio — cada uma vira um lote próprio em `plantios`.
// `chave` é só identidade de UI (key do React / índice do picker de
// cultura), não é coluna de nada.
interface LinhaConsorcio {
  chave: string;
  culturaId: string | null;
  origem: OrigemPlantio | null;
  quantidade: string;
  unidade: string;
}

function linhaVazia(): LinhaConsorcio {
  return { chave: crypto.randomUUID(), culturaId: null, origem: null, quantidade: "", unidade: "" };
}

// useSearchParams exige um limite de Suspense em volta (regra do Next.js
// pra Client Components) — por isso o export default vira só um wrapper,
// ver RegistrarPlantioPage no fim do arquivo.
function RegistrarPlantioConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Preenchidos quando a tela é aberta a partir do Relatório do Turno
  // (Sprint A, item 6, tipo_registro=canteiro → Plantio) — ver
  // lib/relatorio-turno.ts, hrefSubFormulario. Consórcio pode criar N
  // lotes de uma vez: o primeiro vincula ao item de origem, os demais
  // ganham um item irmão cada (decisão do Thiago, 01/10/2026 — ver
  // vincularPlantiosAoItem).
  const relatorioItemId = searchParams.get("relatorio_item");
  const voltarHref = searchParams.get("voltar");

  const [passo, setPasso] = useState(1);

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [canteiros, setCanteiros] = useState<Canteiro[]>([]);
  const [culturas, setCulturas] = useState<Cultura[]>([]);
  const [buscaCultura, setBuscaCultura] = useState("");

  const [canteiroId, setCanteiroId] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaConsorcio[]>([linhaVazia()]);
  // Chave da linha cujo seletor de cultura está aberto — null = mostra a
  // lista de linhas em vez do picker.
  const [escolhendoCulturaDe, setEscolhendoCulturaDe] = useState<string | null>(null);

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

  function atualizarLinha(chave: string, patch: Partial<LinhaConsorcio>) {
    setLinhas((atual) => atual.map((l) => (l.chave === chave ? { ...l, ...patch } : l)));
  }

  function adicionarLinha() {
    setLinhas((atual) => [...atual, linhaVazia()]);
  }

  function removerLinha(chave: string) {
    setLinhas((atual) => (atual.length <= 1 ? atual : atual.filter((l) => l.chave !== chave)));
  }

  const canteiroSelecionado = canteiros.find((c) => c.id === canteiroId);
  const culturasFiltradas = useMemo(() => {
    const alvo = buscaCultura.trim().toLowerCase();
    if (!alvo) return culturas;
    return culturas.filter((c) => c.nome.toLowerCase().includes(alvo));
  }, [culturas, buscaCultura]);

  const linhasCompletas = linhas.every((l) => l.culturaId && l.origem);

  async function salvar() {
    if (!canteiroId || !linhasCompletas) return;
    setSalvando(true);
    setErroSalvar(null);

    const hoje = new Date().toISOString().slice(0, 10);

    const dadosLinhas: NovoPlantio[] = linhas.map((l) => {
      const cultura = culturas.find((c) => c.id === l.culturaId);
      const { snapshot, previsao } = calcularPrevisaoColheita(cultura?.dias_para_colheita ?? null, hoje);
      return {
        cultura_id: l.culturaId as string,
        canteiro_id: canteiroId,
        origem: l.origem as OrigemPlantio,
        data_inicio: hoje,
        quantidade_inicial: l.quantidade.trim() ? Number(l.quantidade) : null,
        unidade: l.unidade.trim() || null,
        dias_para_colheita_snapshot: snapshot,
        previsao_colheita: previsao,
      };
    });

    try {
      const criados = await criarPlantios(dadosLinhas);

      // Aberta a partir do Relatório do Turno (Sprint A, item 6): vincula
      // o primeiro plantio ao item de origem e cria um item irmão pra
      // cada um dos demais (consórcio pode gerar N lotes de uma vez —
      // ver vincularPlantiosAoItem) — e volta pro relatório em vez da
      // tela de sucesso daqui.
      if (relatorioItemId && criados.length > 0) {
        try {
          await vincularPlantiosAoItem(relatorioItemId, criados.map((p) => p.id));
        } catch {
          // segue sem o vínculo — os plantios já estão salvos.
        }
        if (voltarHref) {
          router.push(decodeURIComponent(voltarHref));
          return;
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
    setLinhas([linhaVazia()]);
    setEscolhendoCulturaDe(null);
    setBuscaCultura("");
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
    const algumaSemente = linhas.some((l) => l.origem === "semente");
    return (
      <TelaBase titulo="Registrar plantio" icone="🌱" voltarHref="/patio/horta">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2e6b3e] text-2xl text-white">
            ✅
          </span>
          <p className="text-base font-semibold text-zinc-900">
            {linhas.length > 1 ? `${linhas.length} plantios registrados!` : "Plantio registrado!"}
          </p>
          <p className="max-w-xs text-sm text-zinc-600">
            {algumaSemente
              ? "Quem veio de semente entrou como \"germinando\" — confirme a germinação assim que der (Horta → Confirmar germinação)."
              : "Lote(s) criado(s) e ativo(s) no canteiro escolhido."}
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

  // Picker de cultura pra uma linha específica — sub-tela do passo 2, não
  // conta como passo próprio (PontosPasso continua mostrando o passo 2).
  if (escolhendoCulturaDe) {
    return (
      <TelaBase titulo="Registrar plantio" icone="🌱" voltarHref="/patio/horta">
        <PontosPasso passo={2} total={TOTAL_PASSOS} />
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
                  atualizarLinha(escolhendoCulturaDe, { culturaId: cu.id });
                  setEscolhendoCulturaDe(null);
                  setBuscaCultura("");
                }}
                className="rounded-lg border-2 border-zinc-300 bg-white px-3 py-2 text-left text-sm font-semibold text-zinc-800"
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
          <button
            type="button"
            onClick={() => {
              setEscolhendoCulturaDe(null);
              setBuscaCultura("");
            }}
            className="mt-4 block w-full text-center text-xs text-zinc-500 underline"
          >
            cancelar
          </button>
        </Passo>
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
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCanteiroId(c.id);
                  irPara(2);
                }}
                className={[
                  "rounded-xl border-2 py-4 text-center text-xs font-bold",
                  c.id === canteiroId
                    ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]"
                    : "border-zinc-800 bg-white text-zinc-800",
                ].join(" ")}
              >
                <span className="mb-1 block text-2xl">{iconeTipoCanteiro(c.tipo)}</span>
                {c.nome}
              </button>
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
        <Passo titulo="O que vai ser plantado?">
          <p className="mb-3 text-center text-[11px] text-zinc-500">
            Mais de uma cultura no mesmo canteiro (consórcio)? Adicione uma linha pra cada.
          </p>
          <div className="flex flex-col gap-3">
            {linhas.map((l, indice) => {
              const cultura = culturas.find((c) => c.id === l.culturaId);
              return (
                <div key={l.chave} className="rounded-xl border-2 border-zinc-800 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-500">Planta {indice + 1}</span>
                    {linhas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerLinha(l.chave)}
                        className="text-[11px] font-bold text-red-700"
                        aria-label={`Remover planta ${indice + 1}`}
                      >
                        ✕ remover
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setEscolhendoCulturaDe(l.chave)}
                    className={[
                      "mb-2 w-full rounded-lg border-2 px-3 py-2 text-left text-sm font-semibold",
                      cultura ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]" : "border-zinc-300 bg-white text-zinc-500",
                    ].join(" ")}
                  >
                    {cultura ? cultura.nome : "Escolher cultura…"}
                  </button>

                  <div className="mb-2 grid grid-cols-4 gap-1.5">
                    {ORIGENS.map((o) => (
                      <button
                        key={o.valor}
                        type="button"
                        onClick={() => atualizarLinha(l.chave, { origem: o.valor })}
                        title={o.rotulo}
                        className={[
                          "rounded-lg border-2 py-2 text-center text-[10px] font-bold",
                          l.origem === o.valor
                            ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]"
                            : "border-zinc-300 bg-white text-zinc-600",
                        ].join(" ")}
                      >
                        <span className="mb-0.5 block text-base">{o.icone}</span>
                        {o.rotulo}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[11px] font-semibold text-zinc-600">
                      Quantidade
                      <input
                        value={l.quantidade}
                        onChange={(e) => atualizarLinha(l.chave, { quantidade: e.target.value })}
                        inputMode="decimal"
                        placeholder="—"
                        className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
                      />
                    </label>
                    <label className="block text-[11px] font-semibold text-zinc-600">
                      Unidade
                      <input
                        value={l.unidade}
                        onChange={(e) => atualizarLinha(l.chave, { unidade: e.target.value })}
                        placeholder="Ex.: mudas"
                        className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={adicionarLinha}
            className="mt-3 w-full rounded-xl border-2 border-dashed border-[#2e6b3e] py-2.5 text-xs font-bold text-[#2e6b3e]"
          >
            + outra planta
          </button>

          <BotaoAvancar onClick={() => irPara(3)} desabilitado={!linhasCompletas} />
        </Passo>
      )}

      {passo === 3 && (
        <Passo titulo="Confere antes de salvar">
          <div className="rounded-xl border-2 border-zinc-800 bg-white p-3 text-sm">
            <LinhaResumo rotulo="Canteiro" valor={canteiroSelecionado?.nome ?? "—"} onEditar={() => irPara(1)} />
            {linhas.map((l, indice) => {
              const cultura = culturas.find((c) => c.id === l.culturaId);
              const origemRotulo = ORIGENS.find((o) => o.valor === l.origem)?.rotulo ?? "—";
              const quantidadeTexto = l.quantidade.trim()
                ? `${l.quantidade} ${l.unidade.trim() || ""}`.trim()
                : "não informada";
              return (
                <LinhaResumo
                  key={l.chave}
                  rotulo={`Planta ${indice + 1}`}
                  valor={`${cultura?.nome ?? "—"} · ${origemRotulo} · ${quantidadeTexto}`}
                  onEditar={() => irPara(2)}
                  ultima={indice === linhas.length - 1}
                />
              );
            })}
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

export default function RegistrarPlantioPage() {
  return (
    <Suspense
      fallback={
        <TelaBase titulo="Registrar plantio" icone="🌱" voltarHref="/patio/horta">
          <p className="text-center text-sm text-zinc-600">Carregando…</p>
        </TelaBase>
      }
    >
      <RegistrarPlantioConteudo />
    </Suspense>
  );
}
