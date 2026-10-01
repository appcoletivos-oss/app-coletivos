"use client";

// Horta → Manejo
//
// Registro de manejo recorrente por canteiro (capina seletiva, adubação,
// poda, raleamento). Ajustado pro handoff v3
// (HANDOFF_HORTA_COMPLETO.md, seção 3.9): adubação/capina vinculam
// automaticamente a todos os plantios ativos do canteiro (sem passo extra
// na tela); poda/raleamento exigem escolher manualmente quais plantios
// foram afetados. Esse vínculo é o que alimenta "próximo manejo devido"
// por plantio (motor de demandas do dia).
//
// "Quem registrou" e "data" nunca são perguntados: vêm da sessão de login
// e do relógio do aparelho.
//
// Os pedaços de tela (TelaBase, Passo, BotaoGrande etc.) vêm de
// @/components/fluxo-registro — compartilhados com as demais telas de
// registro, pra não duplicar essa UI a cada fluxo novo.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { enviarFotoRegistro, listarCanteiros, salvarFotosExtras } from "@/lib/patio";
import { iconeTipoCanteiro, salvarRegistroManejo } from "@/lib/horta";
import { listarPlantiosAtivosPorCanteiro } from "@/lib/plantios";
import { calcularPesoCarrinho, listarTiposCarrinho } from "@/lib/carrinhos";
import { vincularRegistroAoItem } from "@/lib/relatorio-turno";
import { criarFilaOffline } from "@/lib/fila-offline";
import type { Canteiro, NovoRegistroManejo, PlantioComCultura, TipoCarrinho, TipoManejo } from "@/lib/types";
import {
  BotaoAvancar,
  BotaoGrande,
  LinhaResumo,
  Passo,
  PontosPasso,
  SeletorFotos,
  TelaBase,
} from "@/components/fluxo-registro";

const TOTAL_PASSOS = 5;

const filaOffline = criarFilaOffline<NovoRegistroManejo>(
  "app-coletivo:fila-registros-manejo",
);

const TIPOS_MANEJO: { valor: TipoManejo; icone: string; rotulo: string }[] = [
  { valor: "capina_seletiva", icone: "🌾", rotulo: "Capina seletiva" },
  { valor: "adubacao", icone: "🧪", rotulo: "Adubação" },
  { valor: "poda", icone: "✂️", rotulo: "Poda" },
  { valor: "raleamento", icone: "🍃", rotulo: "Raleamento" },
  { valor: "outro", icone: "🔧", rotulo: "Outro" },
];

// Adubação e capina auto-vinculam a todos os plantios ativos do canteiro;
// poda e raleamento exigem escolha manual — ver handoff, seção 3.9.
function exigeSelecaoDePlantios(tipo: TipoManejo | null): boolean {
  return tipo === "poda" || tipo === "raleamento";
}

