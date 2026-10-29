# Sprint B — Turno guiado + Relato do turno com IA

> **Status em 28/10/2026 (noite):** B2, B2b e B2c (migrations) aplicados. B5 (Lançar a semana) construído e validado contra a IA real. **Itens restantes (B1, B3, B4) seguem em `SPRINT_B2_HOME_RELATO_FILA.md`, que vence esta spec onde divergir** (ex.: a seção 5b não usa temperature e o casamento de lojas, caixas, canteiros e culturas é feito no servidor, não pelo modelo).

Escrito no Cowork em 28/10/2026, a partir de decisões do Thiago. Este arquivo é a instrução vigente. Complementa SPRINT_A1_MENOS_TOQUES.md (que segue valendo no que não for alterado aqui).

## 0. Por que existe

Operação diária ficou pesada demais para a equipe. Novo desenho aprovado:

1. A pessoa abre o app e cai direto no **ponto**.
2. Depois do ponto, cai no **checklist do turno** (o Relatório do Turno que já existe), marcado por toque.
3. No fim do turno, **cola ou dita um texto** (hoje elas já ditam em outra IA e colam a transcrição no WhatsApp). A IA interpreta e propõe o que preencher.
4. A pessoa confere em uma tela, responde 2 ou 3 perguntas de toque sobre o que faltou (puláveis) e envia.
5. O que a IA propôs entra numa **fila "Para conferir"**; qualquer coordenadora aprova. Só depois de aprovado vira registro oficial (entra em saldos, Mapa, totais).

Decisões já fechadas (não reabrir):
- Voz nativa **fora** desta sprint (sem Whisper, sem `OPENAI_API_KEY`). Entrada é texto colado ou ditado pelo teclado do celular.
- Qualquer coordenadora ou o consultor aprova; não há atribuição por tipo de dado.
- Carrinho sem tipo informado = **Carrinho azul** (18 kg), marcado como assumido.
- Compostagem aceita **dois formatos** (seção 4).
- Doação de **alimento** sai do relato como proposta de doação, com **foto obrigatória, anexável depois** pela pessoa que relatou ou por qualquer coordenadora/consultor (a entrega costuma ser feita depois, em mãos, na comunidade; seção 4b). Doação de **muda** não entra nesta sprint (exige plantio): vira item do checklist com aviso.
- Escala e planejamento da semana passam a ser lançados colando a mensagem que a coordenação já manda no WhatsApp (item B5).

## 1. Regras de trabalho (mesmas da Sprint A)

- Ler `AGENTS.md` e a documentação em `node_modules/next/dist/docs/` antes de criar rota de API (Next 16 tem mudanças).
- Não aplicar SQL, não fazer commit nem push. Migrations: criar o arquivo e devolver ao Cowork para revisão; o Thiago roda no SQL Editor do Supabase.
- Trabalhar em branch separada. O código local da A.1 ainda não foi commitado e depende da migration 20261002010000 (não aplicada); não misturar.
- Rodar `tsc`, `eslint`, `next build` ao fim de cada item.
- Onde está escrito "verificar antes de implementar", conferir no código/schema real e reportar o achado.
- Chave `ANTHROPIC_API_KEY`: só no servidor (nunca `NEXT_PUBLIC_*`), em `.env.local` para teste e como Secret na Vercel (Thiago cria).

## 2. Item B1 — Home do dia: ponto, depois checklist

Nova rota `/patio/hoje` (client component):

1. Sem ponto de **entrada** hoje (Recife, mesma lógica de `determinarDataTurnoAtual`) → redireciona para `/patio/meu-ponto?voltar=/patio/hoje`.
2. Com entrada hoje → redireciona para `/patio/relatorio-turno` (que já abre ou cria o relatório do turno e redireciona para `[id]`).
3. Consultor (não bate ponto) → `/patio`, como hoje.

`/` (tela inicial): para papel `equipe` e `coordenacao`, o card "Pátio de Compostagem" aponta para `/patio/hoje`. **Verificar antes de implementar:** como `src/lib/auth.ts` e o layout decidem a sessão e o papel, e onde fazer o redirecionamento sem quebrar a pré-renderização (lição da sessão G: cliente Supabase sob demanda).

