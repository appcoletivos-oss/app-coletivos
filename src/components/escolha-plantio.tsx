"use client";

// Escolha de canteiro → plantio em TELA ÚNICA (Sprint A.1, itens 1.6 e 2 —
// SPRINT_A1_MENOS_TOQUES.md). Usada pelas telas de ação da Horta (Colher,
// Perda, e depois Doar/Transplantar/Germinou).
//
// - Vindo do Mapa (`?canteiro=<id>&plantio=<id>`): canteiro e plantio já
//   chegam escolhidos e aparecem só como cabeçalho (P4), com "trocar".
// - Sem contexto (Relatório do Turno, Agenda, Avisos): o primeiro campo é o
//   canteiro, em botões grandes, os usados por último primeiro (P5);
//   escolher o canteiro mostra os plantios dele logo abaixo, na mesma tela.
//
// O vínculo a `plantio_id` continua obrigatório (P6) — muda só o caminho.

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { listarCanteiros } from "@/lib/patio";
import { iconeTipoCanteiro } from "@/lib/horta";
import { listarPlantiosAtivosPorCanteiro } from "@/lib/plantios";
import { lembrarRecentes, lerRecentes, ordenarPorRecentes } from "@/lib/recentes";
import type { Canteiro, PlantioComCultura, StatusPlantio } from "@/lib/types";
import { BotaoGrande, CabecalhoContexto, RotuloCampo } from "@/components/fluxo-registro";

export const LISTA_RECENTES_CANTEIROS = "canteiros";

