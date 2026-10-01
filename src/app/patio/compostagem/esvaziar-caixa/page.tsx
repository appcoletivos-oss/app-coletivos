"use client";

// Compostagem → Esvaziar caixa (Sprint A, item 4 —
// SPRINT_A_REGISTRO_SIMPLIFICADO_ETAPA2.md, seção 8).
//
// Acontece depois do descanso da caixa: só caixas com `status = 'descanso'`
// aparecem no passo 1. O composto retirado vai sempre pra mesma área de
// descanso ao ar livre (sem campo de destino nesta rodada) e é
// contabilizado em carrinhos — peso snapshot, mesmo componente do carrinho
// de mão em manejo (um tipo de carrinho por registro). Sem foto, sem
// análise sensorial.
//
// Decisão do Thiago (01/10/2026): só Coordenação/Consultor registram, e
// depois do esvaziamento a caixa volta a "ativa" ou vai pra "desativada"
// (manutenção) — a pessoa escolhe no passo 3. Tudo é gravado pelo RPC
// registrar_esvaziamento_caixa (lib/esvaziamento.ts), que também valida o
// papel e calcula o peso no banco; o peso mostrado aqui é só prévia. Sem
// fila offline: sem internet, a tela avisa e não deixa salvar.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { obterMeuMembro } from "@/lib/auth";
import { listarCaixas } from "@/lib/patio";
import { calcularPesoCarrinho, listarTiposCarrinho } from "@/lib/carrinhos";
import { ErroValidacaoEsvaziamento, registrarEsvaziamentoCaixa } from "@/lib/esvaziamento";
import { vincularRegistroAoItem } from "@/lib/relatorio-turno";
import type { Caixa, NovoRegistroEsvaziamentoCaixa, StatusCaixaPosEsvaziamento, TipoCarrinho } from "@/lib/types";
import { BotaoAvancar, LinhaResumo, Passo, PontosPasso, TelaBase } from "@/components/fluxo-registro";

const TOTAL_PASSOS = 4;

const ROTULO_NOVO_STATUS: Record<StatusCaixaPosEsvaziamento, string> = {
  ativa: "Volta a funcionar",
  desativada: "Vai pra manutenção",
};

