// Tipos compartilhados do Módulo 1 (Pátio de Compostagem).
//
// Espelham as tabelas criadas em
// supabase/migrations/20260821120000_entidades_parceiros_caixas_canteiros.sql —
// se o schema mudar, atualize aqui também.

export type TipoParceiro = "loja" | "construtora" | "outro";

// Loja/restaurante (ou construtora) que entrega resíduo ao pátio.
// "ativo: false" não some do histórico — só some das opções de novos
// registros. Ver comentário no topo da migration sobre por que renomear
// (corrigir o nome) é diferente de trocar o parceiro de verdade.
export interface Parceiro {
  id: string;
  nome: string;
  tipo: TipoParceiro;
  ativo: boolean;
  vinculado_desde: string;
  vinculado_ate: string | null;
  observacoes: string | null;
}

export type StatusCaixa = "ativa" | "nao_ativada" | "nova" | "desativada";

export interface Caixa {
  id: string;
  numero: number;
  status: StatusCaixa;
  capacidade_kg: number;
  observacoes: string | null;
}

export type TipoCanteiro =
  | "canteiro_solo"
  | "bombona"
  | "galeria"
  | "geodesica"
  | "outro";

export interface Canteiro {
  id: string;
  nome: string;
  tipo: TipoCanteiro;
  area_m2: number | null;
  capacidade_texto: string | null;
  ativo: boolean;
  vinculado_desde: string;
  vinculado_ate: string | null;
  observacoes: string | null;
}

export type TipoResiduo = "alimento" | "poda_verde" | "outro_organico";

// Dados que a tela de Registrar alimentação precisa enviar pra salvar um
// registro novo. `id` e `registrado_em` ficam por conta do banco.
export interface NovoRegistroAlimentacao {
  parceiro_id: string;
  caixa_id: string;
  peso_kg: number;
  tipo_residuo: TipoResiduo;
  temperatura_c?: number | null;
  foto_url?: string | null;
  observacao?: string | null;
}
