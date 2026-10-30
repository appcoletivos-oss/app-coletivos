"use client";

// Relato do turno com IA — entrada e conferência "Entendi isto" (Sprint B,
// B3; SPRINT_B_RELATO_DO_TURNO.md 5a/5d e SPRINT_B2_HOME_RELATO_FILA.md 3.5
// a 3.7).
//
// 1. Escrever: caixa grande (colar ou ditar pelo microfone do teclado),
//    aviso de IA, "Entender". O texto vai pro aparelho a cada tecla
//    (rascunho por relatório): falha de rede ou da IA nunca perde o texto.
//    Sem internet: "Guardado. Vai ser interpretado quando você tiver
//    internet" — nada roda em segundo plano.
// 2. Entendi isto: blocos Pronto / Confira / Falta informação, e no máximo
//    3 perguntas por toque (as de maior impacto), todas puláveis. Cultura
//    ou canteiro que não existe no cadastro: alerta com "Escolher uma que
//    existe" ou "Seguir mesmo assim" (fica o nome cru, status
//    nao_cadastrado, e a coordenação decide na fila). Esta tela nunca
//    cadastra cultura.
// 3. Enviar: checklist marcado e propostas pendentes (src/lib/relato.ts).

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { lerRecentes } from "@/lib/recentes";
import { buscarRelatorioPorId } from "@/lib/relatorio-turno";
import {
  ErroRelato,
  LIMITE_TEXTO_RELATO,
  enviarRelato,
  guardarRascunhoRelato,
  interpretarRelato,
  lerRascunhoRelato,
  type CadastrosRelato,
  type ItemRelato,
  type ProgressoEnvio,
  type RelatoInterpretado,
} from "@/lib/relato";
import {
  aplicarResposta,
  naoCadastrados,
  perguntasPrioritarias,
  piorStatus,
  type Pergunta,
  type Resposta,
} from "@/lib/relato-campos";
import type { RelatorioTurno } from "@/lib/types";
import { LISTA_RECENTES_CANTEIROS } from "@/components/escolha-plantio";
import { AlertaNaoCadastrado, CartaoItemRelato, PerguntaRelato } from "@/components/relato-itens";
import { TelaBase } from "@/components/fluxo-registro";

const MAX_PERGUNTAS = 3;

type Etapa = "escrever" | "conferir" | "enviado";

function formatarDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function RelatoConteudo() {
  const params = useParams<{ id: string }>();
  const relatorioId = params.id;
  const voltarHref = `/patio/relatorio-turno/${relatorioId}`;

  const [carregando, setCarregando] = useState(true);
  const [relatorio, setRelatorio] = useState<RelatorioTurno | null>(null);
  const [texto, setTexto] = useState("");
  const [etapa, setEtapa] = useState<Etapa>("escrever");
  const [guardadoSemInternet, setGuardadoSemInternet] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [resultado, setResultado] = useState<RelatoInterpretado | null>(null);
  const [itens, setItens] = useState<ItemRelato[]>([]);
  const [cadastros, setCadastros] = useState<CadastrosRelato | null>(null);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [resolvidas, setResolvidas] = useState<Set<string>>(new Set());
  // Alertas de "não cadastrado" já respondidos com "Seguir mesmo assim".
  const [seguidos, setSeguidos] = useState<Set<string>>(new Set());
  const [canteirosRecentes, setCanteirosRecentes] = useState<string[]>([]);
  const [editado, setEditado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resumoEnvio, setResumoEnvio] = useState<number | null>(null);
  const progresso = useRef<ProgressoEnvio>({ propostas: false, checklist: new Set() });

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const rascunho = lerRascunhoRelato(relatorioId);
      try {
        const rel = await buscarRelatorioPorId(relatorioId);
        if (cancelado) return;
        setRelatorio(rel);
      } catch {
        // Sem internet: a tela de escrever funciona igual (o texto fica no
        // aparelho); só o cabeçalho fica sem data.
      }
      if (cancelado) return;
      if (rascunho) {
        setTexto(rascunho.texto);
        setGuardadoSemInternet(rascunho.aguardando_internet);
      }
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [relatorioId]);

  function mudarTexto(valor: string) {
    const cortado = valor.slice(0, LIMITE_TEXTO_RELATO);
    setTexto(cortado);
    guardarRascunhoRelato(relatorioId, cortado, false);
    setGuardadoSemInternet(false);
  }

  function guardarSemInternet() {
    guardarRascunhoRelato(relatorioId, texto, true);
    setGuardadoSemInternet(true);
  }

  async function entender() {
    if (!texto.trim()) return;
    setErro(null);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      guardarSemInternet();
      return;
    }
    setProcessando(true);
    try {
      const r = await interpretarRelato(relatorioId, texto);
      guardarRascunhoRelato(relatorioId, texto, false);
      setResultado(r);
      setItens(r.itens);
      setCadastros(r.cadastros);
      const recentes = lerRecentes(LISTA_RECENTES_CANTEIROS);
      setCanteirosRecentes(recentes);
      setPerguntas(perguntasPrioritarias(r.itens, r.cadastros, recentes, MAX_PERGUNTAS));
      setResolvidas(new Set());
      setSeguidos(new Set());
      setEditado(false);
      progresso.current = { propostas: false, checklist: new Set() };
      setGuardadoSemInternet(false);
      setEtapa("conferir");
    } catch (e) {
      if (e instanceof ErroRelato && e.semRede) guardarSemInternet();
      else setErro(e instanceof Error ? e.message : "A IA não conseguiu ler o texto agora. Tente de novo daqui a pouco.");
    } finally {
      setProcessando(false);
    }
  }

  const responder = useCallback(
    (pergunta: Pergunta, resposta: Resposta) => {
      if (!cadastros) return;
      setItens((lista) => lista.map((i) => (i.chave === pergunta.itemChave ? aplicarResposta(i, pergunta.campo, resposta, cadastros) : i)));
      setResolvidas((s) => new Set(s).add(pergunta.chave));
      setEditado(true);
    },
    [cadastros],
  );

  async function enviar() {
    if (!resultado) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await enviarRelato(relatorioId, resultado.relato_id, resultado.log_id, itens, !editado, progresso.current);
      setResumoEnvio(r.propostas);
      setEtapa("enviado");
    } catch {
      setErro("Não deu pra enviar agora. Confira a internet e toque Enviar de novo (nada vai duplicar).");
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <TelaBase titulo="Contar o turno" icone="📝" voltarHref={voltarHref}>
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (relatorio?.fechado_em) {
    return (
      <TelaBase titulo="Contar o turno" icone="📝" voltarHref={voltarHref}>
        <p className="text-center text-sm text-zinc-600">Este relatório já foi fechado. Peça à coordenação pra reabrir.</p>
      </TelaBase>
    );
  }

  const cabecalho = relatorio && (
    <p className="mb-3 text-center text-xs font-bold text-zinc-600">
      {formatarDataBR(relatorio.data)} · {relatorio.turno === "manha" ? "Manhã" : "Tarde"}
    </p>
  );

  if (etapa === "enviado") {
    return (
      <TelaBase titulo="Contar o turno" icone="📝" voltarHref={voltarHref}>
        <div className="rounded-xl border-2 border-[#2e6b3e] bg-[#eaf3ea] p-4 text-center">
          <p className="text-sm font-bold text-[#2e6b3e]">Enviado. A coordenação vai conferir.</p>
          {resumoEnvio !== null && resumoEnvio > 0 && (
            <p className="mt-1 text-[11px] text-[#2e6b3e]">
              {resumoEnvio === 1 ? "1 registro ficou" : `${resumoEnvio} registros ficaram`} esperando a conferência.
            </p>
          )}
        </div>
        <Link href={voltarHref} className="mt-4 block rounded-xl bg-[#2e6b3e] py-3 text-center text-sm font-bold text-white">
          Voltar ao relatório
        </Link>
      </TelaBase>
    );
  }

  if (etapa === "conferir" && resultado && cadastros) {
    const abertas = perguntas.filter((p) => !resolvidas.has(p.chave));
    const perguntasDoItem = (chave: string) => abertas.filter((p) => p.itemChave === chave);
    const blocos: { titulo: string; filtro: (i: ItemRelato) => boolean }[] = [
      { titulo: "Pronto", filtro: (i) => piorStatus(i) === "certo" },
      { titulo: "Confira", filtro: (i) => piorStatus(i) === "inferido" },
      { titulo: "Falta informação", filtro: (i) => piorStatus(i) === "faltando" },
    ];

    return (
      <TelaBase titulo="Entendi isto" icone="📝" voltarHref={voltarHref}>
        {cabecalho}
        {resultado.avisos.length > 0 && (
          <div className="mb-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-2">
            {resultado.avisos.map((a, i) => (
              <p key={i} className="text-[11px] text-amber-900">
                ⚠️ {a}
              </p>
            ))}
          </div>
        )}
        {itens.length === 0 && <p className="mb-3 text-center text-xs text-zinc-500">A IA não achou nenhuma atividade no texto.</p>}

        {blocos.map((bloco) => {
          const doBloco = itens.filter(bloco.filtro);
          if (doBloco.length === 0) return null;
          return (
            <div key={bloco.titulo} className="mb-4">
              <p className="mb-2 text-xs font-bold text-zinc-800">
                {bloco.titulo} ({doBloco.length})
              </p>
              <div className="flex flex-col gap-2">
                {doBloco.map((item) => (
                  <CartaoItemRelato key={item.chave} item={item} cadastros={cadastros}>
                    {naoCadastrados(item)
                      .filter((alvo) => !seguidos.has(`${item.chave}:${alvo.campo}`))
                      .map((alvo) => (
                        <AlertaNaoCadastrado
                          key={alvo.campo}
                          item={item}
                          alvo={alvo}
                          cadastros={cadastros}
                          canteirosRecentes={canteirosRecentes}
                          modo="relato"
                          onResponder={responder}
                          onSeguir={() => setSeguidos((s) => new Set(s).add(`${item.chave}:${alvo.campo}`))}
                        />
                      ))}
                    {perguntasDoItem(item.chave).map((p) => (
                      <PerguntaRelato
                        key={p.chave}
                        pergunta={p}
                        onResponder={(r) => responder(p, r)}
                        onPular={() => setResolvidas((s) => new Set(s).add(p.chave))}
                      />
                    ))}
                  </CartaoItemRelato>
                ))}
              </div>
            </div>
          );
        })}

        {resultado.observacoes.length > 0 && (
          <div className="mb-4 rounded-xl border-2 border-dashed border-zinc-300 bg-white p-2">
            <p className="mb-1 text-[11px] font-bold text-zinc-600">Observações (ficam guardadas no texto do relato)</p>
            {resultado.observacoes.map((o, i) => (
              <p key={i} className="text-[11px] text-zinc-600">
                {o}
              </p>
            ))}
          </div>
        )}

        {erro && <p className="mb-3 text-center text-sm text-red-700">{erro}</p>}
        <button
          type="button"
          disabled={enviando}
          onClick={enviar}
          className="w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {enviando ? "Enviando…" : "Enviar"}
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => setEtapa("escrever")}
          className="mt-2 w-full rounded-xl border-2 border-zinc-800 bg-white py-2.5 text-sm font-bold text-zinc-800 disabled:opacity-60"
        >
          Voltar e editar o texto
        </button>
      </TelaBase>
    );
  }

  return (
    <TelaBase titulo="Contar o turno" icone="📝" voltarHref={voltarHref}>
      {cabecalho}
      {guardadoSemInternet && (
        <p className="mb-3 rounded-lg border-2 border-dashed border-zinc-400 bg-white px-3 py-2 text-center text-[11px] text-zinc-700">
          📶 Guardado. Vai ser interpretado quando você tiver internet: volte aqui e toque &quot;Entender&quot;.
        </p>
      )}
      <textarea
        value={texto}
        onChange={(e) => mudarTexto(e.target.value)}
        rows={12}
        placeholder="Cole ou escreva aqui. Pode ditar pelo microfone do teclado."
        className="mb-1 w-full rounded-xl border-2 border-zinc-300 bg-white p-3 text-sm"
      />
      <p className="mb-2 text-right text-[10px] text-zinc-400">
        {texto.length.toLocaleString("pt-BR")} / {LIMITE_TEXTO_RELATO.toLocaleString("pt-BR")}
      </p>
      {/* Texto provisório (B2, 3.5): o Thiago aprova antes de produção. */}
      <p className="mb-3 text-[10px] text-zinc-500">
        O texto é lido por uma IA (Anthropic) para organizar o relatório. Os primeiros nomes de quem aparece no texto
        também são lidos. Não escreva documentos, endereços ou dados pessoais de terceiros.
      </p>
      {erro && <p className="mb-3 text-center text-sm text-red-700">{erro}</p>}
      <button
        type="button"
        disabled={processando || !texto.trim()}
        onClick={entender}
        className="w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {processando ? "Lendo o relato…" : "Entender"}
      </button>
    </TelaBase>
  );
}
