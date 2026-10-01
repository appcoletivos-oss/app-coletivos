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

// "descanso" — Etapa 1, item 6 (claude_handoff-registro-simplificado.md):
// caixa fora de operação por decisão da coordenação (ex.: dar um tempo pro
// composto maturar sem receber alimentação nova), diferente de
// "desativada" (defeito, retirada de circulação).
export type StatusCaixa = "ativa" | "nao_ativada" | "nova" | "desativada" | "descanso";

export interface Caixa {
  id: string;
  numero: number;
  status: StatusCaixa;
  capacidade_kg: number;
  observacoes: string | null;
  // Preenchida quando a caixa entra em descanso (cadastro já em descanso,
  // ou botão "mover pra descanso") — null fora desse status.
  data_inicio_descanso: string | null;
}

export type TipoCanteiro =
  | "canteiro_solo"
  | "bombona"
  | "galeia"
  | "geodesica"
  | "pergolado"
  | "vaso"
  | "bandeja_muda"
  | "saco_muda"
  | "outro";

export type LocalCanteiro = "patio" | "teto";

export interface Canteiro {
  id: string;
  nome: string;
  tipo: TipoCanteiro;
  local: LocalCanteiro;
  area_m2: number | null;
  capacidade_texto: string | null;
  ativo: boolean;
  vinculado_desde: string;
  vinculado_ate: string | null;
  observacoes: string | null;
  // Preenchidos quando o canteiro é INATIVADO pela aba Canteiros (estrutura
  // quebrada, perene encerrada) — distinto de vinculado_ate (turnover). Ver
  // migration 20260830000000 e claude/handoff-mais-pacote1.md, seção 1.
  motivo_inativacao: string | null;
  inativado_em: string | null;
  inativado_por: string | null;
}

// coordenacao e consultor têm o mesmo nível de acesso (ver matriz da
// decisão de 2026-08-27); a diferença prática é que consultor não bate
// ponto. Lojista fica para a Leva 2 — não existe como papel aqui.
export type PapelEquipe = "coordenacao" | "equipe" | "consultor";
export type StatusMembroEquipe = "convidado" | "ativo" | "inativo";

// Membro da equipe (coordenação/equipe/consultor). "Remover" pela tela de
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
  // auth.users(id) da pessoa — preenchido no aceite do convite (function
  // aceitar_convite). Enquanto for null, o membro não concluiu o 1º acesso.
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
// (2026-08-22) — histórico anterior ao bloco Plantios (ver Registro Geral,
// seção 3). Desde o handoff v3 (ver HANDOFF_HORTA_COMPLETO.md, seção 3.6),
// todo registro novo também exige `plantio_id`: a tela passa a escolher um
// plantio ativo do canteiro (não mais a cultura em texto livre digitado à
// mão) e `cultura` é preenchido automaticamente com o nome da ficha do
// plantio escolhido, só pra manter a coluna (nullable no banco, obrigatória
// na aplicação) consistente com o histórico antigo.
export interface NovoRegistroColheita {
  canteiro_id: string;
  plantio_id: string;
  cultura: string;
  peso_kg: number;
  foto_url?: string | null;
  observacao?: string | null;
  evento_agenda_id?: string | null;
}

export type TipoManejo = "capina_seletiva" | "adubacao" | "poda" | "raleamento" | "outro";

// Dados que a tela de Horta → Manejo precisa enviar pra salvar um registro
// novo (capina seletiva, adubação, poda, raleamento). `plantioIds` não é
// coluna de registros_manejo — é usado só pelo cliente (lib/plantios.ts,
// vincularManejoAPlantios) pra preencher registros_manejo_plantios logo
// depois do insert: em adubação/capina vem auto-preenchido com todos os
// plantios ativos do canteiro (sem passo extra na tela); em poda/
// raleamento vem da seleção manual feita na tela (ver handoff, seção 3.9).
export interface NovoRegistroManejo {
  canteiro_id: string;
  tipo_manejo: TipoManejo;
  observacao?: string | null;
  foto_url?: string | null;
  evento_agenda_id?: string | null;
  plantioIds?: string[];
}

// -----------------------------------------------------------------------------
// Horta → Plantios (rastreio ponta a ponta: origem → germinação →
// transplante → colheita/perda/doação) + fichas de cultura.
//
// Espelham as tabelas criadas em
// supabase/migrations/20260827130000_horta_plantios.sql — ver
// HANDOFF_HORTA_COMPLETO.md (v3) pro modelo completo e o porquê de cada
// campo.
// -----------------------------------------------------------------------------

export type CicloProdutivo = "unico" | "continuo";

