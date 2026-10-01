"use client";

// Relatório do Turno — tela do relatório (Sprint A, item 6 —
// SPRINT_A_REGISTRO_SIMPLIFICADO_ETAPA2.md, seção 11c/11d).
//
// Cabeçalho (data, turno, equipe) + lista de itens, cada um com
// ✅ Feito / ❌ Não feito e, quando aplicável, "Registrar dado" — que abre
// o sub-formulário já existente (Registrar compostagem, Manejo,
// Registrar plantio, Registrar colheita, Esvaziar caixa, Análise
// sensorial) via query string (?relatorio_item=<id>&voltar=<aqui>). O
// sub-formulário grava o vínculo e marca feito=true ao salvar (ver
// vincularRegistroAoItem em lib/relatorio-turno.ts) — esta tela só
// precisa recarregar os itens quando volta a ganhar foco (ver carregar()).
//
// Fechar é de qualquer papel; reabrir só Coordenação/Consultor (proposta
// P1 do sprint doc, RLS aberta a qualquer papel — o controle é só aqui).
// "Esvaziar caixa" dentro de um item de tipo caixa também só aparece pra
// Coordenação/Consultor (decisão do Thiago, 01/10/2026 — a RLS e o RPC
// registrar_esvaziamento_caixa barram a equipe de qualquer jeito); a
// equipe continua marcando o item como feito/não feito.

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  buscarEquipeDoTurno,
  buscarRelatorioPorId,
  criarItemExtra,
  criarItemIrmao,
  escolherTipoRegistro,
  fecharRelatorio,
  listarItensDoRelatorio,
  marcarItemFeito,
  reabrirRelatorio,
} from "@/lib/relatorio-turno";
import { obterMeuMembro } from "@/lib/auth";
import type { ItemRelatorioTurno, MembroDoTurno, RelatorioTurno, TipoRegistroRelatorio } from "@/lib/types";
import { TelaBase } from "@/components/fluxo-registro";

type DestinoSubFormulario = "compostagem" | "manejo" | "plantio" | "colheita" | "esvaziar" | "analise";

const ROTAS_SUBFORMULARIO: Record<DestinoSubFormulario, string> = {
  compostagem: "/patio/compostagem/registrar-alimentacao",
  manejo: "/patio/horta/manejo",
  plantio: "/patio/horta/registrar-plantio",
  colheita: "/patio/horta/registrar-colheita",
  esvaziar: "/patio/compostagem/esvaziar-caixa",
  analise: "/patio/compostagem/analise-sensorial",
};

function hrefSubFormulario(destino: DestinoSubFormulario, itemId: string, relatorioId: string): string {
  const voltar = encodeURIComponent(`/patio/relatorio-turno/${relatorioId}`);
  return `${ROTAS_SUBFORMULARIO[destino]}?relatorio_item=${itemId}&voltar=${voltar}`;
}

const TIPOS_REGISTRO: { valor: TipoRegistroRelatorio; icone: string; rotulo: string }[] = [
  { valor: "compostagem", icone: "📥", rotulo: "Compostagem" },
  { valor: "canteiro", icone: "🌻", rotulo: "Canteiro" },
  { valor: "caixa", icone: "🪣", rotulo: "Caixa" },
  { valor: "ronda", icone: "🚶", rotulo: "Ronda" },
  { valor: "outro", icone: "🔧", rotulo: "Outro" },
];

function formatarDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function RelatorioTurnoConteudo() {
  const params = useParams<{ id: string }>();
  const relatorioId = params.id;

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioTurno | null>(null);
  const [itens, setItens] = useState<ItemRelatorioTurno[]>([]);
  const [equipe, setEquipe] = useState<MembroDoTurno[]>([]);
  const [ehGestor, setEhGestor] = useState(false);

  const [novoTexto, setNovoTexto] = useState("");
  const [criando, setCriando] = useState(false);
  const [fechando, setFechando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const rel = await buscarRelatorioPorId(relatorioId);
      if (!rel) {
        setErro("Relatório não encontrado.");
        return;
      }
      const [listaItens, listaEquipe, meuMembro] = await Promise.all([
        listarItensDoRelatorio(rel.id),
        buscarEquipeDoTurno(rel.data, rel.turno),
        obterMeuMembro(),
      ]);
      setRelatorio(rel);
      setItens(listaItens);
      setEquipe(listaEquipe);
      setEhGestor(meuMembro?.papel === "coordenacao" || meuMembro?.papel === "consultor");
      setErro(null);
    } catch {
      setErro("Não deu pra carregar o relatório agora. Confira a internet e tente de novo.");
    } finally {
      setCarregando(false);
    }
  }, [relatorioId]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!cancelado) await carregar();
    })();
    return () => {
      cancelado = true;
    };
  }, [carregar]);

  // Volta a carregar quando a aba ganha foco de novo — é como esta tela
  // sabe que o sub-formulário salvou algo enquanto estava em outra rota
  // (ver topo do arquivo).
  useEffect(() => {
    function aoFocar() {
      carregar();
    }
    window.addEventListener("focus", aoFocar);
    return () => window.removeEventListener("focus", aoFocar);
  }, [carregar]);

  async function adicionarExtra() {
    if (!novoTexto.trim() || !relatorio) return;
    setCriando(true);
    try {
      await criarItemExtra(relatorio.id, novoTexto);
      setNovoTexto("");
      await carregar();
    } catch {
      // Mantém o texto digitado pra pessoa tentar de novo — sem internet,
      // o item simplesmente não é criado (Relatório do Turno exige
      // conexão, ver seção 11e do sprint doc).
    } finally {
      setCriando(false);
    }
  }

  async function alternarFechamento() {
    if (!relatorio) return;
    setFechando(true);
    try {
      if (relatorio.fechado_em) await reabrirRelatorio(relatorio.id);
      else await fecharRelatorio(relatorio.id);
      await carregar();
    } finally {
      setFechando(false);
    }
  }

  if (carregando) {
    return (
      <TelaBase titulo="Relatório do turno" icone="📋" voltarHref="/patio/relatorio-turno">
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (erro || !relatorio) {
    return (
      <TelaBase titulo="Relatório do turno" icone="📋" voltarHref="/patio/relatorio-turno">
        <p className="text-center text-sm text-red-700">{erro ?? "Relatório não encontrado."}</p>
      </TelaBase>
    );
  }

  const bloqueado = relatorio.fechado_em !== null;

  return (
    <TelaBase titulo="Relatório do turno" icone="📋" voltarHref="/patio/relatorio-turno">
      <div className="mb-3 rounded-xl border-2 border-zinc-800 bg-white p-3">
        <p className="text-sm font-bold text-zinc-900">
          {formatarDataBR(relatorio.data)} · {relatorio.turno === "manha" ? "Manhã" : "Tarde"}
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">
          Equipe: {equipe.length === 0 ? "ninguém bateu entrada ainda" : equipe.map((m) => m.nome).join(", ")}
        </p>
        {bloqueado && <p className="mt-1 text-[11px] font-bold text-zinc-500">🔒 Fechado — somente leitura.</p>}
      </div>

      <div className="flex flex-col gap-2">
        {itens.map((item) => (
          <LinhaItemRelatorio key={item.id} item={item} relatorioId={relatorio.id} bloqueado={bloqueado} ehGestor={ehGestor} onMudou={carregar} />
        ))}
        {itens.length === 0 && (
          <p className="text-center text-xs text-zinc-500">
            Nenhum item ainda — sem planejamento lançado pra este turno. Use &quot;+ outra atividade&quot; abaixo.
          </p>
        )}
      </div>

      {!bloqueado && (
        <div className="mt-3 flex gap-2">
          <input
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") adicionarExtra();
            }}
            placeholder="+ outra atividade…"
            className="flex-1 rounded-xl border-2 border-dashed border-zinc-400 bg-white p-2.5 text-sm"
          />
          <button
            type="button"
            disabled={criando || !novoTexto.trim()}
            onClick={adicionarExtra}
            className="rounded-xl bg-[#2e6b3e] px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            +
          </button>
        </div>
      )}

      {(!bloqueado || ehGestor) && (
        <button
          type="button"
          disabled={fechando}
          onClick={alternarFechamento}
          className="mt-5 w-full rounded-xl border-2 border-zinc-800 bg-white py-2.5 text-sm font-bold text-zinc-800 disabled:opacity-60"
        >
          {fechando ? "…" : bloqueado ? "🔓 Reabrir relatório" : "🔒 Fechar relatório"}
        </button>
      )}
    </TelaBase>
  );
}

