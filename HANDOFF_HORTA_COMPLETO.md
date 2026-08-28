# Handoff técnico — Bloco Horta completo (App Coletivo, Módulo 1 — Pátio)

> **v3 — substitui as versões anteriores.** A v1 tratava o vínculo colheita→plantio como opcional; corrigido na v2 para rastreio de ponta a ponta. Esta v3 ajusta três pontos que ficaram errados na v2: (1) fechamento do plantio na colheita nunca é automático por `ciclo_produtivo` — é sempre confirmação explícita da pessoa registrando, porque a prática real do coletivo diverge da literatura em várias espécies (rúcula/coentro/couve colhidos de forma contínua, "tradicionalmente" corte único); (2) o motor de automação (seção 3.10a) ganhou especificação completa — é 90% do valor pedido pelo usuário, cobrindo tanto colheita no prazo quanto manejo periódico por planta, cruzando regra de cultura + histórico real de cada plantio; (3) as fichas de cultura ganharam dado de partida real, pesquisado com fonte institucional (seção 3.10b), em vez de nascerem vazias.

---

## 1. Objetivo desta rodada

Rastrear cada lote de plantio do início ao fim, sem perder precisão em nenhum ponto da cadeia:

1. **Origem**: sementes plantadas por nós, muda comprada já germinada, estaca, ou planta já existente antes do sistema (perenes antigas, tipo o pé de uva já citado).
2. **Germinação** (quando origem = semente): quantas sementes, quando germinou, quantas germinaram.
3. **Transplante**: pra onde foi, quanto foi (pode dividir um lote entre vários canteiros — cada fração vira um lote-filho rastreável).
4. **Colheita**: sempre amarrada a um plantio específico, nunca só a um canteiro. Pra cultura de colheita única (alface) fecha o lote; pra cultura de produção contínua (tomate) registra cada colheita ao longo do tempo, sem fechar o lote.
5. **Perda e doação de mudas/produção**: sempre amarradas a um plantio específico, com quantidade.
6. **Regime de manejo por cultura**: cada tipo de manejo (rega, adubação, poda, raleamento) com sua própria regra de início e repetição, contada a partir do marco certo (plantio, germinação ou transplante — configurável, porque cada regra da vida real conta a partir de um ponto diferente, como no exemplo do tomate).
7. **Consequência automática de tudo isso**: dá pra saber, por planta ou lote, quanto tempo levou até colher, quanto rendeu, e cruzar isso com produtividade por canteiro — sem precisar desenhar essa parte agora, o modelo já habilita.

Consórcio continua sendo a regra (vários plantios ativos por canteiro ao mesmo tempo) — nada aqui muda isso.

---

## 2. O que muda em relação à v1 (resumo da correção)

| Ponto | v1 (errado) | v2 (corrigido) |
|---|---|---|
| Colheita → plantio | Sem vínculo formal, cultura em texto livre | **Vínculo obrigatório** pra registros novos — sempre um plantio específico |
| Manejo → plantio | Vínculo opcional só pra poda/raleamento | Adubação/capina aplicam automaticamente a todos os plantios ativos do canteiro (sem passo extra na tela); poda/raleamento exigem escolher quais plantios |
| Transplante | Só move o plantio de canteiro | **Pode dividir** um lote em vários lotes-filhos, um por canteiro de destino, preservando a linhagem |
| Origem do plantio | Não existia | Semente / muda comprada / estaca / já existente (perene antiga) / divisão (nasceu de um transplante) |
| Germinação | Não existia | Campos próprios no plantio (data e quantidade), preenchidos depois, quando confirmado |
| Doação de mudas/produção | Não existia | Tabela própria, distinta da doação de alimento já colhido (essa outra já está no roadmap do bloco "Venda") |
| Regime de manejo | Um intervalo fixo em dias por cultura+tipo | Intervalo com **marco de referência configurável** (a partir do plantio, da germinação ou do transplante) — necessário pro exemplo real do tomate, onde adubação conta a partir do transplante, não do plantio |

---

## 3. Modelo de dados

### 3.1 Alterar `canteiros` (igual à v1, sem mudança nesta correção)

