# App Coletivo — Registro Geral do Projeto

> Este documento é a fonte de continuidade do projeto. Deve ser consultado no início de cada nova tarefa/sessão e atualizado ao final de sessões relevantes (ou sempre que pedido "salvar progresso"). Mantenha-o no Project Knowledge do Projeto.

> **Nome oficial do produto: "App Coletivo", no singular (atualizado 2026-08-20).** Vale só como nome de exibição — o usuário decidiu explicitamente **não** renomear os identificadores técnicos já existentes: e-mail `appcoletivos@gmail.com`, usuário GitHub `appcoletivos-oss`, repositório `app-coletivos` e pasta local `Claude\Projects\app-coletivos` continuam no plural, e é assim que devem ficar. Curiosidade: o projeto na Vercel, por coincidência, já nasceu com o nome `app-coletivo` (singular) — não é uma inconsistência a corrigir, os dois convivem bem.

---

## 1. Status geral

- **Última atualização:** 2026-08-21
- **Fase atual:** Infraestrutura completa — código publicado no GitHub, projeto Supabase real conectado, projeto Vercel real no ar. **Estrutura de telas do Módulo 1 100% fechada** (rodada 7). Em código: Compostagem → Registrar alimentação (fluxo de 6 passos) e a **tela de Cadastro completa** (Parceiros, Canteiros, Caixas, Equipe + convite por link), construída na sessão C. Falta aplicar as migrations no Supabase real, commitar o código novo, e detalhar/construir as demais telas.
- **Módulo em foco:** Módulo 1 — Pátio de Compostagem
- **Resumo do momento atual:** Stack confirmada e infraestrutura toda criada: GitHub (`appcoletivos-oss/app-coletivos`), Supabase (projeto real, `.env.local` configurado) e Vercel (`app-coletivo.vercel.app`, no ar). Nome de exibição "App Coletivo" (singular); identificadores técnicos seguem no plural por decisão do usuário. Uma sessão anterior do Claude editou o arquivo de wireframe diretamente na pasta local do projeto (`Arquivos extras\wireframe_modulo1.html`), produzindo a **rodada 7**, mas sem atualizar o Registro Geral nem publicá-la como artefato — por isso esta sessão só ficou sabendo ao ler o arquivo local (ver nota de continuidade abaixo). A rodada 7 resolveu as duas últimas perguntas em aberto: (1) a convenção de pastas do Drive foi **corrigida** — nível 1 é "Mês/Ano" por extenso (ex.: "Agosto/26"), nível 2 é "dia_mês" (ex.: "20/8"); (2) "Registrar ocorrência atípica" foi confirmado como **exceção** à regra "Mais = só coordenação". Na sessão B, além de sincronizar essas decisões aqui, foi feita a **primeira tela detalhada**: Compostagem → Registrar alimentação, desenhada como fluxo de 6 passos, e implementado o schema base do banco (`parceiros`/`caixas`/`canteiros`/`registros_alimentacao`). Na **sessão C (Claude Code, 2026-08-21)**: confirmado que a suposta anomalia de git já estava corrigida (commit `702daf2`, já em `origin/main`); e construída em código a **tela de Cadastro completa** (`/patio/mais/cadastro`), com 4 abas — Parceiros, Canteiros, Caixas e Equipe (esta última nova, com tabela `membros_equipe` e fluxo de convite por link, `/convite/[token]`). Falta: usuário aplicar as migrations no Supabase real e commitar o código novo.

> **Nota de continuidade importante (2026-08-21):** sessões do Claude não compartilham memória automaticamente entre si — só compartilham o que está escrito no Project Knowledge (este documento e os outros docs do projeto) ou em arquivos na pasta local do usuário, quando conectada. A sessão que fez a rodada 7 editou o arquivo local via a ponte com o computador do usuário, mas **não atualizou este Registro Geral** — por isso a sessão seguinte (que só lê o Project Knowledge no início) não sabia da rodada 7 até o usuário pedir explicitamente pra ler o arquivo. Lição registrada: sempre que uma sessão mexer em arquivos locais relevantes ao projeto, ela deveria também atualizar este Registro Geral no mesmo momento — não fez isso aqui. Daqui pra frente, vale considerar como prática: no início de qualquer sessão, além de ler o Registro Geral, também checar se há arquivos mais novos na pasta do projeto que ele ainda não reflete.

> **Ajuste de tela (2026-08-21):** a pedido do usuário, dois pequenos acertos em Compostagem → Registrar alimentação: (1) o título da tela e os textos relacionados passaram de "Registrar alimentação" para **"Registrar compostagem"** (título, mensagem de sucesso e botão "Registrar outra compostagem"), no arquivo `src/app/patio/compostagem/registrar-alimentacao/page.tsx`, e o rótulo correspondente no hub `src/app/patio/compostagem/page.tsx`; (2) o ícone de "Caixa" era o emoji 📦 (caixa de papelão) — objeto diferente do real. Substituído por um SVG próprio (`src/components/icone-caixa-dagua.tsx`), representando uma caixa d'água azul-padrão de 1000L (tampa, aro e corpo cilíndrico), usado na barra de contexto do fluxo de registro e no ícone "Ver caixas" do hub. Editado diretamente no arquivo local via ponte com o computador do usuário e verificado com checagem de sintaxe TypeScript; **ainda não commitado** — segue junto com o restante do código pendente (Cadastro/Equipe da sessão C).

---

## 2. Módulo 1 — Pátio de Compostagem (contexto fixo do caso real)

- Local: pátio de compostagem dentro de shopping center
- Volume: ~4,45 t/mês de resíduos orgânicos, de 5 restaurantes + 1 construtora vinculada
- Método: caixas d'água de 1000L (~620kg cada). A planilha real lista **26 caixas** (Caixa 1 a Caixa 26) — 18 já operando, 4 "Não ativadas" (19–22) e mais 4 novas (23–26).
- Área agroecológica compartilhada: ~700m² de produção de hortaliças, ervas, frutas e raízes
- Destinos da produção: doação a uma ZEIS (alimentos, composto sólido, biofertilizante); futuramente, feira de comercialização organizada pelo shopping
- Equipe: 4 coordenadoras (compostagem, plantio, feira, gestão) + 1 consultor + 5 funcionárias
- Orçamento: ~R$150 mil/ano (custeado pelo shopping)
- Contrapartidas contratuais: oficinas, mutirões e visitas guiadas para público externo

### Levantamento operacional (discovery, 2026-08-20)
- **Quem usa / dispositivos:** as 5 funcionárias e as coordenadoras, em celulares pessoais diversos (Android e iPhone misturados) — não há aparelho corporativo padronizado. Existe também um terceiro tipo de usuário, o **lojista** (funcionário dos restaurantes parceiros), que acessa o mesmo app/PWA com visão restrita: tela de controle de bombonas da própria loja + relatório geral da própria loja (com mensagem de impacto, ver abaixo).
- **Conectividade real no pátio:** depende de 4G; existem áreas com pouco sinal dentro do próprio pátio. Não há wifi confiável disponível o tempo todo.
- **Registros hoje (pré-app):** planilha (financeiro e diversas atividades), caderno físico, grupo de WhatsApp, e 3 Google Forms (bombonas, atividades diárias "Alvorada Sustentável", plantio/colheita). Controle de ponto **não existe hoje em nenhum formato** — é uma funcionalidade nova, não uma migração.
- **Maior dor / prioridade percebida:** facilitar o monitoramento e a automação das atividades previsíveis e mecânicas (rotinas do ciclo produtivo), sempre considerando acessibilidade (baixo letramento/familiaridade com tecnologia da equipe).

### O que a planilha real de monitoramento da Compostagem revelou

Documento completo em `claude/resumo-planilha-monitoramento-compostagem.md` (Project Knowledge). Principais achados:

- Campos mínimos de um registro de "alimentação" (entrega de resíduo numa caixa): quem registrou, data, origem do resíduo (loja/restaurante parceiro), destino (caixa), peso, temperatura, observações, tipo de resíduo. 1.027 registros históricos. **Também precisa de campo de foto** (achado da rodada 3).
- Aba de controle por caixa (status atual, peso acumulado, data da última alimentação). Há uma aba paralela de "leira" — **esclarecido: leiras de compostagem foram desativadas; hoje só caixas d'água.** Dados de leira na planilha são histórico do método antigo (2023-2024), não um conceito ativo. **Decisão de modelagem: "unidade de compostagem" do Módulo 1 é só "caixa".**
- Produção de adubo (líquido/sólido) já tem controle próprio na planilha (61 registros). **Adubo não é mais bloco próprio na tela inicial — vive dentro de Compostagem.**
- Análise sensorial (visão/olfato/tato por caixa) e controle de água/energia (irrigação, jato, trator) — funcionalidades não mapeadas antes, achadas na planilha.
- Peso por loja/parceiro de origem é rastreado — base do **relatório da própria loja** que o lojista vê no app, incluindo a mensagem de impacto (ver abaixo).

### A Horta é muito maior do que se sabia (2 planilhas novas)

O usuário adicionou 2 planilhas novas na pasta "Arquivos extras" (ver seção 5):

- **`Tabela de monitoração de cultivo.xlsx`** — modelo para preenchimento manual in loco do ciclo completo por espécie: `Cultura`, `Data de Germinação`, `Quantidade Germinada`, `Taxa de sucesso`, `Data de Transplante`, `Quantidade Plantada`, `Quantidade doada`, `Quantidade Perdida`, `Taxa de Aproveitamento`, `Setor Plantado`, `Área Cultivada (m²)`, `Manejo Programado`, `Previsão de Colheita`, `Primeira colheita`, `Quantidade Colhida (Total)`, `Observações sobre o Cultivo`.
- **`Tabela de Plantio e Colheita - Patio Alvorada.xlsx`** — histórico real e ativamente usado: **637 registros de colheita, 69 espécies diferentes**, de **set/2023 a jun/2025**, com peso colhido por evento, data de plantio e local (canteiro). Aba de totais mensais colhidos (kg/mês).
- **Conclusão:** a suposição anterior (colheita pouco usada) estava errada. **Decisão: Horta vira bloco de primeiro nível com a mesma complexidade de Compostagem.**
- **Terminologia resolvida:** a coluna "Local (leira)" da planilha de Horta usava "leira" para canteiro/fileira de plantio — sentido diferente e sem relação com a leira de compostagem (desativada). **Decisão do usuário: em todo o app, esse conceito passa a se chamar "Canteiro".**
- **Manejo ganha item próprio:** o campo "Manejo Programado" do ciclo de cultivo virou pouco — o usuário pediu uma parte dedicada dentro de Horta para registrar manejo (capina seletiva, adubação, poda, raleamento etc.) como atividade recorrente por canteiro, não só um campo dentro de um registro maior de cultivo.