`/patio/meu-ponto`: aceitar `?voltar=` (somente caminho interno que comece com `/patio/`; rejeitar qualquer outro valor) e, após salvar entrada com sucesso (inclusive pendente por fora do raio), navegar para esse caminho. Nada mais muda no ponto.

Rodapé da tela do relatório: botão discreto "Bater ponto de saída" (leva a `meu-ponto`) e link "Outras telas" para `/patio` (a lista atual de blocos continua existindo, é a área de acesso detalhado). Coordenação/consultor veem no topo do relatório e em `/patio` um selo "Para conferir (N)" que leva a `/patio/conferir` (B3). N conta propostas pendentes + culturas com `revisar = true`.

Critério de pronto B1: de app fechado a "Bater entrada" são 0 toques de navegação (abre direto no ponto); depois do ponto o checklist aparece sem toque extra.

## 3. Item B2 — Banco: staging das propostas (migration para o Cowork revisar)

Decisão de arquitetura: **a IA nunca grava nas tabelas de registro**. Grava propostas numa tabela própria; ao aprovar, o app cria o registro oficial chamando as funções/RPCs que já existem. Assim nada pendente vaza para saldo, Mapa ou relatório (e não é preciso mexer em 8 tabelas nem nos filtros de `anulado_em` da A.1).

Arquivo: `supabase/migrations/20261028000000_relato_turno_propostas.sql`. Idempotente (`if not exists`, `drop policy if exists`). Conteúdo:

```
relatos_turno
  id uuid pk default gen_random_uuid()
  relatorio_turno_id uuid not null references relatorios_turno(id)
  texto text not null            -- texto colado, como veio
  interpretado_em timestamptz
  criado_por uuid not null default auth.uid() references auth.users(id)
  criado_em timestamptz not null default now()

relato_turno_propostas
  id uuid pk default gen_random_uuid()
  relato_turno_id uuid not null references relatos_turno(id)
  relatorio_turno_id uuid not null references relatorios_turno(id)
  tipo text not null check (tipo in ('compostagem','plantio','colheita','manejo','doacao'))
  dados jsonb not null           -- campos propostos (seção 5)
  campos_status jsonb not null   -- {"canteiro_id":"certo|inferido|faltando", ...}
  trecho_origem text not null    -- pedaço do texto de onde saiu
  avisos jsonb not null default '[]'   -- ex.: divergência de soma
  status text not null default 'pendente' check (status in ('pendente','aprovada','rejeitada'))
  conferido_por uuid references auth.users(id)
  conferido_em timestamptz
  motivo_rejeicao text
  tabela_registro_gerado text
  registro_id_gerado uuid
  criado_por uuid not null default auth.uid() references auth.users(id)
  criado_em timestamptz not null default now()
```

RLS (usar `papel_atual()`):
- `relatos_turno`: insert `papel_atual() is not null and criado_por = auth.uid()`; select: autor ou coordenacao/consultor. Sem update/delete.
- `relato_turno_propostas`: insert igual (autor); select: autor ou coordenacao/consultor; update: só coordenacao/consultor (aprovar, rejeitar, editar `dados`/`campos_status`). Sem delete.
- Preencher `relatos_ia_log` (já existe): `modo = 'texto'`, tokens, `aceito_sem_edicao`.

**Verificar antes de implementar:** como as tabelas de registro tratam `registrado_por` na aprovação. A RLS atual só deixa gravar `registrado_por = auth.uid()` ou nulo. Portanto o registro oficial criado na aprovação terá a coordenadora como `registrado_por`. Isso é aceitável nesta versão: o autor real fica em `relato_turno_propostas.criado_por` e a tela da fila e do registro mostram "Relatado por X, conferido por Y". Reportar se algum registro precisar de outro tratamento.

## 4. Item B2b — Compostagem nos dois formatos e carrinho assumido (migration separada)

Arquivo: `supabase/migrations/20261028010000_compostagem_formato_loja_e_carrinho_assumido.sql`. Entregar ao Cowork para revisão antes de qualquer teste.

Fatos do schema real (conferidos hoje):
- `registros_alimentacao`: uma linha por loja e por caixa; `caixa_id` NOT NULL; `peso_kg` NOT NULL.
- `registro_alimentacao_bombonas`: `numero_bombona` NOT NULL, `unique (registro_alimentacao_id, numero_bombona)`.
- RPC `registrar_alimentacao_com_bombonas` exige número em toda bombona.