```sql
alter table canteiros add column local text not null default 'patio'
  check (local in ('patio', 'teto'));

alter table canteiros drop constraint canteiros_tipo_check;
alter table canteiros add constraint canteiros_tipo_check
  check (tipo in ('canteiro_solo', 'bombona', 'galeia', 'geodesica',
                   'pergolado', 'vaso', 'bandeja_muda', 'saco_muda', 'outro'));
```

### 3.2 Nova tabela `culturas` — ficha de cultura, expandida

```sql
create table culturas (
  id                     uuid primary key default gen_random_uuid(),
  nome                   text not null unique,
  solo_ideal             text,
  rega_ideal             text,
  ciclo_produtivo        text not null default 'unico'
                           check (ciclo_produtivo in ('unico', 'continuo')),
  dias_para_germinacao   int,   -- só relevante quando o plantio é por semente
  dias_para_transplante  int,   -- recomendação de quando mover do viveiro pro canteiro definitivo
  dias_para_colheita     int,   -- tempo até a primeira colheita (não o fim do ciclo, em cultura contínua)
  ativo                  boolean not null default true,
  observacoes            text,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);
```

`ciclo_produtivo`: **`unico`** = a colheita encerra o plantio (alface, cenoura, rúcula — colhe uma vez e a planta sai do canteiro). **`continuo`** = a planta permanece produzindo por um período (tomate, pimentão, banana) — cada colheita é um evento que soma produção, sem fechar o plantio. Isso decide se registrar uma colheita muda o `status` do plantio automaticamente ou não (ver seção 3.4).

Todos os campos numéricos da ficha continuam opcionais — pode ser preenchida aos poucos, sem travar o uso do resto do módulo.

### 3.3 Nova tabela `culturas_regime_manejo` — regra de manejo periódico, com marco de referência

```sql
create table culturas_regime_manejo (
  id              uuid primary key default gen_random_uuid(),
  cultura_id      uuid not null references culturas(id),
  tipo_manejo     text not null check (tipo_manejo in ('capina_seletiva', 'adubacao', 'poda', 'raleamento')),
  referencia      text not null check (referencia in ('plantio', 'germinacao', 'transplante')),
  dias_inicio     int not null check (dias_inicio >= 0),  -- dias após a referência pra começar
  intervalo_dias  int not null check (intervalo_dias > 0), -- repete a cada N dias, a partir do início
  observacao      text,       -- espaço pra regra específica, tipo "poda drástica de crescimento"
  unique (cultura_id, tipo_manejo)
);
```

Exemplo real do tomateiro, pra conferir se o modelo cobre (dado pelo usuário nesta sessão): transplante ~20 dias após o plantio; adubação a cada 15 dias **a partir do transplante**; poda drástica a partir de 1 mês, repetindo a cada 20 dias. Isso vira:

- `culturas.dias_para_transplante = 20`
- linha em `culturas_regime_manejo`: `tipo_manejo='adubacao', referencia='transplante', dias_inicio=0, intervalo_dias=15`
- linha em `culturas_regime_manejo`: `tipo_manejo='poda', referencia='transplante', dias_inicio=30, intervalo_dias=20` (assumindo que "a partir de um mês" conta do transplante, que é quando a planta vai pro canteiro definitivo — se na prática for a partir do plantio original, é só trocar `referencia`; perguntar caso a caso ao cadastrar cada ficha, não precisa travar por causa disso agora)

Como cada linha tem um `cultura_id` só, uma cultura pode ter regras diferentes pra cada tipo de manejo, cada uma contando a partir de um marco diferente.

### 3.4 Nova tabela `plantios` — o lote, com origem e status corrigidos

```sql
create table plantios (
  id                          uuid primary key default gen_random_uuid(),
  cultura_id                  uuid not null references culturas(id),
  canteiro_id                 uuid not null references canteiros(id), -- localização atual
  plantio_pai_id              uuid references plantios(id),           -- preenchido quando nasceu de um transplante parcial
  origem                      text not null
                                 check (origem in ('semente', 'muda_comprada', 'estaca', 'ja_existente', 'divisao')),
  data_inicio                 date not null default current_date,     -- data do plantio, da compra, ou do transplante que originou este lote
  quantidade_inicial          numeric,     -- pode ficar em branco pra 'ja_existente' quando não dá pra saber
  unidade                     text,        -- texto livre: 'sementes', 'mudas', 'estacas' etc.
  data_germinacao             date,        -- só quando origem = 'semente'; preenchido depois, quando confirmado
  quantidade_germinada        numeric,     -- idem
  dias_para_colheita_snapshot int,         -- cópia do valor da ficha no momento do plantio (memória histórica)
  previsao_colheita           date,        -- data_inicio + dias_para_colheita_snapshot
  status                      text not null default 'ativo'
                                 check (status in ('germinando', 'ativo', 'colhido', 'perdido', 'doado', 'transplantado', 'encerrado')),
  registrado_por              uuid references auth.users(id),
  criado_em                   timestamptz not null default now()
);
```

