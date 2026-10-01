"use client";

// Venda → Registrar doação de alimento (Etapa 1, item 5 — handoff
// "Registro simplificado"). Distinta de Horta → Registrar doação
// (plantio_doacoes, doação de muda/produção): aqui é alimento já colhido,
// rastreado pela colheita — não pelo canteiro. Sem geofence (pode ser
// registrada fora da área de trabalho) e com foto obrigatória de quem
// recebe.

import Link from "next/link";
import { useEffect, useState } from "react";
import { enviarFotoRegistro, salvarFotosExtras } from "@/lib/patio";
import { listarCulturasAtivas } from "@/lib/culturas";
import { criarDoacaoAlimento, listarColheitasRecentes } from "@/lib/venda";
import type { ColheitaRecente, Cultura, NovaDoacaoAlimento } from "@/lib/types";
import {
  BotaoAvancar,
  CampoPeso,
  LinhaResumo,
  Passo,
  PontosPasso,
  SeletorFotos,
  TelaBase,
} from "@/components/fluxo-registro";

const TOTAL_PASSOS = 4;

type Origem = "colheita" | "direto";

export default function RegistrarDoacaoAlimentoPage() {
  const [passo, setPasso] = useState(1);

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [colheitas, setColheitas] = useState<ColheitaRecente[]>([]);
  const [culturas, setCulturas] = useState<Cultura[]>([]);

  const [origem, setOrigem] = useState<Origem>("colheita");
  const [colheitaId, setColheitaId] = useState<string | null>(null);
  const [culturaId, setCulturaId] = useState<string | null>(null);
  const [peso, setPeso] = useState(1);

  const [destino, setDestino] = useState("");
  const [observacao, setObservacao] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"ok" | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [listaColheitas, listaCulturas] = await Promise.all([
          listarColheitasRecentes(),
          listarCulturasAtivas(),
        ]);
        if (!cancelado) {
          setColheitas(listaColheitas);
          setCulturas(listaCulturas);
        }
      } catch {
        if (!cancelado) {
          setErroCarregamento("Não deu pra carregar as colheitas agora. Confira a internet e tente de novo.");
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  function irPara(novoPasso: number) {
    setPasso(Math.min(Math.max(novoPasso, 1), TOTAL_PASSOS));
  }

  const colheitaSelecionada = colheitas.find((c) => c.id === colheitaId);
  const culturaSelecionada = culturas.find((c) => c.id === culturaId);
  const podeAvancarOrigem =
    origem === "colheita" ? colheitaId !== null : culturaId !== null && peso > 0;

  async function salvar() {
    if (!podeAvancarOrigem || fotos.length === 0) return;
    setSalvando(true);
    setErroSalvar(null);

    try {
      const fotoUrl = await enviarFotoRegistro(fotos[0], "doacao-alimento");

      const registro: NovaDoacaoAlimento =
        origem === "colheita"
          ? {
              registro_colheita_id: colheitaId,
              foto_url: fotoUrl,
              destino: destino.trim() || null,
              observacao: observacao.trim() || null,
            }
          : {
              cultura_id: culturaId,
              quantidade: peso,
              foto_url: fotoUrl,
              destino: destino.trim() || null,
              observacao: observacao.trim() || null,
            };

      const doacao = await criarDoacaoAlimento(registro);
      if (fotos.length > 1) {
        try {
          const extras = await Promise.all(
            fotos.slice(1).map((f) => enviarFotoRegistro(f, "doacao-alimento")),
          );
          await salvarFotosExtras("doacoes_alimento", doacao.id, extras);
        } catch {
          // segue sem as extras — a capa já foi salva com o registro.
        }
      }
      setResultado("ok");
    } catch {
      setErroSalvar("Não deu pra salvar agora. Confira a internet e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  function recomecar() {
    setPasso(1);
    setOrigem("colheita");
    setColheitaId(null);
    setCulturaId(null);
    setPeso(1);
    setDestino("");
    setObservacao("");
    setFotos([]);
    setResultado(null);
    setErroSalvar(null);
  }

  if (carregando) {
    return (
      <TelaBase titulo="Registrar doação" icone="🎁" voltarHref="/patio/venda">
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (erroCarregamento) {
    return (
      <TelaBase titulo="Registrar doação" icone="🎁" voltarHref="/patio/venda">
        <p className="text-center text-sm text-red-700">{erroCarregamento}</p>
      </TelaBase>
    );
  }

  if (resultado) {
    return (
      <TelaBase titulo="Registrar doação" icone="🎁" voltarHref="/patio/venda">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2e6b3e] text-2xl text-white">
            ✅
          </span>
          <p className="text-base font-semibold text-zinc-900">Doação registrada!</p>
          <div className="mt-2 flex flex-col gap-3">
            <button
              type="button"
              onClick={recomecar}
              className="rounded-full bg-[#2e6b3e] px-6 py-3 text-sm font-semibold text-white"
            >
              Registrar outra doação
            </button>
            <Link
              href="/patio/venda"
              className="rounded-full border-2 border-[#2e6b3e] px-6 py-3 text-sm font-semibold text-[#2e6b3e]"
            >
              Voltar pra Venda
            </Link>
          </div>
        </div>
      </TelaBase>
    );
  }

  return (
    <TelaBase titulo="Registrar doação" icone="🎁" voltarHref="/patio/venda">
      <PontosPasso passo={passo} total={TOTAL_PASSOS} />

      {passo === 1 && (
        <Passo titulo="O que foi doado?">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setOrigem("colheita")}
              className={[
                "flex-1 rounded-lg border-2 py-2 text-xs font-bold",
                origem === "colheita" ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]" : "border-zinc-300 bg-white text-zinc-700",
              ].join(" ")}
            >
              De uma colheita recente
            </button>
            <button
              type="button"
              onClick={() => setOrigem("direto")}
              className={[
                "flex-1 rounded-lg border-2 py-2 text-xs font-bold",
                origem === "direto" ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]" : "border-zinc-300 bg-white text-zinc-700",
              ].join(" ")}
            >
              Direto (cultura + kg)
            </button>
          </div>

          {origem === "colheita" ? (
            <div className="flex flex-col gap-2">
              {colheitas.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColheitaId(c.id)}
                  className={[
                    "rounded-lg border-2 px-3 py-2 text-left text-sm",
                    c.id === colheitaId ? "border-[#2e6b3e] bg-[#eaf3ea]" : "border-zinc-300 bg-white",
                  ].join(" ")}
                >
                  <span className="block font-bold text-zinc-900">{c.cultura}</span>
                  <span className="block text-[11px] text-zinc-500">
                    {c.peso_kg} kg · {new Date(c.registrado_em).toLocaleDateString("pt-BR")}
                  </span>
                </button>
              ))}
              {colheitas.length === 0 && (
                <p className="text-center text-xs text-zinc-500">Nenhuma colheita registrada ainda.</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {culturas.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCulturaId(c.id)}
                    className={[
                      "rounded-full border-2 px-3 py-1.5 text-xs font-semibold",
                      c.id === culturaId ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]" : "border-zinc-300 text-zinc-700",
                    ].join(" ")}
                  >
                    {c.nome}
                  </button>
                ))}
              </div>
              <CampoPeso valor={peso} onMudar={setPeso} />
            </div>
          )}

          <BotaoAvancar onClick={() => irPara(2)} desabilitado={!podeAvancarOrigem} />
        </Passo>
      )}

      {passo === 2 && (
        <Passo titulo="Pra onde foi?">
          <label className="mb-3 block text-[11px] font-semibold text-zinc-600">
            Destino (opcional)
            <input
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Ex.: ZEIS, família do bairro…"
              className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
            />
          </label>
          <label className="block text-[11px] font-semibold text-zinc-600">
            Observação (opcional)
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="mt-1 min-h-20 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
            />
          </label>
          <BotaoAvancar onClick={() => irPara(3)} />
        </Passo>
      )}

      {passo === 3 && (
        <Passo titulo="Foto de quem recebeu">
          <SeletorFotos fotos={fotos} onMudar={setFotos} obrigatoria />
          <BotaoAvancar onClick={() => irPara(4)} desabilitado={fotos.length === 0} />
        </Passo>
      )}

      {passo === 4 && (
        <Passo titulo="Confere antes de salvar">
          <div className="rounded-xl border-2 border-zinc-800 bg-white p-3 text-sm">
            <LinhaResumo
              rotulo="O que"
              valor={
                origem === "colheita"
                  ? colheitaSelecionada
                    ? `${colheitaSelecionada.cultura} (${colheitaSelecionada.peso_kg} kg)`
                    : "—"
                  : culturaSelecionada
                    ? `${culturaSelecionada.nome} (${peso} kg)`
                    : "—"
              }
              onEditar={() => irPara(1)}
            />
            <LinhaResumo rotulo="Destino" valor={destino.trim() || "não informado"} onEditar={() => irPara(2)} />
            <LinhaResumo
              rotulo="Fotos"
              valor={fotos.length === 0 ? "sem foto" : `${fotos.length} anexada(s)`}
              onEditar={() => irPara(3)}
              ultima
            />
          </div>

          {erroSalvar && <p className="mt-3 text-center text-xs text-red-700">{erroSalvar}</p>}

          <button
            type="button"
            disabled={salvando}
            onClick={salvar}
            className="mt-4 w-full rounded-xl border-2 border-[#2e6b3e] bg-[#eaf3ea] py-3 text-sm font-bold text-[#2e6b3e] disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "✅ Salvar registro"}
          </button>
          <p className="mt-2 text-center text-[10px] text-zinc-500">
            Sem geofence — pode ser registrada fora da área de trabalho.
          </p>
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
