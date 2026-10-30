"use client";

// Cartão de item do Relato do turno e pergunta por toque (Sprint B, B3 e
// B4). Usado na tela "Entendi isto" (quem relatou) e dentro do cartão da
// fila "Para conferir" (coordenação): mesmos selos, mesmos chips.

import { useEffect, useState, type ReactNode } from "react";
import { listarPlantiosAtivosPorCanteiro } from "@/lib/plantios";
import {
  ROTULO_TIPO,
  camposVisiveis,
  perguntasDoItem,
  type NaoCadastrado,
  type Pergunta,
  type Resposta,
} from "@/lib/relato-campos";
import type { CadastrosRelato, ItemRelato, StatusCampo } from "@/lib/relato";

const SELO: Record<StatusCampo, { texto: string; classe: string }> = {
  certo: { texto: "✓", classe: "bg-[#eaf3ea] text-[#2e6b3e]" },
  inferido: { texto: "confira", classe: "bg-amber-100 text-amber-800" },
  faltando: { texto: "falta", classe: "bg-red-100 text-red-700" },
  nao_cadastrado: { texto: "não cadastrado", classe: "bg-red-100 text-red-700" },
};

export function SeloCampo({ status }: { status: StatusCampo }) {
  const s = SELO[status];
  return <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${s.classe}`}>{s.texto}</span>;
}

export function CartaoItemRelato({
  item,
  cadastros,
  children,
}: {
  item: ItemRelato;
  cadastros: CadastrosRelato;
  children?: ReactNode;
}) {
  const tipo = ROTULO_TIPO[item.tipo];
  const campos = camposVisiveis(item, cadastros);
  return (
    <div className="rounded-xl border-2 border-zinc-800 bg-white p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-zinc-900">
          {tipo.icone} {tipo.rotulo}
        </span>
        {item.item_planejado_id && <span className="text-[9px] font-bold text-zinc-500">marca o checklist</span>}
      </div>
      {item.trecho_origem && <p className="mb-2 text-[11px] italic text-zinc-500">“{item.trecho_origem}”</p>}
      <div className="flex flex-col gap-0.5">
        {campos.map((c) => (
          <div key={c.campo} className="flex items-start justify-between gap-2 text-[11px]">
            <span className="text-zinc-700">
              {c.rotulo && <span className="font-semibold">{c.rotulo}: </span>}
              {c.valor ?? <span className="text-zinc-400">—</span>}
            </span>
            {c.status && <SeloCampo status={c.status} />}
          </div>
        ))}
      </div>
      {item.avisos.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5">
          {item.avisos.map((a, i) => (
            <li key={i} className="text-[10px] text-amber-800">
              ⚠️ {a}
            </li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}

export function PerguntaRelato({
  pergunta,
  onResponder,
  onPular,
  onCadastrarCultura,
}: {
  pergunta: Pergunta;
  onResponder: (resposta: Resposta) => void;
  onPular?: () => void;
  onCadastrarCultura?: (nome: string) => Promise<void>;
}) {
  const [numero, setNumero] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [cadastrando, setCadastrando] = useState(false);
  const [plantios, setPlantios] = useState<{ valor: string; rotulo: string }[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (pergunta.tipo !== "plantio" || !pergunta.canteiroId) return;
    let cancelado = false;
    listarPlantiosAtivosPorCanteiro(pergunta.canteiroId)
      .then((lista) => {
        if (cancelado) return;
        setPlantios(
          lista
            .filter((p) => !pergunta.culturaId || p.cultura_id === pergunta.culturaId)
            .map((p) => ({ valor: p.id, rotulo: `${p.cultura_nome} · ${p.data_inicio.split("-").reverse().slice(0, 2).join("/")}` })),
        );
      })
      .catch(() => {
        if (!cancelado) setErro("Não deu pra carregar os plantios agora.");
      });
    return () => {
      cancelado = true;
    };
  }, [pergunta.tipo, pergunta.canteiroId, pergunta.culturaId]);

  const opcoes = pergunta.tipo === "plantio" ? (plantios ?? []) : pergunta.opcoes;
  const chip = "rounded-full border-2 px-2.5 py-1 text-[11px] font-bold";

  return (
    <div className="mt-2 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-2">
      <p className="mb-1.5 text-[11px] font-bold text-amber-900">{pergunta.rotulo}</p>

      {pergunta.tipo === "numero" && (
        <div className="flex gap-1.5">
          <input
            inputMode="decimal"
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/[^\d.,]/g, ""))}
            className="w-24 rounded-lg border-2 border-amber-300 bg-white p-1.5 text-xs"
          />
          <button
            type="button"
            disabled={!(Number(numero.replace(",", ".")) > 0)}
            onClick={() => onResponder(Number(numero.replace(",", ".")))}
            className="rounded-lg bg-[#2e6b3e] px-3 text-[11px] font-bold text-white disabled:opacity-40"
          >
            OK
          </button>
        </div>
      )}

      {(pergunta.tipo === "escolha" || pergunta.tipo === "plantio") && (
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {pergunta.tipo === "plantio" && plantios === null && !erro && <span className="text-[11px] text-zinc-500">Carregando…</span>}
          {pergunta.tipo === "plantio" && plantios?.length === 0 && (
            <span className="text-[11px] text-zinc-500">Nenhum plantio ativo dessa cultura nesse canteiro.</span>
          )}
          {opcoes.map((o) => (
            <button key={o.valor} type="button" onClick={() => onResponder(o.valor)} className={`${chip} border-zinc-300 bg-white text-zinc-700`}>
              {o.rotulo}
            </button>
          ))}
          {pergunta.cadastrarCultura && onCadastrarCultura && (
            <button
              type="button"
              disabled={cadastrando}
              onClick={async () => {
                setCadastrando(true);
                setErro(null);
                try {
                  await onCadastrarCultura(pergunta.cadastrarCultura as string);
                } catch {
                  setErro("Não deu pra cadastrar agora.");
                } finally {
                  setCadastrando(false);
                }
              }}
              className={`${chip} border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e] disabled:opacity-40`}
            >
              {cadastrando ? "…" : `+ Cadastrar "${pergunta.cadastrarCultura}"`}
            </button>
          )}
        </div>
      )}

      {pergunta.tipo === "multi" && (
        <>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {opcoes.map((o) => {
              const marcado = marcados.includes(o.valor);
              return (
                <button
                  key={o.valor}
                  type="button"
                  onClick={() => setMarcados((m) => (marcado ? m.filter((v) => v !== o.valor) : [...m, o.valor]))}
                  className={`${chip} ${marcado ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]" : "border-zinc-300 bg-white text-zinc-700"}`}
                >
                  {o.rotulo}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={marcados.length === 0}
            onClick={() => onResponder(marcados)}
            className="mt-1.5 rounded-lg bg-[#2e6b3e] px-3 py-1 text-[11px] font-bold text-white disabled:opacity-40"
          >
            OK ({marcados.length})
          </button>
        </>
      )}

      {erro && <p className="mt-1 text-[10px] text-red-700">{erro}</p>}
      {onPular && (
        <button type="button" onClick={onPular} className="mt-1.5 block text-[10px] font-bold text-zinc-500 underline">
          Pular (a coordenação completa)
        </button>
      )}
    </div>
  );
}

