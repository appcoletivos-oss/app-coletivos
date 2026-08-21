"use client";

// Cadastro → aba Equipe (ver Registro Geral, seção "Cadastro → Equipe:
// gestão de membros e convite"). Adicionar já gera o link de convite;
// "remover" desativa (nunca apaga), mesma lógica de parceiros/canteiros;
// editar contato só corrige nome/papel/WhatsApp.

import { useEffect, useState } from "react";
import {
  atualizarContatoMembro,
  criarMembro,
  desativarMembro,
  linkConvite,
  linkWhatsapp,
  listarMembrosAtivos,
  reenviarConvite,
} from "@/lib/equipe";
import type { MembroEquipe, PapelEquipe } from "@/lib/types";

const PAPEIS: { valor: PapelEquipe; rotulo: string }[] = [
  { valor: "funcionaria", rotulo: "Funcionária" },
  { valor: "coordenacao", rotulo: "Coordenação" },
];

function rotuloPapel(papel: PapelEquipe): string {
  return PAPEIS.find((p) => p.valor === papel)?.rotulo ?? papel;
}

function conviteExpirado(membro: MembroEquipe): boolean {
  if (!membro.convite_expira_em) return true;
  return new Date(membro.convite_expira_em).getTime() < Date.now();
}

export function AbaEquipe() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  // Origem (protocolo + domínio) só existe no navegador — fica vazia no
  // primeiro render do servidor e é preenchida depois, no efeito.
  const [origem, setOrigem] = useState("");

  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [linkCopiadoId, setLinkCopiadoId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setMembros(await listarMembrosAtivos());
    } catch {
      setErro("Não deu pra carregar a equipe agora. Confira a internet e tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    let cancelado = false;
    async function carregarInicial() {
      if (cancelado) return;
      setOrigem(window.location.origin);
      await carregar();
    }
    carregarInicial();
    return () => {
      cancelado = true;
    };
  }, []);

  function fecharTudo() {
    setFormAberto(false);
    setEditandoId(null);
    setRemovendoId(null);
  }

  async function copiarLink(membro: MembroEquipe) {
    if (!membro.convite_token || !origem) return;
    const link = linkConvite(origem, membro.convite_token);
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopiadoId(membro.id);
      setTimeout(() => setLinkCopiadoId((atual) => (atual === membro.id ? null : atual)), 2500);
    } catch {
      // Sem permissão de clipboard: sem problema, o link continua visível
      // na tela pra copiar manualmente.
    }
  }

  if (carregando) return <p className="text-center text-sm text-zinc-600">Carregando…</p>;
  if (erro) return <p className="text-center text-sm text-red-700">{erro}</p>;

  return (
    <div>
      {!formAberto && !editandoId && (
        <button
          type="button"
          onClick={() => setFormAberto(true)}
          className="mb-3 w-full rounded-xl border-2 border-dashed border-[#2e6b3e] py-2.5 text-xs font-bold text-[#2e6b3e]"
        >
          + Adicionar membro
        </button>
      )}

      {formAberto && (
        <div className="mb-3">
          <FormMembro
            titulo="Novo membro da equipe"
            textoSalvar="Gerar convite"
            onCancelar={fecharTudo}
            onSalvar={async (dados) => {
              await criarMembro(dados);
              fecharTudo();
              await carregar();
            }}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {membros.map((m) => (
          <div key={m.id} className="rounded-xl border-2 border-zinc-800 bg-white p-3">
            {editandoId === m.id ? (
              <FormMembro
                titulo="Editar contato"
                textoSalvar="Salvar"
                valoresIniciais={{ nome: m.nome, papel: m.papel, whatsapp: m.whatsapp }}
                onCancelar={fecharTudo}
                onSalvar={async (dados) => {
                  await atualizarContatoMembro(m.id, dados);
                  fecharTudo();
                  await carregar();
                }}
              />
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-zinc-900">{m.nome}</p>
                    <p className="text-[11px] text-zinc-500">
                      {rotuloPapel(m.papel)} · {m.status === "ativo" ? "ativo(a)" : "convite pendente"}
                    </p>
                  </div>
                  <a
                    href={linkWhatsapp(m.whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-full border-2 border-[#2e6b3e] px-3 py-1.5 text-[11px] font-bold text-[#2e6b3e]"
                  >
                    💬 WhatsApp
                  </a>
                </div>

                {m.status === "convidado" && m.convite_token && (
                  <div className="mt-2 rounded-lg border border-dashed border-zinc-400 bg-[#f1efe6] px-2 py-1.5 text-[11px] text-zinc-600">
                    {conviteExpirado(m) ? (
                      <div className="flex items-center justify-between gap-2">
                        <span>⏳ Convite expirado.</span>
                        <button
                          type="button"
                          onClick={async () => {
                            await reenviarConvite(m.id);
                            await carregar();
                          }}
                          className="font-bold text-[#2e6b3e] underline"
                        >
                          gerar novo link
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span>⏳ Aguardando primeiro acesso.</span>
                        <button
                          type="button"
                          onClick={() => copiarLink(m)}
                          className="font-bold text-[#2e6b3e] underline"
                        >
                          {linkCopiadoId === m.id ? "✅ link copiado!" : "copiar link do convite"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {removendoId === m.id ? (
                  <div className="mt-2 rounded-lg border-2 border-red-300 bg-red-50 p-2">
                    <p className="mb-2 text-[11px] text-red-800">
                      Remover {m.nome} da equipe? Isso não apaga o histórico de registros dela/dele — só tira da lista de membros ativos.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await desativarMembro(m.id);
                          fecharTudo();
                          await carregar();
                        }}
                        className="flex-1 rounded-lg bg-red-700 py-1.5 text-[11px] font-bold text-white"
                      >
                        Confirmar remoção
                      </button>
                      <button
                        type="button"
                        onClick={fecharTudo}
                        className="rounded-lg border-2 border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-600"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditandoId(m.id)}
                      className="rounded-full border-2 border-zinc-300 px-3 py-1 text-[11px] font-bold text-zinc-700"
                    >
                      ✏️ Editar contato
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemovendoId(m.id)}
                      className="rounded-full border-2 border-red-300 px-3 py-1 text-[11px] font-bold text-red-700"
                    >
                      🚫 Remover
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {membros.length === 0 && (
          <p className="text-center text-xs text-zinc-500">Nenhum membro cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}

function FormMembro({
  titulo,
  textoSalvar,
  valoresIniciais,
  onSalvar,
  onCancelar,
}: {
  titulo: string;
  textoSalvar: string;
  valoresIniciais?: { nome: string; papel: PapelEquipe; whatsapp: string };
  onSalvar: (dados: { nome: string; papel: PapelEquipe; whatsapp: string }) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState(valoresIniciais?.nome ?? "");
  const [papel, setPapel] = useState<PapelEquipe>(valoresIniciais?.papel ?? "funcionaria");
  const [whatsapp, setWhatsapp] = useState(valoresIniciais?.whatsapp ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!nome.trim() || !whatsapp.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({ nome, papel, whatsapp });
    } catch {
      setErro("Não deu pra salvar agora. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-zinc-400 bg-[#f1efe6] p-3">
      <p className="mb-2 text-xs font-bold text-zinc-800">{titulo}</p>
      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Nome
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome completo"
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>
      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Papel
        <select
          value={papel}
          onChange={(e) => setPapel(e.target.value as PapelEquipe)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
        >
          {PAPEIS.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
        WhatsApp
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          inputMode="tel"
          placeholder="Ex.: (11) 91234-5678"
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>
      {erro && <p className="mb-2 text-[11px] text-red-700">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={salvando || !nome.trim() || !whatsapp.trim()}
          onClick={salvar}
          className="flex-1 rounded-lg bg-[#2e6b3e] py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          {salvando ? "Salvando…" : textoSalvar}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-lg border-2 border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