**Origem `ja_existente`** cobre plantas que já estavam no canteiro antes do módulo existir (o pé de uva citado no relatório de WhatsApp é um exemplo real) — cadastro rápido, sem precisar saber data exata de plantio nem quantidade, só pra dar um `plantio_id` pra linkar colheita/manejo dali pra frente. Sem isso, a exigência de vínculo obrigatório na colheita (seção 3.6) travaria o uso em qualquer planta que já existia antes do sistema.

**`status`**: `germinando` só se aplica a lotes de semente recém-plantados, até a confirmação de germinação (que é uma edição simples no registro, atualizando `data_germinacao`/`quantidade_germinada` e movendo o status pra `ativo`). `transplantado` marca um lote que foi 100% movido/dividido pra outro(s) lugar(es) — não resta mais planta ativa nesse registro, mas ele continua existindo como nó da linhagem. `colhido` só fecha automaticamente o plantio quando a cultura é `ciclo_produtivo = 'unico'`; em cultura `continua`, cada colheita é só um registro em `registros_colheita` e o plantio segue `ativo` até alguém marcar manualmente `encerrado` (fim do pé, por qualquer motivo) ou `perdido`.

`plantio_pai_id` monta a linhagem completa: dá pra reconstruir de onde cada lote veio (semente → germinação → transplante(s) → lote atual) com uma CTE recursiva simples:

```sql
with recursive linhagem as (
  select * from plantios where id = :plantio_id
  union all
  select p.* from plantios p join linhagem l on p.id = l.plantio_pai_id
)
select * from linhagem;
```

### 3.5 Nova tabela `plantio_transplantes` — movimentação com divisão de lote

```sql
create table plantio_transplantes (
  id                  uuid primary key default gen_random_uuid(),
  plantio_origem_id   uuid not null references plantios(id),
  plantio_destino_id  uuid not null references plantios(id), -- lote novo, criado nesta mesma operação
  canteiro_destino_id uuid not null references canteiros(id),
  quantidade           numeric,     -- quanto foi transplantado (pode ser parcial ou o lote inteiro)
  observacao           text,
  foto_url              text,
  registrado_por        uuid references auth.users(id),
  registrado_em          timestamptz not null default now()
);
```

Ao registrar um transplante: cria uma linha nova em `plantios` (o lote-filho, com `origem='divisao'`, `plantio_pai_id=plantio_origem_id`, `canteiro_id=canteiro_destino_id`, `cultura_id` herdado do pai, `quantidade_inicial=quantidade transplantada`) **e** uma linha em `plantio_transplantes` amarrando os dois. Se o lote inteiro foi movido (sem divisão), `plantio_origem.status` vira `transplantado`. Se foi uma fração, o lote-pai continua `ativo` com o resto (quantidade restante é sempre calculável somando os transplantes/perdas/doações já registrados contra `quantidade_inicial` — ver view na seção 3.9, não precisa de coluna própria pra saldo).

Isso cobre exatamente o caso descrito: uma bandeja de germinação divide em várias frações, cada uma indo pra um canteiro diferente — cada fração vira seu próprio `plantio`, rastreável dali pra frente de forma independente (inclusive podendo ser transplantada de novo depois, tipo pergolado → teto).

### 3.6 Alterar `registros_colheita` (tabela existente)

```sql
alter table registros_colheita add column plantio_id uuid references plantios(id);
```

`plantio_id` fica **obrigatório na aplicação** pra todo registro novo (a tela de Registrar colheita não deixa salvar sem escolher um plantio ativo daquele canteiro — se for uma planta perene ainda não cadastrada, o fluxo pede pra cadastrar rapidinho como `origem='ja_existente'` antes de continuar). Fica nullable no banco só pra não quebrar os registros antigos que já existem sem esse campo (histórico anterior a este módulo). O campo `cultura` (texto livre) continua existindo pra exibir os registros antigos, mas deixa de ser preenchido em registros novos — a cultura passa a vir do `plantio_id` escolhido.