Problema real nos relatos: (a) formato novo = loja + quantidade de bombonas + peso total da loja, sem número e sem divisão por caixa; (b) nos relatos de setembro o mesmo número aparece duas vezes na mesma coleta (ex.: 74 em 25/09).

Mudanças:
1. `registro_alimentacao_bombonas.numero_bombona` passa a aceitar nulo; remover a constraint `unique (registro_alimentacao_id, numero_bombona)` (manter o índice por número). O app avisa número repetido na mesma coleta, mas não bloqueia.
2. `registros_alimentacao`: novas colunas `coleta_id uuid`, `qtd_bombonas_coleta int check (>= 0)`, `peso_total_coleta numeric check (>= 0)`, `peso_dividido_estimado boolean not null default false`. Todas as linhas da mesma loja no mesmo turno compartilham `coleta_id`. Consulta "total da loja no turno" = agrupar por `coleta_id`.
3. Nova RPC `registrar_alimentacao_por_loja(p_parceiro_id uuid, p_tipo_residuo text, p_qtd_bombonas int, p_peso_total_kg numeric, p_distribuicao jsonb, p_bombonas jsonb default null, p_temperatura_c numeric default null, p_foto_url text default null, p_observacao text default null, p_evento_agenda_id uuid default null) returns uuid` (devolve `coleta_id`), `security invoker`, `set search_path = ''`, `revoke ... from public`, `grant execute ... to authenticated`.
   - `p_distribuicao` = `[{"caixa_id": uuid, "peso_kg": numeric|null}, ...]`, ao menos 1 caixa.
   - Todos com `peso_kg`: a soma deve igualar `p_peso_total_kg` (tolerância 0,05); senão erro claro.
   - Algum sem `peso_kg`: dividir o restante em partes iguais entre os sem peso e marcar `peso_dividido_estimado = true` em todas as linhas da coleta.
   - `p_bombonas` opcional (`[{numero_bombona, peso_kg}]`); se vier, grava filhas em cada linha só quando houver exatamente 1 caixa; com mais de 1 caixa, não gravar filhas (reportar como limitação).
   - Mesmo vínculo opcional com `registros_bombonas` do RPC antigo (parceiro + número, mais recente por `data_entrega`).
4. O RPC antigo `registrar_alimentacao_com_bombonas` **continua existindo** (a tela atual usa).
5. `registros_manejo`: nova coluna `tipo_carrinho_assumido boolean not null default false`.

Tela de Registrar alimentação: **não alterar agora** (A.1 item 6 faz a tela única; ao fazê-la, oferecer os dois modos: "Total da loja" como padrão e "Detalhar bombonas").

## 4b. Item B2c — Doação com foto pendente (migration separada)

Fatos do schema real: `doacoes_alimento.foto_url` é NOT NULL e `registrado_por` é NOT NULL com RLS `registrado_por = auth.uid()` no insert.

Arquivo: `supabase/migrations/20261028020000_doacao_foto_pendente.sql`. Entregar ao Cowork para revisão.
1. `foto_url` passa a aceitar nulo; nova coluna `foto_pendente boolean not null default false`; constraint `check (foto_url is not null or foto_pendente)`.
2. Anexar a foto = UPDATE só de `foto_url` e `foto_pendente` (vira `false` ao anexar). Quem pode: o autor do registro (`registrado_por`), a pessoa que relatou (via `relato_turno_propostas.criado_por` onde `tabela_registro_gerado = 'doacoes_alimento'` e `registro_id_gerado = doacoes_alimento.id`) e coordenacao/consultor. Qualquer outra coluna só muda pelo mecanismo de correção da A.1.
3. **Verificar antes de implementar:** se a migration `20261002010000_correcao_anulacao_registros.sql` já foi aplicada, reaproveitar o gatilho e o padrão de `foto_pendente` dela em vez de criar um paralelo; se não, esta migration cria o mínimo só para `doacoes_alimento`, com `add column if not exists`, sem conflito com a outra.
4. A tela atual de Registrar doação (foto obrigatória no ato) continua igual. Ganha, na própria tela de Venda e no relatório do turno, a lista "Fotos de doação pendentes" com um toque para abrir a câmera. Em `/patio/hoje`, faixa "Você tem N fotos pendentes". Coordenação e consultor veem todas as pendentes na fila `/patio/conferir`, seção "Fotos pendentes".

