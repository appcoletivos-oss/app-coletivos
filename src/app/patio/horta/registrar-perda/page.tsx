"use client";

// Horta → Registrar perda
//
// Perda de mudas/produção de um plantio específico, sempre amarrada a
// plantio_id (nunca só a um canteiro) — ver HANDOFF_HORTA_COMPLETO.md
// (v3), seção 3.7. Não fecha o plantio sozinho — se a perda for total, quem
// registra fecha o plantio pelo Mapa ("Encerrar sem registro…").
//
// Sprint A.1 (SPRINT_A1_MENOS_TOQUES.md, item 2): TELA ÚNICA. Vindo do card
// do plantio no Mapa (?canteiro=&plantio=): quantidade, motivo em botões e
// Salvar. O motivo continua texto livre no banco (registros_perdas.motivo);
// os botões são os motivos mais usados do histórico + "outro".
// `registros_perdas` não tem coluna de observação — por isso "Mais
// detalhes" aqui só tem a foto (a sprint não muda schema de registro).

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { enviarFotoRegistro, salvarFotosExtras } from "@/lib/patio";
import { listarMotivosPerdaFrequentes, registrarPerda } from "@/lib/plantios";
import { vincularRegistroAoItem } from "@/lib/relatorio-turno";
import type { NovoRegistroPerda, PlantioComCultura } from "@/lib/types";
import {
  BlocoRecolhivel,
  BotaoSalvar,
  RotuloCampo,
  SeletorBotoes,
  SeletorFotos,
  TelaBase,
} from "@/components/fluxo-registro";
import { EscolhaPlantioCampos, useEscolhaPlantio } from "@/components/escolha-plantio";

const STATUS_COM_PERDA: PlantioComCultura["status"][] = ["ativo", "germinando"];

// Completam os chips enquanto o histórico ainda tem poucos motivos (início
// do uso). Saem da lista assim que aparecem no próprio histórico.
const MOTIVOS_INICIAIS = ["praga", "sol forte", "falta d'água", "chuva forte"];
const OUTRO = "__outro__";

function RegistrarPerdaConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Relatório do Turno: mesmo contrato das outras telas de ação
  // (?relatorio_item=&voltar=) — vincula o registro ao item e volta.
  const relatorioItemId = searchParams.get("relatorio_item");
  const voltarHref = searchParams.get("voltar");
  const fecharHref = voltarHref ? decodeURIComponent(voltarHref) : "/patio/horta";

  const escolha = useEscolhaPlantio(STATUS_COM_PERDA);
  const { canteiro, plantio } = escolha;

  const [motivosSugeridos, setMotivosSugeridos] = useState<string[]>(MOTIVOS_INICIAIS);
  const [quantidade, setQuantidade] = useState("");
  // null = ainda não mexeu: usa a unidade do próprio plantio.
  const [unidadeEditada, setUnidadeEditada] = useState<string | null>(null);
  const [motivoEscolhido, setMotivoEscolhido] = useState<string | null>(null);
  const [motivoOutro, setMotivoOutro] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    listarMotivosPerdaFrequentes()
      .then((doHistorico) => {
        if (cancelado) return;
        const vistos = new Set(doHistorico.map((m) => m.toLowerCase()));
        const complemento = MOTIVOS_INICIAIS.filter((m) => !vistos.has(m));
        setMotivosSugeridos([...doHistorico, ...complemento].slice(0, 8));
      })
      .catch(() => {
        // fica só com os motivos iniciais.
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const unidade = unidadeEditada ?? plantio?.unidade ?? "";
  const quantidadeNumero = quantidade.trim() ? Number(quantidade.replace(",", ".")) : null;
  const quantidadeInvalida = quantidadeNumero !== null && (Number.isNaN(quantidadeNumero) || quantidadeNumero <= 0);
  const motivo = motivoEscolhido === OUTRO ? motivoOutro.trim() : (motivoEscolhido ?? "");

  async function salvar() {
    if (!plantio || quantidadeInvalida) return;
    setSalvando(true);
    setErroSalvar(null);
    escolha.lembrarCanteiro();

    let fotoUrl: string | null = null;
    if (fotos[0]) {
      try {
        fotoUrl = await enviarFotoRegistro(fotos[0], "perda");
      } catch {
        fotoUrl = null;
      }
    }

    const registro: NovoRegistroPerda = {
      plantio_id: plantio.id,
      quantidade: quantidadeNumero,
      unidade: unidade.trim() || null,
      motivo: motivo || null,
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
      if (relatorioItemId) {
        try {
          await vincularRegistroAoItem(relatorioItemId, "registros_perdas", perda.id);
        } catch {
          // segue sem o vínculo — o registro já está salvo.
        }
        if (voltarHref) {
          router.push(decodeURIComponent(voltarHref));
          return;
        }
      }
      router.push("/patio/horta?salvo=perda");
    } catch {
      setErroSalvar("Não deu pra salvar agora. Confira a internet e tente de novo.");
      setSalvando(false);
    }
  }

  if (escolha.carregando) {
    return (
      <TelaBase titulo="Registrar perda" icone="📉" voltarHref={fecharHref}>
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (escolha.erro) {
    return (
      <TelaBase titulo="Registrar perda" icone="📉" voltarHref={fecharHref}>
        <p className="text-center text-sm text-red-700">{escolha.erro}</p>
      </TelaBase>
    );
  }

  const pendencia = !plantio
    ? canteiro
      ? "Escolha o plantio"
      : "Escolha o canteiro"
    : quantidadeInvalida
      ? "Quantidade inválida"
      : motivoEscolhido === OUTRO && !motivoOutro.trim()
        ? "Escreva o motivo"
        : null;
  const partesResumo = [
    quantidadeNumero !== null ? `${quantidade.trim()} ${unidade.trim()}`.trim() : null,
    plantio ? `de ${plantio.cultura_nome}` : null,
    motivo ? `· ${motivo}` : null,
  ].filter(Boolean);
  const resumo = `Salvar perda${partesResumo.length ? `: ${partesResumo.join(" ")}` : ""}`;

  return (
    <TelaBase titulo="Registrar perda" icone="📉" voltarHref={fecharHref}>
      <EscolhaPlantioCampos
        escolha={escolha}
        iconeContexto="📉"
        perguntaPlantio="Qual plantio teve perda?"
        semPlantios="Nenhum plantio nesse canteiro."
        detalhePlantio={(p) => (p.status === "germinando" ? "germinando" : null)}
      />

      {plantio && (
        <>
          <RotuloCampo>Quanto se perdeu?</RotuloCampo>
          <div className="mb-3 flex items-center gap-2 rounded-xl border-2 border-zinc-800 bg-[#f1efe6] px-3 py-4">
            <input
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value.replace(/[^0-9,.]/g, ""))}
              inputMode="decimal"
              autoFocus
              placeholder="0"
              aria-label="Quantidade perdida"
              className="w-24 border-b-2 border-zinc-800 bg-transparent text-center text-3xl font-bold tabular-nums text-zinc-900 focus:outline-none"
            />
            <input
              value={unidade}
              onChange={(e) => setUnidadeEditada(e.target.value)}
              placeholder="mudas"
              aria-label="Unidade"
              className="min-w-0 flex-1 border-b border-dashed border-zinc-400 bg-transparent text-lg font-bold text-zinc-600 focus:outline-none"
            />
          </div>

          <RotuloCampo>Por quê? (opcional)</RotuloCampo>
          <SeletorBotoes
            opcoes={[
              ...motivosSugeridos.map((m) => ({ valor: m, rotulo: m })),
              { valor: OUTRO, rotulo: "outro…" },
            ]}
            valor={motivoEscolhido}
            onEscolher={(v) => setMotivoEscolhido(v === motivoEscolhido ? null : v)}
          />
          {motivoEscolhido === OUTRO && (
            <input
              autoFocus
              value={motivoOutro}
              onChange={(e) => setMotivoOutro(e.target.value)}
              placeholder="Qual foi o motivo?"
              className="mt-2 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
            />
          )}

          <BlocoRecolhivel resumo={fotos.length > 0 ? `${fotos.length} foto(s)` : null}>
            <div>
              <RotuloCampo>Fotos</RotuloCampo>
              <SeletorFotos fotos={fotos} onMudar={setFotos} />
            </div>
          </BlocoRecolhivel>
        </>
      )}

      {erroSalvar && <p className="mt-3 text-center text-xs text-red-700">{erroSalvar}</p>}
      <BotaoSalvar resumo={resumo} pendencia={pendencia} salvando={salvando} onClick={salvar} />
    </TelaBase>
  );
}

export default function RegistrarPerdaPage() {
  return (
    <Suspense
      fallback={
        <TelaBase titulo="Registrar perda" icone="📉" voltarHref="/patio/horta">
          <p className="text-center text-sm text-zinc-600">Carregando…</p>
        </TelaBase>
      }
    >
      <RegistrarPerdaConteudo />
    </Suspense>
  );
}