### Formulários reais do Pátio (conteúdo obtido em 2026-08-20)

Três links de Google Forms foram enviados pelo usuário. Um foi consultado com sucesso via ferramenta; os outros dois retornaram erro 401 (exigem login com conta Google específica) e o usuário colou o conteúdo diretamente na conversa.

**1. "Controle das Bombonas"** (consultado com sucesso) — controle de higiene/prazo dos contêineres que levam resíduo das lojas até o pátio. Campos: nome da loja, número da bombona, data de entrega, data de devolução, bombona higienizada (sim/não), tampa fechada corretamente (sim/não), adesivo de identificação presente (sim/não), odor (escala de 5 pontos), "foi preenchida corretamente?" (campo exclusivo da equipe do pátio), observações, responsável pela entrega/coleta.
**Confirmado pelo usuário:** é preenchido por lojistas E pela equipe do pátio → lojista é oficialmente o 3º tipo de usuário do app, com tela própria de controle e relatório da própria loja.

**2. "Projeto Chié - Alvorada Sustentável"** (conteúdo colado pelo usuário) — formulário de registro de atividade diária, preenchido logo após a atividade. Campos: `Data`, `Turno` (Manhã / Tarde / Dia todo — múltipla escolha), `Quem participou das atividades do dia?` (checklist com 10 nomes reais da equipe + campo "Outro" — **dado pessoal, ver nota de cuidado abaixo**), `Relatório Detalhado` (texto livre — atividades realizadas, horário, quem estava, peso, o que foi plantado/colhido, pragas, problemas e soluções), `Fotos da produção` (upload de até 5 arquivos, até 1GB cada). O formulário registra automaticamente nome/foto/e-mail da Conta Google de quem envia.
**Achado importante:** confirma o conceito de **turno** e traz **evidência fotográfica obrigatória** — usada depois pela coordenação para relatório. **Decisão:** essas fotos alimentam um relatório curado (dentro de "Mais → Relatórios") **e também** ficam acessíveis por inteiro (mesmo as que não entram em nenhum relatório formal) através de um link facilitado para o **Drive do próprio coletivo** — em vez de o app precisar construir e manter um banco de imagens próprio.

**3. Formulário de plantio/colheita** (descrito pelo usuário, não colado literalmente) — mais simples: data/hora, mesmos nomes da equipe, divisão por turno, estrutura parecida com o formulário acima. O usuário confirma que a planilha `Tabela de monitoração de cultivo.xlsx` já é bem mais detalhada que esse formulário — o modelo de dados do app deve mirar a riqueza da planilha, não a simplicidade do formulário.

> **Nota de cuidado (LGPD):** os nomes reais da equipe (10 pessoas, coletados do formulário "Alvorada Sustentável") são dado pessoal. Por ora não estão listados individualmente neste documento — se for necessário usá-los para popular dados de teste/demonstração do app, tratar com o mesmo cuidado já previsto para o controle de ponto via GPS, e confirmar com o usuário antes de registrar a lista completa em qualquer lugar fora do controle interno do coletivo.

### Drive do coletivo: link real e convenção de pastas (confirmada na rodada 7)

**Mecânica confirmada:** upload automático das fotos para o Drive do coletivo, a partir de um link de pasta.

**Link real fornecido pelo usuário para este piloto** (ver também seção 5): https://drive.google.com/drive/folders/1lqgSU6jhbVDPEmgK8kOzMtahcXgCqAni?usp=sharing

**Convenção de organização da pasta — formato definitivo (corrigido na rodada 7, 2026-08-21):**
- Nível 1 — pasta por **Mês/Ano, por extenso**, ex.: `Agosto/26`.
- Nível 2 — dentro do mês, subpasta por **dia_mês**, ex.: `20/8`.
- Isso **substitui** a leitura abreviada registrada na rodada 6 (`08_26` / `01_08`), que tinha sido uma interpretação da instrução do usuário e ficou marcada como "a confirmar" — o próprio usuário corrigiu no arquivo de wireframe.

**Importante — decisão de produto para o futuro:** o link acima é só para configurar o piloto agora. **No app já pronto, esse link deve poder ser configurado pela própria equipe do coletivo** (uma tela de configurações, não um valor fixo no código) — para que o coletivo consiga trocar de pasta/Drive sem depender de ninguém mexer no código.

### Princípio: Agenda gera pendência de registro (confirmado e ampliado)

Decisão de arquitetura/UX: a Agenda não é uma lista solta de compromissos. Quando algo é programado nela — por exemplo, manejo no Canteiro 8 no dia 25/08 — o app cria automaticamente uma **pendência vinculada à tela de registro daquela atividade**, pronta para ser preenchida no dia marcado. Reduz o esforço de "lembrar o que fazer" e "achar a tela certa": a pessoa só confirma/preenche o que já estava programado.

**Escopo confirmado:** vale desde o início para:
- todas as atividades de equipe programadas em **Horta e/ou Compostagem** (manejo, colheita prevista, alimentação programada etc.);
- **mutirões, oficinas e visitas** (contrapartidas contratuais com o shopping) — também exigem registro depois.

No futuro pode se estender a Meu Ponto (turno programado). Detalhe técnico de modelagem no banco (como o registro referencia o evento de origem) é trabalho de implementação, não pergunta de produto em aberto.

### Relatório do lojista: mensagem de impacto

O relatório da própria loja (que o lojista acessa no app) ganha um dado calculado, não só bruto: **quanto do resíduo fornecido por aquela loja específica virou composto**, com uma mensagem de impacto pronta, por exemplo:

> "Sua loja contribuiu com **142 kg** de resíduo este mês. Isso ajudou a gerar aproximadamente **38 kg** de composto sólido e **15 L** de biofertilizante líquido, usados na produção agroecológica de alimentos aqui na cidade — 142 kg que deixaram de ir pro aterro."

**Lógica do cálculo (aproximada, por proporção de peso — confirmada como aceitável pelo usuário, não precisa ser um balanço de massa exato):**
`composto atribuído à loja ≈ (peso da loja no período ÷ peso total recebido de todas as lojas no período) × produção total de composto sólido/líquido no mesmo período`

Isso é possível porque a planilha real já rastreia peso por loja/parceiro de origem (seção acima) e a produção de adubo líquido/sólido também já tem registro próprio. É um cálculo de storytelling/transparência para o lojista, não uma métrica contábil de precisão.

### Registrar ocorrência atípica — exceção confirmada dentro de "Mais" (rodada 7)

O usuário pediu (rodada 6) um campo dentro de "Mais" para relatar e registrar **ocorrências atípicas** — eventos fora da rotina normal (problemas, imprevistos etc.), também com suporte a foto. A foto de uma ocorrência vai para o mesmo link do Drive do coletivo, usando o **título do relato** como identificação do arquivo/pasta da ocorrência.

**Resolvido na rodada 7 (2026-08-21):** "Registrar ocorrência atípica" é **exceção confirmada** à regra "Mais = só coordenação" — qualquer funcionária pode relatar uma ocorrência que presenciou, mesmo sem acesso ao resto do bloco "Mais". Isso não é mais uma pergunta em aberto; passa a ser regra de acesso a implementar (ver seção 4).

### 2.1 Estrutura de telas / wireframe — Módulo 1 (rodada 7, 2026-08-21 — estrutura 100% fechada)

Sete rodadas de wireframe estático de baixa fidelidade (sem interação, ícones tipo emoji) até agora. As seis primeiras foram feitas em sessão de Cowork (publicado/atualizado como artefato, id `app-coletivo-wireframe-modulo1-patio`); a **rodada 7** foi feita pelo usuário diretamente no arquivo local `Arquivos extras\wireframe_modulo1.html` — este documento foi atualizado a partir da leitura desse arquivo. **A estrutura está 100% fechada** — não há mais perguntas de estrutura em aberto; as próximas rodadas devem detalhar telas específicas.

**Estrutura final da tela inicial do módulo Pátio** — 6 blocos grandes, ícone + 1 palavra, sempre visíveis, sem menu "hambúrguer":

1. 🌱 **Compostagem** — ver caixas, registrar alimentação (📷 com foto), registrar adubo (líq./sólido), análise sensorial, água e energia, controle de bombonas (🏪 tela própria do lojista), relatório da própria loja (🏪 lojista, com mensagem de impacto)
2. 🌻 **Horta** — cultivo (germinação → transplante), plantio por **canteiro**, **manejo** (capina seletiva, adubação, poda), registrar colheita (📷 com foto), perdas/aproveitamento
3. ⏰ **Meu Ponto** — bater ponto (dado sensível — GPS, LGPD)
4. 📅 **Agenda** — atividades da equipe (Horta/Compostagem — geram pendência), folgas e férias, mutirões/oficinas/visitas (geram pendência)
5. 📦 **Venda** — registrar doação (alimento/adubo) hoje; planejamento da feira no futuro
6. ⚙️ **Mais** (**majoritariamente restrito a coordenação, com uma exceção confirmada**) — avisos ao shopping, financeiro, relatórios ESG/ODS (inclui fotos curadas), arquivo de fotos (link pro Drive do coletivo) são exclusivos de coordenação; **registrar ocorrência atípica é aberto a qualquer funcionária**

