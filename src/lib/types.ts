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
  // Turnos de 3h/semana esperados no vínculo geral da pessoa — usado como
  // "esperado" no cálculo de banco de horas (ver lib/ponto.ts). Editável
  // livremente pela coordenação a qualquer momento, não é fixado na
  // criação do cadastro (ver migration 20260826120000).
  carga_semanal_turnos: number | null;
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
  // Preenchido quando a tela é aberta a partir de um link da Agenda
  // (evento tipo "atividade") — ver lib/agenda.ts e migration 20260826120000.
  evento_agenda_id?: string | null;
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
  evento_agenda_id?: string | null;
}

export type TipoManejo = "capina_seletiva" | "adubacao" | "poda" | "raleamento" | "outro";

// Dados que a tela de Horta → Manejo precisa enviar pra salvar um registro
// novo (capina seletiva, adubação, poda, raleamento).
export interface NovoRegistroManejo {
  canteiro_id: string;
  tipo_manejo: TipoManejo;
  observacao?: string | null;
  foto_url?: string | null;
  evento_agenda_id?: string | null;
}

// Dados que a tela de Compostagem → Análise sensorial precisa enviar pra
// salvar um registro novo. Os três campos são texto livre e opcionais —
// ver nota sobre gravação de áudio como melhoria futura em
// analise-sensorial/page.tsx.
export interface NovoRegistroAnaliseSensorial {
  caixa_id: string;
  visao?: string | null;
  olfato?: string | null;
  tato?: string | null;
  evento_agenda_id?: string | null;
}

// Dados que a tela de Compostagem → Controle de bombonas precisa enviar
// pra salvar um registro novo. `registrado_por` é obrigatório na tela
// (texto livre, digitado por quem registra) mesmo sendo opcional no banco
// — ver migration 20260822180000 sobre por que não é um uuid de
// auth.users como nas demais tabelas de registro.
export interface NovoRegistroBombona {
  parceiro_id: string;
  numero_bombona: string;
  data_entrega: string;
  data_devolucao?: string | null;
  higienizada?: boolean | null;
  tampa_fechada?: boolean | null;
  adesivo_presente?: boolean | null;
  odor?: number | null;
  preenchida_corretamente?: boolean | null;
  observacao?: string | null;
  registrado_por: string;
  evento_agenda_id?: string | null;
}

// -----------------------------------------------------------------------------
// Bloco Agenda + Meu Ponto
//
// Espelham as tabelas criadas em supabase/migrations/20260826100000_agenda.sql
// e 20260826110000_pontos.sql — se o schema mudar, atualize aqui também.
// -----------------------------------------------------------------------------

export type TipoEventoAgenda =
  | "atividade"
  | "mutirao"
  | "oficina"
  | "visita"
  | "turno_trabalho"
  | "folga"
  | "ferias";

export type TurnoDia = "manha" | "tarde" | "dia_todo";

// Um evento da Agenda: geral da equipe (membro_equipe_id null) ou escala
// individual (turno_trabalho, folga, ferias — membro_equipe_id obrigatório
// em regra de produto). Ver comentário no topo da migration 20260826100000.
export interface EventoAgenda {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: TipoEventoAgenda;
  data: string;
  data_fim: string | null;
  turno: TurnoDia | null;
  membro_equipe_id: string | null;
  criado_por: string | null;
  criado_em: string;
}

export interface NovoEventoAgenda {
  titulo: string;
  descricao?: string | null;
  tipo: TipoEventoAgenda;
  data: string;
  data_fim?: string | null;
  turno?: TurnoDia | null;
  membro_equipe_id?: string | null;
}

// Config do geofence usado por Meu Ponto — ver migration 20260826090000.
export interface LocalTrabalho {
  id: string;
  nome: string;
  latitude: number;
  longitude: number;
  raio_metros: number;
  atualizado_em: string;
}

export type TipoPonto = "entrada" | "saida";

// Um registro de entrada/saída — todo registro que existe já passou na
// checagem de geofence no cliente (ver lib/ponto.ts e migration 20260826110000).
export interface Ponto {
  id: string;
  membro_equipe_id: string;
  tipo: TipoPonto;
  horario: string;
  latitude: number;
  longitude: number;
  distancia_metros: number;
  observacao: string | null;
  criado_em: string;
}

export interface NovoPonto {
  membro_equipe_id: string;
  tipo: TipoPonto;
  horario: string;
  latitude: number;
  longitude: number;
  distancia_metros: number;
  observacao?: string | null;
}