## 5. Item B3 — Relato do turno com IA (texto)

### 5a. Entrada
Na tela do relatório, no topo: botão grande "Contar como foi o turno". Abre caixa de texto grande ("Cole ou escreva aqui. Pode ditar pelo microfone do teclado."). Botão "Entender". Aviso curto sob a caixa (texto provisório, Thiago aprova antes de ir para produção): "O texto é lido por uma IA (Anthropic) para organizar o relatório. Não escreva dados pessoais de terceiros." Limite: 8.000 caracteres.

Sem internet: guardar o texto no aparelho (padrão de `fila-offline.ts`, chave própria) e mostrar "Guardado. Vai ser interpretado quando você tiver internet". Ao reabrir com internet, mostrar faixa "Você tem um relato para enviar" em `/patio/hoje` e no relatório. Nada é interpretado em segundo plano; a pessoa precisa abrir a tela de conferência.

### 5b. Rota de API (servidor)
`src/app/api/relato-turno/interpretar/route.ts` (conferir convenção de route handler do Next 16 na documentação local).
- Autenticar: sessão Supabase válida e `papel_atual() is not null`; senão 401.
- Entrada: `{ relatorio_turno_id, texto }`. Carregar do banco, com a sessão da pessoa: o relatório (data, turno), os itens do checklist (id + descrição), lojas ativas (`parceiros`), caixas ativas (número), canteiros ativos (id, número, nome, tipo, local), culturas (id, nome), tipos de carrinho ativos.
- Chamar a API da Anthropic por `fetch` (sem SDK novo), modelo Haiku. **Verificar antes de implementar** o identificador atual do modelo na documentação da Anthropic (esperado `claude-haiku-5-5`); não fixar de memória. Saída estruturada por tool use com o esquema da 5c. `temperature` baixa.
- Gravar `relatos_turno` e uma linha em `relatos_ia_log` (tokens). Devolver o JSON interpretado (ainda não criar propostas; quem cria é a confirmação da pessoa, 5d).
- Erros da API: mensagem simples e o texto continua na tela; nunca perder o que a pessoa colou.

### 5c. Regras da interpretação (valem no prompt e nas validações do servidor)
O modelo devolve uma lista de itens. Cada item tem `tipo`, `campos`, `campos_status` por campo (`certo` | `inferido` | `faltando`), `trecho_origem` e `avisos`.

Tipos:
- `checklist`: atividade de rotina (rega, limpeza, ronda, organização, peneiração, troca de água etc.). Casa com um `item_planejado_id` quando houver correspondência clara; senão vira item extra. Não gera proposta de registro.
- `compostagem`: `parceiro_id` (loja), `qtd_bombonas`, `peso_total_kg`, `caixas` (lista de números), `peso_por_caixa` quando informado, `bombonas` (números e pesos) quando informados.
- `plantio`: `cultura` (id ou nome não encontrado), `canteiro_id`, `quantidade`, `unidade` (muda, fileira, cova...).
- `colheita`: `cultura`, `peso_kg` (aceitar "0,200 kg", "700 g"; converter g para kg), `canteiro_id`/`plantio_id`.
- `manejo`: `acao` (composto, poda triturada, poda de planta), `canteiro_id`s, `quantidade_carrinhos`, `tipo_carrinho_id`, e para poda de planta a `cultura`.
- `doacao`: `cultura`, `quantidade` + `unidade` (padrão kg), `destino` (texto livre, opcional), `registro_colheita_id` quando identificável, `natureza` (`alimento` | `muda`). Só `alimento` vira proposta (nasce com foto pendente). Se o texto disser "muda(s)", `natureza = muda`: vira item extra do checklist com aviso "doação de muda: registrar pelo fluxo de doação de muda (precisa do plantio)". Sem a palavra muda, assumir `alimento` com `natureza` marcada `inferido` (a coordenadora confirma).
- `ronda`: texto livre; o aviso sugere "pode virar ocorrência". Não criar ocorrência automática.