**Regra de acesso por papel, definitiva:** o bloco "Mais" é majoritariamente exclusivo de coordenação, com uma única exceção confirmada — Registrar ocorrência atípica, aberta a qualquer funcionária. Tudo o mais (Compostagem, Horta, Meu Ponto próprio, Agenda, Venda) é visível normalmente para funcionária. Lojista vê só suas 2 telas (bombonas da loja + relatório da loja).

**Evolução por rodada:**
- **Rodada 1:** estrutura inicial de 6 blocos (Compostagem, Adubo, Horta, Meu Ponto, Agenda, Mais).
- **Rodada 2:** Adubo entra em Compostagem; bloco Venda criado; Horta promovida a bloco de primeira grandeza; acesso por papel confirmado; login com múltiplas opções decidido.
- **Rodada 3:** lojista como 3º tipo de usuário; terminologia "Canteiro"; evidência fotográfica identificada como requisito transversal; turno e roteiro real de equipe descobertos.
- **Rodada 4:** lojista ganha tela própria + relatório da loja; fotos viram relatório curado + link pro Drive do coletivo; Manejo vira item próprio em Horta; princípio de Agenda gerar pendência de registro.
- **Rodada 5 (fechamento):** acesso por papel simplificado (só "Mais"); Drive com upload automático via link da equipe; Agenda→pendência ampliado (Horta/Compostagem + mutirões/oficinas/visitas); mensagem de impacto no relatório do lojista.
- **Rodada 6:** link real do Drive registrado; convenção de pastas mês/ano + dia_mês (leitura abreviada, depois corrigida); novo item "Registrar ocorrência atípica" em "Mais" (visibilidade ainda em aberto).
- **Rodada 7 (fechamento definitivo, 2026-08-21):** convenção de pastas do Drive corrigida para formato por extenso ("Agosto/26" / "20/8"); "Registrar ocorrência atípica" confirmado como exceção aberta a qualquer funcionária. **Estrutura 100% fechada.**

**Critério de ordenação:** frequência real de uso observada nas planilhas e formulários reais (Compostagem e Horta são as rotinas mais repetidas).

**Prioridade sugerida para a próxima etapa (detalhamento de tela):** dentro de Compostagem, **Registrar alimentação** — maior volume isolado (1.027 registros), já com campo de foto. **Feito em 2026-08-21** (ver detalhamento completo logo abaixo).

### Registrar alimentação — tela detalhada (2026-08-21)

Desenhada como fluxo de **6 passos, um assunto por tela**, em vez de formulário longo — princípio de acessibilidade do projeto (poucas etapas, ícones grandes, evitar digitação quando dá para escolher visualmente). "Quem registrou" e "data" nunca são perguntados — vêm preenchidos sozinhos (login + data de hoje).

1. **Loja de origem** — grade de 6 blocos grandes (5 restaurantes + 1 construtora). Nomes ainda são placeholder (`Loja 1`...`Loja 5`, `Construtora`) — **falta confirmar os nomes reais dos 5 restaurantes parceiros com o usuário.**
2. **Caixa de destino** — grade compacta das 26 caixas reais: 18 ativas (coloridas por status ilustrativo — disponível / quase cheia), 4 "não ativadas" (19–22) e 4 novas (23–26) aparecem apagadas/não selecionáveis. Uma caixa aparece marcada como "sugerida" — **só decorativo no wireframe por enquanto**, é uma prévia de como a futura previsão de lotação das caixas (funcionalidade pendente) poderia se comportar.
3. **Peso + tipo de resíduo** — stepper grande de +/− em vez de teclado numérico; tipo de resíduo como chips (Alimento / Poda-verde / Outro orgânico).
4. **Temperatura (opcional) + foto (obrigatória)** — foto é obrigatória porque alimenta o relatório da coordenação e o Drive do coletivo; temperatura é opcional porque nem toda entrega é medida hoje na prática real.
5. **Observação (opcional)** — campo de texto livre, com opção de pular.
6. **Revisão e salvar** — resumo com cada campo editável (✏️) sem precisar refazer o fluxo inteiro, botão "Salvar registro", e aviso de que o registro fica guardado no celular e envia sozinho se estiver sem internet (reforça a resiliência offline já prevista na stack).

**Decisão de design:** fluxo passo a passo (uma pergunta por tela) escolhido em vez de formulário único — coerente com a restrição central de acessibilidade do projeto (baixo letramento/familiaridade com tecnologia da equipe). Alternativa considerada e descartada: formulário único com todos os campos na mesma tela (mais rápido de preencher para quem já tem prática, mas mais intimidador para quem não tem).

**Pendência gerada por este detalhamento:** confirmar com o usuário os nomes reais dos 5 restaurantes parceiros (hoje placeholder `Loja 1`–`Loja 5`) e da construtora vinculada. **Resolvida em parte em 2026-08-21** (ver decisão de modelagem abaixo) — os nomes continuam placeholder no banco, mas agora existe um caminho técnico pra equipe corrigi-los sem depender de código.

### Decisão de modelagem: memória histórica de parceiros e canteiros (2026-08-21)

O usuário trouxe um requisito de produto importante: o nome de uma loja parceira (e, pelo mesmo motivo, de um canteiro da Horta) precisa poder ser **editado continuamente pela própria equipe** — inclusive **trocado de verdade** quando o parceiro/canteiro físico muda (ex.: a Loja X sai do projeto, entra a Loja Y no lugar) — **sem perder a memória**: os registros feitos enquanto "X" estava vinculada precisam continuar mostrando "X", marcados no tempo, mesmo depois da troca.

Isso também vale pra Horta: canteiros não são só "fileira numerada" — no regime de permacultura do coletivo, um canteiro pode ser bombona, galeria, geodésica, canteiro no solo, entre outras formas, cada uma com sua própria forma de quantificar (litros, m², etc.), e também precisam poder ser adicionados/trocados livremente.

**Modelagem escolhida (implementada em código nesta sessão — ver seção 4B):**
- `parceiros` e `canteiros` são tabelas próprias, cada linha com um `id` fixo (uuid) — os registros de atividade sempre referenciam esse id, nunca o nome como texto solto.
- **Renomear** (corrigir "Loja 1" pra o nome real) atualiza só o campo `nome` da mesma linha — indicado para corrigir placeholder/erro de digitação.
- **Trocar de verdade** (turnover) é modelado como: marcar a linha antiga com `ativo = false` e `vinculado_ate` preenchido, e cadastrar uma linha **nova** para o parceiro/canteiro que entrou. Assim nada é sobrescrito — o histórico de quem foi quem, e quando, fica intacto.
- `ativo = false` nunca apaga a linha nem os registros que apontam pra ela — só tira das opções de novos registros.
- Canteiros ganham um campo `tipo` (canteiro_solo / bombona / galeria / geodésica / outro) e um campo de capacidade em texto livre (porque a unidade de medida muda por tipo).

**Alternativas descartadas:**
- Guardar o nome da loja como texto solto em cada registro (sem tabela própria) — descartado: não dá pra corrigir um nome digitado errado sem reescrever todo o histórico, e não dá pra saber com segurança "quais parceiros já passaram pelo projeto".
- Sobrescrever direto o nome da loja quando ela é trocada — descartado: é exatamente o comportamento que o usuário pediu para evitar (perderia a marcação no tempo).

**Confirmado (2026-08-21): a tela de Cadastro inteira — parceiros, canteiros e, agora, também Equipe (ver subseção nova abaixo) — é restrita à coordenação**, dentro do bloco "Mais". Não é uma sub-permissão fina dentro de "Mais": é a mesma regra de acesso já fechada (seção 2.1) — coordenação vê o bloco inteiro, funcionária não vê nenhuma parte do Cadastro.

**Tela de Cadastro — wireframe desenhado em 2026-08-21** (enquanto o usuário rodava os comandos de git da entrega anterior): fica dentro de "Mais" (coordenação), com duas listas (Parceiros e Canteiros), cada item com dois botões bem separados de propósito — ✏️ **corrigir nome** (mesma linha, só ajusta o texto) e 🔁 **encerrar e substituir** (marca a linha atual como encerrada e já encaminha pro cadastro do novo parceiro/canteiro que entra no lugar). A separação dos dois botões é intencional: evita que alguém "renomeie" sem querer um parceiro que já saiu do projeto, é o único jeito de garantir na prática a diferença entre correção e troca que o modelo de dados foi desenhado pra suportar. Wireframe publicado junto com o de Registrar alimentação (link na seção 5, seção 7 do arquivo). **Ainda não virou código** — é o próximo passo de desenvolvimento.

### Cadastro → Equipe: gestão de membros e convite (decisão de 2026-08-21)

O usuário pediu para ampliar o Cadastro com uma terceira aba, **Equipe**, também restrita à coordenação:

- **Adicionar/remover membro:** coordenação cadastra nome, papel (funcionária/coordenação) e contato oficial. Remover segue a mesma lógica de memória histórica de parceiros/canteiros — **desativar, não apagar** — pra manter rastreável quem registrou o quê enquanto fazia parte da equipe, mesmo depois de sair.
- **Contato oficial vinculado ao WhatsApp:** o cadastro de cada membro guarda o número, com link direto pro WhatsApp (ex.: `wa.me/55...`) pra facilitar contato da coordenação sem precisar sair do app.
- **Convite por link:** a pessoa recebe um **link direto de acesso ao app**, mas esse link só existe depois de um **pré-cadastro feito pela coordenação** (nome + papel + WhatsApp). Ou seja: a coordenação cadastra a pessoa primeiro → o app gera um link único de convite → a coordenação manda esse link manualmente (pelo próprio WhatsApp) → a pessoa abre o link, o app já reconhece quem ela é (pelo pré-cadastro) e ela só precisa concluir o próprio login (PIN/biometria/social, decisão já fechada na seção 2.1) pra vincular a conta dela ao perfil pré-cadastrado.