// Cultura ou canteiro dito no texto que não existe no cadastro.
//   modo "relato" (quem relatou): "Escolher uma que existe" (chips) ou
//     "Seguir mesmo assim" (fica o nome cru, a coordenação decide). Nunca
//     cadastra nada.
//   modo "fila" (coordenação/consultor): "Usar uma que existe" (chips),
//     "Cadastrar 'X'" (só cultura) e "Rejeitar".
export function AlertaNaoCadastrado({
  item,
  alvo,
  cadastros,
  canteirosRecentes,
  modo,
  onResponder,
  onSeguir,
  onCadastrar,
  onRejeitar,
}: {
  item: ItemRelato;
  alvo: NaoCadastrado;
  cadastros: CadastrosRelato;
  canteirosRecentes: string[];
  modo: "relato" | "fila";
  onResponder: (pergunta: Pergunta, resposta: Resposta) => void;
  onSeguir?: () => void;
  onCadastrar?: (nome: string) => Promise<void>;
  onRejeitar?: () => void;
}) {
  const [escolhendo, setEscolhendo] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pergunta = perguntasDoItem(item, cadastros, canteirosRecentes, false, alvo.campo)[0];

  const texto =
    modo === "relato"
      ? alvo.tipo === "cultura"
        ? "Esta cultura não está cadastrada"
        : "Este canteiro não está cadastrado"
      : alvo.tipo === "cultura"
        ? `Cultura "${alvo.nome}" não cadastrada`
        : `Canteiro "${alvo.nome}" não cadastrado`;
  const botao = "rounded-lg border-2 px-2.5 py-1 text-[11px] font-bold disabled:opacity-40";

  return (
    <div className="mt-2 rounded-lg border-2 border-red-300 bg-red-50 p-2">
      <p className="text-[11px] font-bold text-red-800">
        ⚠️ {texto}
        {modo === "relato" && `: "${alvo.nome}"`}
      </p>
      {escolhendo && pergunta ? (
        <PerguntaRelato pergunta={pergunta} onResponder={(r) => onResponder(pergunta, r)} />
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setEscolhendo(true)} className={`${botao} border-zinc-800 bg-white text-zinc-800`}>
            {modo === "relato" ? (alvo.tipo === "cultura" ? "Escolher uma que existe" : "Escolher um que existe") : alvo.tipo === "cultura" ? "Usar uma que existe" : "Usar um que existe"}
          </button>
          {modo === "relato" && onSeguir && (
            <button type="button" onClick={onSeguir} className={`${botao} border-zinc-300 bg-white text-zinc-600`}>
              Seguir mesmo assim
            </button>
          )}
          {modo === "fila" && alvo.tipo === "cultura" && onCadastrar && (
            <button
              type="button"
              disabled={cadastrando}
              onClick={async () => {
                setCadastrando(true);
                setErro(null);
                try {
                  await onCadastrar(alvo.nome);
                } catch (e) {
                  const codigo = (e as { code?: string } | null)?.code;
                  setErro(codigo === "23505" ? "Já existe uma cultura com esse nome (talvez inativa)." : "Não deu pra cadastrar agora.");
                } finally {
                  setCadastrando(false);
                }
              }}
              className={`${botao} border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]`}
            >
              {cadastrando ? "…" : `+ Cadastrar "${alvo.nome}"`}
            </button>
          )}
          {modo === "fila" && onRejeitar && (
            <button type="button" onClick={onRejeitar} className={`${botao} border-red-300 bg-white text-red-700`}>
              Rejeitar
            </button>
          )}
        </div>
      )}
      {escolhendo && (
        <button type="button" onClick={() => setEscolhendo(false)} className="mt-1 text-[10px] font-bold text-zinc-500 underline">
          Voltar
        </button>
      )}
      {erro && <p className="mt-1 text-[10px] text-red-700">{erro}</p>}
    </div>
  );
}