// unico = colheita encerra o plantio (alface, cenoura). continuo = planta
// permanece produzindo (tomate, banana). É só o valor de PARTIDA do
// checkbox "essa colheita encerra o plantio?" em Registrar colheita — a
// pessoa registrando sempre confirma ou troca (nunca é regra automática).
export interface Cultura {
  id: string;
  nome: string;
  solo_ideal: string | null;
  rega_ideal: string | null;
  ciclo_produtivo: CicloProdutivo;
  dias_para_germinacao: number | null;
  dias_para_transplante: number | null;
  dias_para_colheita: number | null;
  ativo: boolean;
  observacoes: string | null;
}

export interface NovaCultura {
  nome: string;
  solo_ideal?: string | null;
  rega_ideal?: string | null;
  ciclo_produtivo: CicloProdutivo;
  dias_para_germinacao?: number | null;
  dias_para_transplante?: number | null;
  dias_para_colheita?: number | null;
  observacoes?: string | null;
}

export type TipoManejoRegime = "capina_seletiva" | "adubacao" | "poda" | "raleamento";
export type ReferenciaManejo = "plantio" | "germinacao" | "transplante";

// Regra de manejo periódico de uma cultura, contada a partir de um marco
// configurável (referencia) — ex.: tomate/adubação conta do transplante,
// não do plantio. Base do motor de "demandas do dia" (lib/plantios.ts).
export interface RegimeManejoCultura {
  id: string;
  cultura_id: string;
  tipo_manejo: TipoManejoRegime;
  referencia: ReferenciaManejo;
  dias_inicio: number;
  intervalo_dias: number;
  observacao: string | null;
}

export interface NovoRegimeManejoCultura {
  cultura_id: string;
  tipo_manejo: TipoManejoRegime;
  referencia: ReferenciaManejo;
  dias_inicio: number;
  intervalo_dias: number;
  observacao?: string | null;
}

export type OrigemPlantio = "semente" | "muda_comprada" | "estaca" | "ja_existente" | "divisao";
export type StatusPlantio =
  | "germinando"
  | "ativo"
  | "colhido"
  | "perdido"
  | "doado"
  | "transplantado"
  | "encerrado"
  // Canteiro/estrutura foi inativado e a planta não podia ser movida nem
  // colhida (perene). NÃO conta como perda real nos relatórios de
  // produtividade — ver claude/handoff-mais-pacote1.md, seção 1.
  | "encerrado_por_desativacao";

// Um lote de plantio. plantio_pai_id monta a linhagem quando o lote nasceu
// de um transplante parcial (origem=divisao) — ver linhagemPlantio em
// lib/plantios.ts.
export interface Plantio {
  id: string;
  cultura_id: string;
  canteiro_id: string;
  plantio_pai_id: string | null;
  origem: OrigemPlantio;
  data_inicio: string;
  quantidade_inicial: number | null;
  unidade: string | null;
  data_germinacao: string | null;
  quantidade_germinada: number | null;
  dias_para_colheita_snapshot: number | null;
  previsao_colheita: string | null;
  status: StatusPlantio;
  observacao_encerramento: string | null;
  registrado_por: string | null;
  criado_em: string;
}

// Dados que Registrar plantio precisa enviar pra criar um lote novo.
// dias_para_colheita_snapshot/previsao_colheita são calculados no cliente
// a partir da ficha da cultura escolhida (cópia do valor no momento do
// plantio — memória histórica, ver Plantio.dias_para_colheita_snapshot).
export interface NovoPlantio {
  cultura_id: string;
  canteiro_id: string;
  origem: OrigemPlantio;
  data_inicio?: string;
  quantidade_inicial?: number | null;
  unidade?: string | null;
  dias_para_colheita_snapshot?: number | null;
  previsao_colheita?: string | null;
  status?: StatusPlantio;
}

// Projeção usada pelas telas de seleção de plantio (Registrar colheita,
// Manejo, Transplantar) — nome da cultura já resolvido via join, pra não
// precisar de uma segunda consulta.
export interface PlantioComCultura extends Plantio {
  cultura_nome: string;
  cultura_ciclo_produtivo: CicloProdutivo;
}

export interface PlantioTransplante {
  id: string;
  plantio_origem_id: string;
  plantio_destino_id: string;
  canteiro_destino_id: string;
  quantidade: number | null;
  observacao: string | null;
  foto_url: string | null;
  registrado_por: string | null;
  registrado_em: string;
}

export interface RegistroPerda {
  id: string;
  plantio_id: string;
  quantidade: number | null;
  unidade: string | null;
  motivo: string | null;
  foto_url: string | null;
  registrado_por: string | null;
  registrado_em: string;
}

export interface NovoRegistroPerda {
  plantio_id: string;
  quantidade?: number | null;
  unidade?: string | null;
  motivo?: string | null;
  foto_url?: string | null;
}

