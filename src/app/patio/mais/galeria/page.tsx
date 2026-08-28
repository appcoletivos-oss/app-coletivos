"use client";

// Mais → Arquivo de fotos (galeria)
//
// Lista cronológica simples de todas as fotos já registradas no app
// (colheita, doação, perda, transplante, alimentação, manejo, ocorrência
// atípica). Sem pastas nesta rodada. Restrito a coordenação/consultor. Ver
// claude/handoff-mais-pacote1.md, seção 4.

import { useEffect, useState } from "react";
import { obterMeuMembro } from "@/lib/auth";
import { listarGaleria, ROTULO_ORIGEM_GALERIA, type FotoGaleriaExibivel } from "@/lib/galeria";
import { TelaBase } from "@/components/fluxo-registro";

export default function GaleriaPage() {
  const [acesso, setAcesso] = useState<"verificando" | "ok" | "negado">("verificando");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [fotos, setFotos] = useState<FotoGaleriaExibivel[]>([]);

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

  useEffect(() => {
    if (acesso !== "ok") return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const lista = await listarGaleria();
        if (!cancelado) setFotos(lista);
      } catch {
        if (!cancelado) setErro("Não deu pra carregar as fotos agora. Confira a internet e tente de novo.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [acesso]);

  if (acesso === "verificando") {
    return (
      <TelaBase titulo="Arquivo de fotos" icone="🖼️" voltarHref="/patio/mais">
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      </TelaBase>
    );
  }
  if (acesso === "negado") {
    return (
      <TelaBase titulo="Arquivo de fotos" icone="🖼️" voltarHref="/patio/mais">
        <p className="rounded-lg border border-dashed border-zinc-400 bg-[#f1efe6] px-3 py-4 text-center text-xs text-zinc-600">
          Esta tela é da coordenação.
        </p>
      </TelaBase>
    );
  }

  return (
    <TelaBase titulo="Arquivo de fotos" icone="🖼️" voltarHref="/patio/mais">
      {carregando ? (
        <p className="text-center text-sm text-zinc-600">Carregando…</p>
      ) : erro ? (
        <p className="text-center text-sm text-red-700">{erro}</p>
      ) : fotos.length === 0 ? (
        <p className="text-center text-xs text-zinc-500">Nenhuma foto registrada ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {fotos.map((f) => (
            <div key={`${f.origem}-${f.registro_id}`} className="rounded-xl border-2 border-zinc-800 bg-white p-2">
              {f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.url}
                  alt={f.descricao ?? f.origem}
                  className="max-h-64 w-full rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400">
                  foto indisponível
                </div>
              )}
              <div className="px-1 pt-2">
                <p className="text-xs font-bold text-zinc-800">
                  {ROTULO_ORIGEM_GALERIA[f.origem] ?? f.origem}
                </p>
                {f.descricao && <p className="text-[11px] text-zinc-600">{f.descricao}</p>}
                <p className="text-[11px] text-zinc-400">{new Date(f.data).toLocaleString("pt-BR")}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </TelaBase>
  );
}