// useSearchParams exige um limite de Suspense em volta (regra do Next.js
// pra Client Components) — por isso o export default vira só um wrapper,
// ver ManejoPage no fim do arquivo.
function ManejoConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Preenchido quando a tela é aberta a partir de um link da Agenda
  // (evento tipo "atividade") — ver lib/agenda.ts, LINKS_REGISTRO_ATIVIDADE.
  const eventoAgendaId = searchParams.get("evento_agenda_id");
  // Preenchidos quando a tela é aberta a partir do Relatório do Turno
  // (Sprint A, item 6, tipo_registro=canteiro → Manejo) — ver
  // lib/relatorio-turno.ts, hrefSubFormulario.
  const relatorioItemId = searchParams.get("relatorio_item");
  const voltarHref = searchParams.get("voltar");

  const [passo, setPasso] = useState(1);

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [canteiros, setCanteiros] = useState<Canteiro[]>([]);
  const [tiposCarrinho, setTiposCarrinho] = useState<TipoCarrinho[]>([]);

  const [canteiroId, setCanteiroId] = useState<string | null>(null);
  const [plantiosCanteiro, setPlantiosCanteiro] = useState<PlantioComCultura[]>([]);
  const [tipoManejo, setTipoManejo] = useState<TipoManejo | null>(null);
  const [plantioIdsSelecionados, setPlantioIdsSelecionados] = useState<string[]>([]);
  const [fotos, setFotos] = useState<File[]>([]);
  const [observacao, setObservacao] = useState("");
  // Carrinho de mão (Sprint A, item 2) — opcional, um tipo por registro.
  const [tipoCarrinhoId, setTipoCarrinhoId] = useState<string | null>(null);
  const [quantidadeCarrinhos, setQuantidadeCarrinhos] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"ok" | "offline" | null>(null);
  const [pendentesOffline, setPendentesOffline] = useState(() => filaOffline.contar());

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        const [listaCanteiros, listaCarrinhos] = await Promise.all([
          listarCanteiros(),
          listarTiposCarrinho(),
        ]);
        if (!cancelado) {
          setCanteiros(listaCanteiros);
          setTiposCarrinho(listaCarrinhos);
        }
      } catch {
        if (!cancelado) {
          setErroCarregamento(
            "Não deu pra carregar os canteiros agora. Confira a internet e tente de novo.",
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
      const { restantes } = await filaOffline.tentarEnviar(salvarRegistroManejo);
      setPendentesOffline(restantes);
    }
    tentarEnviar();
    window.addEventListener("online", tentarEnviar);
    return () => window.removeEventListener("online", tentarEnviar);
  }, []);

  function irPara(novoPasso: number) {
    setPasso(Math.min(Math.max(novoPasso, 1), TOTAL_PASSOS));
  }

  async function escolherCanteiro(id: string) {
    setCanteiroId(id);
    try {
      setPlantiosCanteiro(await listarPlantiosAtivosPorCanteiro(id));
    } catch {
      setPlantiosCanteiro([]);
    }
    irPara(2);
  }

  function escolherTipoManejo(tipo: TipoManejo) {
    setTipoManejo(tipo);
    setPlantioIdsSelecionados([]);
    irPara(exigeSelecaoDePlantios(tipo) ? 3 : 4);
  }

  function alternarPlantioSelecionado(id: string) {
    setPlantioIdsSelecionados((atual) =>
      atual.includes(id) ? atual.filter((p) => p !== id) : [...atual, id],
    );
  }

  async function salvar() {
    if (!canteiroId || !tipoManejo) return;
    setSalvando(true);
    setErroSalvar(null);

    let fotoUrl: string | null = null;
    if (fotos[0]) {
      try {
        fotoUrl = await enviarFotoRegistro(fotos[0], "manejo");
      } catch {
        // Sem internet ou bucket ainda não configurado: segue sem foto em
        // vez de travar o registro inteiro nela (foto é opcional aqui).
        fotoUrl = null;
      }
    }

    const plantioIds = exigeSelecaoDePlantios(tipoManejo)
      ? plantioIdsSelecionados
      : tipoManejo === "adubacao" || tipoManejo === "capina_seletiva"
        ? plantiosCanteiro.map((p) => p.id)
        : [];

    const registro: NovoRegistroManejo = {
      canteiro_id: canteiroId,
      tipo_manejo: tipoManejo,
      foto_url: fotoUrl,
      observacao: observacao.trim() ? observacao.trim() : null,
      evento_agenda_id: eventoAgendaId,
      plantioIds,
      tipo_carrinho_id: tipoCarrinhoId,
      quantidade_carrinhos: quantidadeCarrinhos.trim() ? Number(quantidadeCarrinhos) : null,
      peso_kg_calculado: pesoCarrinhoCalculado,
    };

    try {
      const registroId = await salvarRegistroManejo(registro);
      if (fotos.length > 1 && registroId) {
        try {
          const extras = await Promise.all(fotos.slice(1).map((f) => enviarFotoRegistro(f, "manejo")));
          await salvarFotosExtras("registros_manejo", registroId, extras);
        } catch {
          // segue sem as extras — a capa já foi salva com o registro.
        }
      }

      // Aberta a partir do Relatório do Turno (Sprint A, item 6): vincula
      // e volta pro relatório em vez da tela de sucesso daqui.
      if (relatorioItemId) {
        try {
          await vincularRegistroAoItem(relatorioItemId, "registros_manejo", registroId);
        } catch {
          // segue sem o vínculo — o registro já está salvo.
        }
        if (voltarHref) {
          router.push(decodeURIComponent(voltarHref));
          return;
        }
      }
      setResultado("ok");
    } catch {
      filaOffline.enfileirar(registro);
      setPendentesOffline(filaOffline.contar());
      // Enfileirado sem internet: sem id pra vincular ao item do
      // Relatório do Turno (limitação conhecida, seção 11e) — volta pro
      // relatório mesmo assim, o item fica sem marcar.
      if (relatorioItemId && voltarHref) {
        router.push(decodeURIComponent(voltarHref));
        return;
      }
      setResultado("offline");
    } finally {
      setSalvando(false);
    }
  }

  function recomecar() {
    setPasso(1);
    setCanteiroId(null);
    setPlantiosCanteiro([]);
    setTipoManejo(null);
    setPlantioIdsSelecionados([]);
    setFotos([]);
    setObservacao("");
    setTipoCarrinhoId(null);
    setQuantidadeCarrinhos("");
    setResultado(null);
    setErroSalvar(null);
  }

  const canteiroSelecionado = canteiros.find((c) => c.id === canteiroId);
  const tipoSelecionado = TIPOS_MANEJO.find((t) => t.valor === tipoManejo);
  const tipoCarrinhoSelecionado = tiposCarrinho.find((t) => t.id === tipoCarrinhoId);
  const pesoCarrinhoCalculado =
    tipoCarrinhoSelecionado && quantidadeCarrinhos.trim() && !Number.isNaN(Number(quantidadeCarrinhos))
      ? calcularPesoCarrinho(Number(quantidadeCarrinhos), tipoCarrinhoSelecionado.peso_estimado_kg)
      : null;

  if (carregando) {
    return (
      <TelaBase titulo="Registrar manejo" icone="🌾" voltarHref="/patio/horta">
        <p className="text-center text-sm text-zinc-600">Carregando canteiros…</p>
      </TelaBase>
    );
  }

  if (erroCarregamento) {
    return (
      <TelaBase titulo="Registrar manejo" icone="🌾" voltarHref="/patio/horta">
        <p className="text-center text-sm text-red-700">{erroCarregamento}</p>
      </TelaBase>
    );
  }

  if (resultado) {
    return (
      <TelaBase titulo="Registrar manejo" icone="🌾" voltarHref="/patio/horta">
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
              ? "Registro de manejo salvo com sucesso."
              : "Assim que a conexão voltar, este registro é enviado sozinho. Não precisa fazer nada."}
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <button
              type="button"
              onClick={recomecar}
              className="rounded-full bg-[#2e6b3e] px-6 py-3 text-sm font-semibold text-white"
            >
              Registrar outro manejo
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
    <TelaBase titulo="Registrar manejo" icone="🌾" voltarHref="/patio/horta">
      <BarraContexto canteiro={canteiroSelecionado} tipo={tipoSelecionado?.rotulo ?? null} passo={passo} />
      <PontosPasso passo={passo} total={TOTAL_PASSOS} />

      {pendentesOffline > 0 && (
        <p className="mb-3 rounded-lg border border-dashed border-zinc-400 bg-white px-3 py-2 text-center text-[11px] text-zinc-600">
          📶 {pendentesOffline} registro(s) esperando internet pra enviar.
        </p>
      )}

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
          {canteiros.length === 0 && (
            <p className="text-center text-sm text-zinc-600">
              Nenhum canteiro cadastrado ainda. Cadastre pelo menos um canteiro (Mais → Cadastro) pra continuar.
            </p>
          )}
        </Passo>
      )}

      {passo === 2 && (
        <Passo titulo="Que tipo de manejo foi feito?">
          <div className="grid grid-cols-2 gap-3">
            {TIPOS_MANEJO.map((t) => (
              <BotaoGrande
                key={t.valor}
                icone={t.icone}
                rotulo={t.rotulo}
                selecionado={t.valor === tipoManejo}
                onClick={() => escolherTipoManejo(t.valor)}
              />
            ))}
          </div>
        </Passo>
      )}

      {passo === 3 && exigeSelecaoDePlantios(tipoManejo) && (
        <Passo titulo="Quais plantios foram afetados?">
          <div className="flex flex-col gap-2">
            {plantiosCanteiro.map((p) => {
              const selecionado = plantioIdsSelecionados.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => alternarPlantioSelecionado(p.id)}
                  className={[
                    "flex items-center justify-between rounded-lg border-2 px-3 py-2 text-left text-sm font-semibold",
                    selecionado ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]" : "border-zinc-300 bg-white text-zinc-800",
                  ].join(" ")}
                >
                  {p.cultura_nome}
                  {selecionado && <span aria-hidden="true">✓</span>}
                </button>
              );
            })}
            {plantiosCanteiro.length === 0 && (
              <p className="text-center text-xs text-zinc-500">Nenhum plantio ativo nesse canteiro.</p>
            )}
          </div>
          <BotaoAvancar onClick={() => irPara(4)} desabilitado={plantioIdsSelecionados.length === 0} />
        </Passo>
      )}

      {passo === 4 && (
        <Passo titulo="Foto e observação (opcionais)">
          <SeletorFotos fotos={fotos} onMudar={setFotos} />

          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder='Ex.: "capina em volta dos pés de couve"...'
            className="mt-4 min-h-24 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
          />

          {tiposCarrinho.length > 0 && (
            <div className="mt-4 rounded-xl border-2 border-dashed border-zinc-400 bg-[#f1efe6] p-3">
              <p className="mb-2 text-xs font-bold text-zinc-700">
                Usou carrinho de mão pra levar composto/poda pro canteiro? (opcional)
              </p>
              <div className="mb-2 grid grid-cols-2 gap-2">
                {tiposCarrinho.map((tc) => (
                  <button
                    key={tc.id}
                    type="button"
                    onClick={() => setTipoCarrinhoId(tc.id === tipoCarrinhoId ? null : tc.id)}
                    className={[
                      "rounded-lg border-2 px-3 py-2 text-left text-xs font-semibold",
                      tc.id === tipoCarrinhoId
                        ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]"
                        : "border-zinc-300 bg-white text-zinc-700",
                    ].join(" ")}
                  >
                    🛒 {tc.nome}
                  </button>
                ))}
              </div>
              {tipoCarrinhoId && (
                <label className="block text-[11px] font-semibold text-zinc-600">
                  Quantidade de carrinhos
                  <input
                    value={quantidadeCarrinhos}
                    onChange={(e) => setQuantidadeCarrinhos(e.target.value)}
                    inputMode="decimal"
                    placeholder="Ex.: 3"
                    className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
                  />
                </label>
              )}
              {pesoCarrinhoCalculado !== null && (
                <p className="mt-2 text-[11px] text-zinc-600">
                  ≈ {pesoCarrinhoCalculado} kg ({quantidadeCarrinhos} × {tipoCarrinhoSelecionado?.peso_estimado_kg} kg)
                </p>
              )}
            </div>
          )}

          <BotaoAvancar onClick={() => irPara(5)} />
        </Passo>
      )}

      {passo === 5 && (
        <Passo titulo="Confere antes de salvar">
          <div className="rounded-xl border-2 border-zinc-800 bg-white p-3 text-sm">
            <LinhaResumo rotulo="Canteiro" valor={canteiroSelecionado?.nome ?? "—"} onEditar={() => irPara(1)} />
            <LinhaResumo rotulo="Tipo de manejo" valor={tipoSelecionado?.rotulo ?? "—"} onEditar={() => irPara(2)} />
            {exigeSelecaoDePlantios(tipoManejo) && (
              <LinhaResumo
                rotulo="Plantios afetados"
                valor={`${plantioIdsSelecionados.length} selecionado(s)`}
                onEditar={() => irPara(3)}
              />
            )}
            {(tipoManejo === "adubacao" || tipoManejo === "capina_seletiva") && (
              <LinhaResumo
                rotulo="Plantios afetados"
                valor={`todos os ${plantiosCanteiro.length} ativos do canteiro`}
                onEditar={() => irPara(1)}
              />
            )}
            <LinhaResumo
              rotulo="Fotos"
              valor={fotos.length === 0 ? "sem foto" : `${fotos.length} anexada(s)`}
              onEditar={() => irPara(4)}
            />
            <LinhaResumo rotulo="Observação" valor={observacao.trim() || "sem observação"} onEditar={() => irPara(4)} />
            <LinhaResumo
              rotulo="Carrinho de mão"
              valor={
                tipoCarrinhoSelecionado && pesoCarrinhoCalculado !== null
                  ? `${quantidadeCarrinhos} ${tipoCarrinhoSelecionado.nome.toLowerCase()}(s) ≈ ${pesoCarrinhoCalculado} kg`
                  : "não usou"
              }
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
          onClick={() => irPara(passo === 4 && !exigeSelecaoDePlantios(tipoManejo) ? 2 : passo - 1)}
          className="mt-4 block w-full text-center text-xs text-zinc-500 underline"
        >
          voltar
        </button>
      )}
    </TelaBase>
  );
}

export default function ManejoPage() {
  return (
    <Suspense
      fallback={
        <TelaBase titulo="Registrar manejo" icone="🌾" voltarHref="/patio/horta">
          <p className="text-center text-sm text-zinc-600">Carregando…</p>
        </TelaBase>
      }
    >
      <ManejoConteudo />
    </Suspense>
  );
}

function BarraContexto({
  canteiro,
  tipo,
  passo,
}: {
  canteiro?: Canteiro;
  tipo: string | null;
  passo: number;
}) {
  if (passo === 1) return null;
  return (
    <div className="mb-2 flex justify-between rounded-lg border border-zinc-300 bg-[#f1efe6] px-3 py-1 text-[11px] text-zinc-600">
      <span>🌻 {canteiro?.nome ?? "—"}</span>
      {tipo && <span>{tipo}</span>}
    </div>
  );
}