// useSearchParams exige um limite de Suspense em volta (regra do Next.js
// pra Client Components) — por isso o export default vira só um wrapper,
// ver EsvaziarCaixaPage no fim do arquivo.
function EsvaziarCaixaConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Preenchidos quando a tela é aberta a partir do Relatório do Turno
  // (Sprint A, item 6, tipo_registro=caixa → Esvaziar caixa) — ver
  // lib/relatorio-turno.ts, hrefSubFormulario.
  const relatorioItemId = searchParams.get("relatorio_item");
  const voltarHref = searchParams.get("voltar");

  const [passo, setPasso] = useState(1);

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [ehGestor, setEhGestor] = useState(false);
  const [online, setOnline] = useState(true);
  const [caixasEmDescanso, setCaixasEmDescanso] = useState<Caixa[]>([]);
  const [tiposCarrinho, setTiposCarrinho] = useState<TipoCarrinho[]>([]);

  const [caixaId, setCaixaId] = useState<string | null>(null);
  const [tipoCarrinhoId, setTipoCarrinhoId] = useState<string | null>(null);
  const [quantidadeCarrinhos, setQuantidadeCarrinhos] = useState("");
  const [novoStatus, setNovoStatus] = useState<StatusCaixaPosEsvaziamento | null>(null);
  const [observacao, setObservacao] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"ok" | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        const membro = await obterMeuMembro();
        const gestor = membro?.papel === "coordenacao" || membro?.papel === "consultor";
        if (!cancelado) setEhGestor(gestor);
        if (!gestor) return;
        const [caixas, carrinhos] = await Promise.all([listarCaixas(), listarTiposCarrinho()]);
        if (!cancelado) {
          setCaixasEmDescanso(caixas.filter((c) => c.status === "descanso"));
          setTiposCarrinho(carrinhos);
        }
      } catch {
        if (!cancelado) {
          setErroCarregamento("Não deu pra carregar as caixas agora. Confira a internet e tente de novo.");
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

  // navigator só existe no cliente — lido depois do mount.
  useEffect(() => {
    const atualizar = () => setOnline(navigator.onLine);
    atualizar();
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);
    return () => {
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
    };
  }, []);

  const voltar = voltarHref ? decodeURIComponent(voltarHref) : "/patio/compostagem";

  function irPara(novoPasso: number) {
    setPasso(Math.min(Math.max(novoPasso, 1), TOTAL_PASSOS));
  }

  const caixaSelecionada = caixasEmDescanso.find((c) => c.id === caixaId);
  const tipoCarrinhoSelecionado = tiposCarrinho.find((t) => t.id === tipoCarrinhoId);
  const pesoCalculado =
    tipoCarrinhoSelecionado && quantidadeCarrinhos.trim() && !Number.isNaN(Number(quantidadeCarrinhos))
      ? calcularPesoCarrinho(Number(quantidadeCarrinhos), tipoCarrinhoSelecionado.peso_estimado_kg)
      : null;
  const passo2Valido =
    tipoCarrinhoId !== null &&
    quantidadeCarrinhos.trim().length > 0 &&
    !Number.isNaN(Number(quantidadeCarrinhos)) &&
    Number(quantidadeCarrinhos) > 0;

  async function salvar() {
    if (!caixaId || !tipoCarrinhoId || !novoStatus || !passo2Valido) return;
    if (!navigator.onLine) {
      setErroSalvar("Sem internet agora. O esvaziamento não fica guardado no celular — tente de novo quando a conexão voltar.");
      return;
    }
    setSalvando(true);
    setErroSalvar(null);

    const registro: NovoRegistroEsvaziamentoCaixa = {
      caixa_id: caixaId,
      tipo_carrinho_id: tipoCarrinhoId,
      quantidade_carrinhos: Number(quantidadeCarrinhos),
      novo_status: novoStatus,
      observacao: observacao.trim() ? observacao.trim() : null,
    };

    try {
      const criadoId = await registrarEsvaziamentoCaixa(registro);

      // Aberta a partir do Relatório do Turno (Sprint A, item 6): vincula
      // e volta pro relatório em vez da tela de sucesso daqui.
      if (relatorioItemId) {
        try {
          await vincularRegistroAoItem(relatorioItemId, "registros_esvaziamento_caixa", criadoId);
        } catch {
          // segue sem o vínculo — o registro já está salvo.
        }
        if (voltarHref) {
          router.push(decodeURIComponent(voltarHref));
          return;
        }
      }
      setResultado("ok");
    } catch (e) {
      // Sem fila offline nesta tela (ver cabeçalho). Erro de validação do
      // RPC mostra a mensagem do banco; o resto é tratado como rede.
      if (e instanceof ErroValidacaoEsvaziamento) {
        setErroSalvar(e.message);
      } else if (!navigator.onLine) {
        setErroSalvar("Sem internet agora. O esvaziamento não foi salvo — tente de novo quando a conexão voltar.");
      } else {
        setErroSalvar("Não deu pra salvar agora. Confira a internet e tente de novo.");
      }
    } finally {
      setSalvando(false);
    }
  }

  function recomecar() {
    setPasso(1);
    setCaixaId(null);
    setTipoCarrinhoId(null);
    setQuantidadeCarrinhos("");
    setNovoStatus(null);
    setObservacao("");
    setResultado(null);
    setErroSalvar(null);
  }

  if (carregando) {
    return (
      <TelaBase titulo="Esvaziar caixa" icone="🧹" voltarHref="/patio/compostagem">
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  // Equipe abrindo a rota direto pelo endereço: o botão não aparece pra
  // ela (hub de Compostagem e Relatório do Turno), e o RPC barraria de
  // qualquer jeito — aqui é só uma mensagem simples.
  if (!ehGestor && !erroCarregamento) {
    return (
      <TelaBase titulo="Esvaziar caixa" icone="🧹" voltarHref={voltar}>
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-zinc-700">Só a coordenação registra o esvaziamento.</p>
          <Link
            href={voltar}
            className="rounded-full border-2 border-[#2e6b3e] px-6 py-3 text-sm font-semibold text-[#2e6b3e]"
          >
            Voltar
          </Link>
        </div>
      </TelaBase>
    );
  }

  if (erroCarregamento) {
    return (
      <TelaBase titulo="Esvaziar caixa" icone="🧹" voltarHref="/patio/compostagem">
        <p className="text-center text-sm text-red-700">{erroCarregamento}</p>
      </TelaBase>
    );
  }

  if (resultado) {
    return (
      <TelaBase titulo="Esvaziar caixa" icone="🧹" voltarHref="/patio/compostagem">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2e6b3e] text-2xl text-white">
            ✅
          </span>
          <p className="text-base font-semibold text-zinc-900">Esvaziamento registrado!</p>
          <p className="max-w-xs text-sm text-zinc-600">
            Caixa {caixaSelecionada?.numero} — {quantidadeCarrinhos} {tipoCarrinhoSelecionado?.nome.toLowerCase()}(s) ≈{" "}
            {pesoCalculado} kg retirados.
          </p>
          <p className="max-w-xs text-sm text-zinc-600">
            {novoStatus === "desativada" ? "A caixa foi pra manutenção." : "A caixa voltou a funcionar."}
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <button
              type="button"
              onClick={recomecar}
              className="rounded-full bg-[#2e6b3e] px-6 py-3 text-sm font-semibold text-white"
            >
              Registrar outro esvaziamento
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

  // Nenhuma caixa em descanso: mensagem simples, sem deixar prosseguir
  // (pronto-quando do item 4).
  if (caixasEmDescanso.length === 0) {
    return (
      <TelaBase titulo="Esvaziar caixa" icone="🧹" voltarHref="/patio/compostagem">
        <p className="text-center text-sm text-zinc-600">Nenhuma caixa em descanso agora.</p>
        <p className="mt-2 text-center text-[11px] text-zinc-500">
          Uma caixa só pode ser esvaziada depois de passar pelo descanso (Compostagem → Ver caixas → mover pra
          descanso).
        </p>
      </TelaBase>
    );
  }

  return (
    <TelaBase titulo="Esvaziar caixa" icone="🧹" voltarHref="/patio/compostagem">
      <PontosPasso passo={passo} total={TOTAL_PASSOS} />

      {passo === 1 && (
        <Passo titulo="Qual caixa (em descanso)?">
          <div className="grid grid-cols-4 gap-2">
            {caixasEmDescanso.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCaixaId(c.id);
                  irPara(2);
                }}
                className={[
                  "rounded-lg border-2 py-3 text-sm font-bold",
                  c.id === caixaId
                    ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]"
                    : "border-zinc-800 bg-white text-zinc-800",
                ].join(" ")}
              >
                {c.numero}
              </button>
            ))}
          </div>
        </Passo>
      )}

      {passo === 2 && (
        <Passo titulo="Quanto saiu, em carrinhos?">
          {tiposCarrinho.length === 0 ? (
            <p className="text-center text-sm text-zinc-600">
              Nenhum tipo de carrinho cadastrado ainda. Cadastre pelo menos um (Mais → Cadastro → Carrinhos) pra
              continuar.
            </p>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {tiposCarrinho.map((tc) => (
                  <button
                    key={tc.id}
                    type="button"
                    onClick={() => setTipoCarrinhoId(tc.id)}
                    className={[
                      "rounded-lg border-2 px-3 py-2 text-left text-xs font-semibold",
                      tc.id === tipoCarrinhoId
                        ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]"
                        : "border-zinc-300 bg-white text-zinc-700",
                    ].join(" ")}
                  >
                    🛒 {tc.nome}
                  </button>
                ))}
              </div>
              <label className="block text-[11px] font-semibold text-zinc-600">
                Quantidade de carrinhos
                <input
                  value={quantidadeCarrinhos}
                  onChange={(e) => setQuantidadeCarrinhos(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ex.: 5"
                  autoFocus
                  className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
                />
              </label>
              {pesoCalculado !== null && (
                <p className="mt-2 text-center text-sm font-bold text-zinc-900">≈ {pesoCalculado} kg</p>
              )}
              <BotaoAvancar onClick={() => irPara(3)} desabilitado={!passo2Valido} />
            </>
          )}
        </Passo>
      )}

      {passo === 3 && (
        <Passo titulo="E agora a caixa?">
          <div className="flex flex-col gap-3">
            {(["ativa", "desativada"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setNovoStatus(s);
                  irPara(4);
                }}
                className={[
                  "rounded-xl border-2 py-5 text-base font-bold",
                  s === novoStatus
                    ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]"
                    : "border-zinc-800 bg-white text-zinc-800",
                ].join(" ")}
              >
                {s === "ativa" ? "✅ " : "🔧 "}
                {ROTULO_NOVO_STATUS[s]}
              </button>
            ))}
          </div>
        </Passo>
      )}

      {passo === 4 && (
        <Passo titulo="Confere antes de salvar">
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Observação (opcional)"
            className="mb-3 min-h-20 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
          />
          <div className="rounded-xl border-2 border-zinc-800 bg-white p-3 text-sm">
            <LinhaResumo rotulo="Caixa" valor={caixaSelecionada ? `Caixa ${caixaSelecionada.numero}` : "—"} onEditar={() => irPara(1)} />
            <LinhaResumo
              rotulo="Carrinho"
              valor={tipoCarrinhoSelecionado ? `${quantidadeCarrinhos} ${tipoCarrinhoSelecionado.nome.toLowerCase()}(s)` : "—"}
              onEditar={() => irPara(2)}
            />
            <LinhaResumo rotulo="Peso calculado" valor={pesoCalculado !== null ? `≈ ${pesoCalculado} kg` : "—"} onEditar={() => irPara(2)} />
            <LinhaResumo rotulo="E agora a caixa?" valor={novoStatus ? ROTULO_NOVO_STATUS[novoStatus] : "—"} onEditar={() => irPara(3)} />
            <LinhaResumo rotulo="Observação" valor={observacao.trim() || "sem observação"} onEditar={() => irPara(4)} ultima />
          </div>

          {!online && (
            <p className="mt-3 rounded-lg bg-amber-100 p-2 text-center text-xs font-semibold text-amber-900">
              📵 Sem internet. Esse registro precisa de conexão pra salvar.
            </p>
          )}
          {erroSalvar && <p className="mt-3 text-center text-xs text-red-700">{erroSalvar}</p>}

          <button
            type="button"
            disabled={salvando || !online || !novoStatus}
            onClick={salvar}
            className="mt-4 w-full rounded-xl border-2 border-[#2e6b3e] bg-[#eaf3ea] py-3 text-sm font-bold text-[#2e6b3e] disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "✅ Salvar esvaziamento"}
          </button>
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

export default function EsvaziarCaixaPage() {
  return (
    <Suspense
      fallback={
        <TelaBase titulo="Esvaziar caixa" icone="🧹" voltarHref="/patio/compostagem">
          <p className="text-center text-sm text-zinc-600">Carregando…</p>
        </TelaBase>
      }
    >
      <EsvaziarCaixaConteudo />
    </Suspense>
  );
}
