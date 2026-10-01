"use client";

// Horta → Registrar colheita
//
// Ajustada pro handoff v3 (HANDOFF_HORTA_COMPLETO.md, seção 3.6): a
// cultura não é mais digitada — a pessoa escolhe um plantio ativo do
// canteiro, e a cultura vem dele. O fechamento do plantio NUNCA é
// automático por ciclo_produtivo: a ficha da cultura só pré-marca o
// checkbox "essa colheita encerra o plantio?" (pra ciclo=unico), mas quem
// registra sempre confirma ou troca — porque a mesma espécie pode ser
// tratada como corte único ou colheita contínua dependendo de como o
// coletivo realmente maneja.
//
// "Quem registrou" e "data" nunca são perguntados — vêm da sessão de
// login e do relógio do aparelho, mesmo espírito de sempre.

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { enviarFotoRegistro, listarCanteiros, salvarFotosExtras } from "@/lib/patio";
import { iconeTipoCanteiro, salvarRegistroColheita } from "@/lib/horta";
import { listarCulturasAtivas } from "@/lib/culturas";
import { criarPlantio, listarPlantiosAtivosPorCanteiro, marcarStatusPlantio } from "@/lib/plantios";
import { criarFilaOffline } from "@/lib/fila-offline";
import type { Canteiro, Cultura, NovoRegistroColheita, PlantioComCultura } from "@/lib/types";
import {
  BotaoAvancar,
  BotaoGrande,
  CampoPeso,
  LinhaResumo,
  Passo,
  PontosPasso,
  SeletorFotos,
  TelaBase,
} from "@/components/fluxo-registro";
import Link from "next/link";

const TOTAL_PASSOS = 6;

const filaOffline = criarFilaOffline<NovoRegistroColheita>(
  "app-coletivo:fila-registros-colheita",
);