function LinhaItemRelatorio({
  item,
  relatorioId,
  bloqueado,
  ehGestor,
  onMudou,
}: {
  item: ItemRelatorioTurno;
  relatorioId: string;
  bloqueado: boolean;
  ehGestor: boolean;
  onMudou: () => Promise<void>;
}) {
  const [pedindoMotivo, setPedindoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [processando, setProcessando] = useState(false);

  async function marcar(feito: boolean) {
    if (!feito) {
      setPedindoMotivo(true);
      return;
    }
    setProcessando(true);
    try {
      await marcarItemFeito(item.id, true);
      await onMudou();
    } finally {
      setProcessando(false);
    }
  }

  async function confirmarNaoFeito() {
    if (!motivo.trim()) return;
    setProcessando(true);
    try {
      await marcarItemFeito(item.id, false, motivo);
      setPedindoMotivo(false);
      setMotivo("");
      await onMudou();
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-zinc-800 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{item.descricao}</p>
          <p className="text-[10px] text-zinc-500">
            {item.origem === "planejada" ? "planejada" : "extra"}
            {item.registro_id_gerado && " · registro vinculado"}
          </p>
        </div>
        {item.feito !== null && (
          <span
            className={[
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
              item.feito ? "bg-[#eaf3ea] text-[#2e6b3e]" : "bg-red-100 text-red-700",
            ].join(" ")}
          >
            {item.feito ? "✅ feito" : "❌ não feito"}
          </span>
        )}
      </div>

      {item.feito === false && item.motivo_nao_feito && (
        <p className="mt-1 text-[11px] text-zinc-600">Motivo: {item.motivo_nao_feito}</p>
      )}

      {!bloqueado &&
        (pedindoMotivo ? (
          <div className="mt-2">
            <input
              autoFocus
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por que não foi feito?"
              className="w-full rounded-lg border-2 border-zinc-300 p-2 text-xs"
            />
            <div className="mt-1.5 flex gap-1.5">
              <button
                type="button"
                disabled={processando || !motivo.trim()}
                onClick={confirmarNaoFeito}
                className="rounded-lg bg-red-700 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setPedindoMotivo(false)}
                className="rounded-lg border-2 border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={processando}
              onClick={() => marcar(true)}
              className="flex-1 rounded-lg border-2 border-[#2e6b3e] bg-[#eaf3ea] py-1.5 text-xs font-bold text-[#2e6b3e] disabled:opacity-50"
            >
              ✅ Feito
            </button>
            <button
              type="button"
              disabled={processando}
              onClick={() => marcar(false)}
              className="flex-1 rounded-lg border-2 border-red-300 bg-white py-1.5 text-xs font-bold text-red-700 disabled:opacity-50"
            >
              ❌ Não feito
            </button>
          </div>
        ))}

      {!bloqueado && (
        <div className="mt-2">
          <BotaoRegistrarDado item={item} relatorioId={relatorioId} ehGestor={ehGestor} onEscolheuTipo={onMudou} />
        </div>
      )}
    </div>
  );
}

function BotaoRegistrarDado({
  item,
  relatorioId,
  ehGestor,
  onEscolheuTipo,
}: {
  item: ItemRelatorioTurno;
  relatorioId: string;
  ehGestor: boolean;
  onEscolheuTipo: () => Promise<void>;
}) {
  const router = useRouter();
  const [expandido, setExpandido] = useState(false);
  const [processando, setProcessando] = useState(false);

  // Um item tem no máximo um registro: se já tem um vinculado, "Registrar
  // dado" de novo cria um item IRMÃO e navega pra ele, em vez de
  // sobrescrever o vínculo existente (seção 11d do sprint doc).
  async function irPara(destino: DestinoSubFormulario) {
    setProcessando(true);
    try {
      const itemAlvo = item.registro_id_gerado ? await criarItemIrmao(item) : item;
      router.push(hrefSubFormulario(destino, itemAlvo.id, relatorioId));
    } finally {
      setProcessando(false);
    }
  }

  async function escolher(tipo: TipoRegistroRelatorio) {
    setProcessando(true);
    try {
      await escolherTipoRegistro(item.id, tipo);
      if (tipo === "ronda" || tipo === "outro") setExpandido(false);
      await onEscolheuTipo();
      if (tipo === "compostagem") await irPara("compostagem");
    } finally {
      setProcessando(false);
    }
  }

  if (!item.tipo_registro) {
    if (!expandido) {
      return (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          className="text-[11px] font-bold text-zinc-600 underline"
        >
          📎 Registrar dado
        </button>
      );
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {TIPOS_REGISTRO.map((t) => (
          <button
            key={t.valor}
            type="button"
            disabled={processando}
            onClick={() => escolher(t.valor)}
            className="rounded-full border-2 border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-bold text-zinc-700 disabled:opacity-50"
          >
            {t.icone} {t.rotulo}
          </button>
        ))}
      </div>
    );
  }

  if (item.tipo_registro === "ronda" || item.tipo_registro === "outro") return null;

  if (item.tipo_registro === "compostagem") {
    return (
      <button
        type="button"
        disabled={processando}
        onClick={() => irPara("compostagem")}
        className="text-[11px] font-bold text-zinc-600 underline disabled:opacity-50"
      >
        📎 Registrar dado (compostagem)
      </button>
    );
  }

  if (item.tipo_registro === "canteiro") {
    return (
      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={processando} onClick={() => irPara("manejo")} className="rounded-full border-2 border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-bold text-zinc-700 disabled:opacity-50">
          🌾 Manejo
        </button>
        <button type="button" disabled={processando} onClick={() => irPara("plantio")} className="rounded-full border-2 border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-bold text-zinc-700 disabled:opacity-50">
          🌱 Plantio
        </button>
        <button type="button" disabled={processando} onClick={() => irPara("colheita")} className="rounded-full border-2 border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-bold text-zinc-700 disabled:opacity-50">
          🧺 Colheita
        </button>
      </div>
    );
  }

  // caixa — Esvaziar só pra Coordenação/Consultor (ver cabeçalho).
  return (
    <div className="flex flex-wrap gap-1.5">
      {ehGestor && (
        <button type="button" disabled={processando} onClick={() => irPara("esvaziar")} className="rounded-full border-2 border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-bold text-zinc-700 disabled:opacity-50">
          🧹 Esvaziar caixa
        </button>
      )}
      <button type="button" disabled={processando} onClick={() => irPara("analise")} className="rounded-full border-2 border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-bold text-zinc-700 disabled:opacity-50">
        👃 Análise sensorial
      </button>
    </div>
  );
}
