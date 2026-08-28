"use client";

// Mais → Ocorrência atípica
//
// Registro aberto a qualquer papel (equipe inclusive), com foto
// obrigatória. Enquanto não resolvida, a ocorrência aparece no banner da
// home do Pátio. Opção de já virar um aviso ao shopping (cria a linha em
// avisos_shopping junto). Ver claude/handoff-mais-pacote1.md, seção 2.

import { useEffect, useState } from "react";
import { enviarFotoRegistro } from "@/lib/patio";
import {
  contarOcorrenciasPendentes,
  criarOcorrencia,
  listarOcorrencias,
  resolverOcorrencia,
} from "@/lib/ocorrencias";
import type { CanalAviso, OcorrenciaAtipica } from "@/lib/types";
import { TelaBase } from "@/components/fluxo-registro";

const CANAIS: { valor: CanalAviso; rotulo: string }[] = [
  { valor: "whatsapp", rotulo: "WhatsApp" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "presencial", rotulo: "Presencial" },
  { valor: "outro", rotulo: "Outro" },
];

export default function OcorrenciaAtipicaPage() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaAtipica[]>([]);
  const [pendentes, setPendentes] = useState(0);
  const [formAberto, setFormAberto] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [lista, qtd] = await Promise.all([listarOcorrencias(), contarOcorrenciasPendentes()]);
      setOcorrencias(lista);
      setPendentes(qtd);
    } catch {
      setErro("Não deu pra carregar as ocorrências agora. Confira a internet e tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!cancelado) await carregar();
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  async function alternarResolvido(o: OcorrenciaAtipica) {
    await resolverOcorrencia(o.id, !o.resolvido);
    await carregar();
  }

  return (
    <TelaBase titulo="Ocorrência atípica" icone="⚠️" voltarHref="/patio/mais">
      {carregando ? (
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      ) : erro ? (
        <p className="text-center text-sm text-red-700">{erro}</p>
      ) : (
        <>
          {!formAberto && (
            <button
              type="button"
              onClick={() => setFormAberto(true)}
              className="mb-4 w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white"
            >
              + Registrar ocorrência
            </button>
          )}

          {formAberto && (
            <FormOcorrencia
              onCancelar={() => setFormAberto(false)}
              onSalvo={async () => {
                setFormAberto(false);
                await carregar();
              }}
            />
          )}

          {pendentes > 0 && (
            <p className="mb-3 rounded-lg border-2 border-amber-400 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              {pendentes} {pendentes === 1 ? "ocorrência pendente" : "ocorrências pendentes"}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {ocorrencias.map((o) => (
              <div
                key={o.id}
                className={[
                  "rounded-xl border-2 p-3",
                  o.resolvido ? "border-zinc-300 bg-zinc-50 opacity-80" : "border-zinc-800 bg-white",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-zinc-900">{o.descricao}</p>
                  {o.resolvido && (
                    <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                      resolvida
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {new Date(o.criado_em).toLocaleString("pt-BR")}
                </p>
                <button
                  type="button"
                  onClick={() => alternarResolvido(o)}
                  className="mt-2 rounded-full border-2 border-zinc-300 px-3 py-1 text-[11px] font-bold text-zinc-700"
                >
                  {o.resolvido ? "↩️ Reabrir" : "✅ Marcar resolvida"}
                </button>
              </div>
            ))}
            {ocorrencias.length === 0 && (
              <p className="text-center text-xs text-zinc-500">Nenhuma ocorrência registrada.</p>
            )}
          </div>
        </>
      )}
    </TelaBase>
  );
}

function FormOcorrencia({
  onCancelar,
  onSalvo,
}: {
  onCancelar: () => void;
  onSalvo: () => Promise<void>;
}) {
  const [descricao, setDescricao] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [virarAviso, setVirarAviso] = useState(false);
  const [canal, setCanal] = useState<CanalAviso>("whatsapp");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function selecionarFoto(arquivo: File | null) {
    setFoto(arquivo);
    setFotoPreview((antigo) => {
      if (antigo) URL.revokeObjectURL(antigo);
      return arquivo ? URL.createObjectURL(arquivo) : null;
    });
  }

  async function salvar() {
    if (!descricao.trim() || !foto) return;
    setSalvando(true);
    setErro(null);
    try {
      const fotoUrl = await enviarFotoRegistro(foto, "ocorrencia");
      await criarOcorrencia({ descricao, foto_url: fotoUrl }, virarAviso ? { canal } : undefined);
      await onSalvo();
    } catch {
      setErro("Não deu pra salvar agora. A foto é obrigatória — confira a internet e tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border-2 border-dashed border-zinc-400 bg-[#f1efe6] p-3">
      <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
        O que aconteceu?
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder='Ex.: "vazamento na torneira do fundo", "portão da rampa quebrado"…'
          className="mt-1 min-h-20 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>

      <label className="mb-3 block cursor-pointer rounded-xl border-2 border-dashed border-zinc-800 bg-white p-6 text-center">
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
          <span className="text-sm font-bold text-zinc-800">📷 Foto (obrigatória)</span>
        )}
      </label>

      <label className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-zinc-700">
        <input
          type="checkbox"
          checked={virarAviso}
          onChange={(e) => setVirarAviso(e.target.checked)}
          className="h-4 w-4"
        />
        Isso precisa virar um aviso pro shopping?
      </label>
      {virarAviso && (
        <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
          Por qual canal você vai avisar?
          <select
            value={canal}
            onChange={(e) => setCanal(e.target.value as CanalAviso)}
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
          >
            {CANAIS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </label>
      )}

      {erro && <p className="mb-2 text-[11px] text-red-700">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={salvando || !descricao.trim() || !foto}
          onClick={salvar}
          className="flex-1 rounded-lg bg-[#2e6b3e] py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          {salvando ? "Salvando…" : "Salvar ocorrência"}
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