Regras duras:
1. **Nunca inventar** local, quantidade, nome ou data. Não está no texto = `null` e `faltando`.
2. `inferido` só quando o texto sugere com força (ex.: plantio citado logo depois de "limpeza do canteiro 3" sem outro local). Sempre `inferido`, nunca `certo`.
3. Ids só de listas fornecidas. Nome que não existe na lista de culturas = devolver o nome cru e `faltando` (a tela oferece "Cadastrar '<nome>'" pelo fluxo de cultura mínima com `revisar = true`).
4. Equipe e nomes de pessoas no texto: ignorar. A equipe vem do ponto.
5. Datas no texto: se diferirem da data do relatório, `avisos` com "O texto fala de DD/MM, este turno é DD/MM". Não mudar a data.
6. **Conferir contas no servidor, não no modelo:** soma dos pesos citados × total escrito (tolerância 0,05 kg). Divergência = aviso "soma X kg, total escrito Y kg" e o campo de peso vira `faltando` até a pessoa escolher.
7. Unidades que não são contagem de planta (fileira, cova) ficam como estão; não converter em número de mudas.
8. Carrinho sem tipo: usar o Carrinho azul e `tipo_carrinho_assumido = true`. Calcular peso com a função existente de `src/lib/carrinhos.ts`.
9. "Poda triturada na caixa" (compostagem) não entra no registro (decisão de 10/2026). Poda triturada em canteiro entra como manejo.
10. Locais por apelido (Ilha, Pergolado, Geodésica) só casam com canteiro quando houver um único canteiro de `tipo`/nome correspondente; senão `faltando`.

### 5d. Tela "Entendi isto" (conferência da pessoa)
Três blocos, nesta ordem: **Pronto** (tudo `certo`), **Confira** (tem `inferido`), **Falta informação** (tem `faltando`). Cada cartão mostra o trecho original, os campos com selo, e para cada campo faltante um botão de toque que abre chips (canteiros numerados com os recentes primeiro; caixas; lojas; culturas). No máximo 3 perguntas visíveis por vez; as demais ficam como estão. Botões: "Enviar" (sempre ativo) e "Voltar e editar o texto". Pular é permitido.

Ao enviar:
- Itens `checklist`: marcar `feito = true` no `relatorio_turno_itens` (criar `origem = 'extra'` quando não houver item planejado correspondente).
- Demais itens: inserir em `relato_turno_propostas` com `status = 'pendente'`.
- Atualizar `relatos_ia_log.aceito_sem_edicao` (true se a pessoa não mudou nenhum campo).
- Mensagem final: "Enviado. A coordenação vai conferir."

## 6. Item B4 — Fila "Para conferir" (coordenação e consultor)

Rota `/patio/conferir`, acesso só coordenacao/consultor.

- Duas seções: **Relatos do turno** (propostas pendentes, agrupadas por relatório: data, turno, equipe do ponto, "relatado por X") e **Culturas novas** (as de `culturas.revisar = true`, reaproveitando o fluxo da A.1 seção 9b item 5).
- Cartão de proposta: trecho original, campos com selo, avisos. Ações: **Aprovar** (habilitado quando nenhum campo obrigatório está `faltando`), **Editar** (mesmos chips de 5d, dentro do cartão), **Rejeitar** (motivo curto). Botão "Aprovar tudo que está completo" no topo de cada relatório.
- Campos obrigatórios por tipo para aprovar: compostagem (loja, peso total, ao menos 1 caixa), plantio (cultura, canteiro, quantidade), colheita (cultura, peso, plantio), manejo (canteiro(s), quantidade de carrinhos ou ação com planta), doação (cultura e quantidade; o destino é opcional e a foto fica pendente).
- Aprovar chama as funções que já existem para criar o registro oficial (compostagem: `registrar_alimentacao_por_loja`; plantio, colheita e manejo: as libs atuais de `plantios.ts`/`patio.ts`; doação: `criarDoacaoAlimento` em `venda.ts`, adaptada para foto pendente, seção 4b), grava `tabela_registro_gerado`, `registro_id_gerado`, `conferido_por`, `conferido_em` e `status = 'aprovada'`. Se a criação falhar, a proposta continua pendente e mostra o erro.
- **Colheita exige `plantio_id` (regra central do módulo).** Se a cultura tiver exatamente um plantio ativo no canteiro, sugerir (`inferido`); se houver vários, a coordenadora escolhe. Nunca aprovar colheita sem plantio.
- Selo de idade: proposta pendente há mais de 3 dias aparece em vermelho. Sem escalonamento além disso.
- A pessoa que relatou vê o status das suas propostas (pendente, aprovada, rejeitada com motivo) no relatório do turno.