**Modelagem sugerida (ainda não implementada em código — fica pro Claude Code, ver pendência):** tabela `membros_equipe` com o mesmo padrão de histórico já usado em `parceiros`/`canteiros` — `id`, `nome`, `papel` (funcionaria/coordenacao), `whatsapp`, `status` (convidado/ativo/inativo), `convite_token` (único, usado uma vez), `convite_criado_em`, `convite_expira_em`, `user_id` (referência a `auth.users`, preenchida só depois que a pessoa aceita o convite e faz login pela primeira vez), `vinculado_desde`, `vinculado_ate`.

**Pendência gerada:** implementar essa tabela + a aba Equipe na tela de Cadastro + o fluxo técnico de gerar/validar o link de convite (rota específica no app que lê o token, mostra "Bem-vindo(a), [nome]" e leva direto pro login). Encaminhado para Claude Code (ver seção 6).

### Funcionalidades já definidas
- [x] Estrutura da tela inicial do módulo Pátio (100% fechada): 6 blocos — Compostagem (com Adubo, Bombonas e relatório do lojista dentro), Horta (com Manejo), Meu Ponto, Agenda, Venda, Mais (com arquivo de fotos e ocorrências atípicas) — ver seção 2.1
- [x] Acesso por papel: "Mais" é majoritariamente exclusivo de coordenação, com exceção confirmada para ocorrência atípica (aberta a qualquer funcionária); lojista só vê suas 2 telas próprias
- [x] Login: múltiplas opções acessíveis (PIN numérico, biometria/digital, login social)
- [x] Lojista acessa o mesmo app/PWA que a equipe, com visão restrita (bombonas da loja + relatório da loja)
- [x] Terminologia "Canteiro" adotada no lugar de "leira" para a Horta
- [x] Evidência fotográfica (upload de foto) é requisito de Registrar alimentação e Registrar colheita
- [x] Fotos alimentam relatório curado ("Mais → Relatórios") e também sobem automaticamente para o Drive do coletivo (link real já registrado, ver seção 5)
- [x] Convenção de pastas do Drive: Mês/Ano por extenso (ex.: "Agosto/26") no nível 1, dia_mês (ex.: "20/8") no nível 2 — formato definitivo, confirmado na rodada 7
- [x] Link do Drive será configurável pela própria equipe dentro do app (não fixo no código) — decisão de produto para versão futura
- [x] Manejo (capina seletiva, adubação, poda, raleamento) é item próprio dentro de Horta
- [x] Agenda gera pendência de registro vinculada, para atividades de Horta/Compostagem e para mutirões/oficinas/visitas
- [x] Relatório do lojista inclui mensagem de impacto (resíduo → composto sólido/líquido), calculada por proporção de peso
- [x] "Registrar ocorrência atípica" (com foto) dentro de "Mais", aberta a qualquer funcionária — decisão definitiva confirmada na rodada 7

### Funcionalidades já implementadas
- [x] **Schema base do banco** (`supabase/migrations/20260821120000_entidades_parceiros_caixas_canteiros.sql`): tabelas `parceiros`, `caixas`, `canteiros`, `registros_alimentacao`, com o desenho de memória histórica descrito acima, RLS básica (qualquer autenticado lê/escreve — papéis finos ficam para quando o login existir), bucket de Storage privado `registros-fotos`, e seed das 26 caixas reais + 6 parceiros placeholder. **Ainda não aplicada no Supabase real** — falta o usuário rodar essa migration (ver pendências).
- [x] **Tela real Compostagem → Registrar alimentação** (`src/app/patio/compostagem/registrar-alimentacao/page.tsx`): fluxo de 6 passos implementado em React/Next/Tailwind, batendo com o wireframe — loja e caixa carregadas do banco (não hardcoded), caixas inativas/novas aparecem desabilitadas, foto obrigatória, temperatura e observação opcionais, revisão editável, e fila offline em `localStorage` (`src/lib/fila-offline.ts`) que tenta reenviar sozinha quando a internet volta.
- [x] Hub `/patio/compostagem` (`src/app/patio/compostagem/page.tsx`) e tela inicial `/patio` (`src/app/patio/page.tsx`) atualizados para navegar de verdade até Registrar alimentação — os demais itens aparecem como "em breve".
- [x] Funções de acesso a dados centralizadas em `src/lib/patio.ts` (listar parceiros ativos, listar caixas, salvar registro, enviar foto) e tipos em `src/lib/types.ts`.
- [x] **Schema da Equipe** (`supabase/migrations/20260821140000_equipe.sql`): tabela `membros_equipe` (mesmo padrão de memória histórica/RLS piloto das outras tabelas) + function `buscar_convite_por_token` (security definer) pra permitir a leitura do convite por quem ainda não fez login, sem abrir a tabela inteira pra anônimo. **Também ainda não aplicada no Supabase real.**
- [x] **Tela real Cadastro** (`/patio/mais/cadastro`, dentro do hub `/patio/mais`), com 4 abas: **Parceiros** e **Canteiros** (padrão ✏️ corrigir nome vs. 🔁 encerrar e substituir, do wireframe seção 7), **Caixas** (adicionar/editar/retirar por defeito, usando o campo `status` que já existia) e **Equipe** (adicionar membro com geração automática de link de convite, editar contato, remover = desativar, botão direto de WhatsApp via `wa.me`). Funções de acesso em `src/lib/patio.ts` (parceiros/canteiros/caixas) e `src/lib/equipe.ts` (equipe).
- [x] Rota de convite `/convite/[token]` — mostra "Bem-vindo(a), [nome]" a partir do pré-cadastro; botão de concluir acesso fica desabilitado como placeholder até o login (PIN/biometria/social) existir.
- [ ] (demais telas do wireframe — preencher conforme forem construídas)

### Funcionalidades pendentes de definição/detalhamento
- [ ] Previsão de lotação das caixas d'água
- [ ] Previsão de maturação/descanso do composto
- [ ] Alerta de necessidade de novas caixas
- [ ] Ciclo completo de cultivo da Horta (germinação → transplante → previsão de colheita → colheita → perdas/doação), com upload de foto
- [ ] Manejo por canteiro (capina seletiva, adubação, poda, raleamento) como registro recorrente próprio
- [ ] Controle de ponto via GPS (com o conceito real de turno: manhã/tarde/dia todo)
- [ ] Gestão financeira
- [ ] Registro de comunicações/demandas com o shopping
- [ ] Agenda de atividades, folgas e férias da equipe — com geração de pendência de registro vinculada (Horta/Compostagem + mutirões/oficinas/visitas)
- [ ] Relatórios ESG/ODS (incluindo fotos curadas)
- [ ] Análise sensorial por caixa (visão, olfato, tato)
- [ ] Controle de água/energia (irrigação, jato, uso do trator)
- [ ] Controle de bombonas — tela própria do lojista
- [ ] Relatório da própria loja — tela própria do lojista, com mensagem de impacto (ver fórmula acima)
- [ ] Bloco "Venda": registro de doações hoje; planejamento de feira de comercialização no futuro
- [ ] Upload/evidência fotográfica como campo reutilizável em vários formulários do app, com upload automático para o Drive do coletivo
- [ ] Integração técnica com Google Drive API para o upload automático das fotos (link e convenção de pastas já definitivos — falta a implementação)
- [ ] Tela de configurações para a equipe trocar o link do Drive dentro do app (versão futura)
- [ ] Registrar ocorrência atípica — tela com foto (nome do arquivo = título do relato); implementar regra de acesso: exceção liberada a qualquer funcionária dentro de um bloco majoritariamente restrito

---

## 3. Decisões técnicas