// Doação de mudas/parte de um lote — distinta da doação de alimento já
// colhido pra ZEIS (bloco Venda, fora de escopo aqui).
export interface PlantioDoacao {
  id: string;
  plantio_id: string;
  quantidade: number | null;
  unidade: string | null;
  destino: string | null;
  observacao: string | null;
  foto_url: string | null;
  registrado_por: string | null;
  registrado_em: string;
}

export interface NovaPlantioDoacao {
  plantio_id: string;
  quantidade?: number | null;
  unidade?: string | null;
  destino?: string | null;
  observacao?: string | null;
  foto_url?: string | null;
}

// Saldo disponível do lote (view plantios_saldo — sempre calculado, nunca
// armazenado).
export interface PlantioSaldo {
  id: string;
  quantidade_disponivel: number | null;
}

// Estoque do viveiro (Horta → Estoque do viveiro): agrupa plantios_saldo
// por cultura, considerando só canteiros tipo geodesica/bandeja_muda/
// saco_muda (cobre qualquer origem — compra, sobra de transplante,
// germinação própria ainda não alocada). Sem custo/fornecedor por decisão
// explícita — controle financeiro fica fora do módulo Horta, reservado pro
// bloco Mais (financeiro), que ainda não existe.
export interface LoteEstoqueViveiro {
  plantioId: string;
  canteiroId: string;
  canteiroNome: string;
  origem: OrigemPlantio;
  dataInicio: string;
  quantidade: number | null;
  unidade: string | null;
  status: "germinando" | "ativo";
}

export interface EstoqueViveiroCultura {
  culturaId: string;
  culturaNome: string;
  // germinando = soma do saldo dos lotes ainda status='germinando'
  // (aguardando confirmação). disponivel = soma do saldo dos lotes já
  // status='ativo' (confirmado). Nunca somados num único número — ver
  // handoff/pedido do usuário, 2026-08-28.
  germinando: number;
  disponivel: number;
  lotes: LoteEstoqueViveiro[];
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

// Etapa 1, item 7 (claude_handoff-registro-simplificado.md): ponto batido
// fora do raio não é mais bloqueado — fica pendente de aprovação da
// coordenação/consultor. "aprovado"/"rejeitado" são decisões manuais;
// pontos dentro do raio não passam por esse campo (ficam null).
export type StatusAprovacaoPonto = "pendente" | "aprovado" | "rejeitado";

// Um registro de entrada/saída. Desde a Etapa 1 nem todo registro passou
// na checagem de geofence no cliente — ver fora_do_raio/justificativa
// (lib/ponto.ts e claude_handoff-registro-simplificado.md, Etapa 1 item 7).
// latitude/longitude/distancia_metros são nullable desde a SQL de 01/10
// (pontos_sem_gps_exige_justificativa): cobre o caso de GPS indisponível/
// timeout dentro do shopping — null só é válido junto com
// fora_do_raio=true e justificativa preenchida (regra garantida pela
// constraint no banco, não só na tela).
export interface Ponto {
  id: string;
  membro_equipe_id: string;
  tipo: TipoPonto;
  horario: string;
  latitude: number | null;
  longitude: number | null;
  distancia_metros: number | null;
  observacao: string | null;
  criado_em: string;
  fora_do_raio: boolean;
  justificativa: string | null;
  status_aprovacao: StatusAprovacaoPonto | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
}

export interface NovoPonto {
  membro_equipe_id: string;
  tipo: TipoPonto;
  horario: string;
  latitude: number | null;
  longitude: number | null;
  distancia_metros: number | null;
  observacao?: string | null;
  fora_do_raio?: boolean;
  justificativa?: string | null;
  status_aprovacao?: StatusAprovacaoPonto | null;
}

// -----------------------------------------------------------------------------
// Bloco "Mais completo" — Pacote 1 (ocorrência atípica, avisos ao shopping,
// galeria de fotos, financeiro).
//
// Espelham as tabelas criadas em
// supabase/migrations/20260830000000_mais_pacote1.sql — ver
// claude/handoff-mais-pacote1.md pro modelo completo.
// -----------------------------------------------------------------------------

// --- Ocorrência atípica ---

export interface OcorrenciaAtipica {
  id: string;
  descricao: string;
  foto_url: string;
  resolvido: boolean;
  resolvido_em: string | null;
  resolvido_por: string | null;
  registrado_por: string | null;
  criado_em: string;
}

// `foto_url` é obrigatória na tela (a coluna é not null no banco). `virarAviso`
// não é coluna — a tela usa pra criar junto uma linha em avisos_shopping.
export interface NovaOcorrenciaAtipica {
  descricao: string;
  foto_url: string;
}

// --- Avisos ao shopping ---

export type DirecaoAviso = "para_shopping" | "do_shopping";
export type CanalAviso = "whatsapp" | "email" | "presencial" | "outro";
export type AssuntoAviso =
  | "pedido_compra"
  | "ocorrencia_atipica"
  | "pagamento_mensal"
  | "planejamento_atividade"
  | "pedido_manutencao"
  | "outro";
export type StatusAviso = "pendente" | "resolvido";

export interface AvisoShopping {
  id: string;
  direcao: DirecaoAviso;
  canal: CanalAviso;
  assunto: AssuntoAviso;
  descricao: string;
  data: string;
  status: StatusAviso;
  ocorrencia_atipica_id: string | null;
  lancamento_financeiro_id: string | null;
  registrado_por: string | null;
  criado_em: string;
}

export interface NovoAvisoShopping {
  direcao: DirecaoAviso;
  canal: CanalAviso;
  assunto: AssuntoAviso;
  descricao: string;
  data: string;
  ocorrencia_atipica_id?: string | null;
  lancamento_financeiro_id?: string | null;
}

// --- Financeiro ---

export type TipoFinanceiro = "entrada" | "saida";
export type OrigemLancamento =
  | "manual"
  | "compra_compostagem"
  | "compra_horta"
  | "repasse_shopping"
  | "outro";

export interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipo: TipoFinanceiro;
  criado_por: string | null;
  criado_em: string;
}

