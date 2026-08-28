"use client";

// Mais → Financeiro
//
// Categorias cadastráveis (sem lista fixa) + lançamentos de entrada/saída
// com comprovante obrigatório. Restrito a coordenação/consultor. Ver
// claude/handoff-mais-pacote1.md, seção 5.
//
// Fora desta rodada (handoff 5.4): reaproveitar compras de Compostagem/
// Horta — não existe tabela nem formulário de compra no schema atual, então
// não há o que conferir ainda. A coluna `origem` já fica pronta pra
// marcação manual.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { obterMeuMembro } from "@/lib/auth";
import { enviarFotoRegistro } from "@/lib/patio";
import { listarAvisos, vincularAvisoALancamento } from "@/lib/avisos";
import {
  criarCategoria,
  criarLancamento,
  listarCategorias,
  listarLancamentos,
  resumoFinanceiro,
} from "@/lib/financeiro";
import type {
  AvisoShopping,
  CategoriaFinanceira,
  LancamentoComCategoria,
  OrigemLancamento,
  TipoFinanceiro,
} from "@/lib/types";
import { TelaBase } from "@/components/fluxo-registro";

const ORIGENS: { valor: OrigemLancamento; rotulo: string }[] = [
  { valor: "manual", rotulo: "Manual" },
  { valor: "repasse_shopping", rotulo: "Repasse do shopping" },
  { valor: "compra_compostagem", rotulo: "Compra — Compostagem" },
  { valor: "compra_horta", rotulo: "Compra — Horta" },
  { valor: "outro", rotulo: "Outro" },
];

function reais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FinanceiroPage() {
  const [acesso, setAcesso] = useState<"verificando" | "ok" | "negado">("verificando");
  const [aba, setAba] = useState<"lancamentos" | "categorias">("lancamentos");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const membro = await obterMeuMembro();
        const gestor = membro?.papel === "coordenacao" || membro?.papel === "consultor";
        if (!cancelado) setAcesso(gestor ? "ok" : "negado");
      } catch {
        if (!cancelado) setAcesso("ok");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  if (acesso === "verificando") {
    return (
      <TelaBase titulo="Financeiro" icone="💰" voltarHref="/patio/mais">
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }
  if (acesso === "negado") {
    return (
      <TelaBase titulo="Financeiro" icone="💰" voltarHref="/patio/mais">
        <p className="rounded-lg border border-dashed border-zinc-400 bg-[#f1efe6] px-3 py-4 text-center text-xs text-zinc-600">
          Esta tela é da coordenação.
        </p>
      </TelaBase>
    );
  }

  return (
    <TelaBase titulo="Financeiro" icone="💰" voltarHref="/patio/mais">
      <div className="mb-4 flex gap-1.5">
        {(["lancamentos", "categorias"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAba(v)}
            className={[
              "rounded-lg border-2 px-3 py-2 text-[11px] font-bold",
              aba === v ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]" : "border-zinc-300 bg-white text-zinc-600",
            ].join(" ")}
          >
            {v === "lancamentos" ? "Lançamentos" : "Categorias"}
          </button>
        ))}
      </div>

      {aba === "lancamentos" ? <AbaLancamentos /> : <AbaCategorias />}
    </TelaBase>
  );
}