| Data | Decisão | Motivo | Alternativas consideradas |
|------|---------|--------|----------------------------|
| 2026-08-20 | Contas do projeto administradas por uma única pessoa (Thiago) por enquanto, sem gerenciador de senhas prévio | Fase de piloto, sem equipe técnica ainda | Conta compartilhada desde já — descartada por enquanto |
| 2026-08-20 | GitHub criado via "Sign in with Google" (appcoletivos@gmail.com), sem senha própria | Simplicidade | Conta com senha própria |
| 2026-08-20 | Supabase criado via "Continue with GitHub" (OAuth) | Reduz senhas a administrar | — |
| 2026-08-20 | Vercel criado com senha própria (não via GitHub OAuth) | Cadastro já feito assim | Recriar via OAuth — descartado por ora |
| 2026-08-20 | Gerenciador de senhas ainda em aberto | Priorizar não travar o avanço | Bitwarden (opção ainda válida) |
| 2026-08-20 | **Stack confirmada:** Next.js (App Router) + TypeScript + Tailwind CSS, PWA; Supabase; Vercel; GitHub | Cobre Android+iPhone com 1 código; conectividade instável pede resiliência offline; time pequeno pede stack de baixa manutenção | React Native/Expo — descartado |
| 2026-08-20 | Resiliência offline via `experimental.useOffline` + Cache Components + Partial Prefetching (Next.js nativo) | Next.js 16 já resolve boa parte nativamente | Service worker manual — guardado como opção futura |
| 2026-08-20 | Fonte do sistema (nativa do SO) em vez de Google Fonts | Não depende de internet; simplifica build | Geist — removida |
| 2026-08-20 | Pasta local: `C:\Users\Thiago França\Claude\Projects\app-coletivos` | Padrão já usado pelo usuário | Alternativas descartadas (ver histórico) |
| 2026-08-20 | `git config` local, sem `--global` | Não afetar outros projetos na mesma máquina | `--global` — descartado |
| 2026-08-20 | Push autenticado via navegador (Git Credential Manager) | Mais simples, conta loga via Google | Personal Access Token — não necessário |
| 2026-08-20 | Nome de exibição "App Coletivo" (singular) | Pedido do usuário | Manter plural — descartado |
| 2026-08-20 | Identificadores técnicos mantidos no plural | Evitar risco de renomear repositório/remote/deploy por ganho estético | Renomear tudo — descartado pelo usuário |
| 2026-08-20 | `package.json` (`name`) → `app-coletivo` | Consistência mínima, baixo risco | — |
| 2026-08-20 | Planilha de monitoramento não anexada como binário — só resumo em markdown | Ferramenta do projeto só aceita texto | Upload manual pelo usuário, se quiser |
| 2026-08-20 | "Unidade de compostagem" = só "caixa"; leira não é entidade ativa | Leiras desativadas, uso real é só caixa | Modelar as duas — descartado |
| 2026-08-20 | Tela inicial em blocos fixos, sem menu "hambúrguer" | Acessibilidade: poucos blocos grandes, ícone + 1 palavra | Menu lateral/gaveta — descartado |
| 2026-08-20 | Wireframe em HTML estático de baixa fidelidade, publicado como artefato no Cowork | Escolha do usuário | Protótipo navegável / descrição textual — não escolhidos |
| 2026-08-20 | Adubo passa para dentro de Compostagem (não é mais bloco de primeiro nível) | É resultado direto da compostagem, não é jornada separada no dia a dia | Manter bloco próprio (rodada 1) — substituído |
| 2026-08-20 | Criado bloco "Venda" de primeiro nível (hoje doações; futuro planejamento de feira) | Antecipa necessidade futura sem redesenhar a navegação depois | Doação dentro de Compostagem/Horta separadamente — descartado, fragmentava o conceito |
| 2026-08-20 | Horta promovida a bloco de primeiro nível, mesma complexidade de Compostagem | 637 colheitas reais em 69 espécies desde 2023 — uso muito mais intenso do que se sabia | Manter Horta como bloco simples — descartado |
| 2026-08-20 | Controle de acesso por papel confirmado (funcionária / coordenação / lojista) | Pedido explícito do usuário | Todo mundo vê tudo — descartado |
| 2026-08-20 | Login com múltiplas opções acessíveis (PIN, biometria, social) | Pedido explícito do usuário — reduz barreira de entrada | Login único — descartado |
| 2026-08-20 | Lojista confirmado como 3º tipo de usuário do app | Formulário real de bombonas é preenchido por lojistas, não só pela equipe do pátio | Tratar lojista como "fora do sistema" — descartado |
| 2026-08-20 | Terminologia "Canteiro" adotada no lugar de "leira" para a Horta, em todo o app | Pedido explícito do usuário; evita confundir com a leira de compostagem (desativada) | Manter "leira" — descartado |
| 2026-08-20 | Evidência fotográfica (upload de foto) vira requisito de Registrar alimentação e Registrar colheita | Formulários reais do Pátio já exigem isso hoje, para relatório posterior da coordenação | Deixar fotos de fora do MVP — descartado |
| 2026-08-20 | Lojista ganha tela própria de controle (bombonas da loja) + relatório geral da própria loja | Pedido explícito do usuário — dá transparência ao parceiro sobre sua própria contribuição | Lojista só preenche, sem ver nada de volta — descartado |
| 2026-08-20 | Fotos de atividades alimentam um relatório curado ("Mais → Relatórios") e também ficam acessíveis por inteiro via link pro Drive do coletivo | Pedido explícito do usuário — cobre a necessidade de acesso ao "banco geral" de fotos sem precisar construir um banco de imagens próprio no app | Construir um banco de imagens/galeria própria dentro do app — descartado por ora |
| 2026-08-20 | Manejo (capina seletiva, adubação, poda, raleamento) vira item próprio dentro de Horta, não só um campo do ciclo de cultivo | Pedido explícito do usuário — Manejo é uma atividade recorrente por canteiro, com identidade própria | Deixar manejo só como campo "Manejo Programado" dentro do registro de cultivo — descartado |
| 2026-08-20 | Agenda gera pendência de registro vinculada à tela de registro correspondente | Pedido explícito do usuário — reduz esforço de lembrar/achar a tela certa | Agenda como lista solta de compromissos, sem ligação com os registros — descartado |
| 2026-08-20 | Acesso por papel simplificado: só o bloco "Mais" é exclusivo de coordenação; todo o resto é visível pra funcionária normalmente | Pedido explícito do usuário — resposta direta à pergunta de detalhe fino de acesso por papel | Restringir também partes de Meu Ponto/Venda para funcionária — descartado, mantém simples |
| 2026-08-20 | Drive do coletivo: upload automático das fotos, a partir de um link de pasta fornecido pela própria equipe | Pedido explícito do usuário | Upload manual pela pessoa depois — descartado |
| 2026-08-20 | Agenda → pendência de registro ampliado: vale desde o início pra toda atividade de equipe em Horta/Compostagem, e também para mutirões, oficinas e visitas | Pedido explícito do usuário — essas atividades (contrapartida contratual com o shopping) também exigem registro | Restringir a lógica só a Manejo/Colheita no início — descartado |
| 2026-08-20 | Relatório do lojista ganha mensagem de impacto calculada (resíduo → composto sólido/líquido), por proporção de peso, com mensagem pronta em linguagem simples | Pedido explícito do usuário — reforça a lógica de transparência e engajamento do lojista com o projeto | Mostrar só o peso bruto entregue, sem conversão pra composto — descartado |
| 2026-08-20 | Link real do Drive registrado para este piloto, com convenção de pastas mês/ano (nível 1) e dia_mês (nível 2) | Pedido explícito do usuário — organização cronológica das fotos | Estrutura de pastas livre/sem padrão — descartada, dificultaria achar fotos depois |
| 2026-08-20 | Link do Drive será configurável pela própria equipe dentro do app, não fixo no código, em versão futura | Pedido explícito do usuário — evita depender de desenvolvedor pra trocar de pasta/Drive | Link fixo hardcoded — descartado como solução definitiva (aceitável só pro piloto atual) |
| 2026-08-20 | Novo item "Registrar ocorrência atípica" (com foto) dentro de "Mais" | Pedido explícito do usuário | Não ter esse registro — descartado |
| 2026-08-21 | **Convenção de pastas do Drive corrigida:** Mês/Ano por extenso (ex.: "Agosto/26") no nível 1, dia_mês (ex.: "20/8") no nível 2 | O usuário corrigiu, no arquivo de wireframe (rodada 7), a leitura abreviada registrada na rodada 6 ("08_26"/"01_08"), que era uma interpretação a confirmar | Manter a leitura abreviada da rodada 6 — descartada, estava errada |
| 2026-08-21 | **"Registrar ocorrência atípica" confirmado como exceção** à regra "Mais = só coordenação" — aberto a qualquer funcionária | Pedido explícito do usuário (rodada 7) — qualquer pessoa pode presenciar um imprevisto em campo, não só coordenação | Manter restrito só à coordenação por estar dentro de "Mais" — descartado |
| 2026-08-21 | **Registrar alimentação** desenhada como fluxo de 6 passos (um assunto por tela), não formulário único | Coerente com a restrição central de acessibilidade do projeto (baixo letramento/familiaridade com tecnologia) | Formulário único com todos os campos juntos — descartado por ser mais intimidador pra quem tem menos prática |
| 2026-08-21 | Caixas 19–22 ("não ativadas") e 23–26 (novas, aguardando brita) aparecem desabilitadas na seleção de caixa, não somem da tela | Transparência sobre o estado real do pátio, sem deixar escolher uma caixa que não existe operacionalmente ainda | Ocultar essas caixas da lista — descartado, esconderia informação relevante da equipe |
| 2026-08-21 | `parceiros` e `canteiros` viram tabelas próprias no banco (id fixo, nome/tipo editáveis, campo `ativo` + `vinculado_desde`/`vinculado_ate`) em vez de texto solto nos registros | Pedido explícito do usuário — nomes precisam ser editáveis continuamente pela equipe sem perder a memória histórica quando um parceiro/canteiro é trocado | Guardar nome como texto direto em cada registro — descartado, perderia rastreabilidade e não permitiria corrigir nomes sem reescrever histórico |
| 2026-08-21 | Trocar um parceiro/canteiro de verdade = desativar o antigo (`ativo=false` + `vinculado_ate`) e cadastrar um novo, nunca sobrescrever a linha existente | Preserva a memória histórica: registros antigos continuam corretamente atribuídos a quem eram na época | Sobrescrever o nome da linha existente — descartado, é o comportamento que o usuário pediu para evitar |
| 2026-08-21 | Canteiro ganha campo `tipo` (canteiro_solo/bombona/galeria/geodésica/outro) e capacidade em texto livre | Regime de permacultura do coletivo usa formas diversas de plantio, cada uma com unidade de medida própria | Canteiro como conceito único sem tipo — descartado, não refletiria a realidade descrita pelo usuário |
| 2026-08-21 | RLS do piloto liberada pra qualquer usuário autenticado (leitura e escrita), sem restrição fina por papel ainda | Login/papéis (funcionária/coordenação/lojista) ainda não têm implementação técnica — não travar o avanço esperando essa peça | Bloquear tudo até o sistema de papéis existir — descartado, impediria testar a tela agora |
| 2026-08-21 | Tela Registrar alimentação construída como componente cliente (`"use client"`) com estado local por passo, sem servidor/SSR para o formulário | Simplicidade para o estágio do projeto; parceiros/caixas carregados do Supabase direto no navegador, consistente com o app já ser client-heavy (PWA offline-first) | Buscar dados via Server Component/Server Action — guardado como possível refinamento futuro |
| 2026-08-21 | Fila offline de Registrar alimentação implementada em `localStorage`, guardando só os campos de texto/número (foto não é guardada offline nesta primeira versão) | Cobre o caso mais comum (perda de sinal no meio do registro) sem a complexidade de guardar arquivos binários offline (IndexedDB) agora | Fila completa com foto via IndexedDB — descartado por ora, fica como melhoria futura documentada |

**Pendente de fechar:** qual gerenciador de senhas será usado para a senha do Vercel.

**Nota:** a organização "Glauber" na integração Supabase do Claude (seção 4A) provavelmente é de outro projeto do usuário.

---

## 4. Stack e ferramentas

**Status: CONFIRMADA e com infraestrutura real no ar (ver seção 4B e seção 5).**

- **Front-end:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4, como PWA.
- **Banco de dados / autenticação:** Supabase (Postgres + Auth + Storage + Edge Functions) — projeto real criado e conectado.
- **Hospedagem / deploy:** Vercel — projeto real `app-coletivo`, já com deploy publicado.
- **Controle de versão:** GitHub (usuário `appcoletivos-oss`, repositório `app-coletivos`).

