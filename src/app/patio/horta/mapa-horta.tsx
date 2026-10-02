"use client";

// Horta → Mapa, agora a PORTA DE ENTRADA da Horta (Sprint A.1, item 1 —
// SPRINT_A1_MENOS_TOQUES.md, seção 4). Antes era um hub de 10 botões e o
// Mapa ficava em /patio/horta/mapa (que agora só redireciona pra cá).
//
// Canteiros em cards, cada um com seus plantios. Cada plantio tem os botões
// de ação (Colher, Perda, Doar, Transplantar, Germinou) que abrem a tela já
// com ?canteiro=&plantio= — partir do card reduz o erro de escolher o
// plantio errado (P6). Cada canteiro tem Manejo e "＋ Plantar aqui".
//
// Continua mostrando também o lote "transplantado" como nó fechado da
// linhagem, e o encerramento direto pelo card (perdido/doado/colhido/
// encerrado, pros casos sem registro formal) — agora atrás de "Encerrar…" e
// com confirmação inline, porque é irreversível (P3).

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { listarCanteiros } from "@/lib/patio";
import { iconeTipoCanteiro } from "@/lib/horta";
import { calcularDemandasHorta, linhagemPlantio, listarPlantiosParaMapa, marcarStatusPlantio } from "@/lib/plantios";
import { dataHojeRecife } from "@/lib/relatorio-turno";
import type { Canteiro, Plantio, PlantioComCultura } from "@/lib/types";

const ROTULO_ORIGEM: Record<Plantio["origem"], string> = {
  semente: "semente",
  muda_comprada: "muda comprada",
  estaca: "estaca",
  ja_existente: "já existente",
  divisao: "transplante",
};

// Avisos que as telas de ação mandam de volta ao salvar (?salvo=<código>).
// Código fechado, não texto livre na URL.
const MENSAGENS_SALVO: Record<string, string> = {
  colheita: "✅ Colheita salva.",
  "colheita-offline": "📶 Sem internet agora: a colheita ficou guardada no celular e envia sozinha quando o sinal voltar.",
  perda: "✅ Perda registrada.",
  plantio: "✅ Plantio registrado.",
  "plantio-semente":
    "✅ Plantio registrado. O que veio de semente entrou como germinando: toque em 🌿 Germinou no card quando brotar.",
};

type StatusEncerramento = "perdido" | "doado" | "encerrado" | "colhido";

const OPCOES_ENCERRAMENTO: { status: StatusEncerramento; rotulo: string }[] = [
  { status: "colhido", rotulo: "🧺 Colhido" },
  { status: "perdido", rotulo: "💀 Perdido" },
  { status: "doado", rotulo: "🎁 Doado" },
  { status: "encerrado", rotulo: "🚫 Encerrado" },
];

function diasRestantes(previsao: string | null, hoje: string | null): string | null {
  if (!previsao || !hoje) return null;
  const dias = Math.round(
    (new Date(`${previsao}T00:00:00`).getTime() - new Date(`${hoje}T00:00:00`).getTime()) / 86400000,
  );
  if (dias < 0) return `atrasado ${Math.abs(dias)}d`;
  if (dias === 0) return "hoje";
  return `em ${dias}d`;
}

function ordenarCanteiros(a: Canteiro, b: Canteiro): number {
  return a.nome.localeCompare(b.nome, "pt-BR", { numeric: true });
}