function AbaLancamentos() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [lancamentos, setLancamentos] = useState<LancamentoComCategoria[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [avisos, setAvisos] = useState<AvisoShopping[]>([]);
  const [formAberto, setFormAberto] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [l, c, a] = await Promise.all([listarLancamentos(), listarCategorias(), listarAvisos()]);
      setLancamentos(l);
      setCategorias(c);
      setAvisos(a);
    } catch {
      setErro("Não deu pra carregar o financeiro agora. Confira a internet e tente de novo.");
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

  const resumo = useMemo(() => resumoFinanceiro(lancamentos), [lancamentos]);
  const avisosPagamentoLivres = avisos.filter(
    (a) => a.assunto === "pagamento_mensal" && !a.lancamento_financeiro_id,
  );

  if (carregando) return <p className="text-center text-sm text-zinc-600">Carregando…</p>;
  if (erro) return <p className="text-center text-sm text-red-700">{erro}</p>;

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border-2 border-zinc-300 bg-white p-2">
          <p className="text-[10px] font-bold text-zinc-500">Entradas</p>
          <p className="text-xs font-bold text-[#2e6b3e]">{reais(resumo.entradas)}</p>
        </div>
        <div className="rounded-xl border-2 border-zinc-300 bg-white p-2">
          <p className="text-[10px] font-bold text-zinc-500">Saídas</p>
          <p className="text-xs font-bold text-red-700">{reais(resumo.saidas)}</p>
        </div>
        <div className="rounded-xl border-2 border-zinc-800 bg-white p-2">
          <p className="text-[10px] font-bold text-zinc-500">Saldo</p>
          <p className="text-xs font-bold text-zinc-900">{reais(resumo.saldo)}</p>
        </div>
      </div>

      {!formAberto &&
        (categorias.length === 0 ? (
          <p className="mb-4 rounded-lg border border-dashed border-zinc-400 bg-[#f1efe6] px-3 py-2 text-center text-[11px] text-zinc-600">
            Cadastre ao menos uma categoria na aba Categorias antes de lançar.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setFormAberto(true)}
            className="mb-4 w-full rounded-xl bg-[#2e6b3e] py-3 text-sm font-bold text-white"
          >
            + Novo lançamento
          </button>
        ))}

      {formAberto && (
        <FormLancamento
          categorias={categorias}
          avisosPagamentoLivres={avisosPagamentoLivres}
          onCancelar={() => setFormAberto(false)}
          onSalvo={async () => {
            setFormAberto(false);
            await carregar();
          }}
        />
      )}

      <div className="flex flex-col gap-2">
        {lancamentos.map((l) => (
          <div key={l.id} className="rounded-xl border-2 border-zinc-800 bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800">{l.categoria_nome}</span>
              <span
                className={[
                  "text-sm font-bold",
                  l.tipo === "entrada" ? "text-[#2e6b3e]" : "text-red-700",
                ].join(" ")}
              >
                {l.tipo === "entrada" ? "+" : "−"} {reais(Number(l.valor))}
              </span>
            </div>
            {l.descricao && <p className="text-sm text-zinc-900">{l.descricao}</p>}
            <p className="mt-1 text-[11px] text-zinc-500">
              {new Date(`${l.data}T00:00:00`).toLocaleDateString("pt-BR")}
              {l.origem !== "manual"
                ? ` · ${ORIGENS.find((o) => o.valor === l.origem)?.rotulo ?? l.origem}`
                : ""}
              {l.aviso_id ? " · vinculado a aviso" : ""}
            </p>
          </div>
        ))}
        {lancamentos.length === 0 && (
          <p className="text-center text-xs text-zinc-500">Nenhum lançamento ainda.</p>
        )}
      </div>
    </div>
  );
}