**Pontos que ainda vão exigir decisão/desenho específico (não bloqueiam o andamento):**
- Login: já decidido oferecer PIN/biometria/social — falta desenho de tela e implementação técnica com Supabase Auth.
- Controle de ponto via GPS — dado sensível, tratamento LGPD específico.
- Acesso por papel — já decidido no nível de produto ("Mais" majoritariamente restrito, com exceção confirmada para ocorrência atípica) — falta modelar no Supabase (provavelmente RLS + tabela de perfis com papel funcionária/coordenação/lojista, incluindo a exceção de item único liberado dentro de um bloco restrito).
- Upload de fotos (Registrar alimentação, Registrar colheita, ocorrência atípica) — usar Supabase Storage; pensar em compressão/tamanho pra conexão 4G instável em campo; e implementar a integração com Google Drive API pro upload automático (link e convenção de pastas já definitivos — ver seção 5 — falta a implementação e, no futuro, a tela de configuração desse link pela equipe).
- Cálculo de impacto do lojista — implementar a fórmula de proporção de peso (seção 2) como uma view/query agregada, não como campo manual.
- Agenda → pendência de registro: modelar como as duas entidades (evento de agenda e registro de atividade) se conectam no banco (provavelmente uma referência do registro pro evento de origem).
- Migração/aproveitamento dos dados dos Google Forms e das planilhas reais (Compostagem e Horta) para dentro da nova estrutura — tarefa separada, não obrigatória para o primeiro protótipo.

### 4A. Integrações Claude ≠ contas appcoletivos (ainda relevante)

O Claude tem ferramentas conectadas de Supabase e Vercel que **não apontam para as contas do projeto**:
- Supabase (via integração do Claude): organização `Glauber` — não é a conta `appcoletivos`.
- Vercel (via integração do Claude): time `Thiago's projects` (slug `cineflow-s-projects`) — não é a conta `appcoletivos`.

Por isso o projeto Supabase real e o projeto Vercel real foram criados **manualmente pelo usuário** direto nos painéis.

**Nenhuma ação deve ser tomada via essas integrações do Claude (Supabase/Vercel) sem confirmar antes com o usuário a qual conta ela está de fato conectada.**

### 4B. Estrutura inicial de código

Código em `C:\Users\Thiago França\Claude\Projects\app-coletivos`, publicado em `github.com/appcoletivos-oss/app-coletivos`, já rodando ao vivo em `app-coletivo.vercel.app`.

O que já existe no código:
- Projeto Next.js com TypeScript, Tailwind, App Router.
- `next.config.ts`: `cacheComponents`, `partialPrefetching` e `experimental.useOffline` ativados.
- `src/app/manifest.ts`: manifesto do PWA (nome "App Coletivo", short_name "Coletivo", cor verde, ícones placeholder).
- `src/app/offline-banner.tsx`: aviso visível de "sem internet".
- `src/lib/supabase.ts`: cliente do Supabase, já ligado ao projeto real via `.env.local`.
- Tela inicial (`src/app/page.tsx`): seletor de módulo — "Pátio de Compostagem" (`/patio`) e "Gestão do Coletivo" (`/coletivo`), ambos placeholder.
- `README.md` e `package.json` (`name`: `app-coletivo`) atualizados.

**Ainda não commitado/enviado ao GitHub:** falta o usuário rodar `git add`, `git commit` e `git push` — ver seção 6.

**Ainda não implementado no código:** a tela `/patio` continua placeholder — os wireframes da seção 2.1 (estrutura 100% fechada) ainda não foram traduzidos em componentes React/Tailwind reais.

---

## 5. Caminhos, links e contatos

- **E-mail do projeto:** appcoletivos@gmail.com
- **Repositório de código:** https://github.com/appcoletivos-oss/app-coletivos
- **GitHub:** usuário `appcoletivos-oss` (login via Google, 2FA não ativado)
- **Supabase (projeto real):** região a confirmar
  - URL: `https://jfismzwfxkklytqpatka.supabase.co`
  - Chave pública (anon/publishable): `sb_publishable_f3QWMoMROPyCupGiuMrzmQ_molxL2xF`
  - Já gravada no `.env.local` da máquina do usuário
- **Vercel (projeto real):** `app-coletivo`
  - Domínio público: https://app-coletivo.vercel.app/
  - Deployment: https://vercel.com/app-coletivo/app-coletivo/5SzrhV3aMbPD5RgmDuuGdZKnkwgn
  - Ainda rodando a versão com "App Coletivos" (plural) — atualiza sozinho após o `git push` pendente
- **Pasta local do projeto:** `C:\Users\Thiago França\Claude\Projects\app-coletivos`
- **Pasta de arquivos e imagens de apoio:** `C:\Users\Thiago França\Claude\Projects\app-coletivos\Arquivos extras` — conteúdo atual (2026-08-21):
  - `Monitoramento Compostagem - Patio Alvorada.xlsx` — resumida em `claude/resumo-planilha-monitoramento-compostagem.md`
  - `Tabela de monitoração de cultivo.xlsx` — modelo de preenchimento manual do ciclo de cultivo
  - `Tabela de Plantio e Colheita - Patio Alvorada.xlsx` — histórico real de colheitas (637 registros, 69 espécies)
  - `wireframe_modulo1.html` — arquivo de wireframe do Módulo 1, agora na **rodada 7** (fechamento definitivo), editado pelo próprio usuário diretamente nesta pasta
- **Google Forms do Pátio (3 links, 2026-08-20):**
  - "Controle das Bombonas" (consultado com sucesso, campos na seção 2): https://docs.google.com/forms/d/e/1FAIpQLSdXfLeWRFUGP1FIjjcVXxQcp2PbxzAHav61AzB0Ld0nl9gFkg/viewform
  - "Projeto Chié - Alvorada Sustentável" (atividades diárias; conteúdo colado pelo usuário, ver seção 2): https://docs.google.com/forms/d/e/1FAIpQLSdgrTS23BhJ1SHUNCUcNe6Z2K328MpFM6BDnIv9BsY_VHZIeA/viewform — acesso automático segue dando erro 401
  - Formulário de plantio/colheita (descrito, não colado): https://docs.google.com/forms/d/e/1FAIpQLSd6YJtUqykEcPQX5dz57qAx50Zlu-IruiIc3akGwK9zUd7C5A/viewform — acesso automático também dá erro 401
- **Drive do coletivo (link real, fornecido em 2026-08-20):** https://drive.google.com/drive/folders/1lqgSU6jhbVDPEmgK8kOzMtahcXgCqAni?usp=sharing — usado como arquivo geral de fotos das atividades (compostagem, horta, ocorrências atípicas), com upload automático. **Convenção de pastas (definitiva, rodada 7):** Mês/Ano por extenso no nível 1 (ex.: "Agosto/26"), dia_mês no nível 2 (ex.: "20/8"). **No app final, esse link deve ser configurável pela equipe**, não fixo — o valor acima vale só para este piloto.
- **Wireframe do Módulo 1 — artefato publicado (atual):** https://claude.ai/code/artifact/80557f92-01ad-4466-9a37-34899142d102 — publicado nesta sessão (2026-08-21), já com a estrutura 100% fechada (rodada 7) e a tela **Registrar alimentação** detalhada em 6 passos. Privado por padrão; usuário decide se compartilha pelo menu da própria página. Para atualizar em sessões futuras, republicar passando essa mesma URL — senão vira um artefato novo e separado.
  - As rodadas 1 a 6 tinham sido publicadas como um artefato Cowork mais antigo (id `app-coletivo-wireframe-modulo1-patio`, sem URL do tipo claude.ai) — esse artefato antigo é considerado substituído pelo link acima.
  - O mesmo conteúdo também foi salvo de volta no arquivo local `Arquivos extras\wireframe_modulo1.html`, substituindo a versão da rodada 7.
- **Contatos relevantes** (coordenadoras, shopping, consultor etc.): [nome — função — e-mail/telefone]
- **Guia de configuração de contas (referência):** `claude/guia_configuracao_contas_app_coletivos.md` (Project Knowledge)

---

## 6. Pendências e próximos passos