## 7. Item B5 — Lançar a semana (escala + planejamento), só coordenação e consultor

Rota `/patio/agenda/lancar-semana`, acesso só `coordenacao`/`consultor`, com link a partir de `/patio/agenda` e de `/patio/agenda/planejamento-semanal`.

**Entrada:** seletor da semana (segunda-feira; padrão = próxima semana) e caixa de texto grande para colar a mensagem que a coordenação manda no grupo (escala + lista de atividades, como no Caso 6 do Apêndice). Botão "Entender a semana".

**Rota de API:** `src/app/api/semana/interpretar/route.ts`. Mesma autenticação, mesmo cliente da Anthropic e mesmo verificador de modelo da seção 5b (extrair para um módulo comum, por exemplo `src/lib/ia/anthropic.ts`). Contexto enviado: membros ativos (`id`, `nome`) e a segunda-feira escolhida. Registrar em `relatos_ia_log` (`modo = 'texto'`, `relatorio_turno_id` nulo).

**Saída do modelo:**
- `escala`: lista de `{ dia_semana, turno ('manha'|'tarde'), membro_id | null, nome_no_texto, tipo ('turno_trabalho') }`.
- `folgas`: lista de `{ dia_semana, membro_id | null, nome_no_texto }`.
- `atividades`: lista de `{ dia_semana, turno, descricao }`.
- `avisos`.

**Regras:**
1. **O dia da semana manda, o número do dia não.** Mapear "Segunda", "Terça-feira", "Quinta-feira (1/10)" etc. para a semana escolhida. Se o número do dia (ou o mês, ex.: "26 a 30_9") não bater com a data real desse dia da semana escolhida, aviso "o texto diz DD/MM, a semana escolhida é DD/MM". Aviso, não bloqueio.
2. "Sem expediente" em um turno = nenhuma escala e nenhuma atividade nesse turno.
3. "Folgas: Terça: Ana" → evento `folga`, `turno = dia_todo`, uma linha por pessoa.
4. Nomes: casar o primeiro nome com `membros_equipe.nome` ignorando maiúsculas e acentos, só entre membros ativos. Sem correspondência única (inclusive grafias parecidas como Tiago/Thiago) = `membro_id = null` e `faltando`; a tela pede a escolha por chips. Nunca adivinhar.
5. Separadores de nomes: vírgula e " e ".
6. Atividades: uma por marcador, texto preservado como está (remover `•`, `-`, `;` e ponto final). Manter "Possível", "Possivel" etc. Não reescrever.
7. Nada de inventar dia, turno, pessoa ou atividade.

**Tela de conferência** (sem fila, é a coordenação lançando): duas tabelas editáveis, **Escala** (dia, turno, pessoa) e **Atividades** (dia, turno, texto). Cada linha pode ser editada ou apagada. Avisos no topo. Linhas com pessoa `faltando` ficam destacadas e bloqueiam o botão "Lançar semana" até serem resolvidas ou apagadas.

**Gravação** (sem apagar nada existente):
- Escala: `criarEvento` de `src/lib/agenda.ts` (`turno_trabalho` por pessoa/dia/turno; `folga` com `dia_todo`). Pular o que já existe igual (mesmo dia, turno, pessoa e tipo).
- Atividades: `criarItemPlanejamento` de `src/lib/planejamento.ts`. Pular o que já existe igual (mesmo dia, turno e texto). Pular também (data, turno) que já tenham Relatório do Turno (regra P2 existente) e listar esses casos no resumo final.
- Resumo final: "Criei X turnos, Y folgas, Z atividades. Pulei N que já existiam e M em turnos com relatório aberto."
- **Verificar antes de implementar:** se `eventos_agenda` tem alguma restrição única que impeça dois turnos da mesma pessoa no mesmo dia, e como a Agenda hoje exibe escala por pessoa, para o resultado aparecer sem tela nova.

**Critério de pronto:** o Caso 6 do Apêndice, colado inteiro, produz a contagem esperada depois de a coordenadora resolver apenas as linhas marcadas como `faltando`.