function FormLancamento({
  categorias,
  avisosPagamentoLivres,
  onCancelar,
  onSalvo,
}: {
  categorias: CategoriaFinanceira[];
  avisosPagamentoLivres: AvisoShopping[];
  onCancelar: () => void;
  onSalvo: () => Promise<void>;
}) {
  const [tipo, setTipo] = useState<TipoFinanceiro>("saida");
  const [categoriaId, setCategoriaId] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState("");
  const [origem, setOrigem] = useState<OrigemLancamento>("manual");
  const [avisoId, setAvisoId] = useState("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [comprovantePreview, setComprovantePreview] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo);

  function selecionarComprovante(arquivo: File | null) {
    setComprovante(arquivo);
    setComprovantePreview((antigo) => {
      if (antigo) URL.revokeObjectURL(antigo);
      return arquivo && arquivo.type.startsWith("image/") ? URL.createObjectURL(arquivo) : null;
    });
  }

  async function salvar() {
    if (!categoriaId || !valor.trim() || !data || !comprovante) return;
    setSalvando(true);
    setErro(null);
    try {
      const comprovanteUrl = await enviarFotoRegistro(comprovante, "financeiro");
      const lancamento = await criarLancamento({
        tipo,
        categoria_id: categoriaId,
        valor: Number(valor),
        data,
        descricao: descricao || null,
        comprovante_url: comprovanteUrl,
        origem,
      });
      if (origem === "repasse_shopping" && avisoId) {
        await vincularAvisoALancamento(avisoId, lancamento.id);
      }
      await onSalvo();
    } catch {
      setErro("Não deu pra salvar agora. O comprovante é obrigatório — confira a internet e tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border-2 border-dashed border-zinc-400 bg-[#f1efe6] p-3">
      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="block text-[11px] font-semibold text-zinc-600">
          Tipo
          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as TipoFinanceiro);
              setCategoriaId("");
            }}
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
          >
            <option value="saida">Saída</option>
            <option value="entrada">Entrada</option>
          </select>
        </label>
        <label className="block text-[11px] font-semibold text-zinc-600">
          Valor (R$)
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
          />
        </label>
      </div>

      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Categoria
        <select
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
        >
          <option value="">Escolher…</option>
          {categoriasDoTipo.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        {categoriasDoTipo.length === 0 && (
          <span className="mt-1 block text-[10px] text-amber-700">
            Nenhuma categoria de {tipo}. Cadastre na aba Categorias.
          </span>
        )}
      </label>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="block text-[11px] font-semibold text-zinc-600">
          Data
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
          />
        </label>
        <label className="block text-[11px] font-semibold text-zinc-600">
          Origem
          <select
            value={origem}
            onChange={(e) => setOrigem(e.target.value as OrigemLancamento)}
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
          >
            {ORIGENS.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      {origem === "repasse_shopping" && avisosPagamentoLivres.length > 0 && (
        <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
          Vincular a um aviso de pagamento (opcional)
          <select
            value={avisoId}
            onChange={(e) => setAvisoId(e.target.value)}
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
          >
            <option value="">Nenhum</option>
            {avisosPagamentoLivres.map((a) => (
              <option key={a.id} value={a.id}>
                {new Date(`${a.data}T00:00:00`).toLocaleDateString("pt-BR")} — {a.descricao.slice(0, 40)}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="mb-2 block text-[11px] font-semibold text-zinc-600">
        Descrição (opcional)
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-2 text-sm"
        />
      </label>

      <label className="mb-3 block cursor-pointer rounded-xl border-2 border-dashed border-zinc-800 bg-white p-5 text-center">
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => selecionarComprovante(e.target.files?.[0] ?? null)}
        />
        {comprovantePreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comprovantePreview} alt="Prévia do comprovante" className="mx-auto max-h-32 rounded-lg" />
        ) : comprovante ? (
          <span className="text-sm font-bold text-zinc-800">📎 {comprovante.name}</span>
        ) : (
          <span className="text-sm font-bold text-zinc-800">📎 Comprovante (obrigatório)</span>
        )}
      </label>

      {erro && <p className="mb-2 text-[11px] text-red-700">{erro}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={salvando || !categoriaId || !valor.trim() || !comprovante}
          onClick={salvar}
          className="flex-1 rounded-lg bg-[#2e6b3e] py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          {salvando ? "Salvando…" : "Salvar lançamento"}
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

function AbaCategorias() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoFinanceiro>("saida");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setCategorias(await listarCategorias());
    } catch {
      setErro("Não deu pra carregar as categorias agora. Confira a internet e tente de novo.");
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

  async function adicionar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await criarCategoria({ nome, tipo });
      setNome("");
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p className="text-center text-sm text-zinc-600">Carregando…</p>;
  if (erro) return <p className="text-center text-sm text-red-700">{erro}</p>;

  return (
    <div>
      <div className="mb-4 rounded-xl border-2 border-dashed border-zinc-400 bg-[#f1efe6] p-3">
        <div className="mb-2 flex gap-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Repasse shopping, Insumos, Sementes…"
            className="flex-1 rounded-lg border-2 border-zinc-300 p-2 text-sm"
          />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoFinanceiro)}
            className="rounded-lg border-2 border-zinc-300 bg-white p-2 text-sm"
          >
            <option value="saida">Saída</option>
            <option value="entrada">Entrada</option>
          </select>
        </div>
        <button
          type="button"
          disabled={salvando || !nome.trim()}
          onClick={adicionar}
          className="w-full rounded-lg bg-[#2e6b3e] py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          {salvando ? "Salvando…" : "+ Adicionar categoria"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {categorias.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border-2 border-zinc-800 bg-white px-3 py-2"
          >
            <span className="text-sm font-bold text-zinc-900">{c.nome}</span>
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                c.tipo === "entrada" ? "bg-[#eaf3ea] text-[#2e6b3e]" : "bg-red-100 text-red-700",
              ].join(" ")}
            >
              {c.tipo}
            </span>
          </div>
        ))}
        {categorias.length === 0 && (
          <p className="text-center text-xs text-zinc-500">Nenhuma categoria ainda.</p>
        )}
      </div>

      <Link
        href="/patio/mais/avisos-shopping"
        className="mt-4 block text-center text-[11px] text-zinc-500 underline"
      >
        ver avisos ao shopping
      </Link>
    </div>
  );
}