export function useEscolhaPlantio(statusAceitos: StatusPlantio[]) {
  const searchParams = useSearchParams();
  const canteiroParam = searchParams.get("canteiro");
  const plantioParam = searchParams.get("plantio");
  // Chave estável pro useEffect/useCallback (o array muda de identidade a
  // cada render de quem chama).
  const statusChave = statusAceitos.join(",");

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [canteiros, setCanteiros] = useState<Canteiro[]>([]);
  const [canteiroId, setCanteiroId] = useState<string | null>(null);
  const [plantios, setPlantios] = useState<PlantioComCultura[]>([]);
  const [carregandoPlantios, setCarregandoPlantios] = useState(false);
  const [plantioId, setPlantioId] = useState<string | null>(null);

  const carregarPlantios = useCallback(
    async (id: string, plantioPreferido: string | null) => {
      setCarregandoPlantios(true);
      try {
        const aceitos = statusChave.split(",");
        const lista = (await listarPlantiosAtivosPorCanteiro(id)).filter((p) => aceitos.includes(p.status));
        setPlantios(lista);
        // Plantio vindo do Mapa; ou, se o canteiro só tem um plantio, já é
        // ele (aparece no cabeçalho com "trocar", não escolhe às cegas).
        const escolhido =
          lista.find((p) => p.id === plantioPreferido) ?? (lista.length === 1 ? lista[0] : null);
        setPlantioId(escolhido?.id ?? null);
      } catch {
        setErro("Não deu pra carregar os plantios desse canteiro agora. Confira a internet e tente de novo.");
      } finally {
        setCarregandoPlantios(false);
      }
    },
    [statusChave],
  );

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const lista = await listarCanteiros();
        if (cancelado) return;
        setCanteiros(ordenarPorRecentes(lista, lerRecentes(LISTA_RECENTES_CANTEIROS)));
        if (canteiroParam && lista.some((c) => c.id === canteiroParam)) {
          setCanteiroId(canteiroParam);
          await carregarPlantios(canteiroParam, plantioParam);
        }
      } catch {
        if (!cancelado) setErro("Não deu pra carregar os canteiros agora. Confira a internet e tente de novo.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [canteiroParam, plantioParam, carregarPlantios]);

  function escolherCanteiro(id: string) {
    setCanteiroId(id);
    setPlantioId(null);
    setPlantios([]);
    void carregarPlantios(id, null);
  }

  function trocarCanteiro() {
    setCanteiroId(null);
    setPlantioId(null);
    setPlantios([]);
  }

  // Plantio criado na hora (ex.: "Não achei o plantio" em Colher) — entra
  // na lista e já fica escolhido.
  function adicionarPlantio(p: PlantioComCultura) {
    setPlantios((lista) => [p, ...lista]);
    setPlantioId(p.id);
  }

  // Chamar depois de salvar: o canteiro sobe pro topo da próxima vez.
  function lembrarCanteiro() {
    if (canteiroId) lembrarRecentes(LISTA_RECENTES_CANTEIROS, [canteiroId]);
  }

  return {
    carregando,
    erro,
    canteiros,
    canteiroId,
    canteiro: canteiros.find((c) => c.id === canteiroId) ?? null,
    plantios,
    carregandoPlantios,
    plantioId,
    plantio: plantios.find((p) => p.id === plantioId) ?? null,
    escolherCanteiro,
    escolherPlantio: setPlantioId,
    trocarPlantio: () => setPlantioId(null),
    trocarCanteiro,
    adicionarPlantio,
    lembrarCanteiro,
  };
}

export type EscolhaPlantio = ReturnType<typeof useEscolhaPlantio>;

export function EscolhaPlantioCampos({
  escolha,
  iconeContexto,
  perguntaPlantio,
  semPlantios,
  rodapeLista,
  detalhePlantio,
}: {
  escolha: EscolhaPlantio;
  iconeContexto: string;
  perguntaPlantio: string;
  semPlantios: string;
  // Ex.: link "Não achei o plantio" (Colher) — fica embaixo da lista.
  rodapeLista?: ReactNode;
  // Linha pequena embaixo do nome da cultura em cada opção.
  detalhePlantio?: (p: PlantioComCultura) => string | null;
}) {
  const { canteiro, plantio } = escolha;

  if (canteiro && plantio) {
    return (
      <CabecalhoContexto
        texto={`${iconeContexto} ${plantio.cultura_nome} · ${canteiro.nome}`}
        onTrocar={escolha.plantios.length > 1 ? escolha.trocarPlantio : escolha.trocarCanteiro}
      />
    );
  }

  if (canteiro) {
    return (
      <div className="mb-3">
        <CabecalhoContexto
          texto={`${iconeTipoCanteiro(canteiro.tipo)} ${canteiro.nome}`}
          onTrocar={escolha.trocarCanteiro}
        />
        <RotuloCampo>{perguntaPlantio}</RotuloCampo>
        {escolha.carregandoPlantios ? (
          <p className="text-center text-sm text-zinc-600">Carregando…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {escolha.plantios.map((p) => {
              const detalhe = detalhePlantio?.(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => escolha.escolherPlantio(p.id)}
                  className="rounded-xl border-2 border-zinc-800 bg-white px-3 py-3 text-left"
                >
                  <span className="block text-sm font-bold text-zinc-900">{p.cultura_nome}</span>
                  {detalhe && <span className="block text-[11px] text-zinc-500">{detalhe}</span>}
                </button>
              );
            })}
            {escolha.plantios.length === 0 && <p className="text-center text-xs text-zinc-500">{semPlantios}</p>}
            {rodapeLista}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-3">
      <RotuloCampo>Qual canteiro?</RotuloCampo>
      <div className="grid grid-cols-2 gap-3">
        {escolha.canteiros.map((c) => (
          <BotaoGrande
            key={c.id}
            icone={iconeTipoCanteiro(c.tipo)}
            rotulo={c.nome}
            selecionado={false}
            onClick={() => escolha.escolherCanteiro(c.id)}
          />
        ))}
      </div>
      {escolha.canteiros.length === 0 && (
        <p className="text-center text-sm text-zinc-600">
          Nenhum canteiro cadastrado ainda. Cadastre pelo menos um canteiro (Mais → Cadastro) pra continuar.
        </p>
      )}
    </div>
  );
}