// useSearchParams exige um limite de Suspense em volta (regra do Next.js
// pra Client Components) — por isso o export default vira só um wrapper,
// ver RegistrarColheitaPage no fim do arquivo.
function RegistrarColheitaConteudo() {
  // Preenchido quando a tela é aberta a partir de um link da Agenda
  // (evento tipo "atividade") — ver lib/agenda.ts, LINKS_REGISTRO_ATIVIDADE.
  const eventoAgendaId = useSearchParams().get("evento_agenda_id");

  const [passo, setPasso] = useState(1);

  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [canteiros, setCanteiros] = useState<Canteiro[]>([]);
  const [culturas, setCulturas] = useState<Cultura[]>([]);

  const [canteiroId, setCanteiroId] = useState<string | null>(null);
  const [plantios, setPlantios] = useState<PlantioComCultura[]>([]);
  const [carregandoPlantios, setCarregandoPlantios] = useState(false);
  const [plantioId, setPlantioId] = useState<string | null>(null);

  // Cadastro rápido de planta "já existente" sem sair da tela (ver
  // HANDOFF_HORTA_COMPLETO.md, seção 3.6, e pedido do usuário, 2026-08-28):
  // quem colhe uma planta que ainda não tem plantio cadastrado cadastra na
  // hora, sem perder o canteiro já escolhido no passo 1.
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [cadastroBuscaCultura, setCadastroBuscaCultura] = useState("");
  const [cadastroCulturaId, setCadastroCulturaId] = useState<string | null>(null);
  const [cadastroQuantidade, setCadastroQuantidade] = useState("");
  const [cadastroUnidade, setCadastroUnidade] = useState("");
  const [cadastroSalvando, setCadastroSalvando] = useState(false);
  const [cadastroErro, setCadastroErro] = useState<string | null>(null);

  const [peso, setPeso] = useState(1);
  const [fotos, setFotos] = useState<File[]>([]);
  const [observacao, setObservacao] = useState("");
  const [encerraPlantio, setEncerraPlantio] = useState(true);
  const [encerraTocado, setEncerraTocado] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"ok" | "offline" | null>(null);
  const [pendentesOffline, setPendentesOffline] = useState(() => filaOffline.contar());

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        const [listaCanteiros, listaCulturas] = await Promise.all([
          listarCanteiros(),
          listarCulturasAtivas(),
        ]);
        if (!cancelado) {
          setCanteiros(listaCanteiros);
          setCulturas(listaCulturas);
        }
      } catch {
        if (!cancelado) {
          setErroCarregamento(
            "Não deu pra carregar os canteiros agora. Confira a internet e tente de novo.",
          );
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

  useEffect(() => {
    async function tentarEnviar() {
      const { restantes } = await filaOffline.tentarEnviar(salvarRegistroColheita);
      setPendentesOffline(restantes);
    }
    tentarEnviar();
    window.addEventListener("online", tentarEnviar);
    return () => window.removeEventListener("online", tentarEnviar);
  }, []);

  function irPara(novoPasso: number) {
    setPasso(Math.min(Math.max(novoPasso, 1), TOTAL_PASSOS));
  }

  async function escolherCanteiro(id: string) {
    setCanteiroId(id);
    setPlantioId(null);
    setCarregandoPlantios(true);
    try {
      const lista = await listarPlantiosAtivosPorCanteiro(id);
      setPlantios(lista.filter((p) => p.status === "ativo"));
      irPara(2);
    } catch {
      setErroCarregamento("Não deu pra carregar os plantios desse canteiro agora.");
    } finally {
      setCarregandoPlantios(false);
    }
  }

  function escolherPlantio(p: PlantioComCultura) {
    setPlantioId(p.id);
    // Valor de partida do checkbox: pré-marca conforme o ciclo_produtivo da
    // cultura, mas só se a pessoa ainda não mexeu manualmente nele.
    if (!encerraTocado) setEncerraPlantio(p.cultura_ciclo_produtivo === "unico");
    irPara(3);
  }

  const culturasFiltradas = useMemo(() => {
    const alvo = cadastroBuscaCultura.trim().toLowerCase();
    if (!alvo) return culturas;
    return culturas.filter((c) => c.nome.toLowerCase().includes(alvo));
  }, [culturas, cadastroBuscaCultura]);

  function abrirCadastroRapido() {
    setCadastroAberto(true);
    setCadastroBuscaCultura("");
    setCadastroCulturaId(null);
    setCadastroQuantidade("");
    setCadastroUnidade("");
    setCadastroErro(null);
  }

  // Cadastra o plantio "já existente" sem sair da tela, mantendo o
  // canteiro já escolhido no passo 1, e segue direto pro registro da
  // colheita vinculado a esse plantio recém-criado.
  async function salvarCadastroRapido() {
    if (!canteiroId || !cadastroCulturaId) return;
    setCadastroSalvando(true);
    setCadastroErro(null);
    try {
      const novo = await criarPlantio({
        cultura_id: cadastroCulturaId,
        canteiro_id: canteiroId,
        origem: "ja_existente",
        quantidade_inicial: cadastroQuantidade.trim() ? Number(cadastroQuantidade) : null,
        unidade: cadastroUnidade.trim() || null,
      });
      const culturaEscolhida = culturas.find((c) => c.id === cadastroCulturaId);
      const novoComCultura: PlantioComCultura = {
        ...novo,
        cultura_nome: culturaEscolhida?.nome ?? "—",
        cultura_ciclo_produtivo: culturaEscolhida?.ciclo_produtivo ?? "unico",
      };
      setPlantios((lista) => [novoComCultura, ...lista]);
      setCadastroAberto(false);
      escolherPlantio(novoComCultura);
    } catch {
      setCadastroErro("Não deu pra cadastrar agora. Confira a internet e tente de novo.");
    } finally {
      setCadastroSalvando(false);
    }
  }

  async function salvar() {
    if (!canteiroId || !plantioId || !plantioSelecionado) return;
    setSalvando(true);
    setErroSalvar(null);

    let fotoUrl: string | null = null;
    if (fotos[0]) {
      try {
        fotoUrl = await enviarFotoRegistro(fotos[0], "colheita");
      } catch {
        fotoUrl = null;
      }
    }

    const registro: NovoRegistroColheita = {
      canteiro_id: canteiroId,
      plantio_id: plantioId,
      cultura: plantioSelecionado.cultura_nome,
      peso_kg: peso,
      foto_url: fotoUrl,
      observacao: observacao.trim() ? observacao.trim() : null,
      evento_agenda_id: eventoAgendaId,
    };

    try {
      const registroId = await salvarRegistroColheita(registro);
      if (fotos.length > 1 && registroId) {
        try {
          const extras = await Promise.all(fotos.slice(1).map((f) => enviarFotoRegistro(f, "colheita")));
          await salvarFotosExtras("registros_colheita", registroId, extras);
        } catch {
          // segue sem as extras — a capa já foi salva com o registro.
        }
      }
      if (encerraPlantio) {
        try {
          await marcarStatusPlantio(plantioId, "colhido");
        } catch {
          // Colheita já foi salva — se o fechamento do plantio falhar,
          // dá pra fechar depois manualmente pelo Mapa. Não trava a tela.
        }
      }
      setResultado("ok");
    } catch {
      filaOffline.enfileirar(registro);
      setPendentesOffline(filaOffline.contar());
      setResultado("offline");
    } finally {
      setSalvando(false);
    }
  }

  function recomecar() {
    setPasso(1);
    setCanteiroId(null);
    setPlantios([]);
    setPlantioId(null);
    setPeso(1);
    setFotos([]);
    setObservacao("");
    setEncerraPlantio(true);
    setEncerraTocado(false);
    setResultado(null);
    setErroSalvar(null);
    setCadastroAberto(false);
  }

  const canteiroSelecionado = canteiros.find((c) => c.id === canteiroId);
  const plantioSelecionado = plantios.find((p) => p.id === plantioId);

  if (carregando) {
    return (
      <TelaBase titulo="Registrar colheita" icone="🧺" voltarHref="/patio/horta">
        <p className="text-center text-sm text-zinc-600">Carregando canteiros…</p>
      </TelaBase>
    );
  }

  if (erroCarregamento) {
    return (
      <TelaBase titulo="Registrar colheita" icone="🧺" voltarHref="/patio/horta">
        <p className="text-center text-sm text-red-700">{erroCarregamento}</p>
      </TelaBase>
    );
  }

  if (resultado) {
    return (
      <TelaBase titulo="Registrar colheita" icone="🧺" voltarHref="/patio/horta">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2e6b3e] text-2xl text-white">
            {resultado === "ok" ? "✅" : "📶"}
          </span>
          <p className="text-base font-semibold text-zinc-900">
            {resultado === "ok"
              ? "Registro salvo!"
              : "Sem internet agora — guardado no celular"}
          </p>
          <p className="max-w-xs text-sm text-zinc-600">
            {resultado === "ok"
              ? "Registro de colheita salvo com sucesso."
              : "Assim que a conexão voltar, este registro é enviado sozinho. Não precisa fazer nada."}
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <button
              type="button"
              onClick={recomecar}
              className="rounded-full bg-[#2e6b3e] px-6 py-3 text-sm font-semibold text-white"
            >
              Registrar outra colheita
            </button>
            <Link
              href="/patio/horta"
              className="rounded-full border-2 border-[#2e6b3e] px-6 py-3 text-sm font-semibold text-[#2e6b3e]"
            >
              Voltar pra Horta
            </Link>
          </div>
        </div>
      </TelaBase>
    );
  }

  return (
    <TelaBase titulo="Registrar colheita" icone="🧺" voltarHref="/patio/horta">
      <BarraContexto canteiro={canteiroSelecionado} cultura={plantioSelecionado?.cultura_nome ?? null} passo={passo} />
      <PontosPasso passo={passo} total={TOTAL_PASSOS} />

      {pendentesOffline > 0 && (
        <p className="mb-3 rounded-lg border border-dashed border-zinc-400 bg-white px-3 py-2 text-center text-[11px] text-zinc-600">
          📶 {pendentesOffline} registro(s) esperando internet pra enviar.
        </p>
      )}

      {passo === 1 && (
        <Passo titulo="Qual canteiro?">
          <div className="grid grid-cols-2 gap-3">
            {canteiros.map((c) => (
              <BotaoGrande
                key={c.id}
                icone={iconeTipoCanteiro(c.tipo)}
                rotulo={c.nome}
                selecionado={c.id === canteiroId}
                onClick={() => escolherCanteiro(c.id)}
              />
            ))}
          </div>
          {canteiros.length === 0 && (
            <p className="text-center text-sm text-zinc-600">
              Nenhum canteiro cadastrado ainda. Cadastre pelo menos um canteiro (Mais → Cadastro) pra continuar.
            </p>
          )}
        </Passo>
      )}

      {passo === 2 && (
        <Passo titulo="Qual plantio foi colhido?">
          {carregandoPlantios ? (
            <p className="text-center text-sm text-zinc-600">Carregando…</p>
          ) : cadastroAberto ? (
            <CadastroRapidoPlantio
              culturas={culturasFiltradas}
              busca={cadastroBuscaCultura}
              onBuscar={setCadastroBuscaCultura}
              culturaId={cadastroCulturaId}
              onEscolherCultura={setCadastroCulturaId}
              quantidade={cadastroQuantidade}
              onMudarQuantidade={setCadastroQuantidade}
              unidade={cadastroUnidade}
              onMudarUnidade={setCadastroUnidade}
              salvando={cadastroSalvando}
              erro={cadastroErro}
              onCancelar={() => setCadastroAberto(false)}
              onSalvar={salvarCadastroRapido}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {plantios.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => escolherPlantio(p)}
                  className={[
                    "rounded-lg border-2 px-3 py-2 text-left",
                    p.id === plantioId ? "border-[#2e6b3e] bg-[#eaf3ea]" : "border-zinc-300 bg-white",
                  ].join(" ")}
                >
                  <span className="block text-sm font-bold text-zinc-900">{p.cultura_nome}</span>
                  <span className="block text-[11px] text-zinc-500">
                    {p.cultura_ciclo_produtivo === "unico" ? "ciclo único" : "ciclo contínuo"}
                  </span>
                </button>
              ))}
              {plantios.length === 0 && (
                <p className="text-center text-xs text-zinc-500">
                  Nenhum plantio ativo nesse canteiro ainda.
                </p>
              )}
              <button
                type="button"
                onClick={abrirCadastroRapido}
                className="mt-1 rounded-lg border-2 border-dashed border-zinc-400 bg-white px-3 py-2 text-center text-xs font-bold text-zinc-700"
              >
                ➕ Não achei — cadastrar planta que já existia
              </button>
            </div>
          )}
        </Passo>
      )}

      {passo === 3 && (
        <Passo titulo="Quanto foi colhido?">
          <CampoPeso valor={peso} onMudar={setPeso} autoFocus />
          <BotaoAvancar onClick={() => irPara(4)} />
        </Passo>
      )}

      {passo === 4 && (
        <Passo titulo="Fotos da colheita">
          <SeletorFotos fotos={fotos} onMudar={setFotos} obrigatoria />
          <BotaoAvancar onClick={() => irPara(5)} desabilitado={fotos.length === 0} />
        </Passo>
      )}

      {passo === 5 && (
        <Passo titulo="Quer contar mais alguma coisa?">
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder='Ex.: "praga na folha, precisa de manejo"...'
            className="min-h-24 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
          />

          <label className="mt-3 flex items-start gap-2 rounded-lg border-2 border-zinc-300 bg-[#f1efe6] p-3 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={encerraPlantio}
              onChange={(e) => {
                setEncerraPlantio(e.target.checked);
                setEncerraTocado(true);
              }}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              Essa colheita encerra o plantio? (a planta some do canteiro depois dessa colheita)
              <span className="mt-0.5 block text-[10px] text-zinc-500">
                Pré-marcado conforme o ciclo da cultura — confira ou troque conforme o que aconteceu de verdade.
              </span>
            </span>
          </label>

          <div className="mt-4 flex flex-col gap-2">
            <BotaoAvancar onClick={() => irPara(6)} texto="Continuar" />
          </div>
        </Passo>
      )}

      {passo === 6 && (
        <Passo titulo="Confere antes de salvar">
          <div className="rounded-xl border-2 border-zinc-800 bg-white p-3 text-sm">
            <LinhaResumo rotulo="Canteiro" valor={canteiroSelecionado?.nome ?? "—"} onEditar={() => irPara(1)} />
            <LinhaResumo rotulo="Plantio" valor={plantioSelecionado?.cultura_nome ?? "—"} onEditar={() => irPara(2)} />
            <LinhaResumo rotulo="Peso colhido" valor={`${peso} kg`} onEditar={() => irPara(3)} />
            <LinhaResumo
              rotulo="Fotos"
              valor={fotos.length === 0 ? "sem foto" : `${fotos.length} anexada(s)`}
              onEditar={() => irPara(4)}
            />
            <LinhaResumo
              rotulo="Encerra o plantio?"
              valor={encerraPlantio ? "sim" : "não"}
              onEditar={() => irPara(5)}
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
            📶 Sem internet agora? Sem problema — fica guardado no celular e envia sozinho quando voltar o sinal.
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

export default function RegistrarColheitaPage() {
  return (
    <Suspense
      fallback={
        <TelaBase titulo="Registrar colheita" icone="🧺" voltarHref="/patio/horta">
          <p className="text-center text-sm text-zinc-600">Carregando…</p>
        </TelaBase>
      }
    >
      <RegistrarColheitaConteudo />
    </Suspense>
  );
}

// Formulário inline de cadastro rápido (origem="ja_existente"), sem sair
// da tela de Registrar colheita — mesmo canteiro já escolhido no passo 1.
// Ver HANDOFF_HORTA_COMPLETO.md, seção 3.6, e pedido do usuário, 2026-08-28.
function CadastroRapidoPlantio({
  culturas,
  busca,
  onBuscar,
  culturaId,
  onEscolherCultura,
  quantidade,
  onMudarQuantidade,
  unidade,
  onMudarUnidade,
  salvando,
  erro,
  onCancelar,
  onSalvar,
}: {
  culturas: Cultura[];
  busca: string;
  onBuscar: (v: string) => void;
  culturaId: string | null;
  onEscolherCultura: (id: string) => void;
  quantidade: string;
  onMudarQuantidade: (v: string) => void;
  unidade: string;
  onMudarUnidade: (v: string) => void;
  salvando: boolean;
  erro: string | null;
  onCancelar: () => void;
  onSalvar: () => void;
}) {
  return (
    <div className="rounded-xl border-2 border-zinc-800 bg-[#f1efe6] p-3">
      <p className="mb-2 text-sm font-bold text-zinc-900">🌳 Cadastrar planta que já existia</p>
      <p className="mb-3 text-[11px] text-zinc-500">
        Cadastro rápido — vira um plantio origem &quot;já existente&quot; neste canteiro, e você já segue direto pra colheita.
      </p>

      <input
        autoFocus
        value={busca}
        onChange={(e) => onBuscar(e.target.value)}
        placeholder="🔎 Buscar cultura…"
        className="mb-2 w-full rounded-lg border-2 border-zinc-300 p-2.5 text-sm"
      />
      <div className="mb-3 flex max-h-40 flex-col gap-1.5 overflow-y-auto">
        {culturas.map((cu) => (
          <button
            key={cu.id}
            type="button"
            onClick={() => onEscolherCultura(cu.id)}
            className={[
              "rounded-lg border-2 px-3 py-2 text-left text-sm font-semibold",
              cu.id === culturaId
                ? "border-[#2e6b3e] bg-[#eaf3ea] text-[#2e6b3e]"
                : "border-zinc-300 bg-white text-zinc-800",
            ].join(" ")}
          >
            {cu.nome}
          </button>
        ))}
        {culturas.length === 0 && (
          <p className="text-center text-xs text-zinc-500">
            Nenhuma cultura encontrada. Cadastre pela tela Mais → Cadastro → Culturas.
          </p>
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="block text-[11px] font-semibold text-zinc-600">
          Quantidade (opcional)
          <input
            value={quantidade}
            onChange={(e) => onMudarQuantidade(e.target.value)}
            inputMode="decimal"
            placeholder="—"
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
          />
        </label>
        <label className="block text-[11px] font-semibold text-zinc-600">
          Unidade
          <input
            value={unidade}
            onChange={(e) => onMudarUnidade(e.target.value)}
            placeholder="Ex.: pés"
            className="mt-1 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
          />
        </label>
      </div>

      {erro && <p className="mb-2 text-center text-xs text-red-700">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="flex-1 rounded-lg border-2 border-zinc-300 bg-white py-2.5 text-xs font-bold text-zinc-700"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!culturaId || salvando}
          onClick={onSalvar}
          className="flex-1 rounded-lg border-2 border-[#2e6b3e] bg-[#eaf3ea] py-2.5 text-xs font-bold text-[#2e6b3e] disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "✅ Cadastrar e continuar"}
        </button>
      </div>
    </div>
  );
}

function BarraContexto({
  canteiro,
  cultura,
  passo,
}: {
  canteiro?: Canteiro;
  cultura: string | null;
  passo: number;
}) {
  if (passo === 1) return null;
  return (
    <div className="mb-2 flex justify-between rounded-lg border border-zinc-300 bg-[#f1efe6] px-3 py-1 text-[11px] text-zinc-600">
      <span>🌻 {canteiro?.nome ?? "—"}</span>
      {cultura && <span>{cultura}</span>}
    </div>
  );
}