export interface NovaCategoriaFinanceira {
  nome: string;
  tipo: TipoFinanceiro;
}

export interface LancamentoFinanceiro {
  id: string;
  tipo: TipoFinanceiro;
  categoria_id: string;
  valor: number;
  data: string;
  descricao: string | null;
  comprovante_url: string;
  origem: OrigemLancamento;
  registro_origem_id: string | null;
  aviso_id: string | null;
  registrado_por: string | null;
  criado_em: string;
}

// `comprovante_url` é obrigatória (coluna not null). Projeção com o nome da
// categoria já resolvido (join) fica em LancamentoComCategoria.
export interface NovoLancamentoFinanceiro {
  tipo: TipoFinanceiro;
  categoria_id: string;
  valor: number;
  data: string;
  descricao?: string | null;
  comprovante_url: string;
  origem?: OrigemLancamento;
  aviso_id?: string | null;
}

export interface LancamentoComCategoria extends LancamentoFinanceiro {
  categoria_nome: string;
}

// --- Galeria de fotos ---

// Uma linha por foto, vinda da função listar_galeria_fotos() (união das
// tabelas que já guardam foto_url). `foto_url` é o caminho interno no bucket
// privado — a tela troca por signed URL pra exibir (urlsAssinadasFotos).
export interface GaleriaFoto {
  origem: string;
  registro_id: string;
  foto_url: string;
  data: string;
  descricao: string | null;
}

// -----------------------------------------------------------------------------
// Registro simplificado — Etapa 1 (claude_handoff-registro-simplificado.md)
// -----------------------------------------------------------------------------

// Fotos além da capa de qualquer tabela de registro que já tinha
// `foto_url` — a primeira foto continua indo pra `foto_url` da tabela
// original (compatibilidade com a Galeria, que só lê a capa); as demais
// viram linhas aqui. `tabela_origem` usa o nome real da tabela (ex.:
// "registros_colheita"). Ver lib/patio.ts, salvarFotosExtras.
export interface FotoRegistro {
  id: string;
  tabela_origem: string;
  registro_id: string;
  foto_url: string;
  ordem: number;
  criado_em: string;
}

// -----------------------------------------------------------------------------
// Venda — Doação de alimento (Etapa 1, item 5 — bloco "Venda", parado
// desde a sessão G, ativado nesta rodada só pra doação). Distinta de
// PlantioDoacao (doação de muda/produção, vinculada a um plantio_id) —
// aqui o rastreio é pela colheita, não pelo canteiro. Sem geofence: pode
// ser registrada fora da área de trabalho (ver claude_handoff-registro-
// simplificado.md, Etapa 1 item 5).
// -----------------------------------------------------------------------------

export interface DoacaoAlimento {
  id: string;
  registro_colheita_id: string | null;
  cultura_id: string | null;
  quantidade: number | null;
  unidade: string;
  destino: string | null;
  foto_url: string;
  observacao: string | null;
  registrado_por: string | null;
  criado_em: string;
}

// Exatamente um dos dois precisa vir preenchido: registro_colheita_id
// (doação a partir de uma colheita já registrada) ou cultura_id + quantidade
// (doação direta, sem colheita associada) — ver constraint
// doacao_alimento_tem_origem no banco.
export interface NovaDoacaoAlimento {
  registro_colheita_id?: string | null;
  cultura_id?: string | null;
  quantidade?: number | null;
  unidade?: string;
  destino?: string | null;
  foto_url: string;
  observacao?: string | null;
}

// Projeção de registros_colheita usada pelo passo "escolher uma colheita
// recente" de Registrar doação de alimento.
export interface ColheitaRecente {
  id: string;
  cultura: string;
  peso_kg: number;
  registrado_em: string;
}