- [x] Criar e-mail, GitHub, Vercel, Supabase do projeto
- [x] Levantamento operacional do Módulo 1 (discovery)
- [x] Confirmar stack com o usuário
- [x] Criar e publicar estrutura inicial de código
- [x] Criar projetos reais Supabase e Vercel
- [x] Renomear "App Coletivos" → "App Coletivo" (nome de exibição)
- [x] Analisar a planilha real de monitoramento da compostagem
- [x] Esclarecer terminologia "leira" vs "caixa" (compostagem)
- [x] Rodadas 1 a 7 de wireframe do Módulo 1 — **estrutura de telas 100% fechada**
- [x] Analisar as 2 planilhas novas de Horta
- [x] Consultar os 3 links de formulário do Pátio (1 direto, 2 via conteúdo colado pelo usuário)
- [x] Definir papel do lojista (tela de bombonas + relatório da loja com mensagem de impacto, mesmo app/PWA)
- [x] Definir destino das fotos (relatório curado + upload automático pro Drive do coletivo)
- [x] Definir Manejo como item próprio de Horta
- [x] Definir escopo de Agenda→pendência (Horta/Compostagem + mutirões/oficinas/visitas)
- [x] Definir detalhe fino de acesso por papel (só "Mais" é majoritariamente restrito)
- [x] Usuário forneceu o link real da pasta do Drive do coletivo
- [x] **Confirmar o formato exato dos nomes de pasta do Drive** — resolvido na rodada 7: Mês/Ano por extenso + dia_mês
- [x] **Decidir se "ocorrência atípica" é visível pra qualquer funcionária ou só coordenação** — resolvido na rodada 7: aberto a qualquer funcionária
- [ ] Usuário roda `git add -A`, `git commit` e `git push` para enviar a mudança de nome ao GitHub — depois disso a Vercel atualiza sozinha
- [ ] Confirmar se a região do projeto Supabase é São Paulo
- [ ] Confirmar/ativar verificação em duas etapas na conta Google do projeto
- [ ] Decidir onde guardar a senha própria do Vercel
- [ ] Desenhar solução de login acessível em detalhe (PIN/biometria/social já decidido — falta tela + implementação técnica)
- [ ] Tratar requisitos de LGPD para o controle de ponto via GPS e para a lista real de nomes da equipe (ver nota na seção 2) quando essas funcionalidades forem desenhadas/implementadas
- [ ] Substituir os ícones placeholder do PWA pela arte final do App Coletivo
- [ ] Apagar as pastas de sobra deixadas pela ponte do Claude na máquina do usuário (`projetos\_to_delete`) — só o usuário pode apagar
- [ ] Se quiser o .xlsx original da planilha de compostagem também no Project Knowledge, o usuário precisa subir manualmente
- [x] **Desenhar em detalhe a primeira tela específica: Compostagem → Registrar alimentação** (com campo de foto) — feito em 2026-08-21, fluxo de 6 passos (ver seção 2.1)
- [x] Republicar o wireframe atualizado como artefato — feito em 2026-08-21 (link na seção 5)
- [ ] Confirmar com o usuário os nomes reais dos 5 restaurantes parceiros (hoje placeholder `Loja 1`–`Loja 5`) e da construtora — agora dá pra corrigir direto pela tela de Cadastro → Parceiros → ✏️ Corrigir nome (não precisa mais mexer no banco na mão)
- [x] Começar a implementar a tela `/patio` real em código — feito em 2026-08-21 (Registrar alimentação funcional; demais blocos como placeholder "em breve")
- [ ] **Usuário aplicar as migrations no Supabase real** (`supabase/migrations/20260821120000_entidades_parceiros_caixas_canteiros.sql` e, agora, também `20260821140000_equipe.sql`) — pelo SQL Editor do painel Supabase (não pela integração do Claude, que aponta pra conta errada, ver seção 4A) ou pela Supabase CLI, se instalada. Nenhuma das duas foi aplicada ainda.
- [ ] Rodar `npm run dev` localmente e testar as telas novas de verdade no navegador/celular (Registrar alimentação, e agora também Cadastro → Parceiros/Canteiros/Caixas/Equipe e a rota `/convite/[token]`)
- [x] Desenhar a tela de "Cadastro" (equipe edita/renomeia/ativa parceiros e canteiros) — wireframe pronto em 2026-08-21 (seção 7 do artefato, link na seção 5)
- [x] Construir a tela de Cadastro em código (React/Next) — feito em 2026-08-21 (sessão C, Claude Code), com as 4 abas: Parceiros, Canteiros, Caixas e Equipe (ver seção 9)
- [ ] Detalhar a próxima tela específica sugerida: Registrar colheita (Horta) ou Ver caixas (Compostagem)
- [x] Usuário revisou e commitou o código novo (commit `30102ba`, `git push` bem-sucedido) — porém o commit trouxe junto arquivos que não deveriam ir pro repositório (ver item abaixo)
- [x] **Anomalia de git — investigada e resolvida (2026-08-21, sessão C, Claude Code):** o susto foi um falso alarme. O commit seguinte (`702daf2`, "Remove cache de skills e planilhas do controle de versao") já tinha corrigido tudo: removeu `.agents/`, `.claude/`, `skills-lock.json` e `Arquivos extras/` do índice do git (mantendo os arquivos no disco) e já tinha adicionado as 4 regras certas no `.gitignore`. Esse commit já estava em `origin/main` antes desta sessão começar. Por isso `git rm -r --cached` "não encontrou" os caminhos e o `git status` deu limpo — o trabalho já tinha sido feito. Confirmado com `git ls-files` (nenhum dos 4 caminhos rastreado) e `git status` (`up to date with origin/main`). **Nenhuma ação nova foi necessária.**
- [ ] Verificar a pasta `_to_delete/tsconfig.check.json` criada nesta sessão (arquivo de teste temporário que a ponte do Claude não conseguiu apagar sozinha) — **atualização:** ao conferir depois, essa pasta nem aparecia mais na listagem real da pasta — sinal de que a ponte teve algum comportamento inconsistente entre "o que o Claude escreve" e "o que aparece de fato no disco" nesta sessão. Vale ficar atento a isso em sessões futuras.

---

## 7. Perguntas em aberto

- [ ] Quando começar a existir equipe técnica além do usuário, migrar a administração das contas para acesso compartilhado
- [ ] Definir critérios de avaliação do piloto (o que significa "funcionar bem" aqui, para cada um dos dois fluxos?)
- [ ] Definir prazo/formato do teste prático em cada contexto (Pátio e coletivo)
- [ ] Mapear quais telas/fluxos são realmente comuns aos dois usos (Pátio vs. gestão do coletivo Chié do Entra) vs. exclusivos de cada um
- [ ] A organização "Glauber" na integração Supabase do Claude é mesmo de outro projeto do usuário? Confirmar quando for relevante.

> As perguntas de estrutura geral do Módulo 1 (acesso por papel, login, Drive, Agenda→pendência, papel do lojista, formato das pastas do Drive, visibilidade de ocorrência atípica) foram todas respondidas ao longo das rodadas 1 a 7 de wireframe (ver seção 2). **A estrutura do Módulo 1 está 100% fechada** — o que resta agora é avançar para implementação técnica (seção 4) e as pendências de execução da seção 6, a começar pelo detalhamento da tela Registrar alimentação.

---

## 8. Registro de Aprendizagem do Usuário

> Seção viva — atualizar conforme o usuário avança no domínio de ferramentas de desenvolvimento. Usar para calibrar explicações futuras (nem repetir do zero o que já foi entendido, nem presumir conhecimento não confirmado).

### Conceitos e ferramentas já apresentados
- [x] Gerenciador de senhas / zero-knowledge (Bitwarden) — 2026-08-20
- [x] Diferença entre e-mail pessoal e e-mail institucional/de projeto — 2026-08-20
- [x] OAuth / "Continue with GitHub" e "Sign in with Google" — 2026-08-20, já praticado
- [x] Repositório de código / versionamento (GitHub) — já usado na prática
- [x] Deploy / hospedagem (Vercel) — projeto real criado e publicado pelo próprio usuário
- [x] Banco de dados e autenticação (Supabase) — projeto real já criado
- [x] PWA (Progressive Web App) — 2026-08-20
- [x] Variáveis de ambiente / `.env` — já praticado
- [x] Diferença entre `git config --global` e local — explicado e aplicado
- [x] Ponte do Claude Desktop com o computador do usuário — vivenciado na prática, incluindo pedido de acesso a novas pastas (mais uma pasta conectada em 2026-08-21)
- [x] `git remote add` + `git push` + autenticação via navegador — praticado com sucesso
- [x] Diferença entre nome de exibição de um produto e identificador técnico de uma conta — explicado, usuário decidiu conscientemente
- [x] Limite do Project Knowledge (só texto, não binários) — explicado
- [x] Wireframe de baixa fidelidade — apresentado e levado a 7 rodadas de revisão até fechar 100% a estrutura, incluindo uma rodada (7) editada pelo próprio usuário direto no arquivo, sem depender do Claude
- [x] Artefato do Cowork (página que pode ser reaberta/atualizada) — apresentado e praticado (6 atualizações no mesmo artefato)
- [x] Limitação de acesso automático a formulários/páginas que exigem login (erro 401) — explicado; usuário resolveu colando o conteúdo diretamente
- [x] Conceito de "pendência vinculada" (Agenda → registro) como padrão de UX — apresentado a partir de uma ideia trazida pelo próprio usuário
- [x] Ideia de métrica calculada/derivada (mensagem de impacto do lojista) vs. dado bruto — o usuário já chegou com a proposta pronta, incluindo o texto da mensagem
- [x] Diferença entre "valor fixo no código" (hardcoded) e "configurável pela equipe" — o usuário já articulou essa diferença sozinho ao pedir que o link do Drive seja trocável no futuro, sem que fosse explicado antes
- [x] Modelagem de dados com memória histórica ("SCD" / registro versionado, sem usar esse termo) — 2026-08-21: o usuário descreveu sozinho, em linguagem própria, exatamente o problema que esse padrão resolve (loja trocada não pode reescrever o passado) — ainda não foi apresentado o nome técnico do padrão, só a implementação; vale nomear na próxima vez que for relevante, sem precisar reexplicar o conceito

### Nível de autonomia percebido por área

| Área | Nível (iniciante / em progresso / autônomo) | Observações |
|------|-----------------------------------------------|-------------|
| Terminal / linha de comando | em progresso | Rodou os comandos de git passados sem intercorrências |
| Git / controle de versão | em progresso | Primeiro `git push` da vida bem-sucedido |
| Lógica de programação | ainda não observado | |
| Banco de dados | em progresso | Criou o projeto Supabase real sozinho |
| Deploy / publicação | autônomo | Criou o projeto Vercel real sem precisar de orientação |
| Leitura de código | ainda não observado | |
| Criação de contas / infraestrutura web | autônomo | Já criou e-mail, GitHub, Vercel e Supabase sozinho |
| Levantamento de requisitos / discovery | autônomo | Trouxe repetidas vezes material real de operação sem que fosse pedido; quando um link não funcionou, resolveu colando o conteúdo direto |
| Organização de arquivos/pastas | autônomo | Convenção própria mantida e ampliada ao longo da sessão; corrigiu por conta própria a convenção de pastas do Drive editando o wireframe diretamente |
| Edição direta de arquivos do projeto | **novo — autônomo** | Na rodada 7, editou o arquivo de wireframe (`wireframe_modulo1.html`) diretamente na pasta local, sem passar pelo Claude, incorporando duas decisões finais de produto — primeiro sinal de trabalho autônomo fora da conversa |
| Decisões de produto / UX (prototipagem) | **autônomo** | Ao longo do projeto, evoluiu de responder perguntas fechadas pra propor estrutura nova por conta própria: padrão Agenda→pendência, métrica calculada completa pro relatório do lojista, o princípio de "configurável pela equipe, não fixo no código", e agora edição direta do próprio wireframe pra fechar as últimas 2 decisões |