## 8. Ordem de construção e pontos de parada

1. B2, B2b e B2c: escrever as três migrations e **parar**. Devolver ao Cowork para revisão e aplicação pelo Thiago. Em paralelo, o Thiago cria `ANTHROPIC_API_KEY` na Vercel e no `.env.local`.
2. B5 (lançar a semana). **Ponto de parada 1:** o Thiago testa com a mensagem real da próxima semana. Sem planejamento lançado o checklist do turno abre vazio, por isso esta vem antes da B1.
3. B1 (home do dia). **Ponto de parada 2:** teste no celular.
4. B3 (rota, tela de entrada, tela "Entendi isto") usando os casos 1 a 5 do Apêndice.
5. B4 (fila e aprovação, incluindo fotos pendentes). **Ponto de parada 3:** teste ponta a ponta com relatos reais.
6. Depois: retomar SPRINT_A1 (seção 9b e itens restantes).

## 9. O que o Claude Code devolve

1. Arquivos criados e alterados, por item.
2. `tsc`, `eslint`, `next build`.
3. Cada "verificar antes de implementar": o que achou e o que fez.
4. Desvios, com motivo.
5. Resultado do Apêndice: para cada caso, o que a interpretação devolveu versus o esperado.
6. Contagem real de toques: abrir app até entrada batida; marcar um item do checklist; relato de colar até enviar; lançar uma semana de colar até confirmar.
7. Pendências que dependem do Thiago (chave da Anthropic na Vercel, texto de LGPD).

## Apêndice — casos de teste (relatos reais, nomes de pessoas omitidos)

**Caso 1 (turno de 28/10, compostagem por loja):**
`Compostagem de hoje (28/10), 7 bombonas divididas em: 2 Zio: 83,67Kg / 2 Gb: 81,21Kg / 2 Yoshi: 67,09Kg / 1 Terra: 24,78Kg / Total: 256,75Kg / Alimentadas nas caixas 1 e 2 / Produzimos mudas de Tomate Cereja, Tomate Santa Clara e Alface`
Esperado: 4 propostas de compostagem (Zio 2 bombonas 83,67; Gb 2, 81,21; Yoshi 2, 67,09; Terra 1, 24,78), caixas 1 e 2 sem divisão (`faltando`, pergunta de toque), soma confere (256,75). "Produzimos mudas": item extra do checklist, sem proposta (sem quantidade nem local).

**Caso 2 (soma divergente, 23/09):**
`Compostagem 103 peso 18kg / 92 peso 29kg / 77 peso 8k (veio com bastante líquido) / 75 peso 10kg / 99 peso 35kg / Total 103kg`
Esperado: aviso "soma 100 kg, total escrito 103 kg"; peso `faltando` até a pessoa escolher; observação "veio com bastante líquido" preservada na bombona 77.

**Caso 3 (plantio, colheita, doação e ronda, sem locais):**
`Limpeza do canteiro 3. Plantio de 14 mudas de alface. Plantio de 64 mudas de couve. Plantio de 1 fileira de coentro. Plantio de 5 covas de coentro. Poda das frutíferas: Acerola; Limão; Amora; Mamão. Colheita: Salsão: 0,200 kg. Cebolinha: 0,080 kg. Pimenta: 0,300 kg. Doações: mudas de pimenta, bredo, pimenta de cheiro, cebolinho. Ronda observativa: canteiro 2 com solo bastante seco; linhas de irrigação das frutíferas muito secas.`
Esperado: "limpeza do canteiro 3" = checklist; alface: canteiro 3 `inferido`; couve e coentro: canteiro `faltando`; fileira e cova mantidas como unidade, quantidade em mudas `faltando`; colheitas com peso certo e plantio `faltando`; poda por cultura, plantio `faltando`; "mudas de pimenta" vira item extra com aviso de doação de muda; bredo, pimenta de cheiro e cebolinho viram 3 propostas de doação de alimento (natureza `inferido`, quantidade `faltando`, foto pendente); ronda como texto, com sugestão "pode virar ocorrência".

