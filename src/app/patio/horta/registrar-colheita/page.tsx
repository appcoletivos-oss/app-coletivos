"use client";

// Horta → Colher
//
// Ajustada pro handoff v3 (HANDOFF_HORTA_COMPLETO.md, seção 3.6): a
// cultura não é mais digitada — a pessoa escolhe um plantio ativo do
// canteiro, e a cultura vem dele. O fechamento do plantio NUNCA é
// automático por ciclo_produtivo: a ficha da cultura só pré-marca o
// "essa colheita encerra o plantio?" (pra ciclo=unico), mas quem registra
// sempre confirma ou troca — porque a mesma espécie pode ser tratada como
// corte único ou colheita contínua dependendo de como o coletivo maneja.
//
// Sprint A.1 (SPRINT_A1_MENOS_TOQUES.md, item 2): TELA ÚNICA. Vindo do card
// do plantio no Mapa (?canteiro=&plantio=), sobra digitar o peso e tocar em
// Salvar. Fotos e observação ficam recolhidas em "Mais detalhes"; não há
// mais tela de conferência — o botão Salvar já mostra o resumo.
//
// "Quem registrou" e "data" nunca são perguntados — vêm da sessão de
// login e do relógio do aparelho, mesmo espírito de sempre.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { enviarFotoRegistro, salvarFotosExtras } from "@/lib/patio";
import { salvarRegistroColheita } from "@/lib/horta";
import { listarCulturasAtivas } from "@/lib/culturas";
import { criarPlantio, marcarStatusPlantio } from "@/lib/plantios";
import { vincularRegistroAoItem } from "@/lib/relatorio-turno";
import { criarFilaOffline } from "@/lib/fila-offline";
import type { Cultura, NovoRegistroColheita, PlantioComCultura } from "@/lib/types";
import {
  BlocoRecolhivel,
  BotaoSalvar,
  CampoPeso,
  RotuloCampo,
  SeletorFotos,
  TelaBase,
  formatarNumero,
} from "@/components/fluxo-registro";
import { EscolhaPlantioCampos, useEscolhaPlantio } from "@/components/escolha-plantio";

const filaOffline = criarFilaOffline<NovoRegistroColheita>(
  "app-coletivo:fila-registros-colheita",
);

// Constante de módulo: o hook usa a lista como chave de efeito.
const STATUS_COLHIVEIS: PlantioComCultura["status"][] = ["ativo"];

