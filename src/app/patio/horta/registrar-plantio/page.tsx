"use client";

// Horta → Registrar plantio
//
// Primeiro passo do rastreio ponta a ponta (ver HANDOFF_HORTA_COMPLETO.md,
// v3): cria um lote (`plantios`) com origem (semente/muda comprada/estaca/
// já existente), canteiro, cultura e quantidade. Se origem = semente, o
// lote entra como "germinando" (precisa confirmar germinação depois); as
// demais entram direto "ativo".
//
// Sprint A, item 1: plantio em consórcio — 1 canteiro + N linhas de
// (cultura, origem, quantidade, unidade), todas com o mesmo canteiro_id/
// data_inicio. Salvar grava as N linhas de uma vez com criarPlantios (um
// único insert com array — transacional).
//
// Sprint A.1 (SPRINT_A1_MENOS_TOQUES.md, item 3): TELA ÚNICA, sem
// conferência. Canteiro no topo (já escolhido quando vem de "＋ Plantar
// aqui" no Mapa), as linhas de planta logo abaixo, culturas usadas por
// último primeiro, origem já marcada com a última usada, e "não achei a
// cultura" cadastra só com o nome, sem sair da tela.
//
// "Quem registrou" e "data de início" nunca são perguntados — vêm da
// sessão de login e do relógio do aparelho (data em America/Recife).
// Previsão de colheita é calculada na hora, copiando o dado da ficha de
// cultura (memória histórica — se a ficha mudar depois, este plantio não
// muda).

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { listarCanteiros } from "@/lib/patio";
import { iconeTipoCanteiro } from "@/lib/horta";
import { criarCultura, listarCulturasAtivas } from "@/lib/culturas";
import { calcularPrevisaoColheita, criarPlantios } from "@/lib/plantios";
import { dataHojeRecife, vincularPlantiosAoItem } from "@/lib/relatorio-turno";
import { obterMeuMembro } from "@/lib/auth";
import { guardarPadrao, lembrarRecentes, lerPadrao, lerRecentes, ordenarPorRecentes } from "@/lib/recentes";
import { LISTA_RECENTES_CANTEIROS } from "@/components/escolha-plantio";
import type { Canteiro, Cultura, NovoPlantio, OrigemPlantio } from "@/lib/types";
import {
  BotaoGrande,
  BotaoSalvar,
  CabecalhoContexto,
  RotuloCampo,
  SeletorBotoes,
  TelaBase,
} from "@/components/fluxo-registro";

const ORIGENS: { valor: OrigemPlantio; icone: string; rotulo: string }[] = [
  { valor: "semente", icone: "🌱", rotulo: "Semente" },
  { valor: "muda_comprada", icone: "🛒", rotulo: "Muda" },
  { valor: "estaca", icone: "🌿", rotulo: "Estaca" },
  { valor: "ja_existente", icone: "🌳", rotulo: "Já existia" },
];

const LISTA_RECENTES_CULTURAS = "culturas";
const PADRAO_ORIGEM = "origem-plantio";
const padraoUnidade = (culturaId: string) => `unidade-cultura:${culturaId}`;

// Uma linha do consórcio — cada uma vira um lote próprio em `plantios`.
// `chave` é só identidade de UI (key do React), não é coluna de nada.
interface LinhaConsorcio {
  chave: string;
  culturaId: string | null;
  origem: OrigemPlantio | null;
  quantidade: string;
  unidade: string;
}

function linhaVazia(origem: OrigemPlantio | null): LinhaConsorcio {
  return { chave: crypto.randomUUID(), culturaId: null, origem, quantidade: "", unidade: "" };
}

function ehOrigem(valor: string | null): valor is OrigemPlantio {
  return ORIGENS.some((o) => o.valor === valor);
}

