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
  | "galeia"
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

export type PapelEquipe = "funcionaria" | "coordenacao";
export type StatusMembroEquipe = "convidado" | "ativo" | "inativo";

// Membro da equipe (funcionária/coordenação). "Remover" pela tela de
// Cadastro sempre desativa (status = "inativo"), nunca apaga a linha —
// mesma lógica de memória histórica de parceiros/canteiros.
export interface MembroEquipe {
  id: string;
  nome: string;
  papel: PapelEquipe;
  whatsapp: string;
  status: StatusMembroEquipe;
  convite_token: string | null;
  convite_criado_em: string | null;
  convite_expira_em: string | null;
  user_id: string | null;
  vinculado_desde: string;
  vinculado_ate: string | null;
}

// Dados públicos mínimos que a tela de convite (/convite/[token]) recebe
// da function `buscar_convite_por_token` — nunca a linha inteira de
// membros_equipe (ver nota de segurança na migration da Equipe).
export interface ConvitePreCadastro {
  nome: string;
  papel: PapelEquipe;
  valido: boolean;
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

// Projeção mínima de registros_alimentacao usada pela tela Ver caixas pra
// somar peso e achar a última alimentação de cada caixa (agregação
// client-side — ver resumoAlimentacaoPorCaixa em lib/patio.ts).
export interface RegistroAlimentacaoResumo {
  caixa_id: string;
  peso_kg: number;
  registrado_em: string;
}

// Dados que a tela de Registrar colheita (Horta) precisa enviar pra
// salvar um registro novo. `cultura` é texto livre por decisão de produto
// (2026-08-22): a tela mostra um grid fixo com as espécies mais colhidas
// historicamente + botão "Outra" pra digitar o nome — sem tabela própria
// de culturas por trás, então não passa por padronização automática (ver
// Registro Geral, seção 3).
export interface NovoRegistroColheita {
  canteiro_id: string;
  cultura: string;
  peso_kg: number;
  foto_url?: string | null;
  observacao?: string | null;
}