**Correção (rodada de refinamento desta mesma sessão):** o fechamento do plantio NUNCA é automático a partir de `ciclo_produtivo`. A cultura tem uma prática **sugerida** (pré-marca um checkbox/toggle "essa colheita encerra o plantio?" na tela), mas a pessoa registrando sempre confirma ou troca — porque a mesma espécie pode ser tratada como corte único ou colheita contínua dependendo de como o coletivo realmente maneja (ex.: rúcula, coentro, couve são "tradicionalmente" corte único na literatura, mas este coletivo colhe de forma contínua). `ciclo_produtivo` na ficha é só o valor de partida do checkbox, nunca a regra final.

### 3.7 Nova tabela `registros_perdas` (igual à v1 — já nascia com plantio_id obrigatório, sem mudança)

```sql
create table registros_perdas (
  id             uuid primary key default gen_random_uuid(),
  plantio_id     uuid not null references plantios(id),
  quantidade     numeric,
  unidade        text,
  motivo         text,
  foto_url       text,
  registrado_por uuid references auth.users(id),
  registrado_em  timestamptz not null default now()
);
```

### 3.8 Nova tabela `plantio_doacoes` — doação de mudas/produção (distinta da doação de alimento já colhido)

```sql
create table plantio_doacoes (
  id             uuid primary key default gen_random_uuid(),
  plantio_id     uuid not null references plantios(id),
  quantidade     numeric,
  unidade        text,
  destino        text,     -- texto livre: pra quem/onde foi doado
  observacao     text,
  foto_url       text,
  registrado_por uuid references auth.users(id),
  registrado_em  timestamptz not null default now()
);
```

Esta é doação de **mudas ou de parte de um lote** (ex.: sobrou muda da bandeja, foi doada em vez de transplantada ou perdida) — diferente da doação de **alimento já colhido** pra ZEIS, que já está mapeada no bloco "Venda" do roadmap (não mexe nisso aqui).

### 3.9 Nova tabela `registros_manejo_plantios` — vínculo manejo↔plantio, agora central

```sql
create table registros_manejo_plantios (
  registro_manejo_id uuid not null references registros_manejo(id),
  plantio_id          uuid not null references plantios(id),
  primary key (registro_manejo_id, plantio_id)
);
```

Uso por tipo de manejo:
- **Adubação / capina seletiva**: aplicam ao canteiro inteiro — a aplicação preenche automaticamente esta tabela com todos os plantios `ativo`/`germinando` daquele canteiro no momento do registro, sem exigir nenhum passo extra da pessoa que está registrando.
- **Poda / raleamento**: exigem escolher explicitamente quais plantios foram afetados (pode ser 1 ou vários) — vira campo obrigatório na tela quando o tipo é um desses dois.

Isso é o que permite calcular "próximo manejo devido" por plantio (seção 3.10), inclusive sob consórcio.

### 3.10 View de apoio — saldo do lote e próximo manejo devido

```sql
create view plantios_saldo as
select
  p.id,
  coalesce(p.quantidade_germinada, p.quantidade_inicial)
    - coalesce((select sum(quantidade) from plantio_transplantes where plantio_origem_id = p.id), 0)
    - coalesce((select sum(quantidade) from registros_perdas where plantio_id = p.id), 0)
    - coalesce((select sum(quantidade) from plantio_doacoes where plantio_id = p.id), 0)
    as quantidade_disponivel
from plantios p;
```

A base do cálculo usa `quantidade_germinada` quando ela existir (plantio por semente já confirmado) — sementes que não germinaram não entram no saldo disponível, sem precisar virar um registro formal de perda. Pra origem que não passa por germinação (muda comprada, estaca, já existente, divisão), a base é `quantidade_inicial` diretamente.

Saldo sempre calculado, nunca armazenado — evita divergência entre o que a tela mostra e o que realmente aconteceu. "Próximo manejo devido" por plantio é uma consulta que cruza `culturas_regime_manejo` (regra da cultura) com a última ocorrência daquele `tipo_manejo` pra aquele `plantio_id` em `registros_manejo_plantios` (ou, na ausência de qualquer ocorrência, com a data de referência do próprio plantio — `data_inicio`, `data_germinacao` ou a movimentação de transplante mais recente, conforme o campo `referencia` da regra). Fica como implementação de aplicação (SQL ou código), o modelo já tem todo dado necessário.

