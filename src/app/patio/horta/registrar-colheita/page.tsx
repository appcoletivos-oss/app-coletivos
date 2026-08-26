"use client";

// Horta → Registrar colheita
//
// Mesmo espírito de Registrar compostagem: fluxo de 6 passos, uma
// pergunta por tela, "quem registrou" e "data" nunca perguntados (vêm da
// sessão de login e do relógio do aparelho). Canteiro vem do banco
// (tabela `canteiros`, mesma usada pela aba Canteiros do Cadastro).
//
// Cultura é diferente de loja/caixa: são 69 espécies no histórico real, e
// a decisão de produto (2026-08-22) foi um grid fixo com as mais comuns
// (CULTURAS_COMUNS, em @/lib/horta) + um botão "Outra" que abre um campo
// de texto — sem cadastro próprio de culturas por trás. O campo "Outra"
// sugere correção ortográfica (sugerirCorrecaoCultura) porque boa parte
// da equipe não escreve com muita segurança — é só sugestão, nunca uma
// trava: a pessoa pode ignorar e salvar o texto como digitou.

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { enviarFotoRegistro, listarCanteiros } from "@/lib/patio";
import {
  CULTURAS_COMUNS,
  iconeTipoCanteiro,
  salvarRegistroColheita,
  sugerirCorrecaoCultura,
} from "@/lib/horta";
import { criarFilaOffline } from "@/lib/fila-offline";
import type { Canteiro, NovoRegistroColheita } from "@/lib/types";
import {
  BotaoAvancar,
  BotaoGrande,
  LinhaResumo,
  Passo,
  PontosPasso,
  Stepper,
  TelaBase,
} from "@/components/fluxo-registro";
import Link from "next/link";

const TOTAL_PASSOS = 6;

const filaOffline = criarFilaOffline<NovoRegistroColheita>(
  "app-coletivo:fila-registros-colheita",
);

