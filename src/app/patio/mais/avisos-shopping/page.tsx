"use client";

// Mais → Avisos ao shopping
//
// Log cronológico bidirecional de comunicação com o shopping (WhatsApp,
// e-mail, presencial). Restrito a coordenação/consultor. Ver
// claude/handoff-mais-pacote1.md, seção 3.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { obterMeuMembro } from "@/lib/auth";
import { criarAviso, definirStatusAviso, listarAvisos } from "@/lib/avisos";
import type {
  AssuntoAviso,
  AvisoShopping,
  CanalAviso,
  DirecaoAviso,
  StatusAviso,
} from "@/lib/types";
import { TelaBase } from "@/components/fluxo-registro";

const DIRECOES: { valor: DirecaoAviso; rotulo: string }[] = [
  { valor: "para_shopping", rotulo: "Nós → shopping" },
  { valor: "do_shopping", rotulo: "Shopping → nós" },
];

const CANAIS: { valor: CanalAviso; rotulo: string }[] = [
  { valor: "whatsapp", rotulo: "WhatsApp" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "presencial", rotulo: "Presencial" },
  { valor: "outro", rotulo: "Outro" },
];

const ASSUNTOS: { valor: AssuntoAviso; rotulo: string }[] = [
  { valor: "pedido_compra", rotulo: "Pedido de compra" },
  { valor: "ocorrencia_atipica", rotulo: "Ocorrência atípica" },
  { valor: "pagamento_mensal", rotulo: "Pagamento mensal" },
  { valor: "planejamento_atividade", rotulo: "Planejamento de atividade" },
  { valor: "pedido_manutencao", rotulo: "Pedido de manutenção" },
  { valor: "outro", rotulo: "Outro" },
];

function rotulo<T extends string>(lista: { valor: T; rotulo: string }[], valor: T): string {
  return lista.find((i) => i.valor === valor)?.rotulo ?? valor;
}