### 3.10a Motor de automação — "demandas do dia" (núcleo do pedido de programação automatizada)

Não é uma tabela nova, é uma consulta recalculada sempre que a tela é aberta. Escopo desta rodada: só Horta (Compostagem fica pra quando o bloco "Mais" for construído — mesma lógica, reaproveitável, só que fora de escopo agora).

Pra cada plantio ativo:

1. Olha `culturas_regime_manejo` da cultura daquele plantio — quais tipos de manejo têm regra, a partir de qual `referencia` (plantio/germinação/transplante) e de quantos em quantos dias.
2. Resolve a data do marco **daquele plantio específico**: `referencia='plantio'` → `plantios.data_inicio`; `referencia='germinacao'` → `plantios.data_germinacao` (se ainda não confirmada, a regra não dispara); `referencia='transplante'` → data do último `plantio_transplantes` em que aquele plantio foi o destino (se nunca foi transplantado, a regra não dispara — fica pendente até acontecer).
3. Olha o histórico em `registros_manejo_plantios` (join com `registros_manejo`) pra achar a última ocorrência daquele `tipo_manejo` pra aquele plantio. Se nunca houve, a primeira data devida é `data_do_marco + dias_inicio`. Se já houve, a próxima é `data_da_última_ocorrência + intervalo_dias`.
4. Pra colheita: usa `plantios.previsao_colheita` diretamente (já calculada a partir de `dias_para_colheita_snapshot`).
5. Junta tudo numa lista por canteiro/planta: "hoje", "atrasado" (data devida no passado), "em X dias". Essa lista se soma (não substitui) às tarefas fixas já existentes na Agenda (mutirões, turnos, rega manual geral, ronda observativa) — painel único de demandas.

Adubação e capina não precisam que a pessoa escolha manualmente os plantios (a consulta já usa `canteiro_id` pra achar todos os plantios ativos daquele canteiro); poda e raleamento usam a seleção feita em `registros_manejo_plantios` quando existir — se a poda foi registrada sem especificar plantio, ela não conta pra "próximo manejo devido" de nenhum plantio específico (fica só no nível canteiro, sem alimentar a contagem individual).

### 3.10b Dado de partida pras fichas de cultura (pesquisa agronômica)

Pesquisa dedicada, feita nesta sessão, cobrindo as 68 espécies do histórico real do Pátio (planilha "Tabela de Plantio e Colheita") + 8 espécies regionais comuns em agroecologia urbana no Recife/PE — nada da planilha real foi usado como fonte agronômica (só como lista de escopo), porque os tempos registrados ali eram ruído operacional, não dado de campo confiável (ex.: "487 dias até colheita" da banana era distância entre datas registradas na planilha, não tempo de germinação/plantio real). Cada dado da pesquisa nova tem fonte institucional citada (Embrapa em primeiro lugar, depois Sebrae/IAC/Emater/universidades) — onde não havia fonte confiável, o campo foi marcado como tal, nada foi inventado.

Dois arquivos, na pasta `Arquivos extras/` do projeto e no Project Knowledge:

- `pesquisa_agronomica_culturas.md` — a pesquisa completa, tabela por espécie com fonte citada, pra consulta e correção manual.
- `seed_culturas.sql` — migration pronta com `INSERT INTO culturas` (73 espécies, duplicatas already mescladas: Hortelã, Manjericão, Rúcula) e `INSERT INTO culturas_regime_manejo` (33 regras de manejo extraídas onde havia intervalo numérico claro na pesquisa), testada contra Postgres 16 local com o schema exato desta seção. **Valores são ponto de partida editável, não verdade fixa** — a `observacoes` de cada cultura cita a fonte e sinaliza divergência/baixa confiança onde existir.

Sete identidades ficaram em dúvida real na pesquisa (documentado em `observacoes` de cada uma, sem travar nada — corrige-se depois direto no Cadastro): Batata roxa, Bredo, Espinafre, Vagem, Quiabo estrela, Mirra, Almeirão. Ver `pesquisa_agronomica_culturas.md` pro detalhe de cada dúvida.

Rodar `seed_culturas.sql` depois da migration principal desta seção (precisa que `culturas` e `culturas_regime_manejo` já existam).

