"use client";

// Compostagem → Controle de bombonas
//
// Baseado no formulário real "Controle das Bombonas" (Google Forms), hoje
// preenchido tanto por lojistas quanto pela equipe do pátio. Fluxo de 7
// passos, uma pergunta (ou pequeno grupo relacionado) por tela — mesmo
// espírito das demais telas de registro.
//
// Como o app ainda não tem login/distinção de papel entre lojista e
// equipe, esta tela fica acessível a qualquer pessoa por enquanto — isso
// inclui "Preenchida corretamente?" (passo 5), que no formulário original
// é marcado como campo "exclusivo da equipe". PENDÊNCIA: restringir esse
// campo à equipe quando o controle de acesso por papel existir (ver
// migration 20260822180000 e Registro Geral, seção 4).
//
// `registrado_por` é texto livre (não vem da sessão) porque um lojista
// entregando/coletando a bombona não necessariamente tem conta vinculada
// a membros_equipe — a pessoa digita o próprio nome no passo 6.

import Link from "next/link";
import { useEffect, useState } from "react";
import { listarParceirosAtivos, salvarRegistroBombona } from "@/lib/patio";
import { criarFilaOffline } from "@/lib/fila-offline";
import type { NovoRegistroBombona, Parceiro } from "@/lib/types";
import {
  BotaoAvancar,
  BotaoGrande,
  LinhaResumo,
  Passo,
  PontosPasso,
  TelaBase,
} from "@/components/fluxo-registro";

const TOTAL_PASSOS = 7;

const filaOffline = criarFilaOffline<NovoRegistroBombona>(
  "app-coletivo:fila-registros-bombonas",
);

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function rotuloSimNao(valor: boolean | null): string {
  if (valor === true) return "Sim";
  if (valor === false) return "Não";
  return "não informado";
}

function formatarDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function BombonasPage() {
  const [passo, setPasso] = useState(1);

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);

  const [parceiroId, setParceiroId] = useState<string | null>(null);
  const [numeroBombona, setNumeroBombona] = useState("");
  // Não usa inicializador preguiçoso com `new Date()` de propósito: o
  // Next.js recusa esse valor no prerender de um Client Component (data
  // instável entre build e visita) — por isso começa vazio e só é
  // preenchida depois de montar, no navegador (ver useEffect abaixo).
  const [dataEntrega, setDataEntrega] = useState("");
  const [higienizada, setHigienizada] = useState<boolean | null>(null);
  const [tampaFechada, setTampaFechada] = useState<boolean | null>(null);
  const [adesivoPresente, setAdesivoPresente] = useState<boolean | null>(null);
  const [odor, setOdor] = useState<number | null>(null);
  const [dataDevolucao, setDataDevolucao] = useState("");
  const [preenchidaCorretamente, setPreenchidaCorretamente] = useState<boolean | null>(null);
  const [observacao, setObservacao] = useState("");
  const [registradoPor, setRegistradoPor] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"ok" | "offline" | null>(null);
  const [pendentesOffline, setPendentesOffline] = useState(() => filaOffline.contar());

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        const lista = await listarParceirosAtivos();
        if (!cancelado) setParceiros(lista);
      } catch {
        if (!cancelado) {
          setErroCarregamento(
            "Não deu pra carregar as lojas agora. Confira a internet e tente de novo.",
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
      const { restantes } = await filaOffline.tentarEnviar(salvarRegistroBombona);
      setPendentesOffline(restantes);
    }
    tentarEnviar();
    window.addEventListener("online", tentarEnviar);
    return () => window.removeEventListener("online", tentarEnviar);
  }, []);

  // Preenche a data de entrega com "hoje" só depois de montar no
  // navegador — não dá pra ler `new Date()` durante o render inicial
  // (inicializador preguiçoso do useState), porque o Next.js recusa esse
  // valor no prerender de um Client Component ("this value would be
  // evaluated during the prerender, instead of recomputed on each
  // visit"). Setar direto no efeito é a alternativa que o próprio erro do
  // build recomenda ("defer: move the read into a useEffect"); o
  // eslint-disable abaixo documenta que essa exceção é intencional.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ver comentário acima: leitura de `new Date()` precisa ficar fora do render inicial por causa do prerender do Next.js
    setDataEntrega(hojeISO());
  }, []);

  function irPara(novoPasso: number) {
    setPasso(Math.min(Math.max(novoPasso, 1), TOTAL_PASSOS));
  }

  async function salvar() {
    if (!parceiroId || !numeroBombona.trim() || !registradoPor.trim()) return;
    setSalvando(true);
    setErroSalvar(null);

    const registro: NovoRegistroBombona = {
      parceiro_id: parceiroId,
      numero_bombona: numeroBombona.trim(),
      data_entrega: dataEntrega,
      data_devolucao: dataDevolucao || null,
      higienizada,
      tampa_fechada: tampaFechada,
      adesivo_presente: adesivoPresente,
      odor,
      preenchida_corretamente: preenchidaCorretamente,
      observacao: observacao.trim() ? observacao.trim() : null,
      registrado_por: registradoPor.trim(),
    };

    try {
      await salvarRegistroBombona(registro);
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
    setNumeroBombona("");
    setDataEntrega(hojeISO());
    setHigienizada(null);
    setTampaFechada(null);
    setAdesivoPresente(null);
    setOdor(null);
    setDataDevolucao("");
    setPreenchidaCorretamente(null);
    setObservacao("");
    setRegistradoPor("");
    setResultado(null);
    setErroSalvar(null);
  }

  const parceiroSelecionado = parceiros.find((p) => p.id === parceiroId);

  if (carregando) {
    return (
      <TelaBase titulo="Controle de bombonas" icone="🛢️" voltarHref="/patio/compostagem">
        <p className="text-center text-sm text-zinc-600">Carregando lojas…</p>
      </TelaBase>
    );
  }

  if (erroCarregamento) {
    return (
      <TelaBase titulo="Controle de bombonas" icone="🛢️" voltarHref="/patio/compostagem">
        <p className="text-center text-sm text-red-700">{erroCarregamento}</p>
      </TelaBase>
    );
  }

  if (resultado) {
    return (
      <TelaBase titulo="Controle de bombonas" icone="🛢️" voltarHref="/patio/compostagem">
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
              ? "Controle de bombona salvo com sucesso."
              : "Assim que a conexão voltar, este registro é enviado sozinho. Não precisa fazer nada."}
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <button
              type="button"
              onClick={recomecar}
              className="rounded-full bg-[#2e6b3e] px-6 py-3 text-sm font-semibold text-white"
            >
              Registrar outra bombona
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
    <TelaBase titulo="Controle de bombonas" icone="🛢️" voltarHref="/patio/compostagem">
      <BarraContexto parceiro={parceiroSelecionado} numeroBombona={numeroBombona} passo={passo} />
      <PontosPasso passo={passo} total={TOTAL_PASSOS} />

      {pendentesOffline > 0 && (
        <p className="mb-3 rounded-lg border border-dashed border-zinc-400 bg-white px-3 py-2 text-center text-[11px] text-zinc-600">
          📶 {pendentesOffline} registro(s) esperando internet pra enviar.
        </p>
      )}

      {passo === 1 && (
        <Passo titulo="De qual loja é a bombona?">
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
        <Passo titulo="Número da bombona e data de entrega">
          <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
            Número da bombona
            <input
              autoFocus
              value={numeroBombona}
              onChange={(e) => setNumeroBombona(e.target.value)}
              placeholder="Ex.: 12"
              className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
            />
          </label>
          <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
            Data de entrega
            <input
              type="date"
              value={dataEntrega}
              onChange={(e) => setDataEntrega(e.target.value)}
              className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
            />
          </label>
          <BotaoAvancar onClick={() => irPara(3)} desabilitado={!numeroBombona.trim()} />
        </Passo>
      )}

      {passo === 3 && (
        <Passo titulo="Checklist rápido">
          <CampoSimNao rotulo="Bombona higienizada?" valor={higienizada} onMudar={setHigienizada} />
          <CampoSimNao rotulo="Tampa fechada corretamente?" valor={tampaFechada} onMudar={setTampaFechada} />
          <CampoSimNao rotulo="Adesivo de identificação presente?" valor={adesivoPresente} onMudar={setAdesivoPresente} />
          <BotaoAvancar onClick={() => irPara(4)} />
        </Passo>
      )}

      {passo === 4 && (
        <Passo titulo="Como está o odor?">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setOdor(odor === n ? null : n)}
                className={[
                  "h-12 w-12 rounded-full border-2 text-base font-bold",
                  odor === n
                    ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]"
                    : "border-zinc-800 bg-white text-zinc-800",
                ].join(" ")}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-zinc-500">1 = sem odor · 5 = odor forte</p>
          <BotaoAvancar onClick={() => irPara(5)} />
        </Passo>
      )}

      {passo === 5 && (
        <Passo titulo="Devolução">
          <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
            Data de devolução (opcional — deixe em branco se ainda não voltou)
            <input
              type="date"
              value={dataDevolucao}
              onChange={(e) => setDataDevolucao(e.target.value)}
              className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
            />
          </label>
          {/* Campo "exclusivo da equipe" no formulário original — ver
              nota de pendência de controle de acesso no topo do arquivo. */}
          <CampoSimNao
            rotulo="Foi preenchida corretamente? (campo da equipe)"
            valor={preenchidaCorretamente}
            onMudar={setPreenchidaCorretamente}
          />
          <BotaoAvancar onClick={() => irPara(6)} />
        </Passo>
      )}

      {passo === 6 && (
        <Passo titulo="Observações e quem está registrando">
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder='Ex.: "bombona com pequeno furo na base"...'
            className="mb-3 min-h-20 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
          />
          <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
            Seu nome
            <input
              value={registradoPor}
              onChange={(e) => setRegistradoPor(e.target.value)}
              placeholder="Quem está registrando?"
              className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
            />
          </label>
          <BotaoAvancar onClick={() => irPara(7)} desabilitado={!registradoPor.trim()} />
        </Passo>
      )}

      {passo === 7 && (
        <Passo titulo="Confere antes de salvar">
          <div className="rounded-xl border-2 border-zinc-800 bg-white p-3 text-sm">
            <LinhaResumo rotulo="Loja" valor={parceiroSelecionado?.nome ?? "—"} onEditar={() => irPara(1)} />
            <LinhaResumo rotulo="Número da bombona" valor={numeroBombona.trim() || "—"} onEditar={() => irPara(2)} />
            <LinhaResumo rotulo="Data de entrega" valor={formatarDataBR(dataEntrega)} onEditar={() => irPara(2)} />
            <LinhaResumo rotulo="Higienizada" valor={rotuloSimNao(higienizada)} onEditar={() => irPara(3)} />
            <LinhaResumo rotulo="Tampa fechada" valor={rotuloSimNao(tampaFechada)} onEditar={() => irPara(3)} />
            <LinhaResumo rotulo="Adesivo presente" valor={rotuloSimNao(adesivoPresente)} onEditar={() => irPara(3)} />
            <LinhaResumo rotulo="Odor" valor={odor ? `${odor} / 5` : "não avaliado"} onEditar={() => irPara(4)} />
            <LinhaResumo rotulo="Data de devolução" valor={dataDevolucao ? formatarDataBR(dataDevolucao) : "ainda não voltou"} onEditar={() => irPara(5)} />
            <LinhaResumo rotulo="Preenchida corretamente" valor={rotuloSimNao(preenchidaCorretamente)} onEditar={() => irPara(5)} />
            <LinhaResumo rotulo="Observação" valor={observacao.trim() || "sem observação"} onEditar={() => irPara(6)} />
            <LinhaResumo rotulo="Registrado por" valor={registradoPor.trim() || "—"} onEditar={() => irPara(6)} ultima />
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

// Toggle sim/não/não-informado: tocar na opção já selecionada desmarca
// (volta pra null) — é assim que o campo, opcional no banco, permite
// "não informado" sem precisar de um terceiro botão.
function CampoSimNao({
  rotulo,
  valor,
  onMudar,
}: {
  rotulo: string;
  valor: boolean | null;
  onMudar: (novo: boolean | null) => void;
}) {
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs font-semibold text-zinc-700">{rotulo}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onMudar(valor === true ? null : true)}
          className={[
            "flex-1 rounded-lg border-2 py-2 text-xs font-bold",
            valor === true ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]" : "border-zinc-300 text-zinc-700",
          ].join(" ")}
        >
          Sim
        </button>
        <button
          type="button"
          onClick={() => onMudar(valor === false ? null : false)}
          className={[
            "flex-1 rounded-lg border-2 py-2 text-xs font-bold",
            valor === false ? "border-red-700 bg-red-50 text-red-700" : "border-zinc-300 text-zinc-700",
          ].join(" ")}
        >
          Não
        </button>
      </div>
    </div>
  );
}

function BarraContexto({
  parceiro,
  numeroBombona,
  passo,
}: {
  parceiro?: Parceiro;
  numeroBombona: string;
  passo: number;
}) {
  if (passo === 1) return null;
  return (
    <div className="mb-2 flex justify-between rounded-lg border border-zinc-300 bg-[#f1efe6] px-3 py-1 text-[11px] text-zinc-600">
      <span>🏪 {parceiro?.nome ?? "—"}</span>
      {numeroBombona.trim() && <span>🛢️ Bombona {numeroBombona.trim()}</span>}
    </div>
  );
}