export default function AvisosShoppingPage() {
  const [acesso, setAcesso] = useState<"verificando" | "ok" | "negado">("verificando");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<AvisoShopping[]>([]);
  const [formAberto, setFormAberto] = useState(false);

  const [fDirecao, setFDirecao] = useState<DirecaoAviso | "">("");
  const [fAssunto, setFAssunto] = useState<AssuntoAviso | "">("");
  const [fStatus, setFStatus] = useState<StatusAviso | "">("");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const membro = await obterMeuMembro();
        const gestor = membro?.papel === "coordenacao" || membro?.papel === "consultor";
        if (!cancelado) setAcesso(gestor ? "ok" : "negado");
      } catch {
        if (!cancelado) setAcesso("ok"); // offline: deixa a RLS decidir
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setAvisos(await listarAvisos());
    } catch {
      setErro("Não deu pra carregar os avisos agora. Confira a internet e tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (acesso !== "ok") return;
    let cancelado = false;
    (async () => {
      if (!cancelado) await carregar();
    })();
    return () => {
      cancelado = true;
    };
  }, [acesso]);

  const filtrados = useMemo(
    () =>
      avisos.filter(
        (a) =>
          (!fDirecao || a.direcao === fDirecao) &&
          (!fAssunto || a.assunto === fAssunto) &&
          (!fStatus || a.status === fStatus),
      ),
    [avisos, fDirecao, fAssunto, fStatus],
  );

  async function alternarStatus(a: AvisoShopping) {
    await definirStatusAviso(a.id, a.status === "pendente" ? "resolvido" : "pendente");
    await carregar();
  }

  if (acesso === "verificando") {
    return (
      <TelaBase titulo="Avisos ao shopping" icone="📣" voltarHref="/patio/mais">
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (acesso === "negado") {
    return (
      <TelaBase titulo="Avisos ao shopping" icone="📣" voltarHref="/patio/mais">
        <p className="rounded-lg border border-dashed border-zinc-400 bg-[#f1efe6] px-3 py-4 text-center text-xs text-zinc-600">
          Esta tela é da coordenação.
        </p>
      </TelaBase>
    );
  }

  return (
    <TelaBase titulo="Avisos ao shopping" icone="📣" voltarHref="/patio/mais">
      {!formAberto && (
        <button
          type="button"
          onClick={() => setFormAberto(true)}
          className="mb-4 w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white"
        >
          + Registrar aviso
        </button>
      )}

      {formAberto && (
        <FormAviso
          onCancelar={() => setFormAberto(false)}
          onSalvo={async () => {
            setFormAberto(false);
            await carregar();
          }}
        />
      )}

      <div className="mb-3 grid grid-cols-3 gap-1.5">
        <select
          value={fDirecao}
          onChange={(e) => setFDirecao(e.target.value as DirecaoAviso | "")}
          className="rounded-lg border-2 border-zinc-300 bg-white p-1.5 text-[11px]"
        >
          <option value="">Direção</option>
          {DIRECOES.map((d) => (
            <option key={d.valor} value={d.valor}>
              {d.rotulo}
            </option>
          ))}
        </select>
        <select
          value={fAssunto}
          onChange={(e) => setFAssunto(e.target.value as AssuntoAviso | "")}
          className="rounded-lg border-2 border-zinc-300 bg-white p-1.5 text-[11px]"
        >
          <option value="">Assunto</option>
          {ASSUNTOS.map((a) => (
            <option key={a.valor} value={a.valor}>
              {a.rotulo}
            </option>
          ))}
        </select>
        <select
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value as StatusAviso | "")}
          className="rounded-lg border-2 border-zinc-300 bg-white p-1.5 text-[11px]"
        >
          <option value="">Status</option>
          <option value="pendente">Pendente</option>
          <option value="resolvido">Resolvido</option>
        </select>
      </div>

      {carregando ? (
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      ) : erro ? (
        <p className="text-center text-sm text-red-700">{erro}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map((a) => (
            <div key={a.id} className="rounded-xl border-2 border-zinc-800 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-zinc-500">
                  {rotulo(DIRECOES, a.direcao)} · {rotulo(CANAIS, a.canal)}
                </span>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    a.status === "pendente"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-[#eaf3ea] text-[#2e6b3e]",
                  ].join(" ")}
                >
                  {a.status}
                </span>
              </div>
              <p className="mt-1 text-xs font-bold text-zinc-800">{rotulo(ASSUNTOS, a.assunto)}</p>
              <p className="text-sm text-zinc-900">{a.descricao}</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {new Date(`${a.data}T00:00:00`).toLocaleDateString("pt-BR")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => alternarStatus(a)}
                  className="rounded-full border-2 border-zinc-300 px-3 py-1 text-[11px] font-bold text-zinc-700"
                >
                  {a.status === "pendente" ? "✅ Marcar resolvido" : "↩️ Reabrir"}
                </button>
                {a.assunto === "ocorrencia_atipica" && a.ocorrencia_atipica_id && (
                  <Link
                    href="/patio/mais/ocorrencia-atipica"
                    className="rounded-full border-2 border-zinc-300 px-3 py-1 text-[11px] font-bold text-zinc-700"
                  >
                    ⚠️ Ver ocorrência
                  </Link>
                )}
                {a.assunto === "pagamento_mensal" && (
                  <Link
                    href="/patio/mais/financeiro"
                    className="rounded-full border-2 border-zinc-300 px-3 py-1 text-[11px] font-bold text-zinc-700"
                  >
                    💰 {a.lancamento_financeiro_id ? "Ver lançamento" : "Lançar no financeiro"}
                  </Link>
                )}
              </div>
            </div>
          ))}
          {filtrados.length === 0 && (
            <p className="text-center text-xs text-zinc-500">Nenhum aviso.</p>
          )}
        </div>
      )}
    </TelaBase>
  );
}

function FormAviso({
  onCancelar,
  onSalvo,
}: {
  onCancelar: () => void;
  onSalvo: () => Promise<void>;
}) {
  const [direcao, setDirecao] = useState<DirecaoAviso>("para_shopping");
  const [canal, setCanal] = useState<CanalAviso>("whatsapp");
  const [assunto, setAssunto] = useState<AssuntoAviso>("pedido_compra");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!descricao.trim() || !data) return;
    setSalvando(true);
    setErro(null);
    try {
      await criarAviso({ direcao, canal, assunto, descricao, data });
      await onSalvo();
    } catch {
      setErro("Não deu pra salvar agora. Tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border-2 border-dashed border-zinc-400 bg-[#f1efe6] p-3">
      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Direção
        <select
          value={direcao}
          onChange={(e) => setDirecao(e.target.value as DirecaoAviso)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
        >
          {DIRECOES.map((d) => (
            <option key={d.valor} value={d.valor}>
              {d.rotulo}
            </option>
          ))}
        </select>
      </label>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="block text-[11px] font-semibold text-zinc-600">
          Canal
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
        <label className="block text-[11px] font-semibold text-zinc-600">
          Data
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
          />
        </label>
      </div>
      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Assunto
        <select
          value={assunto}
          onChange={(e) => setAssunto(e.target.value as AssuntoAviso)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
        >
          {ASSUNTOS.map((a) => (
            <option key={a.valor} value={a.valor}>
              {a.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
        Descrição
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="mt-1 min-h-20 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>
      {erro && <p className="mb-2 text-[11px] text-red-700">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={salvando || !descricao.trim()}
          onClick={salvar}
          className="flex-1 rounded-lg bg-[#2e6b3e] py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          {salvando ? "Salvando…" : "Salvar aviso"}
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