### 3.11 RLS

Mesmo padrão já usado nas tabelas do módulo: autenticados leem tudo, autenticados inserem — Coordenação/Equipe/Consultor com leitura+escrita, Lojista sem acesso (mesma matriz da seção 2.3 do Registro Geral).

---

## 4. Telas / fluxo de uso

| Tela | O que faz | Observação |
|---|---|---|
| **Cadastro → Culturas** | Ficha de cultura: solo, rega, ciclo (único/contínuo), dias pra germinação/transplante/colheita, regras de manejo por tipo com marco de referência | Tudo opcional, pode preencher aos poucos |
| **Horta → Registrar plantio** | Escolhe canteiro, cultura, origem (semente/muda comprada/estaca/já existente), quantidade, unidade | Se origem = semente, status inicial `germinando`; senão, `ativo` direto |
| **Horta → Confirmar germinação** | Edição simples de um plantio em `germinando`: data e quantidade germinada, muda status pra `ativo` | Só aparece pra plantios com origem = semente ainda não confirmados |
| **Horta → Transplantar** | Escolhe plantio ativo, canteiro de destino, quantidade (pode ser parcial) | Cria lote-filho automaticamente, mantém linhagem |
| **Horta → Mapa** | Canteiro × plantios ativos (com origem, quantidade, dias restantes pra cada marco), sinaliza consórcio | Deixa visível a linhagem (de onde veio / pra onde foi) quando a pessoa abre um plantio específico |
| **Horta → Registrar colheita** (existente, ajustada) | Escolhe canteiro → escolhe plantio ativo daquele canteiro (obrigatório) → peso em KG | Cultura vem do plantio, não é mais digitada. Fecha o plantio automaticamente se `ciclo_produtivo = 'unico'` |
| **Horta → Registrar perda** (nova) | Escolhe plantio ativo, quantidade/unidade, motivo opcional | Simples, poucos campos |
| **Horta → Registrar doação (de muda/produção)** (nova) | Escolhe plantio ativo, quantidade/unidade, destino | Distinta da doação de alimento já colhido (bloco Venda) |
| **Horta → Manejo** (existente, ajustada) | Adubação/capina: aplica automático a todos os plantios ativos do canteiro, sem passo extra. Poda/raleamento: exige escolher quais plantios | — |
| **Plantio → marcar como perdido/doado/encerrado** | Ação manual no card do plantio, pros casos que não vêm de um registro formal (ex.: planta morreu, sem evento de "perda" detalhado) | — |
| **Avisos automáticos** | Próxima germinação esperada, transplante recomendado, colheita prevista, manejo periódico devido — por plantio, cruzando `culturas_regime_manejo` com o histórico de eventos daquele plantio | Onde aparece (Agenda existente vs. tela própria) é decisão de UI, não muda o modelo |
| **Relatório de produtividade** (fica pra depois, mas já habilitado pelo modelo) | Rendimento por plantio/cultura/canteiro (soma de `registros_colheita.peso_kg` agrupado), tempo até primeira colheita | Não precisa desenhar tela agora — é consulta em cima do que já existe |

---

## 5. Ordem de construção sugerida

1. Migration completa (seção 3)
2. Cadastro → Culturas (ficha + regime de manejo)
3. Registrar plantio (com origem) + Confirmar germinação
4. Transplantar (com divisão de lote) + Mapa (mostrando linhagem)
5. Registrar colheita ajustada (vínculo obrigatório a plantio, fecha lote quando `unico`)
6. Registrar perda + Registrar doação
7. Manejo ajustado (auto-vínculo adubação/capina, seleção manual poda/raleamento)
8. Avisos automáticos (germinação/transplante/colheita previstos + manejo periódico devido)

Mesmo com "tudo de uma vez" como escopo geral, testar nesta ordem interna evita acumular risco demais antes do primeiro teste real.

---

## 6. O que fica de fora desta rodada (não foi pedido)

- Rega periódica automatizada — só manejo (poda/adubação/raleamento) e colheita entram na programação automática.
- Relatório de produtividade como tela pronta — o modelo habilita, a tela fica pra quando fizer sentido (possivelmente junto do bloco Mais/ESG-ODS, ou quando a feira chegar e produtividade virar critério de avaliação, como o usuário mencionou).
