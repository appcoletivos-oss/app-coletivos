# Sprint B2 — Home do dia, Relato do turno com IA e Fila "Para conferir"

Escrito no Cowork em 28/10/2026 (noite), depois da entrega do B5. Continua `SPRINT_B_RELATO_DO_TURNO.md`.

**Regra de precedência:** as seções 2 (B1), 5 (B3), 6 (B4) e o Apêndice (casos 1 a 5) da SPRINT_B seguem valendo. Onde este arquivo divergir delas, **vale este**. A seção 1 da SPRINT_B (regras de trabalho) continua valendo inteira.

## 0. Estado de entrada

| Item | Estado |
|---|---|
| Migrations B2, B2b, B2c (`20261028000000`, `20261028010000`, `20261028020000`) | Revisadas no Cowork e aplicadas pelo Thiago em 28/10/2026 |
| B5 (Lançar a semana) | Construído. `tsc`, `eslint`, `next build` passam. Caso 6 contra a IA real: 22 turnos, 2 folgas, 39 atividades |
| `ANTHROPIC_API_KEY` | No `.env.local` e na Vercel (Thiago confirmou em 28/10/2026) |
| Branch | `sprint-b-relato-turno`, **nada commitado** |
| Arquivos novos do B5 | `src/lib/ia/anthropic.ts`, `src/lib/ia/sessao-servidor.ts`, `src/lib/ia/semana.ts`, `src/lib/lancar-semana.ts`, `src/app/api/semana/interpretar/route.ts`, `src/app/patio/agenda/lancar-semana/page.tsx` (e botões em `agenda/page.tsx` e `planejamento-semanal/page.tsx`) |

**Pré-condição para começar:** o Thiago ter testado o B5 pelo app (ponto de parada 1) e dito ao Cowork que passou. Se ele colar este arquivo no Claude Code, é porque passou. Se o teste do B5 tiver achado bug, corrigir o bug antes do item 1.

## 1. O que o B5 ensinou e vale daqui pra frente

1. **Reusar, não reescrever.** `chamarIAComJson` (`src/lib/ia/anthropic.ts`) e `obterSessaoDaRequisicao` (`src/lib/ia/sessao-servidor.ts`) são o cliente e a sessão de toda rota de IA. B3 usa os dois. Não criar segundo cliente.
2. **Sem `temperature`.** A API 2026-10-21 recusa. A constância vem do JSON schema (`output_config.format`) e do prompt. A seção 5b da SPRINT_B que pede "temperature baixa" fica sem efeito.
3. **A IA organiza o texto; o código casa com o cadastro.** No B5 o modelo não recebe a lista da equipe: devolve o nome como está no texto e o servidor casa (primeiro nome, sem acento, só ativos, nunca adivinha). **O B3 segue o mesmo princípio** (seção 3 abaixo). Vantagens: o modelo não inventa id, o prompt fica menor, o pós-processamento é testável sem chamar a IA.
4. **Testar o pós-processamento sem IA e depois com IA.** No B5 isso valeu: resposta montada à mão, depois chamada real. Repetir no B3 com os casos 1 a 5. Deixar o script reproduzível no repositório em `scripts/ia/` (um arquivo por rota, lê os casos, chama a IA, compara com o esperado, imprime só a conferência). O script não grava no Supabase e nunca imprime a chave.
5. **Mensagens de erro curtas e sem detalhe técnico** (`ErroIA`), detalhe só no `console.error`. Manter.
6. **Token da pessoa no cabeçalho.** O app guarda a sessão no navegador, não em cookie. Toda tela que chama rota de IA manda `Authorization: Bearer <access token>`. O servidor lê e grava como a pessoa, pela RLS. Nenhuma chave de serviço.
7. **O texto colado contém primeiros nomes da equipe.** Isso chega à Anthropic. O aviso na tela precisa dizer isso com franqueza (ver seção 3.5).

## 2. B1 — Home do dia (ajustes à SPRINT_B seção 2)

Vale a seção 2 inteira, com estes ajustes:

1. **Sem o selo "Para conferir (N)" no B1.** A rota `/patio/conferir` só existe no B4; o selo entra lá. No B1, deixar o ponto de encaixe no topo do relatório e de `/patio` comentado no código.
2. **Verificar antes de implementar** (já estava na SPRINT_B): como `src/lib/auth.ts` e o layout decidem sessão e papel; onde redirecionar sem quebrar a pré-renderização. Reportar o achado.
3. **`?voltar=` em `/patio/meu-ponto`:** aceitar só caminho que comece com `/patio/` e não contenha `//`, `\`, `:` nem `..`. Qualquer outro valor é ignorado e cai no comportamento atual.
4. **Papel `lojista`** (Leva 2) não é redirecionado para `/patio/hoje`. Mantém o comportamento atual.
5. **Critério de pronto** (igual à SPRINT_B): app fechado até "Bater entrada" = 0 toques de navegação; depois do ponto o checklist aparece sem toque extra. Contar e reportar os toques reais.

**Ponto de parada 2:** Thiago testa no celular, com internet ruim, antes de começar o item 3.

## 3. B3 — Relato do turno com IA (ajustes à SPRINT_B seção 5)

### 3.1 Divisão de trabalho entre modelo e servidor (muda a seção 5b)

O modelo recebe: o texto, a data e o turno do relatório, e a lista dos itens do checklist (`id` + descrição). **Não recebe** parceiros, caixas, canteiros, culturas nem tipos de carrinho.

O modelo devolve referências cruas, como estão no texto. O servidor resolve cada uma contra o cadastro, depois do retorno:

| Campo devolvido pelo modelo | Como o servidor resolve |
|---|---|
| `loja_no_texto` | `parceiros` ativos. Normalizar (minúsculas, sem acento, sem espaços extras). Casa se for igual ou se for prefixo/contido de exatamente um parceiro. Zero ou mais de um = `parceiro_id` nulo e `faltando`, com o nome cru preservado para a tela oferecer as lojas em chips |
| `caixas_no_texto` (números) | `caixas` ativas por número. Número inexistente = aviso, campo `faltando` |
| `canteiro_no_texto` (número, nome ou apelido) | `canteiros` ativos. Regra 10 da SPRINT_B 5c: só casa se houver exatamente um canteiro correspondente. Senão `faltando` |
| `cultura_no_texto` | `culturas` por nome normalizado, igual ou prefixo único. Sem correspondência = nome cru e `faltando` (a tela oferece "Cadastrar 'nome'" pelo fluxo de cultura mínima, `revisar = true`) |
| `tipo_carrinho_no_texto` | `tipos_carrinho` ativos. Ausente = Carrinho azul com `tipo_carrinho_assumido = true` |
| `item_planejado_id` (checklist) | O único campo que é id: o servidor confere que o id veio da lista enviada. Se não veio, vira `null` e o item é tratado como extra |

As regras duras 1 a 10 da SPRINT_B 5c continuam valendo, com estas duas verificações no servidor, nunca no modelo: soma dos pesos × total escrito (tolerância 0,05 kg) e conversão de gramas para kg.

### 3.2 Esquema de saída

Definir o JSON schema em `src/lib/ia/relato.ts`, seguindo o padrão de `src/lib/ia/semana.ts` (prompt, schema e pós-processamento no mesmo arquivo). Tipos: `checklist`, `compostagem`, `plantio`, `colheita`, `manejo`, `doacao`, `ronda`, com `campos`, `campos_status`, `trecho_origem`, `avisos` por item, como na SPRINT_B 5c.

### 3.3 Rota

`src/app/api/relato-turno/interpretar/route.ts`. Qualquer papel com `papel_atual() is not null` (equipe incluída). Entrada `{ relatorio_turno_id, texto }`, limite de 8.000 caracteres (`400` acima disso). Grava `relatos_turno` (texto como veio) e uma linha em `relatos_ia_log`. Devolve o JSON já pós-processado. **Não cria propostas**: quem cria é a confirmação da pessoa (SPRINT_B 5d).

### 3.4 Teto diário por pessoa (novo)

Antes de chamar a IA, contar as linhas de `relatos_ia_log` da própria pessoa no dia (fuso `America/Recife`). A partir de **30 chamadas no dia**, responder `429` com "Você já usou a leitura por IA muitas vezes hoje. Fale com a coordenação." Serve de freio para loop de bug e uso indevido.
**Verificar antes de implementar:** o nome real das colunas de autoria e data de `relatos_ia_log` (a migration espelho tem `registrado_por`; confirmar a coluna de data). Se a coluna de data não existir, contar pelas propostas/relatos do dia e reportar.

### 3.5 Aviso de IA na tela (texto provisório, o Thiago aprova antes de produção)

> "O texto é lido por uma IA (Anthropic) para organizar o relatório. Os primeiros nomes de quem aparece no texto também são lidos. Não escreva documentos, endereços ou dados pessoais de terceiros."

Mesma ideia, ajustada, no Lançar a semana (hoje o aviso de lá não menciona os nomes da equipe; ajustar o texto lá também e reportar).

### 3.6 Offline

Como na SPRINT_B 5a: o texto fica guardado no aparelho (padrão de `fila-offline.ts`, chave própria), e nada é interpretado em segundo plano. Ao voltar a internet, a faixa "Você tem um relato para enviar" leva à tela de conferência. **Se a chamada à IA falhar por rede ou por erro da IA, o texto colado nunca pode se perder.**

### 3.7 Conferência "Entendi isto"

Como na SPRINT_B 5d. Um ajuste: no máximo 3 perguntas visíveis por vez, ordenadas por impacto (primeiro o que bloqueia aprovação na seção 4: peso total, loja, plantio, canteiro). As demais ficam `faltando` para a coordenação.

**Critério de pronto do B3:** Casos 1 a 5 do Apêndice da SPRINT_B, contra a IA real, com o resultado de cada caso comparado com o esperado.

**Ponto de parada 3:** Thiago testa o relato com um texto real dele antes do B4.

## 4. B4 — Fila "Para conferir" (ajustes à SPRINT_B seção 6)

1. **Selo "Para conferir (N)"** entra aqui (topo do relatório e de `/patio`), contando propostas pendentes + culturas com `revisar = true`.
2. **Aprovar sem duplicar.** Dois toques seguidos, ou duas coordenadoras ao mesmo tempo, não podem criar dois registros. Fluxo: (a) reivindicar a proposta com `update ... set status = 'aprovada', conferido_por, conferido_em where id = :id and status = 'pendente'` e exigir que volte 1 linha; (b) criar o registro oficial; (c) gravar `tabela_registro_gerado` e `registro_id_gerado`; (d) se (b) falhar, devolver a proposta para `pendente` e mostrar o erro. **Verificar antes de implementar:** o que o gatilho `relato_proposta_imutaveis` deixa mudar e quando (a reivindicação e a devolução têm que passar por ele). Se o gatilho impedir a devolução, reportar e propor o ajuste em migration, sem aplicar.
3. **Autoaprovação permitida, mas visível.** Quem relatou pode aprovar a própria proposta se for coordenação ou consultor (útil quando só uma coordenadora está no turno). A fila mostra "autoaprovada" (quando `conferido_por = criado_por`), com um filtro para ver só esses casos. Sem mudança de banco.
4. **Colheita sem `plantio_id` nunca aprova** (regra central do módulo), como na SPRINT_B.
5. **Fotos de doação pendentes** na fila: seção própria, como na SPRINT_B 4b e 6.
6. **A pessoa que relatou vê o status** das próprias propostas (pendente, aprovada, rejeitada com motivo) no relatório do turno.
7. **Registro oficial criado na aprovação** tem a coordenadora como `registrado_por` (limite da RLS). A tela do registro e a da fila mostram "Relatado por X, conferido por Y", lendo de `relato_turno_propostas.criado_por`.

**Ponto de parada 4:** teste ponta a ponta com relatos reais (equipe relata, coordenação aprova, conferir saldo/Mapa/totais).

## 5. Ordem e pontos de parada

1. B1 → **parada 2** (celular).
2. B3 → **parada 3** (relato real do Thiago).
3. B4 → **parada 4** (ponta a ponta).
4. Depois: retomar `SPRINT_A1_MENOS_TOQUES.md` (seção 9b e itens restantes). A migration `20261002010000_correcao_anulacao_registros.sql` continua com status a confirmar; o Thiago roda a verificação antes.

Em cada parada: `tsc`, `eslint`, `next build`, e entregar o relatório da seção 6.

## 6. O que o Claude Code devolve em cada parada

1. Arquivos criados e alterados.
2. `tsc`, `eslint`, `next build`.
3. Cada "verificar antes de implementar": achado e decisão.
4. Desvios, com motivo.
5. Resultado dos casos de teste: esperado × obtido, com o script de `scripts/ia/`.
6. Contagem real de toques (para B1 e B3).
7. Pendências que dependem do Thiago.

Não fazer commit, push, `npm install` fora do que a tarefa exige, nem aplicar SQL. Migrations novas: criar o arquivo e devolver ao Cowork.

## 7. Fora do escopo desta sprint

- Voz nativa (Whisper/`OPENAI_API_KEY`): fora, decisão de 28/10/2026.
- Doação de muda pelo relato.
- Correção e anulação na interface (A.1 itens 3 e 4) e demais itens da A.1.
- Federação de identidade (WIF) da Anthropic: decidido manter chave de API por enquanto. A rota de IA fica isolada em `src/lib/ia/anthropic.ts`, então trocar depois mexe só nesse arquivo.
