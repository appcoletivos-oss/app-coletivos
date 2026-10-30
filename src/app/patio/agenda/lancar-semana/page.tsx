"use client";

// Agenda → Lançar a semana (Sprint B, item B5 — SPRINT_B_RELATO_DO_TURNO.md,
// seção 7). Só coordenação e consultor.
//
// A coordenação cola a mensagem que já manda no grupo (escala + folgas +
// atividades), a IA estrutura, e esta tela mostra duas tabelas editáveis:
// Escala (dia, turno, pessoa) e Atividades (dia, turno, texto). Nome que
// não casou com ninguém da equipe fica destacado e trava o "Lançar semana"
// até ser escolhido ou apagado. Lançar cria eventos na Agenda e itens no
// Planejamento semanal, sem apagar nada (ver lib/lancar-semana.ts).
//
// `new Date()` só dentro de useEffect pós-mount (regra da sprint, bug real
// com Next 16 + useOffline), mesmo padrão de planejamento-semanal/page.tsx.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TelaBase } from "@/components/fluxo-registro";
import { obterMeuMembro } from "@/lib/auth";
import { listarMembrosAtivos } from "@/lib/equipe";
import {
  ErroLancarSemana,
  LIMITE_TEXTO_SEMANA,
  interpretarSemana,
  lancarSemana,
  registrarAceiteSemEdicao,
  type LinhaAtividadeSemana,
  type LinhaEscalaSemana,
  type ResumoLancamento,
} from "@/lib/lancar-semana";
import type { MembroEquipe } from "@/lib/types";

const NOMES_DIA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

type Etapa = "texto" | "conferir" | "feito";
type TurnoEscala = "manha" | "tarde" | "folga";

interface LinhaEscalaEditavel extends LinhaEscalaSemana {
  chave: number;
}
interface LinhaAtividadeEditavel extends LinhaAtividadeSemana {
  chave: number;
}