### Preferências de explicação
- Formato preferido: guia passo a passo em Markdown, termos técnicos definidos na primeira ocorrência
- Quando uma ferramenta recomendada gera fricção, prefere alternativa mais simples rapidamente
- Confirma decisões técnicas importantes de forma direta e objetiva, sem precisar de debate longo
- Faz perguntas de verificação pontuais antes de executar comandos — vale explicar o efeito colateral antes de pedir pra rodar
- Quando algo não pode ser feito automaticamente (ex.: link com erro 401), prefere ser informado com clareza e resolve de forma prática (colar o conteúdo) em vez de a tarefa ficar pela metade
- Diante de opções apresentadas de forma objetiva, decide rápido e com justificativa própria
- Traz dado real e proativo repetidamente (planilhas, formulários, links) — vale sempre perguntar "tem algum registro disso hoje?" antes de desenhar um fluxo novo
- Depois de ver uma proposta de estrutura, devolve feedback específico com raciocínio de produto — pode receber propostas mais ousadas/detalhadas sem medo de travá-lo
- Já propõe padrões de UX/arquitetura, métricas calculadas e requisitos de manutenibilidade por conta própria — vale tratar essas ideias com o mesmo peso de uma decisão técnica formal, registrar e implementar, não só "anotar como sugestão"
- Pensa no ganho para o outro lado da relação (ex.: o que o lojista ganha em troca de preencher o formulário) e na autonomia futura do coletivo (ex.: link configurável, não travado no código) — sinal de visão de produto madura, pensando em sustentabilidade do projeto além do piloto
- Já demonstrou disposição para editar arquivos do projeto diretamente, sem esperar pelo Claude, quando a decisão já estava clara na sua cabeça — vale sempre checar arquivos locais no início de uma sessão, já que o usuário pode ter avançado sozinho

### Observações gerais
- Usuário tomou decisões próprias no meio do processo sem travar no plano original.
- Primeiro push para o GitHub concluído com sucesso — marco de aprendizagem prática de git.
- Ficou rápido e autônomo nos passos de Supabase/Vercel reais.
- Trouxe proativamente material real de operação várias vezes (planilha de compostagem, 2 planilhas de horta, 3 links de formulário, link real do Drive).
- Evoluiu de "responder perguntas de estrutura" para "propor estrutura nova, métricas calculadas e requisitos de manutenibilidade" — já pode ser tratado como parceiro de design de produto, não só como validador de propostas prontas.
- **Novo (2026-08-21):** deu o primeiro passo de trabalho autônomo fora da conversa — editou o próprio arquivo de wireframe pra fechar as duas últimas decisões de produto, sem esperar por uma sessão do Claude.

---

## 9. Histórico de sessões

| Data | Resumo do que foi feito | Próxima ação sugerida |
|------|--------------------------|-------------------------|
| 2026-08-20 | Criado guia de configuração de contas. Criadas as contas do projeto (e-mail, GitHub, Vercel, Supabase). Discovery operacional do Módulo 1. Stack confirmada. Estrutura inicial de código publicada no GitHub e no ar na Vercel. Nome de exibição corrigido para "App Coletivo". Planilha real de compostagem analisada (26 caixas; análise sensorial e água/energia como achados novos). "Leira" vs "caixa" esclarecido (leira desativada). | Usuário faz commit+push da mudança de nome; começar a desenhar as telas reais do Módulo 1 |
| 2026-08-20 | **Rodada 1 de wireframe:** tela inicial (6 blocos) e mapa de navegação, formato e escopo escolhidos pelo usuário. Publicado como artefato no Cowork. 4 perguntas levantadas (acesso por papel, login, uso real da colheita, agrupamento). | Decidir as perguntas em aberto; desenhar Registrar alimentação |
| 2026-08-20 | **Rodada 2 de wireframe:** acesso por papel confirmado, login com múltiplas opções, Adubo entra em Compostagem, bloco Venda criado, Horta promovida a bloco de primeira grandeza (2 planilhas novas — 637 colheitas reais em 69 espécies desde 2023). 3 links de formulário enviados: 1 consultado com sucesso (Bombonas), 2 com erro 401. | Resolver os 2 links com erro 401; detalhar acesso por papel; desenhar Registrar alimentação |
| 2026-08-20 | **Rodada 3 de wireframe:** lojista confirmado como 3º tipo de usuário, terminologia "Canteiro" decidida, conteúdo dos 2 formulários com erro 401 colado pelo usuário — revelou evidência fotográfica obrigatória, o conceito de turno e um roteiro real de equipe (10 nomes — dado pessoal). | Detalhar acesso por papel; decidir onde o lojista acessa o app; decidir destino do relatório de fotos |
| 2026-08-20 | **Rodada 4 de wireframe:** lojista com tela própria + relatório da loja, acesso pelo mesmo app/PWA; fotos com relatório curado + link pro Drive; Manejo vira item próprio de Horta; usuário propôs por conta própria o princípio de Agenda gerar pendência de registro. | Resolver as 3 perguntas técnicas restantes; desenhar Registrar alimentação |
| 2026-08-20 | **Rodada 5 de wireframe (fechamento da estrutura):** usuário respondeu as 3 últimas perguntas técnicas — acesso por papel simplificado (só "Mais" é de coordenação), Drive com upload automático via link fornecido pela equipe, Agenda→pendência ampliado pra Horta/Compostagem + mutirões/oficinas/visitas — e propôs a mensagem de impacto no relatório do lojista. | Usuário fornecer o link real do Drive; desenhar Registrar alimentação |
| 2026-08-20 | **Rodada 6 de wireframe:** usuário forneceu o link real da pasta do Drive do coletivo, definiu a convenção de organização de pastas (mês/ano + dia_mês, leitura abreviada) e pediu um novo campo em "Mais" — registrar ocorrências atípicas, também com foto indo pro Drive. Também deixou claro que o link do Drive deve ser configurável pela equipe no app futuro, não fixo. Wireframe e artefato do Cowork atualizados pela 6ª vez. Registro Geral atualizado e consolidado — restaram só 2 perguntas finas de confirmação (formato do nome das pastas; visibilidade de ocorrência atípica). | Confirmar as 2 perguntas finas; desenhar em detalhe a primeira tela específica — **Compostagem → Registrar alimentação** (com campo de foto) |
| 2026-08-21 (sessão A) | **Rodada 7 de wireframe (fechamento definitivo), feita por uma sessão anterior do Claude fora desta conversa:** editou diretamente o arquivo `wireframe_modulo1.html` na pasta local do usuário, corrigindo a convenção de pastas do Drive (Mês/Ano por extenso + dia_mês) e confirmando "Registrar ocorrência atípica" como exceção aberta a qualquer funcionária. **Não atualizou o Registro Geral nem publicou artefato** — lacuna identificada na sessão seguinte. | — |
| 2026-08-21 (sessão B) | Usuário conectou a pasta local do projeto a esta sessão; pediu para ler o `wireframe_modulo1.html` e atualizar os registros. Claude leu o arquivo, sincronizou o Registro Geral com as duas decisões da rodada 7 (**estrutura do Módulo 1 100% fechada**) e registrou a lacuna de continuidade entre sessões. Em seguida, a pedido do usuário, detalhou a primeira tela específica — **Compostagem → Registrar alimentação**, como fluxo de 6 passos — e republicou o wireframe completo como artefato Cowork (link na seção 5), também salvando a versão atualizada de volta no arquivo local. Depois, o usuário trouxe um requisito de modelagem (nomes de lojas/canteiros editáveis pela equipe, sem perder memória histórica quando um parceiro é trocado) e pediu para seguir com o desenvolvimento: Claude desenhou e implementou o schema do banco (`parceiros`, `caixas`, `canteiros`, `registros_alimentacao`, com o padrão de memória histórica descrito na seção 2) e construiu a tela Registrar alimentação de verdade em código (React/Next/Tailwind), com fila offline em `localStorage`. Código escrito direto na pasta local do usuário via a ponte do Claude Desktop, mas **não commitado** — fica pro usuário revisar e commitar. | Usuário aplicar a migration no Supabase real; testar a tela com `npm run dev`; revisar e commitar o código; confirmar nomes reais dos parceiros; desenhar a tela de Cadastro; detalhar a próxima tela (Registrar colheita ou Ver caixas) |
| 2026-08-21 (sessão C, Claude Code) | Usuário trouxe duas tarefas pro Claude Code local. **(1) Investigação de git:** confirmado que a "anomalia" reportada pela sessão B já tinha sido corrigida pelo commit `702daf2`, já enviado ao GitHub antes desta sessão começar — nenhuma ação nova foi necessária (ver seção 6). **(2) Tela de Cadastro:** como a tela ainda não existia em código (só o wireframe), o usuário decidiu ampliar o escopo original (só a aba Equipe) para fechar as 4 abas de uma vez — Parceiros, Canteiros, Caixas e Equipe. Claude criou a migration `20260821140000_equipe.sql` (tabela `membros_equipe` + function `buscar_convite_por_token`, security definer, pra permitir a leitura do convite por quem ainda não fez login sem abrir a tabela inteira pra anônimo) e construiu em código: hub `/patio/mais`, tela `/patio/mais/cadastro` com as 4 abas (Parceiros/Canteiros com o padrão ✏️ corrigir nome vs. 🔁 encerrar e substituir; Caixas usando o campo `status` que já existia; Equipe com adicionar/editar/remover e geração de link de convite com wa.me), e a rota `/convite/[token]` (mostra "Bem-vindo(a), [nome]" a partir do pré-cadastro; botão de login fica desabilitado como placeholder, já que login ainda não existe). `npm run build` e `npx eslint` rodados e limpos. **Nada commitado nem enviado ao GitHub ainda** — fica pro usuário revisar. | Usuário aplicar a migration da Equipe no Supabase real (junto com a anterior, se ainda não tiver feito); testar as telas novas com `npm run dev`; revisar e commitar o código; detalhar a próxima tela (Registrar colheita ou Ver caixas) |