**Caso 4 (carrinhos sem tipo e sem canteiros):**
`Atualização de um canteiro. Revolvimento da terra. Aplicação de 2 carrinhos de composto e 1 carrinho de poda triturada em cada canteiro concluído. Instalação dos aspersores no canteiro. Limpeza das mudas das geodésica. Troca de água. Materiais utilizados: Pá de enxada, Carrinho de mão, Rastelo.`
Esperado: manejo com carrinhos azul (`tipo_carrinho_assumido = true`), canteiros `faltando` ("em cada canteiro concluído" não identifica quais); demais linhas viram itens extras do checklist; "Materiais utilizados" vira texto de observação, sem proposta.

**Caso 5 (checklist puro, 22/10):**
`Poda de salsão. Poda de hortelã. Poda da pimenta. Poda do capim santo. Ronda observativa. Peneiração de 1 carro de composto. Irrigação só no pergolado e no canteiro em frente, pois faltou água. Colheita de pimenta. Plantio de 2 mudas de jambu.`
Esperado: "faltou água" como motivo/observação da rega (não registrar como perda); colheita de pimenta sem peso (`faltando`); jambu 2 mudas, canteiro `faltando`.

**Caso 6 (B5, semana inteira; nomes trocados por letras, no teste usar os nomes cadastrados):**
```
Escala de 26 a 30_9
Dia 26 (Segunda)
Manhã: A, B e C
Tarde: D e E
Dia 27 (Terça)
Manhã: Sem expediente
Tarde: B, D, E e F
Dia 28 (Quarta)
Manhã: A e E
Tarde: D e C
Dia 29 (Quinta)
Manhã: Sem expediente
Tarde: B, G, D e C
Dia 30 (Sexta)
Manhã: B e A
Tarde: C, F e E
Folgas
Terca: C
Quinta: E

Segunda:
Manhã:
• Ronda observativa do pátio;
• Rega manual dos canteiros;
• Compostagem;
• Plantio e organização de um canteiro;
• Organização e limpeza dos espaços e ferramentas utilizadas.
Tarde:
• Ronda observativa do pátio;
• Rega manual dos canteiros;
• Plantio e organização de um canteiro;
• Aplicação de biofertilizante nos espaços;
• Organização e limpeza dos espaços e ferramentas utilizadas.
Terça-feira
Manhã: Sem expediente
Tarde:
• Ronda observativa do pátio;
• Rega manual dos canteiros;
• Possivel Visitação da turma de Reaproveitamento;
• Produção de mudas;
• Organização e Plantio de um canteiro;
• Organização e limpeza dos espaços e ferramentas utilizadas.
Quarta-feira
Manhã:
• Ronda observativa do pátio;
• Rega manual nos canteiros;
• Compostagem;
• Plantio e organização de um canteiro;
• Organização e limpeza dos espaços e ferramentas utilizadas.
Tarde:
• Ronda observativa do pátio;
• Rega manual;
• Organização e Plantio de um canteiro;
• Retirada de matos expontaneos das galeias;
• Organização e limpeza dos espaços e ferramentas utilizadas.
Quinta-feira
Manhã:
• Sem expediente
Tarde:
• Ronda observativa do pátio;
• Rega manual dos canteiros;
• Possivel visita do curso de Reaproveitamento;
• Organização e limpeza dos espaços e ferramentas utilizadas.
Sexta-feira
Manhã:
• Ronda observativa do pátio;
• Organização e Plantio de um canteiro;
• Compostagem;
• Organização e limpeza dos espaços e ferramentas utilizadas.
Tarde:
• Ronda observativa do pátio;
• Organização da Geodésica e retirada das folhas amareladas das uvas;
• Revirar as caixas 7 e 8;
• Rega manual dos canteiros;
• Organização e limpeza dos espaços e ferramentas utilizadas.
```
Esperado (contagem feita à mão, o Claude Code confere): **22** turnos de trabalho (seg 3+2, ter 0+4, qua 2+2, qui 0+4, sex 2+3), **2** folgas, **39** atividades (seg 5+5, ter 0+6, qua 5+5, qui 0+4, sex 4+5). Terça manhã e quinta manhã sem escala e sem atividade. Aviso de mês: o texto diz "_9" e a semana escolhida pode ser outra. Dias da semana mandam sobre os números. "Possivel Visitação" e "Possivel visita" preservados como estão. Se algum nome não casar com um membro cadastrado, a linha aparece como `faltando`.
