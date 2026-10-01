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
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  ErroValidacaoBombonas,
  enviarFotoRegistro,
  listarCaixas,
  listarParceirosAtivos,
  rotuloStatusCaixa,
  salvarFotosExtras,
  salvarRegistroAlimentacaoComBombonas,
} from "@/lib/patio";
import { vincularRegistroAoItem } from "@/lib/relatorio-turno";
import { criarFilaOffline } from "@/lib/fila-offline";
import type { Caixa, NovoRegistroAlimentacao, Parceiro, TipoResiduo } from "@/lib/types";
import { IconeCaixaDagua } from "@/components/icone-caixa-dagua";
import {
  BotaoAvancar,
  BotaoGrande,
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
// celular (formato antigo, sem `bombonas`) não perde nada nessa mudança:
// salvarRegistroAlimentacaoComBombonas trata os dois formatos (ver
// lib/patio.ts).
const filaOffline = criarFilaOffline<NovoRegistroAlimentacao>(
  "app-coletivo:fila-registros-alimentacao",
);

const TIPOS_RESIDUO: { valor: TipoResiduo; icone: string; rotulo: string }[] = [
  { valor: "alimento", icone: "🍎", rotulo: "Alimento" },
  { valor: "poda_verde", icone: "🌿", rotulo: "Poda / verde" },
  { valor: "outro_organico", icone: "🥬", rotulo: "Outro orgânico" },
];

// Uma linha de bombona no formulário (Sprint A, item 3 — sprint doc, seção
// 7). `chave` é só identidade de UI (key do React), não é coluna de nada.
interface LinhaBombona {
  chave: string;
  numero: string;
  peso: string;
}

function linhaBombonaVazia(): LinhaBombona {
  return { chave: crypto.randomUUID(), numero: "", peso: "" };
}

// Aceita vírgula como separador decimal (regra da sprint, item 1 da Etapa
// 1) — mesmo espírito de CampoPeso em fluxo-registro.tsx.
function paraNumero(texto: string): number {
  return Number(texto.replace(",", "."));
}

// useSearchParams exige um limite de Suspense em volta (regra do Next.js
// pra Client Components) — por isso o export default vira só um wrapper,
// ver RegistrarAlimentacaoPage no fim do arquivo.
function RegistrarAlimentacaoConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Preenchido quando a tela é aberta a partir de um link da Agenda
  // (evento tipo "atividade") — ver lib/agenda.ts, LINKS_REGISTRO_ATIVIDADE.
  const eventoAgendaId = searchParams.get("evento_agenda_id");
  // Preenchidos quando a tela é aberta a partir do Relatório do Turno
  // (Sprint A, item 6 — "Registrar dado" num item tipo_registro=compostagem)
  // — ver lib/relatorio-turno.ts, hrefSubFormulario.
  const relatorioItemId = searchParams.get("relatorio_item");
  const voltarHref = searchParams.get("voltar");

  const [passo, setPasso] = useState(1);

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [caixas, setCaixas] = useState<Caixa[]>([]);

  const [parceiroId, setParceiroId] = useState<string | null>(null);
  const [caixaId, setCaixaId] = useState<string | null>(null);
  const [bombonas, setBombonas] = useState<LinhaBombona[]>([linhaBombonaVazia()]);
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
  // e de novo sempre que a conexão voltar. salvarRegistroAlimentacaoComBombonas
  // decide sozinho entre RPC (formato novo) e insert direto (formato
  // antigo já enfileirado antes desta sprint) — ver lib/patio.ts.
  useEffect(() => {
    async function tentarEnviar() {
      const { restantes } = await filaOffline.tentarEnviar(salvarRegistroAlimentacaoComBombonas);
      setPendentesOffline(restantes);
    }
    tentarEnviar();
    window.addEventListener("online", tentarEnviar);
    return () => window.removeEventListener("online", tentarEnviar);
  }, []);

  function irPara(novoPasso: number) {
    setPasso(Math.min(Math.max(novoPasso, 1), TOTAL_PASSOS));
  }

  function atualizarBombona(chave: string, patch: Partial<LinhaBombona>) {
    setBombonas((atual) => atual.map((b) => (b.chave === chave ? { ...b, ...patch } : b)));
  }

  function adicionarBombona() {
    setBombonas((atual) => [...atual, linhaBombonaVazia()]);
  }

  function removerBombona(chave: string) {
    setBombonas((atual) => (atual.length <= 1 ? atual : atual.filter((b) => b.chave !== chave)));
  }

  // Número repetido na mesma coleta — bloqueado na tela (a constraint
  // unique no banco é a rede de segurança, não a mensagem, ver sprint doc
  // seção 7). Comparação já com o texto normalizado (trim).
  const numerosRepetidos = useMemo(() => {
    const vistos = new Map<string, number>();
    for (const b of bombonas) {
      const chave = b.numero.trim();
      if (!chave) continue;
      vistos.set(chave, (vistos.get(chave) ?? 0) + 1);
    }
    return new Set([...vistos.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  }, [bombonas]);

  const bombonasValidas = bombonas.every((b) => {
    const peso = paraNumero(b.peso);
    return b.numero.trim().length > 0 && b.peso.trim().length > 0 && !Number.isNaN(peso) && peso > 0;
  });
  const semDuplicatas = numerosRepetidos.size === 0;
  const pesoTotal = bombonas.reduce((soma, b) => {
    const n = paraNumero(b.peso);
    return soma + (Number.isNaN(n) ? 0 : n);
  }, 0);

  async function salvar() {
    if (!parceiroId || !caixaId || !bombonasValidas || !semDuplicatas) return;
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
      peso_kg: pesoTotal,
      tipo_residuo: tipoResiduo,
      temperatura_c: temperaturaAtiva ? temperatura : null,
      foto_url: fotoUrl,
      observacao: observacao.trim() ? observacao.trim() : null,
      evento_agenda_id: eventoAgendaId,
      bombonas: bombonas.map((b) => ({ numero_bombona: b.numero.trim(), peso_kg: paraNumero(b.peso) })),
    };

    try {
      const registroId = await salvarRegistroAlimentacaoComBombonas(registro);
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

      // Aberta a partir do Relatório do Turno (Sprint A, item 6): vincula
      // o registro ao item e volta pro relatório em vez de mostrar a tela
      // de sucesso daqui — melhor esforço (se o vínculo falhar, o
      // registro principal já está salvo mesmo assim).
      if (relatorioItemId) {
        try {
          await vincularRegistroAoItem(relatorioItemId, "registros_alimentacao", registroId);
        } catch {
          // segue sem o vínculo — o registro já está salvo.
        }
        if (voltarHref) {
          router.push(decodeURIComponent(voltarHref));
          return;
        }
      }
      setResultado("ok");
    } catch (erro) {
      // Erro de dado (bombona inválida) — a RPC recusou, e tentar de novo
      // offline não vai resolver: mostra a mensagem e deixa a pessoa
      // corrigir aqui mesmo, sem enfileirar nem avançar de tela.
      if (erro instanceof ErroValidacaoBombonas) {
        setErroSalvar(erro.message);
        return;
      }
      filaOffline.enfileirar(registro);
      setPendentesOffline(filaOffline.contar());
      // Enfileirado sem internet: não há id pra vincular ao item do
      // Relatório do Turno (limitação conhecida, seção 11e do sprint doc)
      // — mesmo assim volta pro relatório, que o item simplesmente fica
      // sem marcar.
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
    setParceiroId(null);
    setCaixaId(null);
    setBombonas([linhaBombonaVazia()]);
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
          <div className="flex flex-col gap-2">
            {bombonas.map((b, indice) => {
              const repetida = b.numero.trim().length > 0 && numerosRepetidos.has(b.numero.trim());
              return (
                <div key={b.chave} className="rounded-xl border-2 border-zinc-800 bg-white p-2.5">
                  <div className="flex items-center gap-2">
                    <label className="flex-1 text-[11px] font-semibold text-zinc-600">
                      Nº da bombona
                      <input
                        value={b.numero}
                        onChange={(e) => atualizarBombona(b.chave, { numero: e.target.value })}
                        placeholder="Ex.: 12"
                        autoFocus={indice === 0}
                        className={[
                          "mt-1 w-full rounded-lg border-2 p-2 text-sm",
                          repetida ? "border-red-400" : "border-zinc-300",
                        ].join(" ")}
                      />
                    </label>
                    <label className="flex-1 text-[11px] font-semibold text-zinc-600">
                      Peso (kg)
                      <input
                        value={b.peso}
                        onChange={(e) => atualizarBombona(b.chave, { peso: e.target.value })}
                        inputMode="decimal"
                        placeholder="Ex.: 8,5"
                        className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
                      />
                    </label>
                    {bombonas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerBombona(b.chave)}
                        aria-label={`Remover bombona ${indice + 1}`}
                        className="mt-5 shrink-0 text-sm font-bold text-red-700"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {repetida && (
                    <p className="mt-1 text-[10px] text-red-700">
                      Já tem outra bombona com esse número nesta coleta.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={adicionarBombona}
            className="mt-2 w-full rounded-xl border-2 border-dashed border-[#2e6b3e] py-2 text-xs font-bold text-[#2e6b3e]"
          >
            + outra bombona
          </button>

          <p className="mt-3 text-center text-sm font-bold text-zinc-900">
            Total: {pesoTotal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg
          </p>

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
          <BotaoAvancar onClick={() => irPara(4)} desabilitado={!bombonasValidas || !semDuplicatas} />
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
            {bombonas.map((b, indice) => (
              <LinhaResumo
                key={b.chave}
                rotulo={`Bombona ${indice + 1}`}
                valor={`nº ${b.numero || "—"} · ${b.peso || "0"} kg`}
                onEditar={() => irPara(3)}
              />
            ))}
            <LinhaResumo
              rotulo="Total"
              valor={`${pesoTotal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`}
              onEditar={() => irPara(3)}
            />
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
            disabled={salvando || !bombonasValidas || !semDuplicatas}
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