function numeroOuNull(texto: string): number | null {
  if (!texto.trim()) return null;
  const n = Number(texto.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

// useSearchParams exige um limite de Suspense em volta (regra do Next.js
// pra Client Components) — por isso o export default vira só um wrapper,
// ver RegistrarPlantioPage no fim do arquivo.
function RegistrarPlantioConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canteiroParam = searchParams.get("canteiro");
  // Preenchidos quando a tela é aberta a partir do Relatório do Turno
  // (Sprint A, item 6, tipo_registro=canteiro → Plantio). Consórcio pode
  // criar N lotes de uma vez: o primeiro vincula ao item de origem, os
  // demais ganham um item irmão cada (decisão do Thiago, 01/10/2026 — ver
  // vincularPlantiosAoItem).
  const relatorioItemId = searchParams.get("relatorio_item");
  const voltarHref = searchParams.get("voltar");
  const fecharHref = voltarHref ? decodeURIComponent(voltarHref) : "/patio/horta";

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [canteiros, setCanteiros] = useState<Canteiro[]>([]);
  const [culturas, setCulturas] = useState<Cultura[]>([]);
  const [culturasRecentes, setCulturasRecentes] = useState<string[]>([]);
  // Cadastro de cultura é só de coordenação/consultor (RLS de `culturas`,
  // migration 20260827130000) — pra equipe a tela orienta a pedir.
  const [podeCadastrarCultura, setPodeCadastrarCultura] = useState(false);

  const [canteiroId, setCanteiroId] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaConsorcio[]>(() => [linhaVazia(null)]);

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const [listaCanteiros, listaCulturas] = await Promise.all([listarCanteiros(), listarCulturasAtivas()]);
        if (cancelado) return;
        // Padrões guardados no aparelho (P5) — lidos aqui, pós-mount.
        const origemPadrao = lerPadrao(PADRAO_ORIGEM);
        if (ehOrigem(origemPadrao)) {
          setLinhas((atual) => atual.map((l) => (l.origem ? l : { ...l, origem: origemPadrao })));
        }
        setCulturasRecentes(lerRecentes(LISTA_RECENTES_CULTURAS));
        setCanteiros(ordenarPorRecentes(listaCanteiros, lerRecentes(LISTA_RECENTES_CANTEIROS)));
        setCulturas(listaCulturas);
        if (canteiroParam && listaCanteiros.some((c) => c.id === canteiroParam)) setCanteiroId(canteiroParam);
      } catch {
        if (!cancelado) {
          setErroCarregamento("Não deu pra carregar canteiros/culturas agora. Confira a internet e tente de novo.");
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();

    obterMeuMembro()
      .then((m) => {
        if (!cancelado) setPodeCadastrarCultura(m?.papel === "coordenacao" || m?.papel === "consultor");
      })
      .catch(() => {
        // sem papel conhecido: não oferece o cadastro (a RLS barraria).
      });

    return () => {
      cancelado = true;
    };
  }, [canteiroParam]);

  const culturasOrdenadas = useMemo(
    () => ordenarPorRecentes(culturas, culturasRecentes),
    [culturas, culturasRecentes],
  );

  function atualizarLinha(chave: string, patch: Partial<LinhaConsorcio>) {
    setLinhas((atual) => atual.map((l) => (l.chave === chave ? { ...l, ...patch } : l)));
  }

  function escolherCultura(chave: string, cultura: Cultura) {
    setLinhas((atual) =>
      atual.map((l) =>
        l.chave === chave
          ? { ...l, culturaId: cultura.id, unidade: l.unidade || lerPadrao(padraoUnidade(cultura.id)) || "" }
          : l,
      ),
    );
  }

  function adicionarLinha() {
    // Nova linha já vem com a origem da anterior (P5: a última usada).
    setLinhas((atual) => [...atual, linhaVazia(atual[atual.length - 1]?.origem ?? null)]);
  }

  function removerLinha(chave: string) {
    setLinhas((atual) => (atual.length <= 1 ? atual : atual.filter((l) => l.chave !== chave)));
  }

  // Cadastro mínimo de cultura (Sprint A.1, itens 3.4 e 4): só o nome. O
  // resto da ficha (ciclo, dias de germinação/colheita...) fica pra depois,
  // em Mais → Cadastro → Culturas. ciclo_produtivo vai "unico", que é o
  // mesmo padrão da coluna no banco.
  async function cadastrarCultura(nome: string): Promise<Cultura> {
    const nova = await criarCultura({ nome, ciclo_produtivo: "unico" });
    setCulturas((lista) => [...lista, nova].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    return nova;
  }

  const canteiroSelecionado = canteiros.find((c) => c.id === canteiroId) ?? null;

  async function salvar() {
    if (!canteiroId || pendencia) return;
    setSalvando(true);
    setErroSalvar(null);

    const hoje = dataHojeRecife();
    const dadosLinhas: NovoPlantio[] = linhas.map((l) => {
      const cultura = culturas.find((c) => c.id === l.culturaId);
      const { snapshot, previsao } = calcularPrevisaoColheita(cultura?.dias_para_colheita ?? null, hoje);
      return {
        cultura_id: l.culturaId as string,
        canteiro_id: canteiroId,
        origem: l.origem as OrigemPlantio,
        data_inicio: hoje,
        quantidade_inicial: numeroOuNull(l.quantidade),
        unidade: l.unidade.trim() || null,
        dias_para_colheita_snapshot: snapshot,
        previsao_colheita: previsao,
      };
    });

    let criadosIds: string[];
    try {
      criadosIds = (await criarPlantios(dadosLinhas)).map((p) => p.id);
    } catch {
      setErroSalvar("Não deu pra salvar agora. Confira a internet e tente de novo.");
      setSalvando(false);
      return;
    }

    lembrarRecentes(LISTA_RECENTES_CANTEIROS, [canteiroId]);
    lembrarRecentes(LISTA_RECENTES_CULTURAS, [...linhas].reverse().map((l) => l.culturaId as string));
    const ultimaOrigem = linhas[linhas.length - 1].origem;
    if (ultimaOrigem) guardarPadrao(PADRAO_ORIGEM, ultimaOrigem);
    for (const l of linhas) {
      if (l.culturaId && l.unidade.trim()) guardarPadrao(padraoUnidade(l.culturaId), l.unidade.trim());
    }

    // Aberta a partir do Relatório do Turno (Sprint A, item 6): vincula
    // o primeiro plantio ao item de origem e cria um item irmão pra cada
    // um dos demais — e volta pro relatório.
    if (relatorioItemId && criadosIds.length > 0) {
      try {
        await vincularPlantiosAoItem(relatorioItemId, criadosIds);
      } catch {
        // segue sem o vínculo — os plantios já estão salvos.
      }
      if (voltarHref) {
        router.push(decodeURIComponent(voltarHref));
        return;
      }
    }
    const algumaSemente = linhas.some((l) => l.origem === "semente");
    router.push(`/patio/horta?salvo=${algumaSemente ? "plantio-semente" : "plantio"}`);
  }

  if (carregando) {
    return (
      <TelaBase titulo="Plantar" icone="🌱" voltarHref={fecharHref}>
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (erroCarregamento) {
    return (
      <TelaBase titulo="Plantar" icone="🌱" voltarHref={fecharHref}>
        <p className="text-center text-sm text-red-700">{erroCarregamento}</p>
      </TelaBase>
    );
  }

  const indiceSemCultura = linhas.findIndex((l) => !l.culturaId);
  const indiceSemOrigem = linhas.findIndex((l) => !l.origem);
  const pendencia = !canteiroId
    ? "Escolha o canteiro"
    : indiceSemCultura >= 0
      ? linhas.length > 1
        ? `Escolha a planta ${indiceSemCultura + 1}`
        : "Escolha a planta"
      : indiceSemOrigem >= 0
        ? linhas.length > 1
          ? `De onde veio a planta ${indiceSemOrigem + 1}?`
          : "De onde veio a planta?"
        : null;
  const resumo = `Salvar ${linhas.length === 1 ? "1 plantio" : `${linhas.length} plantios`} no ${canteiroSelecionado?.nome ?? "canteiro"}`;

  return (
    <TelaBase titulo="Plantar" icone="🌱" voltarHref={fecharHref}>
      {canteiroSelecionado ? (
        <CabecalhoContexto
          texto={`${iconeTipoCanteiro(canteiroSelecionado.tipo)} ${canteiroSelecionado.nome}`}
          onTrocar={() => setCanteiroId(null)}
        />
      ) : (
        <div className="mb-4">
          <RotuloCampo>Qual canteiro?</RotuloCampo>
          <div className="grid grid-cols-2 gap-3">
            {canteiros.map((c) => (
              <BotaoGrande
                key={c.id}
                icone={iconeTipoCanteiro(c.tipo)}
                rotulo={c.nome}
                selecionado={false}
                onClick={() => setCanteiroId(c.id)}
              />
            ))}
          </div>
          {canteiros.length === 0 && (
            <p className="text-center text-sm text-zinc-600">
              Nenhum canteiro cadastrado ainda. Cadastre pelo menos um canteiro (Mais → Cadastro) pra continuar.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {linhas.map((l, indice) => (
          <LinhaPlanta
            key={l.chave}
            linha={l}
            indice={indice}
            total={linhas.length}
            culturas={culturasOrdenadas}
            podeCadastrarCultura={podeCadastrarCultura}
            onEscolherCultura={(c) => escolherCultura(l.chave, c)}
            onTrocarCultura={() => atualizarLinha(l.chave, { culturaId: null })}
            onCadastrarCultura={cadastrarCultura}
            onMudar={(patch) => atualizarLinha(l.chave, patch)}
            onRemover={() => removerLinha(l.chave)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={adicionarLinha}
        className="mt-3 w-full rounded-xl border-2 border-dashed border-[#2e6b3e] py-2.5 text-xs font-bold text-[#2e6b3e]"
      >
        ＋ outra planta no mesmo canteiro (consórcio)
      </button>

      {erroSalvar && <p className="mt-3 text-center text-xs text-red-700">{erroSalvar}</p>}
      <BotaoSalvar resumo={resumo} pendencia={pendencia} salvando={salvando} onClick={salvar} />
    </TelaBase>
  );
}

function LinhaPlanta({
  linha,
  indice,
  total,
  culturas,
  podeCadastrarCultura,
  onEscolherCultura,
  onTrocarCultura,
  onCadastrarCultura,
  onMudar,
  onRemover,
}: {
  linha: LinhaConsorcio;
  indice: number;
  total: number;
  culturas: Cultura[];
  podeCadastrarCultura: boolean;
  onEscolherCultura: (c: Cultura) => void;
  onTrocarCultura: () => void;
  onCadastrarCultura: (nome: string) => Promise<Cultura>;
  onMudar: (patch: Partial<LinhaConsorcio>) => void;
  onRemover: () => void;
}) {
  const cultura = culturas.find((c) => c.id === linha.culturaId) ?? null;

  return (
    <div className="rounded-xl border-2 border-zinc-800 bg-white p-3">
      {total > 1 && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold text-zinc-500">Planta {indice + 1}</span>
          <button
            type="button"
            onClick={onRemover}
            className="text-[11px] font-bold text-red-700"
            aria-label={`Remover planta ${indice + 1}`}
          >
            ✕ remover
          </button>
        </div>
      )}

      {cultura ? (
        <div className="mb-3 flex items-center justify-between rounded-lg border-2 border-[#2e6b3e] bg-[#eaf3ea] px-3 py-2">
          <span className="text-sm font-bold text-[#2e6b3e]">
            🌱 {cultura.nome}
            {cultura.dias_para_colheita == null && (
              <span className="block text-[10px] font-normal text-zinc-500">
                Sem previsão de colheita: falta completar a ficha
              </span>
            )}
          </span>
          <button type="button" onClick={onTrocarCultura} className="shrink-0 text-[11px] text-zinc-600 underline">
            trocar
          </button>
        </div>
      ) : (
        <EscolhaCultura
          culturas={culturas}
          autoFocus={indice > 0}
          podeCadastrar={podeCadastrarCultura}
          onEscolher={onEscolherCultura}
          onCadastrar={onCadastrarCultura}
        />
      )}

      <RotuloCampo>De onde veio?</RotuloCampo>
      <SeletorBotoes
        opcoes={ORIGENS}
        valor={linha.origem}
        onEscolher={(origem) => onMudar({ origem })}
        colunas={4}
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block text-[11px] font-semibold text-zinc-600">
          Quantidade
          <input
            value={linha.quantidade}
            onChange={(e) => onMudar({ quantidade: e.target.value.replace(/[^0-9,.]/g, "") })}
            inputMode="decimal"
            placeholder="—"
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2.5 text-base"
          />
        </label>
        <label className="block text-[11px] font-semibold text-zinc-600">
          Unidade
          <input
            value={linha.unidade}
            onChange={(e) => onMudar({ unidade: e.target.value })}
            placeholder="Ex.: mudas"
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2.5 text-base"
          />
        </label>
      </div>
    </div>
  );
}

// Escolha de cultura dentro da própria linha (sem sub-tela). As usadas por
// último vêm primeiro; a busca filtra a lista completa; "não achei"
// cadastra só com o nome digitado na busca.
function EscolhaCultura({
  culturas,
  autoFocus,
  podeCadastrar,
  onEscolher,
  onCadastrar,
}: {
  culturas: Cultura[];
  autoFocus: boolean;
  podeCadastrar: boolean;
  onEscolher: (c: Cultura) => void;
  onCadastrar: (nome: string) => Promise<Cultura>;
}) {
  const [busca, setBusca] = useState("");
  const [cadastrando, setCadastrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alvo = busca.trim().toLowerCase();
  const filtradas = alvo ? culturas.filter((c) => c.nome.toLowerCase().includes(alvo)) : culturas;
  const nomeExato = culturas.some((c) => c.nome.toLowerCase() === alvo);

  async function cadastrar() {
    const nome = busca.trim();
    if (!nome) return;
    setCadastrando(true);
    setErro(null);
    try {
      onEscolher(await onCadastrar(nome));
    } catch (e) {
      const codigo = (e as { code?: string } | null)?.code;
      setErro(
        codigo === "23505"
          ? "Já existe uma cultura com esse nome (talvez desativada em Mais → Cadastro → Culturas)."
          : "Não deu pra cadastrar agora. Confira a internet e tente de novo.",
      );
    } finally {
      setCadastrando(false);
    }
  }

  return (
    <div className="mb-3">
      <RotuloCampo>Qual planta?</RotuloCampo>
      <input
        autoFocus={autoFocus}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="🔎 Buscar cultura…"
        className="mb-2 w-full rounded-lg border-2 border-zinc-300 p-2.5 text-base"
      />
      <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
        {filtradas.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onEscolher(c)}
            className="rounded-xl border-2 border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-800"
          >
            {c.nome}
          </button>
        ))}
        {filtradas.length === 0 && !alvo && (
          <p className="text-xs text-zinc-500">Nenhuma cultura cadastrada ainda.</p>
        )}
      </div>

      {alvo && !nomeExato && (
        <div className="mt-2">
          {podeCadastrar ? (
            <button
              type="button"
              disabled={cadastrando}
              onClick={cadastrar}
              className="w-full rounded-lg border-2 border-dashed border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-700 disabled:opacity-50"
            >
              {cadastrando ? "Cadastrando…" : `Não achei: cadastrar “${busca.trim()}”`}
            </button>
          ) : (
            <p className="text-[11px] text-zinc-500">
              Não achou? Peça pra coordenação cadastrar a cultura (Mais → Cadastro → Culturas).
            </p>
          )}
          {erro && <p className="mt-1 text-[11px] text-red-700">{erro}</p>}
        </div>
      )}
    </div>
  );
}

export default function RegistrarPlantioPage() {
  return (
    <Suspense
      fallback={
        <TelaBase titulo="Plantar" icone="🌱" voltarHref="/patio/horta">
          <p className="text-center text-sm text-zinc-600">Carregando…</p>
        </TelaBase>
      }
    >
      <RegistrarPlantioConteudo />
    </Suspense>
  );
}
