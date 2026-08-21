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
// Cadastro (ainda não construída) sem precisar mexer em código.

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  enviarFotoRegistro,
  listarCaixas,
  listarParceirosAtivos,
  salvarRegistroAlimentacao,
} from "@/lib/patio";
import {
  contarFilaOffline,
  enfileirarRegistroOffline,
  tentarEnviarFilaOffline,
} from "@/lib/fila-offline";
import type { Caixa, NovoRegistroAlimentacao, Parceiro, TipoResiduo } from "@/lib/types";
import { IconeCaixaDagua } from "@/components/icone-caixa-dagua";

const TOTAL_PASSOS = 6;

const TIPOS_RESIDUO: { valor: TipoResiduo; icone: string; rotulo: string }[] = [
  { valor: "alimento", icone: "🍎", rotulo: "Alimento" },
  { valor: "poda_verde", icone: "🌿", rotulo: "Poda / verde" },
  { valor: "outro_organico", icone: "🥬", rotulo: "Outro orgânico" },
];

function rotuloStatusCaixa(status: Caixa["status"]): string | null {
  if (status === "nao_ativada") return "não ativada";
  if (status === "nova") return "nova, aguardando";
  if (status === "desativada") return "desativada";
  return null;
}

export default function RegistrarAlimentacaoPage() {
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
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"ok" | "offline" | null>(null);
  // Lê a fila offline uma vez, no primeiro render (inicializador
  // preguiçoso do useState) — evita chamar setState direto dentro de um
  // efeito, que o eslint (react-hooks/set-state-in-effect) sinaliza como
  // risco de renderizações em cascata.
  const [pendentesOffline, setPendentesOffline] = useState(() => contarFilaOffline());

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
      const { restantes } = await tentarEnviarFilaOffline(salvarRegistroAlimentacao);
      setPendentesOffline(restantes);
    }
    tentarEnviar();
    window.addEventListener("online", tentarEnviar);
    return () => window.removeEventListener("online", tentarEnviar);
  }, []);

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

  async function salvar() {
    if (!parceiroId || !caixaId) return;
    setSalvando(true);
    setErroSalvar(null);

    let fotoUrl: string | null = null;
    if (foto) {
      try {
        fotoUrl = await enviarFotoRegistro(foto);
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
    };

    try {
      await salvarRegistroAlimentacao(registro);
      setResultado("ok");
    } catch {
      enfileirarRegistroOffline(registro);
      setPendentesOffline(contarFilaOffline());
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
    selecionarFoto(null);
    setObservacao("");
    setResultado(null);
    setErroSalvar(null);
  }

  const parceiroSelecionado = parceiros.find((p) => p.id === parceiroId);
  const caixaSelecionada = caixas.find((c) => c.id === caixaId);
  const tipoSelecionado = TIPOS_RESIDUO.find((t) => t.valor === tipoResiduo);

  if (carregando) {
    return (
      <TelaBase titulo="Registrar compostagem">
        <p className="text-center text-sm text-zinc-600">Carregando lojas e caixas…</p>
      </TelaBase>
    );
  }

  if (erroCarregamento) {
    return (
      <TelaBase titulo="Registrar compostagem">
        <p className="text-center text-sm text-red-700">{erroCarregamento}</p>
      </TelaBase>
    );
  }

  if (resultado) {
    return (
      <TelaBase titulo="Registrar compostagem">
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
    <TelaBase titulo="Registrar compostagem">
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
          <Stepper
            valor={peso}
            unidade="kg"
            passoIncremento={0.5}
            minimo={0.5}
            onMudar={setPeso}
          />
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

          <label className="mt-4 block cursor-pointer rounded-xl border-2 border-dashed border-zinc-800 bg-[#f1efe6] p-6 text-center">
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
            <span className="mt-1 block text-[10px] text-red-800">obrigatório</span>
          </label>

          <BotaoAvancar onClick={() => irPara(5)} desabilitado={!foto} />
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
            <LinhaResumo rotulo="Foto" valor={foto ? "1 anexada" : "sem foto"} onEditar={() => irPara(4)} />
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

// ---------------------------------------------------------------------------
// Pedaços de tela reutilizados
// ---------------------------------------------------------------------------

function TelaBase({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-zinc-800 bg-white px-3 py-2">
        <span className="text-sm font-bold text-zinc-900">🌱 {titulo}</span>
        <Link href="/patio/compostagem" className="text-lg" aria-label="Fechar">
          ✕
        </Link>
      </div>
      {children}
    </main>
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

function PontosPasso({ passo, total }: { passo: number; total: number }) {
  return (
    <div className="mb-4 flex justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <span
          key={n}
          className={`h-1.5 w-1.5 rounded-full ${n <= passo ? "bg-[#2e6b3e]" : "bg-zinc-300"}`}
        />
      ))}
    </div>
  );
}

function Passo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-center text-sm font-bold text-zinc-900">{titulo}</h2>
      {children}
    </div>
  );
}

function BotaoGrande({
  icone,
  rotulo,
  selecionado,
  onClick,
}: {
  icone: string;
  rotulo: string;
  selecionado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border-2 py-4 text-center text-xs font-bold",
        selecionado ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]" : "border-zinc-800 bg-white text-zinc-800",
      ].join(" ")}
    >
      <span className="mb-1 block text-2xl">{icone}</span>
      {rotulo}
    </button>
  );
}

function Stepper({
  valor,
  unidade,
  passoIncremento,
  minimo,
  onMudar,
}: {
  valor: number;
  unidade: string;
  passoIncremento: number;
  minimo: number;
  onMudar: (novo: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4 rounded-xl border-2 border-zinc-800 bg-[#f1efe6] py-4">
      <button
        type="button"
        onClick={() => onMudar(Math.max(minimo, Number((valor - passoIncremento).toFixed(1))))}
        className="h-9 w-9 rounded-lg border-2 border-zinc-800 bg-white text-lg font-bold"
        aria-label="diminuir"
      >
        −
      </button>
      <span className="min-w-20 text-center text-2xl font-bold tabular-nums text-zinc-900">
        {valor} {unidade}
      </span>
      <button
        type="button"
        onClick={() => onMudar(Number((valor + passoIncremento).toFixed(1)))}
        className="h-9 w-9 rounded-lg border-2 border-zinc-800 bg-white text-lg font-bold"
        aria-label="aumentar"
      >
        +
      </button>
    </div>
  );
}

function BotaoAvancar({
  onClick,
  texto = "Continuar",
  desabilitado = false,
}: {
  onClick: () => void;
  texto?: string;
  desabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={desabilitado}
      onClick={onClick}
      className="mt-4 w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white disabled:opacity-40"
    >
      {texto}
    </button>
  );
}

function LinhaResumo({
  rotulo,
  valor,
  onEditar,
  ultima = false,
}: {
  rotulo: string;
  valor: string;
  onEditar: () => void;
  ultima?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${ultima ? "" : "border-b border-dashed border-zinc-200"}`}>
      <span className="text-xs text-zinc-500">{rotulo}</span>
      <button type="button" onClick={onEditar} className="text-xs font-bold text-zinc-900">
        {valor} <span aria-hidden="true">✏️</span>
      </button>
    </div>
  );
}