// useSearchParams exige um limite de Suspense em volta (regra do Next.js
// pra Client Components) — por isso o export default vira só um wrapper,
// ver RegistrarColheitaPage no fim do arquivo.
function RegistrarColheitaConteudo() {
  // Preenchido quando a tela é aberta a partir de um link da Agenda
  // (evento tipo "atividade") — ver lib/agenda.ts, LINKS_REGISTRO_ATIVIDADE.
  const eventoAgendaId = useSearchParams().get("evento_agenda_id");

  const [passo, setPasso] = useState(1);

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [canteiros, setCanteiros] = useState<Canteiro[]>([]);

  const [canteiroId, setCanteiroId] = useState<string | null>(null);
  const [cultura, setCultura] = useState<string | null>(null);
  const [outraAtiva, setOutraAtiva] = useState(false);
  const [outraTexto, setOutraTexto] = useState("");
  const [peso, setPeso] = useState(1);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"ok" | "offline" | null>(null);
  const [pendentesOffline, setPendentesOffline] = useState(() => filaOffline.contar());

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        const lista = await listarCanteiros();
        if (!cancelado) setCanteiros(lista);
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
      const { restantes } = await filaOffline.tentarEnviar(salvarRegistroColheita);
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

  function escolherCulturaComum(nome: string) {
    setCultura(nome);
    setOutraAtiva(false);
    setOutraTexto("");
    irPara(3);
  }

  function confirmarOutraCultura() {
    if (!outraTexto.trim()) return;
    setCultura(outraTexto.trim());
    irPara(3);
  }

  async function salvar() {
    if (!canteiroId || !cultura) return;
    setSalvando(true);
    setErroSalvar(null);

    let fotoUrl: string | null = null;
    if (foto) {
      try {
        fotoUrl = await enviarFotoRegistro(foto, "colheita");
      } catch {
        fotoUrl = null;
      }
    }

    const registro: NovoRegistroColheita = {
      canteiro_id: canteiroId,
      cultura,
      peso_kg: peso,
      foto_url: fotoUrl,
      observacao: observacao.trim() ? observacao.trim() : null,
      evento_agenda_id: eventoAgendaId,
    };

    try {
      await salvarRegistroColheita(registro);
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
    setCanteiroId(null);
    setCultura(null);
    setOutraAtiva(false);
    setOutraTexto("");
    setPeso(1);
    selecionarFoto(null);
    setObservacao("");
    setResultado(null);
    setErroSalvar(null);
  }

  const canteiroSelecionado = canteiros.find((c) => c.id === canteiroId);
  // Recalcula a cada tecla digitada — lista de referência é pequena
  // (~60 nomes curtos), então não pesa fazer isso sem debounce.
  const sugestaoOrtografia = sugerirCorrecaoCultura(outraTexto);

  if (carregando) {
    return (
      <TelaBase titulo="Registrar colheita" icone="🧺" voltarHref="/patio/horta">
        <p className="text-center text-sm text-zinc-600">Carregando canteiros…</p>
      </TelaBase>
    );
  }

  if (erroCarregamento) {
    return (
      <TelaBase titulo="Registrar colheita" icone="🧺" voltarHref="/patio/horta">
        <p className="text-center text-sm text-red-700">{erroCarregamento}</p>
      </TelaBase>
    );
  }

  if (resultado) {
    return (
      <TelaBase titulo="Registrar colheita" icone="🧺" voltarHref="/patio/horta">
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
              ? "Registro de colheita salvo com sucesso."
              : "Assim que a conexão voltar, este registro é enviado sozinho. Não precisa fazer nada."}
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <button
              type="button"
              onClick={recomecar}
              className="rounded-full bg-[#2e6b3e] px-6 py-3 text-sm font-semibold text-white"
            >
              Registrar outra colheita
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
    <TelaBase titulo="Registrar colheita" icone="🧺" voltarHref="/patio/horta">
      <BarraContexto canteiro={canteiroSelecionado} cultura={cultura} passo={passo} />
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
        <Passo titulo="Qual foi a cultura colhida?">
          {!outraAtiva ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {CULTURAS_COMUNS.map((cu) => (
                  <BotaoGrande
                    key={cu.nome}
                    icone={cu.icone}
                    rotulo={cu.nome}
                    selecionado={cu.nome === cultura}
                    onClick={() => escolherCulturaComum(cu.nome)}
                  />
                ))}
                <BotaoGrande
                  icone="✏️"
                  rotulo="Outra"
                  selecionado={false}
                  onClick={() => setOutraAtiva(true)}
                />
              </div>
            </>
          ) : (
            <div>
              <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
                Nome da cultura
                <input
                  autoFocus
                  value={outraTexto}
                  onChange={(e) => setOutraTexto(e.target.value)}
                  placeholder="Ex.: Girassol"
                  className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
                />
              </label>

              {sugestaoOrtografia && (
                <button
                  type="button"
                  onClick={() => setOutraTexto(sugestaoOrtografia)}
                  className="mb-3 block w-full rounded-lg border-2 border-dashed border-[#2e6b3e] bg-[#eaf3ea] px-3 py-2 text-left text-xs text-[#2e6b3e]"
                >
                  Quis dizer <strong>{sugestaoOrtografia}</strong>? <span className="underline">Toque pra corrigir</span>
                </button>
              )}

              <BotaoAvancar onClick={confirmarOutraCultura} desabilitado={!outraTexto.trim()} />
              <button
                type="button"
                onClick={() => {
                  setOutraAtiva(false);
                  setOutraTexto("");
                }}
                className="mx-auto mt-2 block text-[11px] text-zinc-400 underline"
              >
                voltar pra lista
              </button>
            </div>
          )}
        </Passo>
      )}

      {passo === 3 && (
        <Passo titulo="Quanto foi colhido?">
          <Stepper valor={peso} unidade="kg" passoIncremento={0.1} minimo={0.1} onMudar={setPeso} />
          <BotaoAvancar onClick={() => irPara(4)} />
        </Passo>
      )}

      {passo === 4 && (
        <Passo titulo="Uma foto da colheita">
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
            placeholder='Ex.: "praga na folha, precisa de manejo"...'
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
            <LinhaResumo rotulo="Canteiro" valor={canteiroSelecionado?.nome ?? "—"} onEditar={() => irPara(1)} />
            <LinhaResumo rotulo="Cultura" valor={cultura ?? "—"} onEditar={() => irPara(2)} />
            <LinhaResumo rotulo="Peso colhido" valor={`${peso} kg`} onEditar={() => irPara(3)} />
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

export default function RegistrarColheitaPage() {
  return (
    <Suspense
      fallback={
        <TelaBase titulo="Registrar colheita" icone="🧺" voltarHref="/patio/horta">
          <p className="text-center text-sm text-zinc-600">Carregando…</p>
        </TelaBase>
      }
    >
      <RegistrarColheitaConteudo />
    </Suspense>
  );
}

function BarraContexto({
  canteiro,
  cultura,
  passo,
}: {
  canteiro?: Canteiro;
  cultura: string | null;
  passo: number;
}) {
  if (passo === 1) return null;
  return (
    <div className="mb-2 flex justify-between rounded-lg border border-zinc-300 bg-[#f1efe6] px-3 py-1 text-[11px] text-zinc-600">
      <span>🌻 {canteiro?.nome ?? "—"}</span>
      {cultura && <span>{cultura}</span>}
    </div>
  );
}