export function MapaHorta() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const salvo = searchParams.get("salvo");
  const mensagemSalvo = salvo ? MENSAGENS_SALVO[salvo] ?? null : null;

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [canteiros, setCanteiros] = useState<Canteiro[]>([]);
  const [plantios, setPlantios] = useState<PlantioComCultura[]>([]);
  const [hoje, setHoje] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<{ atrasados: number; hoje: number } | null>(null);
  const [maisAberto, setMaisAberto] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [listaCanteiros, listaPlantios] = await Promise.all([listarCanteiros(), listarPlantiosParaMapa()]);
        if (!cancelado) {
          setHoje(dataHojeRecife());
          setCanteiros([...listaCanteiros].sort(ordenarCanteiros));
          setPlantios(listaPlantios);
        }
      } catch {
        if (!cancelado) setErro("Não deu pra carregar o mapa agora. Confira a internet e tente de novo.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    // Avisos carregam à parte: são só um resumo no topo, não seguram o Mapa
    // nem derrubam a tela se falharem.
    (async () => {
      try {
        const demandas = await calcularDemandasHorta();
        if (!cancelado) {
          setAvisos({
            atrasados: demandas.filter((d) => d.situacao === "atrasado").length,
            hoje: demandas.filter((d) => d.situacao === "hoje").length,
          });
        }
      } catch {
        // sem resumo de avisos — o link pra lista continua no topo.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const plantiosPorCanteiro = useMemo(() => {
    const mapa = new Map<string, PlantioComCultura[]>();
    for (const p of plantios) {
      const lista = mapa.get(p.canteiro_id) ?? [];
      lista.push(p);
      mapa.set(p.canteiro_id, lista);
    }
    return mapa;
  }, [plantios]);

  const comPlantio = canteiros.filter((c) => (plantiosPorCanteiro.get(c.id) ?? []).some((p) => p.status !== "transplantado"));
  const semPlantio = canteiros.filter((c) => !comPlantio.includes(c));

  async function encerrarPlantio(plantioId: string, status: StatusEncerramento) {
    await marcarStatusPlantio(plantioId, status);
    // Encerrado sai do Mapa (o Mapa só mostra ativo/germinando/transplantado).
    setPlantios((lista) => lista.filter((p) => p.id !== plantioId));
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-6">
      <div className="mb-3 flex items-center justify-between rounded-xl border-2 border-zinc-800 bg-white px-3 py-2">
        <span className="text-sm font-bold text-zinc-900">🌻 Horta</span>
        <span className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMaisAberto((a) => !a)}
            aria-expanded={maisAberto}
            className="text-xs text-zinc-600 underline"
          >
            Mais
          </button>
          <Link href="/patio" className="text-lg" aria-label="Voltar">
            ←
          </Link>
        </span>
      </div>

      {maisAberto && (
        <nav className="mb-3 flex flex-col gap-1 rounded-xl border-2 border-dashed border-zinc-300 bg-white p-2 text-xs font-bold text-zinc-700">
          <Link href="/patio/horta/avisos" className="rounded-lg px-2 py-2 hover:bg-zinc-100">
            🔔 Avisos
          </Link>
          <Link href="/patio/horta/estoque-viveiro" className="rounded-lg px-2 py-2 hover:bg-zinc-100">
            📦 Estoque do viveiro
          </Link>
          <Link href="/patio/horta/confirmar-germinacao" className="rounded-lg px-2 py-2 hover:bg-zinc-100">
            🌿 Confirmar germinação (todos os lotes)
          </Link>
        </nav>
      )}

      {mensagemSalvo && (
        <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border-2 border-[#2e6b3e] bg-[#eaf3ea] px-3 py-2.5 text-xs font-semibold text-[#2e6b3e]">
          <span>{mensagemSalvo}</span>
          <button
            type="button"
            onClick={() => router.replace("/patio/horta", { scroll: false })}
            aria-label="Fechar aviso"
            className="shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mb-4 grid grid-cols-[1fr_auto] gap-2">
        <Link
          href="/patio/horta/registrar-plantio"
          className="rounded-xl bg-[#2e6b3e] py-3.5 text-center text-sm font-bold text-white"
        >
          ＋ Plantar
        </Link>
        <Link
          href="/patio/horta/avisos"
          className={[
            "flex flex-col justify-center rounded-xl border-2 px-3 text-center text-[11px] font-bold leading-tight",
            avisos && avisos.atrasados > 0
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-zinc-800 bg-white text-zinc-700",
          ].join(" ")}
        >
          {avisos === null ? (
            <span>🔔 Avisos</span>
          ) : avisos.atrasados + avisos.hoje === 0 ? (
            <span>🔔 Nada pra hoje</span>
          ) : (
            <>
              {avisos.atrasados > 0 && <span>⚠️ {avisos.atrasados} atrasado(s)</span>}
              {avisos.hoje > 0 && <span>📌 {avisos.hoje} pra hoje</span>}
            </>
          )}
        </Link>
      </div>

      {carregando ? (
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      ) : erro ? (
        <p className="text-center text-sm text-red-700">{erro}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comPlantio.map((c) => (
            <CardCanteiro
              key={c.id}
              canteiro={c}
              plantios={plantiosPorCanteiro.get(c.id) ?? []}
              hoje={hoje}
              onEncerrar={encerrarPlantio}
            />
          ))}

          {semPlantio.length > 0 && (
            <>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Sem plantio agora</p>
              {semPlantio.map((c) => (
                <CardCanteiro
                  key={c.id}
                  canteiro={c}
                  plantios={plantiosPorCanteiro.get(c.id) ?? []}
                  hoje={hoje}
                  onEncerrar={encerrarPlantio}
                />
              ))}
            </>
          )}

          {canteiros.length === 0 && (
            <p className="text-center text-sm text-zinc-600">
              Nenhum canteiro cadastrado ainda. Cadastre em Mais → Cadastro → Canteiros.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

function CardCanteiro({
  canteiro,
  plantios,
  hoje,
  onEncerrar,
}: {
  canteiro: Canteiro;
  plantios: PlantioComCultura[];
  hoje: string | null;
  onEncerrar: (plantioId: string, status: StatusEncerramento) => Promise<void>;
}) {
  const ativos = plantios.filter((p) => p.status !== "transplantado");
  // Lote transplantado é histórico (nó da linhagem): fica recolhido pra não
  // disputar espaço com o que está de pé.
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const transplantados = plantios.filter((p) => p.status === "transplantado");

  return (
    <div className="rounded-xl border-2 border-zinc-800 bg-white">
      <div className="flex items-center justify-between px-3 pt-2.5">
        <span className="text-sm font-bold text-zinc-900">
          {iconeTipoCanteiro(canteiro.tipo)} {canteiro.nome}
        </span>
        {ativos.length > 1 && (
          <span className="rounded-full bg-[#eaf3ea] px-2 py-0.5 text-[10px] font-bold text-[#2e6b3e]">
            consórcio · {ativos.length}
          </span>
        )}
      </div>

      {ativos.length > 0 && (
        <div className="flex flex-col gap-2 px-3 pt-2">
          {ativos.map((p) => (
            <CardPlantio key={p.id} plantio={p} hoje={hoje} onEncerrar={(status) => onEncerrar(p.id, status)} />
          ))}
        </div>
      )}

      {transplantados.length > 0 && (
        <div className="px-3 pt-2">
          <button
            type="button"
            onClick={() => setHistoricoAberto((a) => !a)}
            className="text-[10px] text-zinc-500 underline"
          >
            {historicoAberto ? "esconder" : "ver"} {transplantados.length} lote(s) que já saíram daqui (transplantados)
          </button>
          {historicoAberto && (
            <div className="mt-2 flex flex-col gap-2">
              {transplantados.map((p) => (
                <CardPlantio key={p.id} plantio={p} hoje={hoje} onEncerrar={(status) => onEncerrar(p.id, status)} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 p-3">
        <Link
          href={`/patio/horta/manejo?canteiro=${canteiro.id}`}
          className="rounded-lg border-2 border-zinc-300 bg-white py-2 text-center text-xs font-bold text-zinc-700"
        >
          🌾 Manejo
        </Link>
        <Link
          href={`/patio/horta/registrar-plantio?canteiro=${canteiro.id}`}
          className="rounded-lg border-2 border-[#2e6b3e] bg-white py-2 text-center text-xs font-bold text-[#2e6b3e]"
        >
          ＋ Plantar aqui
        </Link>
      </div>
    </div>
  );
}

function CardPlantio({
  plantio,
  hoje,
  onEncerrar,
}: {
  plantio: PlantioComCultura;
  hoje: string | null;
  onEncerrar: (status: StatusEncerramento) => Promise<void>;
}) {
  const [linhagemAberta, setLinhagemAberta] = useState(false);
  const [linhagem, setLinhagem] = useState<Plantio[] | null>(null);
  const [carregandoLinhagem, setCarregandoLinhagem] = useState(false);
  const [encerrarAberto, setEncerrarAberto] = useState(false);
  const [confirmando, setConfirmando] = useState<StatusEncerramento | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fechado = plantio.status === "transplantado";
  const germinando = plantio.status === "germinando";
  const restante = diasRestantes(plantio.previsao_colheita, hoje);
  const contexto = `canteiro=${plantio.canteiro_id}&plantio=${plantio.id}`;
  const quantidade = plantio.quantidade_germinada ?? plantio.quantidade_inicial;

  async function alternarLinhagem() {
    const abrir = !linhagemAberta;
    setLinhagemAberta(abrir);
    if (!abrir || linhagem) return;
    setCarregandoLinhagem(true);
    try {
      setLinhagem(await linhagemPlantio(plantio.id));
    } catch {
      setLinhagemAberta(false);
    } finally {
      setCarregandoLinhagem(false);
    }
  }

  async function confirmarEncerramento() {
    if (!confirmando) return;
    setEnviando(true);
    setErro(null);
    try {
      await onEncerrar(confirmando);
    } catch {
      setErro("Não deu pra encerrar agora. Confira a internet e tente de novo.");
      setEnviando(false);
    }
  }

  const acoes: { href: string; rotulo: string }[] = fechado
    ? []
    : [
        ...(germinando
          ? [{ href: `/patio/horta/confirmar-germinacao?${contexto}`, rotulo: "🌿 Germinou" }]
          : [{ href: `/patio/horta/registrar-colheita?${contexto}`, rotulo: "🧺 Colher" }]),
        { href: `/patio/horta/registrar-perda?${contexto}`, rotulo: "📉 Perda" },
        { href: `/patio/horta/registrar-doacao?${contexto}`, rotulo: "🎁 Doar" },
        { href: `/patio/horta/transplantar?${contexto}`, rotulo: "🔀 Transplantar" },
      ];

  return (
    <div
      className={[
        "rounded-lg border p-2.5",
        fechado ? "border-dashed border-zinc-300 bg-zinc-100" : "border-zinc-300 bg-[#f1efe6]",
      ].join(" ")}
    >
      <p className={["text-sm font-bold", fechado ? "text-zinc-500" : "text-zinc-900"].join(" ")}>
        {fechado ? "🔒 " : ""}
        {plantio.cultura_nome}
      </p>
      <p className="text-[11px] text-zinc-500">
        {ROTULO_ORIGEM[plantio.origem]}
        {germinando ? " · germinando" : ""}
        {fechado ? " · transplantado (veja pra onde foi na linhagem)" : ""}
        {quantidade != null ? ` · ${quantidade} ${plantio.unidade ?? ""}`.trimEnd() : ""}
      </p>
      {restante && !fechado && <p className="text-[11px] font-semibold text-[#2e6b3e]">colheita prevista: {restante}</p>}

      {acoes.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {acoes.map((a, i) => (
            <Link
              key={a.href}
              href={a.href}
              className={[
                "rounded-lg border-2 py-2 text-center text-xs font-bold",
                i === 0 ? "border-[#2e6b3e] bg-[#2e6b3e] text-white" : "border-zinc-300 bg-white text-zinc-700",
              ].join(" ")}
            >
              {a.rotulo}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" onClick={alternarLinhagem} className="text-[10px] font-bold text-zinc-600 underline">
          🧬 Linhagem
        </button>
        {!fechado && (
          <button
            type="button"
            onClick={() => {
              setEncerrarAberto((a) => !a);
              setConfirmando(null);
            }}
            className="text-[10px] font-bold text-zinc-600 underline"
          >
            Encerrar sem registro…
          </button>
        )}
      </div>

      {encerrarAberto && !fechado && (
        <div className="mt-2 rounded-lg border border-dashed border-zinc-400 bg-white p-2">
          {confirmando ? (
            <>
              <p className="mb-2 text-[11px] text-zinc-700">
                Marcar {plantio.cultura_nome} como{" "}
                <b>{OPCOES_ENCERRAMENTO.find((o) => o.status === confirmando)?.rotulo}</b>? O plantio sai do mapa e não
                volta.
                {confirmando === "encerrado" ? " Se ainda tiver saldo, vira perda automática." : ""}
              </p>
              {erro && <p className="mb-2 text-[11px] text-red-700">{erro}</p>}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmando(null)}
                  className="rounded-lg border-2 border-zinc-300 py-1.5 text-[11px] font-bold text-zinc-700"
                >
                  Não
                </button>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={confirmarEncerramento}
                  className="rounded-lg border-2 border-red-700 bg-red-700 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  {enviando ? "…" : "Sim, encerrar"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mb-2 text-[10px] text-zinc-500">
                Pra quando não teve registro (ex.: planta morreu toda). Se foi colheita, perda ou doação de verdade, use
                os botões de cima — eles guardam a quantidade.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {OPCOES_ENCERRAMENTO.map((o) => (
                  <button
                    key={o.status}
                    type="button"
                    onClick={() => setConfirmando(o.status)}
                    className="rounded-lg border-2 border-zinc-300 bg-white py-1.5 text-[11px] font-bold text-zinc-700"
                  >
                    {o.rotulo}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {linhagemAberta && (
        <div className="mt-2 rounded-lg border border-dashed border-zinc-400 bg-white p-2">
          {carregandoLinhagem ? (
            <p className="text-[10px] text-zinc-500">Carregando linhagem…</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {/* linhagem_plantio() já devolve em ordem cronológica (mais antigo primeiro), ancestrais e descendentes juntos */}
              {(linhagem ?? []).map((l, i) => (
                <li key={l.id} className="text-[10px] text-zinc-600">
                  {i + 1}. {ROTULO_ORIGEM[l.origem]} — {new Date(`${l.data_inicio}T00:00:00`).toLocaleDateString("pt-BR")}
                  {l.status === "transplantado" ? " (encerrado — virou outro lote)" : ""}
                  {l.id === plantio.id ? " (este lote)" : ""}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