function somarDiasISO(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

// Segunda-feira da semana que vem (padrão da spec: "próxima semana").
function proximaSegunda(hoje: Date): string {
  const dia = hoje.getDay(); // 0 = domingo
  const ateSegunda = dia === 0 ? 1 : 8 - dia;
  const alvo = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + ateSegunda);
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, "0")}-${String(alvo.getDate()).padStart(2, "0")}`;
}

function formatarDataBR(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

let proximaChave = 1;
const novaChave = () => proximaChave++;

export default function LancarSemanaPage() {
  const [podeLancar, setPodeLancar] = useState<boolean | null>(null);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [segunda, setSegunda] = useState<string | null>(null);
  const [texto, setTexto] = useState("");

  const [etapa, setEtapa] = useState<Etapa>("texto");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [escala, setEscala] = useState<LinhaEscalaEditavel[]>([]);
  const [atividades, setAtividades] = useState<LinhaAtividadeEditavel[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [logId, setLogId] = useState<string | null>(null);
  const [editou, setEditou] = useState(false);
  const [resumo, setResumo] = useState<ResumoLancamento | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- new Date() só pode rodar pós-mount (regra da sprint, bug com Next 16 + useOffline), mesmo padrão de planejamento-semanal/page.tsx
    setSegunda(proximaSegunda(new Date()));
    let cancelado = false;
    (async () => {
      try {
        const [meu, lista] = await Promise.all([obterMeuMembro(), listarMembrosAtivos()]);
        if (cancelado) return;
        setPodeLancar(meu?.papel === "coordenacao" || meu?.papel === "consultor");
        setMembros(lista.filter((m) => m.status === "ativo"));
      } catch {
        if (!cancelado) {
          setPodeLancar(false);
          setErro("Não deu pra carregar a equipe agora. Confira a internet e tente de novo.");
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const dias = useMemo(
    () => (segunda ? Array.from({ length: 7 }, (_, i) => somarDiasISO(segunda, i)) : []),
    [segunda],
  );

  const faltando = escala.filter((l) => !l.membro_id).length;
  const nada = escala.length === 0 && atividades.length === 0;

  async function entender() {
    if (!segunda || !texto.trim()) return;
    setProcessando(true);
    setErro(null);
    try {
      const r = await interpretarSemana(segunda, texto);
      setEscala(r.escala.map((l) => ({ ...l, chave: novaChave() })));
      setAtividades(r.atividades.map((l) => ({ ...l, chave: novaChave() })));
      setAvisos(r.avisos);
      setLogId(r.log_id);
      setEditou(false);
      setEtapa("conferir");
    } catch (e) {
      setErro(e instanceof ErroLancarSemana ? e.message : "Não deu pra entender a semana agora. Tente de novo.");
    } finally {
      setProcessando(false);
    }
  }

  async function lancar() {
    if (!segunda || faltando > 0 || nada) return;
    setProcessando(true);
    setErro(null);
    try {
      const r = await lancarSemana(segunda, escala, atividades);
      await registrarAceiteSemEdicao(logId, !editou).catch(() => undefined);
      setResumo(r);
      setEtapa("feito");
    } catch (e) {
      setErro(
        e instanceof ErroLancarSemana
          ? e.message
          : "Parou no meio por falta de conexão ou permissão. O que já foi gravado ficou; tente lançar de novo (o que já existe é pulado).",
      );
    } finally {
      setProcessando(false);
    }
  }

  function mudarEscala(chave: number, mudanca: Partial<LinhaEscalaEditavel>) {
    setEditou(true);
    setEscala((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...mudanca } : l)));
  }
  function mudarAtividade(chave: number, mudanca: Partial<LinhaAtividadeEditavel>) {
    setEditou(true);
    setAtividades((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...mudanca } : l)));
  }

  if (podeLancar === false && !erro) {
    return (
      <TelaBase titulo="Lançar a semana" icone="🗓️" voltarHref="/patio/agenda">
        <p className="text-center text-sm text-zinc-600">Só a coordenação ou o consultor lançam a semana.</p>
      </TelaBase>
    );
  }

  return (
    <TelaBase titulo="Lançar a semana" icone="🗓️" voltarHref="/patio/agenda">
      {etapa === "texto" && (
        <>
          <SeletorSemana segunda={segunda} onMudar={setSegunda} />
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, LIMITE_TEXTO_SEMANA))}
            rows={14}
            placeholder="Cole aqui a mensagem da semana (escala, folgas e atividades), do jeito que vai pro grupo."
            className="mb-1 w-full rounded-xl border-2 border-zinc-300 bg-white p-3 text-xs"
          />
          <p className="mb-3 text-right text-[10px] text-zinc-400">
            {texto.length.toLocaleString("pt-BR")} / {LIMITE_TEXTO_SEMANA.toLocaleString("pt-BR")}
          </p>
          <p className="mb-3 text-[10px] text-zinc-500">
            O texto é lido por uma IA (Anthropic) para organizar a semana. Os primeiros nomes da equipe que
            aparecem na mensagem também são lidos. Nada é gravado antes de você conferir.
          </p>
          {erro && <p className="mb-3 text-center text-sm text-red-700">{erro}</p>}
          <button
            type="button"
            disabled={processando || !texto.trim() || !segunda || podeLancar !== true}
            onClick={entender}
            className="w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {processando ? "Lendo a mensagem…" : "Entender a semana"}
          </button>
        </>
      )}

      {etapa === "conferir" && segunda && (
        <>
          <p className="mb-3 text-center text-xs font-bold text-zinc-700">
            Semana de {formatarDataBR(segunda)} a {formatarDataBR(somarDiasISO(segunda, 6))}
          </p>

          {avisos.length > 0 && (
            <div className="mb-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-3">
              {avisos.map((a, i) => (
                <p key={i} className="text-[11px] text-amber-900">
                  ⚠️ {a}
                </p>
              ))}
            </div>
          )}

          <TabelaEscala
            linhas={escala}
            dias={dias}
            membros={membros}
            onMudar={mudarEscala}
            onApagar={(chave) => {
              setEditou(true);
              setEscala((ls) => ls.filter((l) => l.chave !== chave));
            }}
            onAdicionar={() => {
              setEditou(true);
              setEscala((ls) => [
                ...ls,
                {
                  chave: novaChave(),
                  data: segunda,
                  turno: "manha",
                  tipo: "turno_trabalho",
                  membro_id: null,
                  nome_no_texto: "",
                  pessoa_status: "faltando",
                },
              ]);
            }}
          />

          <TabelaAtividades
            linhas={atividades}
            dias={dias}
            onMudar={mudarAtividade}
            onApagar={(chave) => {
              setEditou(true);
              setAtividades((ls) => ls.filter((l) => l.chave !== chave));
            }}
            onAdicionar={() => {
              setEditou(true);
              setAtividades((ls) => [...ls, { chave: novaChave(), data: segunda, turno: "manha", descricao: "" }]);
            }}
          />

          {erro && <p className="mb-3 text-center text-sm text-red-700">{erro}</p>}
          {faltando > 0 && (
            <p className="mb-2 text-center text-[11px] font-semibold text-amber-800">
              Falta escolher a pessoa em {faltando === 1 ? "1 linha" : `${faltando} linhas`} (ou apagar).
            </p>
          )}
          <button
            type="button"
            disabled={processando || faltando > 0 || nada || atividades.some((a) => !a.descricao.trim())}
            onClick={lancar}
            className="mb-2 w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {processando
              ? "Lançando…"
              : `Lançar semana (${escala.length} na escala, ${atividades.length} atividades)`}
          </button>
          <button
            type="button"
            disabled={processando}
            onClick={() => {
              setErro(null);
              setEtapa("texto");
            }}
            className="w-full rounded-xl border-2 border-zinc-300 py-2.5 text-xs font-bold text-zinc-700"
          >
            Voltar e editar o texto
          </button>
        </>
      )}

      {etapa === "feito" && resumo && (
        <>
          <div className="mb-3 rounded-xl border-2 border-[#2e6b3e] bg-[#eaf3ea] p-3 text-sm text-zinc-900">
            <p>
              Criei {resumo.turnosCriados} {resumo.turnosCriados === 1 ? "turno" : "turnos"}, {resumo.folgasCriadas}{" "}
              {resumo.folgasCriadas === 1 ? "folga" : "folgas"}, {resumo.atividadesCriadas}{" "}
              {resumo.atividadesCriadas === 1 ? "atividade" : "atividades"}. Pulei {resumo.puladasExistentes} que já
              existiam e {resumo.puladasComRelatorio.length} em turnos com relatório aberto.
            </p>
            {resumo.puladasComRelatorio.length > 0 && (
              <ul className="mt-2 list-disc pl-4 text-[11px] text-zinc-700">
                {resumo.puladasComRelatorio.map((p, i) => (
                  <li key={i}>
                    {formatarDataBR(p.data)} {p.turno === "manha" ? "manhã" : "tarde"}: {p.descricao}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href="/patio/agenda"
              className="flex-1 rounded-xl border-2 border-[#2e6b3e] py-2.5 text-center text-xs font-bold text-[#2e6b3e]"
            >
              Ver Agenda
            </Link>
            <Link
              href="/patio/agenda/planejamento-semanal"
              className="flex-1 rounded-xl border-2 border-[#2e6b3e] py-2.5 text-center text-xs font-bold text-[#2e6b3e]"
            >
              Ver Planejamento
            </Link>
          </div>
        </>
      )}
    </TelaBase>
  );
}

function SeletorSemana({ segunda, onMudar }: { segunda: string | null; onMudar: (s: string) => void }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <button
        type="button"
        disabled={!segunda}
        onClick={() => segunda && onMudar(somarDiasISO(segunda, -7))}
        className="rounded-full border-2 border-zinc-300 px-3 py-1.5 text-xs font-bold text-zinc-700"
        aria-label="Semana anterior"
      >
        ←
      </button>
      <p className="text-center text-xs font-bold text-zinc-800">
        {segunda ? `Semana de ${formatarDataBR(segunda)} a ${formatarDataBR(somarDiasISO(segunda, 6))}` : "…"}
      </p>
      <button
        type="button"
        disabled={!segunda}
        onClick={() => segunda && onMudar(somarDiasISO(segunda, 7))}
        className="rounded-full border-2 border-zinc-300 px-3 py-1.5 text-xs font-bold text-zinc-700"
        aria-label="Próxima semana"
      >
        →
      </button>
    </div>
  );
}

function SeletorDia({ valor, dias, onMudar }: { valor: string; dias: string[]; onMudar: (d: string) => void }) {
  return (
    <select
      value={valor}
      onChange={(e) => onMudar(e.target.value)}
      className="rounded-lg border border-zinc-300 bg-white p-1 text-[11px]"
    >
      {dias.map((d, i) => (
        <option key={d} value={d}>
          {NOMES_DIA[i].slice(0, 3)} {formatarDataBR(d)}
        </option>
      ))}
    </select>
  );
}

function TabelaEscala({
  linhas,
  dias,
  membros,
  onMudar,
  onApagar,
  onAdicionar,
}: {
  linhas: LinhaEscalaEditavel[];
  dias: string[];
  membros: MembroEquipe[];
  onMudar: (chave: number, mudanca: Partial<LinhaEscalaEditavel>) => void;
  onApagar: (chave: number) => void;
  onAdicionar: () => void;
}) {
  return (
    <div className="mb-4 rounded-xl border-2 border-zinc-800 bg-white p-3">
      <p className="mb-2 text-xs font-bold text-zinc-900">
        Escala ({linhas.filter((l) => l.tipo === "turno_trabalho").length} turnos,{" "}
        {linhas.filter((l) => l.tipo === "folga").length} folgas)
      </p>
      <div className="flex flex-col gap-1.5">
        {linhas.map((l) => {
          const turno: TurnoEscala = l.tipo === "folga" ? "folga" : l.turno === "tarde" ? "tarde" : "manha";
          return (
            <div
              key={l.chave}
              className={[
                "flex flex-wrap items-center gap-1 rounded-lg px-2 py-1.5",
                l.membro_id ? "bg-[#f1efe6]" : "border-2 border-amber-400 bg-amber-50",
              ].join(" ")}
            >
              <SeletorDia valor={l.data} dias={dias} onMudar={(data) => onMudar(l.chave, { data })} />
              <select
                value={turno}
                onChange={(e) => {
                  const t = e.target.value as TurnoEscala;
                  onMudar(
                    l.chave,
                    t === "folga" ? { tipo: "folga", turno: "dia_todo" } : { tipo: "turno_trabalho", turno: t },
                  );
                }}
                className="rounded-lg border border-zinc-300 bg-white p-1 text-[11px]"
              >
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
                <option value="folga">Folga (dia todo)</option>
              </select>
              <select
                value={l.membro_id ?? ""}
                onChange={(e) => onMudar(l.chave, { membro_id: e.target.value || null })}
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white p-1 text-[11px]"
              >
                <option value="">Escolher pessoa…</option>
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => onApagar(l.chave)} aria-label="Apagar linha" className="text-[11px]">
                🗑️
              </button>
              {!l.membro_id && l.nome_no_texto && (
                <p className="w-full text-[10px] text-amber-900">No texto: “{l.nome_no_texto}”</p>
              )}
            </div>
          );
        })}
        {linhas.length === 0 && <p className="text-[11px] text-zinc-400">Nenhuma escala no texto.</p>}
      </div>
      <button
        type="button"
        onClick={onAdicionar}
        className="mt-2 w-full rounded-lg border-2 border-dashed border-zinc-400 py-1.5 text-[11px] font-bold text-zinc-600"
      >
        + linha na escala
      </button>
    </div>
  );
}

function TabelaAtividades({
  linhas,
  dias,
  onMudar,
  onApagar,
  onAdicionar,
}: {
  linhas: LinhaAtividadeEditavel[];
  dias: string[];
  onMudar: (chave: number, mudanca: Partial<LinhaAtividadeEditavel>) => void;
  onApagar: (chave: number) => void;
  onAdicionar: () => void;
}) {
  return (
    <div className="mb-4 rounded-xl border-2 border-zinc-800 bg-white p-3">
      <p className="mb-2 text-xs font-bold text-zinc-900">Atividades ({linhas.length})</p>
      <div className="flex flex-col gap-1.5">
        {linhas.map((l) => (
          <div key={l.chave} className="flex flex-col gap-1 rounded-lg bg-[#f1efe6] px-2 py-1.5">
            <div className="flex items-center gap-1">
              <SeletorDia valor={l.data} dias={dias} onMudar={(data) => onMudar(l.chave, { data })} />
              <select
                value={l.turno}
                onChange={(e) => onMudar(l.chave, { turno: e.target.value as "manha" | "tarde" })}
                className="rounded-lg border border-zinc-300 bg-white p-1 text-[11px]"
              >
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
              </select>
              <span className="flex-1" />
              <button type="button" onClick={() => onApagar(l.chave)} aria-label="Apagar linha" className="text-[11px]">
                🗑️
              </button>
            </div>
            <input
              value={l.descricao}
              onChange={(e) => onMudar(l.chave, { descricao: e.target.value })}
              placeholder="Atividade"
              className="w-full rounded-lg border border-zinc-300 bg-white p-1.5 text-xs"
            />
          </div>
        ))}
        {linhas.length === 0 && <p className="text-[11px] text-zinc-400">Nenhuma atividade no texto.</p>}
      </div>
      <button
        type="button"
        onClick={onAdicionar}
        className="mt-2 w-full rounded-lg border-2 border-dashed border-zinc-400 py-1.5 text-[11px] font-bold text-zinc-600"
      >
        + atividade
      </button>
    </div>
  );
}
