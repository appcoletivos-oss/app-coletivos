"use client";

// Compostagem → Registrar compostagem
//
// Fluxo de 6 passos, uma pergunta por tela, em vez de um formulário longo
// — decisão de acessibilidade do projeto (ver wireframe publicado e
// Registro Geral, seção 2.1). "Quem registrou" e "data" nunca são
// perguntados: vêm da sessão de login e do relógio do aparelho.
//
// Loja e caixa são carregadas do banco (tabelas `parceiros` e `caixas`),
// não hardcoded — a equipe pode renomear ou trocar parceiros pela tela de
// Cadastro sem precisar mexer em código.
//
// Os pedaços de tela (TelaBase, Passo, Stepper etc.) vêm de
// @/components/fluxo-registro — compartilhados com Registrar colheita
// (Horta), pra não duplicar essa UI a cada fluxo novo.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  enviarFotoRegistro,
  listarCaixas,
  listarParceirosAtivos,
  rotuloStatusCaixa,
  salvarFotosExtras,
  salvarRegistroAlimentacao,
} from "@/lib/patio";
import { criarFilaOffline } from "@/lib/fila-offline";
import type { Caixa, NovoRegistroAlimentacao, Parceiro, TipoResiduo } from "@/lib/types";
import { IconeCaixaDagua } from "@/components/icone-caixa-dagua";
import {
  BotaoAvancar,
  BotaoGrande,
  CampoPeso,
  LinhaResumo,
  Passo,
  PontosPasso,
  SeletorFotos,
  Stepper,
  TelaBase,
} from "@/components/fluxo-registro";

const TOTAL_PASSOS = 6;

// Mesma chave de antes — a fila genérica só trocou a forma de guardar,
// não o formato salvo, então quem já tinha registros pendentes no
// celular não perde nada nessa mudança.
const filaOffline = criarFilaOffline<NovoRegistroAlimentacao>(
  "app-coletivo:fila-registros-alimentacao",
);

const TIPOS_RESIDUO: { valor: TipoResiduo; icone: string; rotulo: string }[] = [
  { valor: "alimento", icone: "🍎", rotulo: "Alimento" },
  { valor: "poda_verde", icone: "🌿", rotulo: "Poda / verde" },
  { valor: "outro_organico", icone: "🥬", rotulo: "Outro orgânico" },
];

