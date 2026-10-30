"use client";

// Fila "Para conferir" (Sprint B, item B4 — SPRINT_B_RELATO_DO_TURNO.md
// seção 6 e SPRINT_B2_HOME_RELATO_FILA.md seção 4). Só coordenação e
// consultor.
//
// Seções: Relatos do turno (propostas pendentes, por relatório), Fotos de
// doação pendentes, Culturas novas e Conferidas recentemente (com filtro
// "só autoaprovadas": quem relatou também conferiu — permitido pra
// coordenação/consultor, mas visível).
//
// Aprovar cria o registro oficial com a sessão de quem aprova (fica como
// registrado_por); quem relatou continua em relato_turno_propostas.
// criado_por, e a fila mostra "Relatado por X, conferido por Y". O fluxo
// que impede aprovar duas vezes está em src/lib/conferir.ts.
//
// Cultura/canteiro "não cadastrado" (o relato seguiu com o nome cru):
// alerta no cartão com "Usar uma que existe", "Cadastrar 'X'" (só cultura,
// revisar = false porque a coordenação já decidiu) e "Rejeitar". Canteiro
// não se cria por aqui. A aprovação fica bloqueada enquanto houver um.
//
// "Travadas": aprovação que parou no meio (reivindicada há mais de 5 min e
// ainda pendente). Não há retomada automática: alguém da coordenação marca
// como aprovada (o registro já existe) ou libera pra conferir de novo.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { obterMeuMembro } from "@/lib/auth";
import {
  aprovarProposta,
  buscarRelatorios,
  carregarCadastrosRelato,
  confirmarCultura,
  editarProposta,
  estaTravada,
  liberarTravada,
  listarCulturasParaRevisar,
  marcarTravadaComoAprovada,
  registrosDaTravada,
  listarPropostasConferidas,
  listarPropostasPendentes,
  nomesPorUsuario,
  obrigatoriosFaltando,
  propostaParaItem,
  rejeitarProposta,
  type PropostaCompleta,
  type RegistroCandidato,
  type RelatorioResumo,
} from "@/lib/conferir";
import { buscarEquipeDoTurno } from "@/lib/relatorio-turno";
import { aplicarResposta, naoCadastrados, perguntasDoItem, type Pergunta, type Resposta } from "@/lib/relato-campos";
import { criarCulturaMinima } from "@/lib/culturas";
import { lerRecentes } from "@/lib/recentes";
import type { CadastrosRelato, ItemRelato } from "@/lib/relato";
import type { Cultura } from "@/lib/types";
import { LISTA_RECENTES_CANTEIROS } from "@/components/escolha-plantio";
import { AlertaNaoCadastrado, CartaoItemRelato, PerguntaRelato } from "@/components/relato-itens";
import { FotosDoacaoPendentes } from "@/components/fotos-doacao-pendentes";
import { TelaBase } from "@/components/fluxo-registro";

const TRES_DIAS_MS = 3 * 24 * 3600_000;

function formatarDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export default function ConferirPage() {
  const [carregando, setCarregando] = useState(true);
  const [semAcesso, setSemAcesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [pendentes, setPendentes] = useState<PropostaCompleta[]>([]);
  const [itens, setItens] = useState<Map<string, ItemRelato>>(new Map());
  const [relatorios, setRelatorios] = useState<Map<string, RelatorioResumo>>(new Map());
  const [equipes, setEquipes] = useState<Map<string, string[]>>(new Map());
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  const [cadastros, setCadastros] = useState<CadastrosRelato | null>(null);
  const [culturasCompletas, setCulturasCompletas] = useState<Cultura[]>([]);
  const [culturasRevisar, setCulturasRevisar] = useState<{ id: string; nome: string; criada_por: string | null }[]>([]);
  const [conferidas, setConferidas] = useState<PropostaCompleta[]>([]);
  const [soAutoaprovadas, setSoAutoaprovadas] = useState(false);
  const [aprovandoGrupo, setAprovandoGrupo] = useState<string | null>(null);
  const [mensagemGrupo, setMensagemGrupo] = useState<Map<string, string>>(new Map());
  // Hora da última carga (decide o que está travado); Date.now() fora do render.
  const [agora, setAgora] = useState(0);

  const carregar = useCallback(async () => {
    try {
      const [lista, feitas, revisar, cad] = await Promise.all([
        listarPropostasPendentes(),
        listarPropostasConferidas(),
        listarCulturasParaRevisar(),
        carregarCadastrosRelato(),
      ]);
      const relIds = [...new Set([...lista, ...feitas].map((p) => p.relatorio_turno_id))];
      const rels = await buscarRelatorios(relIds);
      const usuarios = [
        ...lista.map((p) => p.criado_por),
        ...feitas.flatMap((p) => [p.criado_por, p.conferido_por ?? ""]),
        ...revisar.map((c) => c.criada_por ?? ""),
      ];
      const [mapaNomes, listaEquipes] = await Promise.all([
        nomesPorUsuario(usuarios),
        Promise.all(
          [...new Set(lista.map((p) => p.relatorio_turno_id))].map(async (id) => {
            const r = rels.get(id);
            const equipe = r ? await buscarEquipeDoTurno(r.data, r.turno).catch(() => []) : [];
            return [id, equipe.map((m) => m.nome)] as const;
          }),
        ),
      ]);
      setPendentes(lista);
      setItens(new Map(lista.map((p) => [p.id, propostaParaItem(p)])));
      setConferidas(feitas);
      setCulturasRevisar(revisar);
      setCadastros(cad.cadastros);
      setCulturasCompletas(cad.culturasCompletas);
      setRelatorios(rels);
      setNomes(mapaNomes);
      setEquipes(new Map(listaEquipes));
      setAgora(Date.now());
      setErro(null);
    } catch {
      setErro("Não deu pra carregar a fila agora. Confira a internet e tente de novo.");
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const membro = await obterMeuMembro();
        if (cancelado) return;
        if (membro?.papel !== "coordenacao" && membro?.papel !== "consultor") {
          setSemAcesso(true);
          return;
        }
        await carregar();
      } catch {
        if (!cancelado) setErro("Não deu pra carregar a fila agora. Confira a internet e tente de novo.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [carregar]);

  const travadas = useMemo(() => pendentes.filter((p) => estaTravada(p, agora)), [pendentes, agora]);

  const grupos = useMemo(() => {
    const porRelatorio = new Map<string, PropostaCompleta[]>();
    for (const p of pendentes.filter((x) => !estaTravada(x, agora))) porRelatorio.set(p.relatorio_turno_id, [...(porRelatorio.get(p.relatorio_turno_id) ?? []), p]);
    return [...porRelatorio.entries()].sort(([a], [b]) =>
      (relatorios.get(a)?.data ?? "").localeCompare(relatorios.get(b)?.data ?? ""),
    );
  }, [pendentes, relatorios, agora]);

  async function aprovar(p: PropostaCompleta): Promise<string | undefined> {
    const item = itens.get(p.id);
    const relatorio = relatorios.get(p.relatorio_turno_id);
    if (!item || !relatorio) return "Proposta sem relatório.";
    const { aviso } = await aprovarProposta(p, item, relatorio.data, culturasCompletas);
    return aviso;
  }

  async function aprovarTudoCompleto(relatorioId: string, lista: PropostaCompleta[]) {
    setAprovandoGrupo(relatorioId);
    let ok = 0;
    let falhas = 0;
    for (const p of lista) {
      const item = itens.get(p.id);
      if (!item || p.conferido_por || obrigatoriosFaltando(item).length > 0) continue;
      try {
        await aprovar(p);
        ok += 1;
      } catch {
        falhas += 1;
      }
    }
    setMensagemGrupo((m) =>
      new Map(m).set(relatorioId, `Aprovei ${ok}.${falhas ? ` ${falhas} deram erro: tente uma a uma.` : ""}`),
    );
    setAprovandoGrupo(null);
    await carregar();
  }

  async function salvarItem(id: string, novo: ItemRelato) {
    await editarProposta(id, novo);
    setItens((m) => new Map(m).set(id, novo));
  }

  // "Cadastrar 'X'": cria já revisada (revisar = false) e usa a cultura
  // nova em toda proposta pendente com o mesmo nome não cadastrado.
  async function cadastrarCultura(nome: string) {
    if (!cadastros) return;
    const nova = await criarCulturaMinima(nome, false);
    const novos = { ...cadastros, culturas: [...cadastros.culturas, { id: nova.id, nome: nova.nome }] };
    setCadastros(novos);
    setCulturasCompletas((l) => [...l, nova]);
    for (const [id, item] of itens) {
      const mesmoNome = naoCadastrados(item).some((a) => a.tipo === "cultura" && normalizar(a.nome) === normalizar(nome));
      if (mesmoNome) await salvarItem(id, aplicarResposta(item, "cultura_id", nova.id, novos)).catch(() => undefined);
    }
  }

  if (carregando) {
    return (
      <TelaBase titulo="Para conferir" icone="🔎" voltarHref="/patio">
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (semAcesso) {
    return (
      <TelaBase titulo="Para conferir" icone="🔎" voltarHref="/patio">
        <p className="text-center text-sm text-zinc-600">Só a coordenação e o consultor conferem os relatos.</p>
      </TelaBase>
    );
  }

  const nome = (userId: string | null) => (userId ? (nomes.get(userId) ?? "alguém") : "—");
  const listaConferidas = soAutoaprovadas ? conferidas.filter((p) => p.conferido_por === p.criado_por) : conferidas;

  return (
    <TelaBase titulo="Para conferir" icone="🔎" voltarHref="/patio">
      {erro && <p className="mb-3 text-center text-sm text-red-700">{erro}</p>}

      <p className="mb-2 text-xs font-bold text-zinc-800">📝 Relatos do turno ({pendentes.length})</p>
      {grupos.length === 0 && <p className="mb-4 text-center text-xs text-zinc-500">Nada pendente. 🎉</p>}
      {cadastros &&
        grupos.map(([relatorioId, lista]) => {
          const r = relatorios.get(relatorioId);
          const completas = lista.filter((p) => {
            const item = itens.get(p.id);
            return item && !p.conferido_por && obrigatoriosFaltando(item).length === 0;
          }).length;
          const relatores = [...new Set(lista.map((p) => nome(p.criado_por)))];
          return (
            <div key={relatorioId} className="mb-5 rounded-xl border-2 border-zinc-300 bg-[#f6f6f1] p-2">
              <div className="mb-2 px-1">
                <p className="text-sm font-bold text-zinc-900">
                  {r ? `${formatarDataBR(r.data)} · ${r.turno === "manha" ? "Manhã" : "Tarde"}` : "Relatório"}
                </p>
                <p className="text-[11px] text-zinc-600">
                  Equipe do ponto: {(equipes.get(relatorioId) ?? []).join(", ") || "ninguém bateu entrada"}
                </p>
                <p className="text-[11px] text-zinc-600">Relatado por {relatores.join(", ")}</p>
              </div>
              {completas > 0 && (
                <button
                  type="button"
                  disabled={aprovandoGrupo !== null}
                  onClick={() => aprovarTudoCompleto(relatorioId, lista)}
                  className="mb-2 w-full rounded-lg bg-[#2e6b3e] py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {aprovandoGrupo === relatorioId ? "Aprovando…" : `✅ Aprovar tudo que está completo (${completas})`}
                </button>
              )}
              {mensagemGrupo.get(relatorioId) && (
                <p className="mb-2 text-center text-[11px] text-zinc-700">{mensagemGrupo.get(relatorioId)}</p>
              )}
              <div className="flex flex-col gap-2">
                {lista.map((p) => {
                  const item = itens.get(p.id);
                  if (!item) return null;
                  return (
                    <CartaoProposta
                      key={p.id}
                      proposta={p}
                      item={item}
                      cadastros={cadastros}
                      relatadoPor={nome(p.criado_por)}
                      emConferenciaPor={p.conferido_por ? nome(p.conferido_por) : null}
                      onSalvar={(novo) => salvarItem(p.id, novo)}
                      onCadastrarCultura={cadastrarCultura}
                      onAprovar={() => aprovar(p)}
                      onRejeitar={(motivo) => rejeitarProposta(p.id, motivo)}
                      onConcluido={carregar}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

      {cadastros && travadas.length > 0 && (
        <div className="mb-5">
          <p className="mb-1 text-xs font-bold text-zinc-800">⛔ Travadas ({travadas.length})</p>
          <p className="mb-2 text-[11px] text-zinc-600">
            A aprovação começou e parou no meio. Confira se o registro foi criado antes de escolher.
          </p>
          <div className="flex flex-col gap-2">
            {travadas.map((p) => {
              const item = itens.get(p.id);
              if (!item) return null;
              return (
                <CartaoTravada
                  key={p.id}
                  proposta={p}
                  item={item}
                  cadastros={cadastros}
                  aprovadoPor={nome(p.conferido_por)}
                  relatadoPor={nome(p.criado_por)}
                  onConcluido={carregar}
                />
              );
            })}
          </div>
        </div>
      )}

      <FotosDoacaoPendentes />

      <p className="mb-2 text-xs font-bold text-zinc-800">🌱 Culturas novas ({culturasRevisar.length})</p>
      {culturasRevisar.length === 0 && <p className="mb-4 text-center text-xs text-zinc-500">Nenhuma cultura nova pra revisar.</p>}
      <div className="mb-4 flex flex-col gap-2">
        {culturasRevisar.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border-2 border-zinc-800 bg-white p-2.5">
            <span className="text-xs text-zinc-900">
              <span className="font-bold">{c.nome}</span>
              <span className="block text-[10px] text-zinc-500">cadastrada por {nome(c.criada_por)}</span>
            </span>
            <span className="flex shrink-0 gap-1.5">
              <Link href="/patio/mais/cadastro" className="rounded-lg border-2 border-zinc-300 px-2 py-1 text-[11px] font-bold text-zinc-700">
                Editar
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await confirmarCultura(c.id).catch(() => undefined);
                  await carregar();
                }}
                className="rounded-lg bg-[#2e6b3e] px-2 py-1 text-[11px] font-bold text-white"
              >
                Está certo assim
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold text-zinc-800">Conferidas recentemente</p>
        <label className="flex items-center gap-1 text-[11px] text-zinc-600">
          <input type="checkbox" checked={soAutoaprovadas} onChange={(e) => setSoAutoaprovadas(e.target.checked)} />
          só autoaprovadas
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        {listaConferidas.length === 0 && <p className="text-center text-xs text-zinc-500">Nada por aqui.</p>}
        {listaConferidas.map((p) => (
          <div key={p.id} className="rounded-lg border border-zinc-300 bg-white p-2 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-zinc-800">
                {p.status === "aprovada" ? "✅" : "❌"} {p.tipo}
              </span>
              {p.conferido_por === p.criado_por && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">autoaprovada</span>
              )}
            </div>
            <p className="italic text-zinc-500">“{p.trecho_origem}”</p>
            <p className="text-zinc-600">
              Relatado por {nome(p.criado_por)}, conferido por {nome(p.conferido_por)}
              {p.conferido_em && ` em ${new Date(p.conferido_em).toLocaleDateString("pt-BR")}`}
            </p>
            {p.motivo_rejeicao && <p className="text-red-700">Motivo: {p.motivo_rejeicao}</p>}
          </div>
        ))}
      </div>
    </TelaBase>
  );
}

function CartaoTravada({
  proposta,
  item,
  cadastros,
  aprovadoPor,
  relatadoPor,
  onConcluido,
}: {
  proposta: PropostaCompleta;
  item: ItemRelato;
  cadastros: CadastrosRelato;
  aprovadoPor: string;
  relatadoPor: string;
  onConcluido: () => Promise<void>;
}) {
  const [candidatos, setCandidatos] = useState<RegistroCandidato[] | null>(null);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [confirmandoLiberar, setConfirmandoLiberar] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    registrosDaTravada(proposta)
      .then((lista) => {
        if (cancelado) return;
        setCandidatos(lista);
        if (lista.length === 1) setEscolhido(lista[0].id);
      })
      .catch(() => {
        if (!cancelado) setCandidatos([]);
      });
    return () => {
      cancelado = true;
    };
  }, [proposta]);

  async function executar(acao: () => Promise<void>) {
    setProcessando(true);
    setErro(null);
    try {
      await acao();
      await onConcluido();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu certo agora. Tente de novo.");
    } finally {
      setProcessando(false);
    }
  }

  const registro = candidatos?.find((c) => c.id === escolhido) ?? null;
  const hora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <CartaoItemRelato item={item} cadastros={cadastros}>
      <p className="mt-2 text-[10px] text-zinc-600">
        Relatado por {relatadoPor}. Aprovação começada por {aprovadoPor}
        {proposta.conferido_em && ` em ${hora(proposta.conferido_em)}`}.
      </p>
      {candidatos === null && <p className="mt-1 text-[10px] text-zinc-500">Procurando o registro…</p>}
      {candidatos?.length === 0 && (
        <p className="mt-1 text-[10px] font-bold text-zinc-700">
          Não achei registro criado por essa aprovação: provavelmente dá pra liberar.
        </p>
      )}
      {candidatos && candidatos.length > 1 && (
        <div className="mt-1">
          <p className="text-[10px] font-bold text-zinc-700">Achei mais de um registro: qual é o desta proposta?</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {candidatos.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setEscolhido(c.id)}
                className={`rounded-full border-2 px-2 py-0.5 text-[10px] font-bold ${
                  escolhido === c.id ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]" : "border-zinc-300 bg-white text-zinc-700"
                }`}
              >
                {hora(c.quando)}
              </button>
            ))}
          </div>
        </div>
      )}
      {candidatos?.length === 1 && <p className="mt-1 text-[10px] text-[#2e6b3e]">Registro encontrado ({hora(candidatos[0].quando)}).</p>}

      {confirmandoLiberar ? (
        <div className="mt-2 rounded-lg border-2 border-amber-400 bg-amber-50 p-2">
          <p className="text-[10px] text-amber-900">
            Só libere se o registro NÃO foi criado. Se ele existe, aprovar de novo duplica.
          </p>
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              disabled={processando}
              onClick={() => executar(() => liberarTravada(proposta))}
              className="rounded-lg bg-amber-600 px-3 py-1 text-[11px] font-bold text-white disabled:opacity-40"
            >
              Liberar
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoLiberar(false)}
              className="rounded-lg border-2 border-amber-300 px-3 py-1 text-[11px] font-bold text-amber-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-1.5">
          <button
            type="button"
            disabled={processando || !registro}
            onClick={() => registro && executar(() => marcarTravadaComoAprovada(proposta, registro))}
            className="rounded-lg bg-[#2e6b3e] py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
          >
            ✅ Marcar como aprovada (o registro já existe)
          </button>
          <button
            type="button"
            disabled={processando}
            onClick={() => setConfirmandoLiberar(true)}
            className="rounded-lg border-2 border-zinc-800 py-1.5 text-[11px] font-bold text-zinc-800 disabled:opacity-40"
          >
            ↩️ Liberar para conferir de novo
          </button>
        </div>
      )}
      {erro && <p className="mt-1 text-[11px] text-red-700">{erro}</p>}
    </CartaoItemRelato>
  );
}

function CartaoProposta({
  proposta,
  item,
  cadastros,
  relatadoPor,
  emConferenciaPor,
  onSalvar,
  onCadastrarCultura,
  onAprovar,
  onRejeitar,
  onConcluido,
}: {
  proposta: PropostaCompleta;
  item: ItemRelato;
  cadastros: CadastrosRelato;
  relatadoPor: string;
  // Outra aprovação em andamento (reivindicada há menos de 5 min).
  emConferenciaPor: string | null;
  onSalvar: (novo: ItemRelato) => Promise<void>;
  onCadastrarCultura: (nome: string) => Promise<void>;
  onAprovar: () => Promise<string | undefined>;
  onRejeitar: (motivo: string) => Promise<void>;
  onConcluido: () => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [rejeitando, setRejeitando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Pega a hora uma vez, na montagem (Date.now() no render não é puro).
  const [agora] = useState(() => Date.now());

  const falta = obrigatoriosFaltando(item);
  const velha = agora - new Date(proposta.criado_em).getTime() > TRES_DIAS_MS;
  const perguntas: Pergunta[] = editando ? perguntasDoItem(item, cadastros, lerRecentes(LISTA_RECENTES_CANTEIROS), true) : [];

  async function executar(acao: () => Promise<unknown>) {
    setProcessando(true);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu certo agora. Tente de novo.");
    } finally {
      setProcessando(false);
    }
  }

  async function responder(p: Pergunta, r: Resposta) {
    await executar(() => onSalvar(aplicarResposta(item, p.campo, r, cadastros)));
  }

  return (
    <CartaoItemRelato item={item} cadastros={cadastros}>
      <p className="mt-2 text-[10px] text-zinc-500">
        Relatado por {relatadoPor} ·{" "}
        <span className={velha ? "font-bold text-red-700" : ""}>{new Date(proposta.criado_em).toLocaleDateString("pt-BR")}</span>
        {velha && <span className="font-bold text-red-700"> · há mais de 3 dias</span>}
      </p>
      {falta.length > 0 && <p className="mt-1 text-[10px] font-bold text-red-700">Pra aprovar falta: {falta.join(", ")}</p>}
      {emConferenciaPor && (
        <p className="mt-1 text-[10px] font-bold text-amber-800">Sendo aprovada agora por {emConferenciaPor}.</p>
      )}

      {naoCadastrados(item).map((alvo) => (
        <AlertaNaoCadastrado
          key={alvo.campo}
          item={item}
          alvo={alvo}
          cadastros={cadastros}
          canteirosRecentes={lerRecentes(LISTA_RECENTES_CANTEIROS)}
          modo="fila"
          onResponder={(p, r) => responder(p, r)}
          onCadastrar={onCadastrarCultura}
          onRejeitar={() => setRejeitando(true)}
        />
      ))}

      {perguntas.map((p) => (
        <PerguntaRelato key={p.chave} pergunta={p} onResponder={(r) => responder(p, r)} />
      ))}

      {rejeitando ? (
        <div className="mt-2">
          <input
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (curto)"
            className="w-full rounded-lg border-2 border-zinc-300 p-2 text-xs"
          />
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              disabled={processando || !motivo.trim()}
              onClick={() =>
                executar(async () => {
                  await onRejeitar(motivo);
                  await onConcluido();
                })
              }
              className="rounded-lg bg-red-700 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
            >
              Rejeitar
            </button>
            <button
              type="button"
              onClick={() => setRejeitando(false)}
              className="rounded-lg border-2 border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            disabled={processando || falta.length > 0 || !!emConferenciaPor}
            onClick={() =>
              executar(async () => {
                const aviso = await onAprovar();
                if (aviso) setErro(aviso);
                await onConcluido();
              })
            }
            className="flex-1 rounded-lg bg-[#2e6b3e] py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
          >
            {processando ? "…" : "✅ Aprovar"}
          </button>
          <button
            type="button"
            disabled={processando}
            onClick={() => setEditando((v) => !v)}
            className="rounded-lg border-2 border-zinc-800 px-3 py-1.5 text-[11px] font-bold text-zinc-800 disabled:opacity-40"
          >
            {editando ? "Fechar" : "✏️ Editar"}
          </button>
          <button
            type="button"
            disabled={processando || !!emConferenciaPor}
            onClick={() => setRejeitando(true)}
            className="rounded-lg border-2 border-red-300 px-3 py-1.5 text-[11px] font-bold text-red-700 disabled:opacity-40"
          >
            ❌
          </button>
        </div>
      )}
      {erro && <p className="mt-1 text-[11px] text-red-700">{erro}</p>}
    </CartaoItemRelato>
  );
}