// useSearchParams exige um limite de Suspense em volta (regra do Next.js
// pra Client Components) — por isso o export default vira só um wrapper,
// ver RegistrarColheitaPage no fim do arquivo.
function RegistrarColheitaConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Preenchido quando a tela é aberta a partir de um link da Agenda
  // (evento tipo "atividade") — ver lib/agenda.ts, LINKS_REGISTRO_ATIVIDADE.
  const eventoAgendaId = searchParams.get("evento_agenda_id");
  // Preenchidos quando a tela é aberta a partir do Relatório do Turno
  // (Sprint A, item 6, tipo_registro=canteiro → Colheita) — ver
  // relatorio-turno-conteudo.tsx, hrefSubFormulario.
  const relatorioItemId = searchParams.get("relatorio_item");
  const voltarHref = searchParams.get("voltar");
  const fecharHref = voltarHref ? decodeURIComponent(voltarHref) : "/patio/horta";

  const escolha = useEscolhaPlantio(STATUS_COLHIVEIS);
  const { canteiro, plantio } = escolha;

  const [culturas, setCulturas] = useState<Cultura[]>([]);

  // Cadastro rápido de planta "já existente" sem sair da tela (ver
  // HANDOFF_HORTA_COMPLETO.md, seção 3.6, e pedido do usuário, 2026-08-28):
  // quem colhe uma planta que ainda não tem plantio cadastrado cadastra na
  // hora, sem perder o canteiro já escolhido. Agora atrás do link "Não
  // achei o plantio".
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [cadastroBuscaCultura, setCadastroBuscaCultura] = useState("");
  const [cadastroCulturaId, setCadastroCulturaId] = useState<string | null>(null);
  const [cadastroQuantidade, setCadastroQuantidade] = useState("");
  const [cadastroUnidade, setCadastroUnidade] = useState("");
  const [cadastroSalvando, setCadastroSalvando] = useState(false);
  const [cadastroErro, setCadastroErro] = useState<string | null>(null);

  const [peso, setPeso] = useState(0);
  const [fotos, setFotos] = useState<File[]>([]);
  const [observacao, setObservacao] = useState("");
  // null = a pessoa ainda não mexeu: vale o padrão da cultura do plantio
  // escolhido (ciclo único → encerra). Mexeu, vale o que ela marcou.
  const [encerraEscolhido, setEncerraEscolhido] = useState<boolean | null>(null);
  const encerraPlantio = encerraEscolhido ?? plantio?.cultura_ciclo_produtivo === "unico";

  const [salvando, setSalvando] = useState(false);
  const [pendentesOffline, setPendentesOffline] = useState(0);

  useEffect(() => {
    let cancelado = false;
    listarCulturasAtivas()
      .then((lista) => {
        if (!cancelado) setCulturas(lista);
      })
      .catch(() => {
        // Só o cadastro rápido usa as culturas — sem elas, ele mostra a
        // lista vazia; o resto da tela segue.
      });
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
  // canteiro já escolhido, e já deixa esse plantio escolhido pra colheita.
  async function salvarCadastroRapido() {
    if (!escolha.canteiroId || !cadastroCulturaId) return;
    setCadastroSalvando(true);
    setCadastroErro(null);
    try {
      const novo = await criarPlantio({
        cultura_id: cadastroCulturaId,
        canteiro_id: escolha.canteiroId,
        origem: "ja_existente",
        quantidade_inicial: cadastroQuantidade.trim() ? Number(cadastroQuantidade.replace(",", ".")) : null,
        unidade: cadastroUnidade.trim() || null,
      });
      const culturaEscolhida = culturas.find((c) => c.id === cadastroCulturaId);
      escolha.adicionarPlantio({
        ...novo,
        cultura_nome: culturaEscolhida?.nome ?? "—",
        cultura_ciclo_produtivo: culturaEscolhida?.ciclo_produtivo ?? "unico",
      });
      setEncerraEscolhido(null);
      setCadastroAberto(false);
    } catch {
      setCadastroErro("Não deu pra cadastrar agora. Confira a internet e tente de novo.");
    } finally {
      setCadastroSalvando(false);
    }
  }

  function voltarDepoisDeSalvar(codigo: "colheita" | "colheita-offline") {
    if (relatorioItemId && voltarHref) {
      router.push(decodeURIComponent(voltarHref));
      return;
    }
    router.push(`/patio/horta?salvo=${codigo}`);
  }

  async function salvar() {
    if (!escolha.canteiroId || !plantio || peso <= 0) return;
    setSalvando(true);
    escolha.lembrarCanteiro();

    let fotoUrl: string | null = null;
    if (fotos[0]) {
      try {
        fotoUrl = await enviarFotoRegistro(fotos[0], "colheita");
      } catch {
        fotoUrl = null;
      }
    }

    const registro: NovoRegistroColheita = {
      canteiro_id: escolha.canteiroId,
      plantio_id: plantio.id,
      cultura: plantio.cultura_nome,
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
          await marcarStatusPlantio(plantio.id, "colhido");
        } catch {
          // Colheita já foi salva — se o fechamento do plantio falhar,
          // dá pra fechar depois manualmente pelo Mapa. Não trava a tela.
        }
      }

      // Aberta a partir do Relatório do Turno (Sprint A, item 6): vincula
      // e volta pro relatório.
      if (relatorioItemId) {
        try {
          await vincularRegistroAoItem(relatorioItemId, "registros_colheita", registroId);
        } catch {
          // segue sem o vínculo — o registro já está salvo.
        }
      }
      voltarDepoisDeSalvar("colheita");
    } catch {
      filaOffline.enfileirar(registro);
      setPendentesOffline(filaOffline.contar());
      // Enfileirado sem internet: sem id pra vincular ao item do
      // Relatório do Turno (limitação conhecida, seção 11e) — volta pro
      // relatório mesmo assim, o item fica sem marcar.
      voltarDepoisDeSalvar("colheita-offline");
    } finally {
      setSalvando(false);
    }
  }

  if (escolha.carregando) {
    return (
      <TelaBase titulo="Colher" icone="🧺" voltarHref={fecharHref}>
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }

  if (escolha.erro) {
    return (
      <TelaBase titulo="Colher" icone="🧺" voltarHref={fecharHref}>
        <p className="text-center text-sm text-red-700">{escolha.erro}</p>
      </TelaBase>
    );
  }

  const pendencia = !plantio
    ? escolha.canteiro
      ? "Escolha o plantio colhido"
      : "Escolha o canteiro"
    : peso <= 0
      ? "Digite quantos kg foram colhidos"
      : null;
  const resumo = plantio
    ? `Salvar: ${formatarNumero(peso)} kg de ${plantio.cultura_nome} · ${canteiro?.nome ?? ""}${encerraPlantio ? " · encerra o plantio" : ""}`
    : "Salvar";

  return (
    <TelaBase titulo="Colher" icone="🧺" voltarHref={fecharHref}>
      {pendentesOffline > 0 && (
        <p className="mb-3 rounded-lg border border-dashed border-zinc-400 bg-white px-3 py-2 text-center text-[11px] text-zinc-600">
          📶 {pendentesOffline} registro(s) esperando internet pra enviar.
        </p>
      )}

      {cadastroAberto && escolha.canteiro ? (
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
        <EscolhaPlantioCampos
          escolha={escolha}
          iconeContexto="🧺"
          perguntaPlantio="Qual plantio foi colhido?"
          semPlantios="Nenhum plantio ativo nesse canteiro."
          detalhePlantio={(p) => (p.cultura_ciclo_produtivo === "unico" ? "ciclo único" : "ciclo contínuo")}
          rodapeLista={
            <button
              type="button"
              onClick={abrirCadastroRapido}
              className="mt-1 text-center text-xs text-zinc-600 underline"
            >
              Não achei o plantio (planta que já existia)
            </button>
          }
        />
      )}

      {plantio && !cadastroAberto && (
        <>
          <RotuloCampo>Quanto foi colhido?</RotuloCampo>
          <CampoPeso key={plantio.id} valor={peso} onMudar={setPeso} autoFocus />

          <label className="mt-3 flex items-start gap-2 rounded-xl border-2 border-zinc-300 bg-white p-3 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={encerraPlantio}
              onChange={(e) => setEncerraEscolhido(e.target.checked)}
              className="mt-0.5 h-5 w-5"
            />
            <span>
              <b>Essa colheita encerra o plantio?</b> (a planta sai do canteiro)
              <span className="mt-0.5 block text-[10px] text-zinc-500">
                Já vem marcado conforme o ciclo da cultura. Confira e troque se foi diferente.
              </span>
            </span>
          </label>

          <BlocoRecolhivel
            resumo={
              [fotos.length > 0 ? `${fotos.length} foto(s)` : null, observacao.trim() ? "observação" : null]
                .filter(Boolean)
                .join(", ") || null
            }
          >
            <div>
              <RotuloCampo>Fotos</RotuloCampo>
              <SeletorFotos fotos={fotos} onMudar={setFotos} />
            </div>
            <div>
              <RotuloCampo>Observação</RotuloCampo>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder='Ex.: "praga na folha, precisa de manejo"...'
                className="min-h-20 w-full rounded-lg border-2 border-zinc-300 p-3 text-sm"
              />
            </div>
          </BlocoRecolhivel>
        </>
      )}

      {!cadastroAberto && (
        <>
          <BotaoSalvar resumo={resumo} pendencia={pendencia} salvando={salvando} onClick={salvar} />
          <p className="mt-2 text-center text-[10px] text-zinc-500">
            📶 Sem internet? Fica guardado no celular e envia sozinho quando voltar o sinal.
          </p>
        </>
      )}
    </TelaBase>
  );
}

export default function RegistrarColheitaPage() {
  return (
    <Suspense
      fallback={
        <TelaBase titulo="Colher" icone="🧺" voltarHref="/patio/horta">
          <p className="text-center text-sm text-zinc-600">Carregando…</p>
        </TelaBase>
      }
    >
      <RegistrarColheitaConteudo />
    </Suspense>
  );
}

// Formulário inline de cadastro rápido (origem="ja_existente"), sem sair
// da tela de Colher — mesmo canteiro já escolhido.
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