// useSearchParams exige um limite de Suspense em volta (regra do Next.js
// pra Client Components) — por isso o export default vira só um wrapper,
// ver RegistrarAlimentacaoPage no fim do arquivo.
function RegistrarAlimentacaoConteudo() {
  // Preenchido quando a tela é aberta a partir de um link da Agenda
  // (evento tipo "atividade") — ver lib/agenda.ts, LINKS_REGISTRO_ATIVIDADE.
  const eventoAgendaId = useSearchParams().get("evento_agenda_id");

  const [passo, setPasso] = useState(1);

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [caixas, setCaixas] = useState<Caixa[]>([]);

  const [parceiroId, setParceiroId] = useState<string | null>(null);
  const [caixaId, setCaixaId] = useState<string | null>(null);
  const [peso, setPeso] = useState(5);
  const [tipoResiduo, setTipoResiduo] = useState<TipoResiduo>("alimento");
  const [temperaturaAtiva, setTemperaturaAtiva] = useState(true);
  const [temperatura, setTemperatura] = useState(30);
  const [fotos, setFotos] = useState<File[]>([]);
  const [observacao, setObservacao] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"ok" | "offline" | null>(null);
  // Lê a fila offline uma vez, no primeiro render (inicializador
  // preguiçoso do useState) — evita chamar setState direto dentro de um
  // efeito, que o eslint (react-hooks/set-state-in-effect) sinaliza como
  // risco de renderizações em cascata.
  const [pendentesOffline, setPendentesOffline] = useState(() => filaOffline.contar());

  // Carrega parceiros e caixas ao abrir a tela.
  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        const [listaParceiros, listaCaixas] = await Promise.all([
          listarParceirosAtivos(),
          listarCaixas(),
        ]);
        if (cancelado) return;
        setParceiros(listaParceiros);
        setCaixas(listaCaixas);
      } catch {
        if (!cancelado) {
          setErroCarregamento(
            "Não deu pra carregar as lojas e caixas agora. Confira a internet e tente de novo.",
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

  // Tenta esvaziar a fila offline sozinho quando a tela abre com internet,
  // e de novo sempre que a conexão voltar.
  useEffect(() => {
    async function tentarEnviar() {
      const { restantes } = await filaOffline.tentarEnviar(salvarRegistroAlimentacao);
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
    if (!parceiroId || !caixaId) return;
    setSalvando(true);
    setErroSalvar(null);

    let fotoUrl: string | null = null;
    if (fotos[0]) {
      try {
        fotoUrl = await enviarFotoRegistro(fotos[0]);
      } catch {
        // Sem internet ou bucket ainda não configurado: segue sem foto em
        // vez de travar o registro inteiro nela.
        fotoUrl = null;
      }
    }

    const registro: NovoRegistroAlimentacao = {
      parceiro_id: parceiroId,
      caixa_id: caixaId,
      peso_kg: peso,
      tipo_residuo: tipoResiduo,
      temperatura_c: temperaturaAtiva ? temperatura : null,
      foto_url: fotoUrl,
      observacao: observacao.trim() ? observacao.trim() : null,
      evento_agenda_id: eventoAgendaId,
    };

    try {
      const registroId = await salvarRegistroAlimentacao(registro);
      // Fotos extras (além da capa) — melhor esforço: se o upload falhar
      // (ex.: internet caiu no meio), o registro principal já está salvo,
      // não trava a tela por causa de foto extra.
      if (fotos.length > 1 && registroId) {
        try {
          const extras = await Promise.all(fotos.slice(1).map((f) => enviarFotoRegistro(f)));
          await salvarFotosExtras("registros_alimentacao", registroId, extras);
        } catch {
          // segue sem as extras — a capa já foi salva com o registro.
        }
      }
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
    setParceiroId(null);
    setCaixaId(null);
    setPeso(5);
    setTipoResiduo("alimento");
    setTemperaturaAtiva(true);
    setTemperatura(30);
    setFotos([]);
    setObservacao("");
    setResultado(null);
    setErroSalvar(null);
  }

  const parceiroSelecionado = parceiros.find((p) => p.id === parceiroId);
  const caixaSelecionada = caixas.find((c) => c.id === caixaId);
  const tipoSelecionado = TIPOS_RESIDUO.find((t) => t.valor === tipoResiduo);

  if (carregando) {
    return (
      <TelaBase titulo="Registrar compostagem" icone="🌱" voltarHref="/patio/compostagem">
        <p className="text-center text-sm text-zinc-600">Carregando lojas e caixas…</p>
      </TelaBase>
    );
  }

  if (erroCarregamento) {
    return (
      <TelaBase titulo="Registrar compostagem" icone="🌱" voltarHref="/patio/compostagem">
        <p className="text-center text-sm text-red-700">{erroCarregamento}</p>
      </TelaBase>
    );
  }

  if (resultado) {
    return (
      <TelaBase titulo="Registrar compostagem" icone="🌱" voltarHref="/patio/compostagem">
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
              ? "Registro de compostagem salvo com sucesso."
              : "Assim que a conexão voltar, este registro é enviado sozinho. Não precisa fazer nada."}
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <button
              type="button"
              onClick={recomecar}
              className="rounded-full bg-[#2e6b3e] px-6 py-3 text-sm font-semibold text-white"
            >
              Registrar outra compostagem
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
    <TelaBase titulo="Registrar compostagem" icone="🌱" voltarHref="/patio/compostagem">
      <BarraContexto parceiro={parceiroSelecionado} caixa={caixaSelecionada} passo={passo} />
      <PontosPasso passo={passo} total={TOTAL_PASSOS} />

      {pendentesOffline > 0 && (
        <p className="mb-3 rounded-lg border border-dashed border-zinc-400 bg-white px-3 py-2 text-center text-[11px] text-zinc-600">
          📶 {pendentesOffline} registro(s) esperando internet pra enviar.
        </p>
      )}

      {passo === 1 && (
        <Passo titulo="De qual loja veio esse resíduo?">
          <div className="grid grid-cols-2 gap-3">
            {parceiros.map((p) => (
              <BotaoGrande
                key={p.id}
                icone={p.tipo === "construtora" ? "🏗️" : "🍽️"}
                rotulo={p.nome}
                selecionado={p.id === parceiroId}
                onClick={() => {
                  setParceiroId(p.id);
                  irPara(2);
                }}
              />
            ))}
          </div>
          {parceiros.length === 0 && (
            <p className="text-center text-sm text-zinc-600">
              Nenhuma loja cadastrada ainda. Cadastre pelo menos uma loja pra continuar.
            </p>
          )}
        </Passo>
      )}

      {passo === 2 && (
        <Passo titulo="Em qual caixa vai?">
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
                    irPara(3);
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

      {passo === 3 && (
        <Passo titulo="Quanto pesou e que tipo era?">
          <CampoPeso valor={peso} onMudar={setPeso} autoFocus />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {TIPOS_RESIDUO.map((t) => (
              <button
                key={t.valor}
                type="button"
                onClick={() => setTipoResiduo(t.valor)}
                className={[
                  "rounded-full border-2 px-4 py-2 text-xs font-semibold",
                  t.valor === tipoResiduo
                    ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]"
                    : "border-zinc-300 text-zinc-700",
                ].join(" ")}
              >
                {t.icone} {t.rotulo}
              </button>
            ))}
          </div>
          <BotaoAvancar onClick={() => irPara(4)} />
        </Passo>
      )}

      {passo === 4 && (
        <Passo titulo="Temperatura e uma foto">
          {temperaturaAtiva ? (
            <>
              <Stepper
                valor={temperatura}
                unidade="°C"
                passoIncremento={1}
                minimo={0}
                onMudar={setTemperatura}
              />
              <button
                type="button"
                onClick={() => setTemperaturaAtiva(false)}
                className="mx-auto mt-2 block text-[11px] text-zinc-400 underline"
              >
                pular temperatura
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setTemperaturaAtiva(true)}
              className="mx-auto mb-2 block text-xs text-zinc-500 underline"
            >
              medir temperatura afinal
            </button>
          )}

          <div className="mt-4">
            <SeletorFotos fotos={fotos} onMudar={setFotos} obrigatoria />
          </div>

          <BotaoAvancar onClick={() => irPara(5)} desabilitado={fotos.length === 0} />
        </Passo>
      )}

      {passo === 5 && (
        <Passo titulo="Quer contar mais alguma coisa?">
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder='Ex.: "chegou com bastante casca de fruta hoje"...'
            className="min-h-24 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
          />
          <div className="mt-4 flex flex-col gap-2">
            <BotaoAvancar onClick={() => irPara(6)} texto="Continuar" />
            <button
              type="button"
              onClick={() => {
                setObservacao("");
                irPara(6);
              }}
              className="mx-auto text-[11px] text-zinc-400 underline"
            >
              pular, sem observação
            </button>
          </div>
        </Passo>
      )}

      {passo === 6 && (
        <Passo titulo="Confere antes de salvar">
          <div className="rounded-xl border-2 border-zinc-800 bg-white p-3 text-sm">
            <LinhaResumo rotulo="Loja" valor={parceiroSelecionado?.nome ?? "—"} onEditar={() => irPara(1)} />
            <LinhaResumo rotulo="Caixa" valor={caixaSelecionada ? `Caixa ${caixaSelecionada.numero}` : "—"} onEditar={() => irPara(2)} />
            <LinhaResumo rotulo="Peso" valor={`${peso} kg`} onEditar={() => irPara(3)} />
            <LinhaResumo rotulo="Tipo" valor={tipoSelecionado?.rotulo ?? "—"} onEditar={() => irPara(3)} />
            <LinhaResumo
              rotulo="Temperatura"
              valor={temperaturaAtiva ? `${temperatura} °C` : "não medida"}
              onEditar={() => irPara(4)}
            />
            <LinhaResumo
              rotulo="Fotos"
              valor={fotos.length === 0 ? "sem foto" : `${fotos.length} anexada(s)`}
              onEditar={() => irPara(4)}
            />
            <LinhaResumo rotulo="Observação" valor={observacao.trim() || "sem observação"} onEditar={() => irPara(5)} ultima />
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

export default function RegistrarAlimentacaoPage() {
  return (
    <Suspense
      fallback={
        <TelaBase titulo="Registrar compostagem" icone="🌱" voltarHref="/patio/compostagem">
          <p className="text-center text-sm text-zinc-600">Carregando…</p>
        </TelaBase>
      }
    >
      <RegistrarAlimentacaoConteudo />
    </Suspense>
  );
}

function BarraContexto({
  parceiro,
  caixa,
  passo,
}: {
  parceiro?: Parceiro;
  caixa?: Caixa;
  passo: number;
}) {
  if (passo === 1) return null;
  return (
    <div className="mb-2 flex justify-between rounded-lg border border-zinc-300 bg-[#f1efe6] px-3 py-1 text-[11px] text-zinc-600">
      <span>🏪 {parceiro?.nome ?? "—"}</span>
      {caixa && (
        <span className="inline-flex items-center gap-1">
          <IconeCaixaDagua /> Caixa {caixa.numero}
        </span>
      )}
    </div>
  );
}
