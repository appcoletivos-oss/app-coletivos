-- =============================================================================
-- Seed: culturas + culturas_regime_manejo (Módulo Horta — App Coletivo)
-- =============================================================================
-- Origem dos dados: pesquisa agronômica consolidada (pesquisa_horta_consolidado.md),
-- 76 linhas de espécie cobrindo dias_germinacao, dias_transplante, dias_colheita,
-- ciclo_produtivo e regime_manejo, cada uma com fonte institucional citada
-- (Embrapa, IAC, Sebrae, Emater, universidades — hierarquia de confiança:
-- Embrapa > Sebrae/IAC > Emater > extensão universitária > fonte comercial).
--
-- Regras aplicadas na conversão (ver instruções completas no prompt original):
--  1. Número único encontrado -> usado diretamente.
--  2. Faixa de dias -> ponto médio arredondado.
--  3. Divergência real entre fontes -> preferida a fonte mais específica/dedicada
--     à espécie; alternativa descartada resumida em `observacoes`.
--  4. "Sem fonte confiável encontrada" -> coluna NULL, nunca inventado.
--  5. Propagação vegetativa -> dias_para_germinacao NULL, método anotado em
--     `observacoes`.
--  6. Semeadura direta sem transplante -> dias_para_transplante NULL, anotado.
--  7. ciclo_produtivo: valor de partida a partir da literatura (default 'unico'
--     em empate genuíno) — EDITÁVEL, não é verdade fixa.
--  8/9. `observacoes`, `solo_ideal` e `rega_ideal` resumem o texto qualitativo de
--     regime_manejo; ressalvas de identidade incerta (mirra, quiabo estrela,
--     vagem, bredo, batata roxa, almeirão) foram reaproveidas do texto original.
--
-- IMPORTANTE: estes valores são um PONTO DE PARTIDA EDITÁVEL PELA EQUIPE,
-- não uma verdade fixa. Vários números são pontos médios de faixas, extrapolações
-- entre cultivares/variedades ou dados regionais (nem sempre de Recife-PE) —
-- revisar com a equipe do Pátio de Compostagem / Chié do Entra antes de tratar
-- como definitivo, especialmente onde `observacoes` sinaliza confiança baixa
-- ou divergência entre fontes.
--
-- Duplicatas da pesquisa original mescladas em uma única linha cada:
--   "Hortela" + "Hortelã"              -> "Hortelã"
--   "Manjericao Verde" + "Manjericao"  -> "Manjericão"
--   "Rucula" + "Rucula (Semente)"      -> "Rúcula"
-- Nomes corrigidos ortograficamente em relação à pesquisa original (ex.: Jiló,
-- Alho poró, Batata-doce, Erva-doce, Cana-de-açúcar, Tomate-cereja,
-- Ora-pro-nóbis, Salsão).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) culturas (73 espécies únicas)
-- -----------------------------------------------------------------------------
insert into culturas
  (nome, solo_ideal, rega_ideal, ciclo_produtivo, dias_para_germinacao, dias_para_transplante, dias_para_colheita, observacoes)
values
  ('Abacaxi', NULL,
   'Irrigação importante a partir do 2º mês após o plantio, intensificando a partir do 5º mês (fase de engorda do fruto).',
   'unico', NULL, NULL, 390,
   'Fonte: Embrapa (Como plantar abacaxi). Propagação vegetativa (muda tipo coroa, filhote ou rebentão) — sem semeadura; mudas plantadas diretamente no local definitivo (sem transplante). Primeira colheita 12-14 meses após o plantio da muda, não desde semente; usado 390 dias (13 meses, ponto médio). Pode haver 2ª produção (soca), tratada como novo ciclo.'),
  -- fonte: Embrapa — Como plantar abacaxi

  ('Abóbora', NULL,
   'Irrigar diariamente até 30-50 dias, depois a cada 4 dias, suspendendo perto da colheita.',
   'unico', 5, 15, 120,
   'Fonte principal: CT-175 Embrapa (Recomendações técnicas para abóboras e morangas, fonte dedicada à espécie), 90-150 dias até colheita conforme cultivar (120, ponto médio) — preferida sobre a Infoteca Cultivo de Hortaliças (120-150 dias) e a tabela geral Embrapa (90-120 dias), menos específicas.'),
  -- fonte: CT-175 Embrapa (dedicada a abóboras/morangas)

  ('Abobrinha', NULL,
   'Rega diária até a raleação, depois a cada 3 dias.',
   'continuo', 5, NULL, 65,
   'Fonte principal: Embrapa Infoteca-e (Cultivo de Hortaliças), 60-70 dias até colheita (65, ponto médio). Fontes divergem: Emater-PA ~60 dias, tabela geral Embrapa 45-60 dias, CT-47 60-90 dias. Semeadura direta em covas é a prática mais comum (sem transplante de muda); o número de 14-16 dias para transplante é extrapolado de abóbora/moranga, confiança baixa, não usado.'),
  -- fonte: Embrapa Infoteca-e — O Cultivo de Hortaliças

  ('Acerola', NULL,
   'Rega mais frequente em solo arenoso, menos frequente em solo argiloso (sem intervalo numérico definido na fonte).',
   'continuo', NULL, NULL, 255,
   'Fonte: Embrapa (PLANTAR Acerola). Propagação vegetativa por estaquia (mais recomendada comercialmente) ou enxertia; sementes têm germinação baixa (20-30%), não recomendadas para pomares comerciais. Primeira frutificação 5-12 meses após o plantio da muda (255 dias, ponto médio). 3-4 safras/ano, safra maior de out. a abr. no Submédio São Francisco.'),
  -- fonte: Embrapa — PLANTAR Acerola

  ('Agrião', NULL,
   'Irrigação diária/constante — o agrião exige alta umidade do solo.',
   'continuo', 10, 23, 60,
   'Fontes divergem no prazo de colheita: Emater-PA cita 50 dias desde a semeadura; tabela geral Embrapa cita 60-70 dias. Usado valor intermediário (60 dias). Confiança média (poucas fontes, com divergência numérica).'),
  -- fonte: Emater-PA + Embrapa (divergentes, valor intermediário usado)

  ('Alecrim', 'Solo bem drenado — a planta não tolera excesso de umidade/encharcamento.',
   'Regar ao menos 1x/dia, evitando encharcamento.',
   'continuo', NULL, NULL, NULL,
   'Fonte: Embrapa (Ficha técnica Alecrim FOL68; Propagação vegetativa do alecrim de tabuleiro). Propagação vegetativa por estaquia (mais comum) ou divisão de touceiras. Sem dados numéricos de prazo até colheita/transplante em fonte confiável — colheita é seletiva (folhas adultas, deixando 1/3 da planta para rebrota). Espaçamento 50x70cm.'),
  -- fonte: Embrapa Infoteca-e FOL68

  ('Alface', NULL,
   'Rega 2x/dia na sementeira, diária nos canteiros.',
   'unico', 1, 25, 50,
   'Fonte principal: Embrapa (Cultivo de Hortaliças), 40-60 dias até colheita (50, ponto médio). Outras fontes citam 50-80 dias (tabela geral, variando por estação) e ~25 dias pós-transplante (Emater-PA). Dado de germinação (~24h = 1 dia) vem de fonte única (Emater-PA) e é atipicamente baixo para o padrão agronômico da espécie — usar com cautela.'),
  -- fonte: Embrapa Infoteca-e — O Cultivo de Hortaliças

  ('Alface Roxa', NULL,
   'Rega 2x/dia na sementeira, diária nos canteiros (mesmo manejo da alface comum).',
   'unico', 1, 25, 50,
   'Mesma espécie botânica da Alface (Lactuca sativa); nenhuma fonte oficial brasileira estabelece parâmetros numéricos próprios para cultivares roxas — valores extrapolados da Alface comum (Embrapa Cultivo de Hortaliças). Confiança média (dados extrapolados, não específicos da cultivar roxa).'),
  -- fonte: extrapolado de Alface (Embrapa) — sem dado numérico próprio para cultivar roxa

  ('Alho', NULL,
   'Rega a cada 2 dias até a formação do bulbo, depois a cada 7 dias até o início da maturação.',
   'unico', NULL, NULL, 165,
   'Fonte: Embrapa (O Cultivo de Hortaliças; CT-47; Dormência dos bulbilhos; Sistemas de plantio). Propagação vegetativa por bulbilhos (dentes de alho) — não propagado por semente comercialmente; bulbilhos plantados diretamente, precisam superar dormência (IVD >=70%) antes do plantio.'),
  -- fonte: Embrapa Hortaliças

  ('Alho poró', NULL,
   'Regas diárias.',
   'unico', NULL, NULL, 110,
   'Fonte principal: Embrapa (O Cultivo de Hortaliças). Critério de transplante é por diâmetro do talo (~5mm), não por dias — fonte institucional não dá número de dias, por isso dias_para_transplante ficou NULL. Fonte comercial (Hortas.info, confiança baixa) cita ~60 dias como alternativa, não usada aqui. Germinação sem fonte confiável.'),
  -- fonte: Embrapa Infoteca-e — O Cultivo de Hortaliças

  ('Amora', NULL,
   'Irrigação de 25-30mm/semana, em pelo menos 2x/semana (diária em solo arenoso ou alta demanda).',
   'continuo', NULL, NULL, 730,
   'Fonte: Embrapa (Cultivo da Amora-preta CT75; Sistema de Produção da Amoreira-Preta). Propagação vegetativa (estaquia de raiz é a mais usada). Entra em produção no 2º ano após plantio da muda/estaca (dias_para_colheita aproximado em 730 dias = 2 anos). Poda anual estruturada por estação (desbaste/desponte no outono do ano 1, desponte na primavera do ano 2, remoção pós-colheita, encurtamento no inverno) — não incluída em culturas_regime_manejo por não ter um intervalo único em dias, ver manual completo Embrapa CT75.'),
  -- fonte: Embrapa — Cultivo da Amora-preta (CT75)

  ('Banana', NULL,
   'Fertirrigação a cada 15 dias em solo argiloso; semanal em solo arenoso.',
   'continuo', NULL, NULL, 270,
   'Fonte: Embrapa (Livro Banana — Sistemas de Produção; Cultura da Bananeira; Mudas de Bananeira). Usado dado de baixa altitude (0-300m, compatível com Recife-PE litorâneo): 8-10 meses até 1ª colheita (270 dias, ponto médio). Fonte por cultivar cita 12,6-15,9 meses, alternativa não usada por ser menos aplicável ao contexto de Recife. Propagação vegetativa (mudas de rizoma/perfilhos ou micropropagadas); duração exata de viveiro sem fonte confiável.'),
  -- fonte: Embrapa — Livro Banana / Cultura da Bananeira

  ('Batata-doce', NULL,
   'Irrigação leve e frequente na 1ª semana; período crítico entre 40-55 dias após o plantio (~40mm de água/semana).',
   'unico', NULL, NULL, 120,
   'Fonte: Embrapa (Sistema de Produção de Batata-Doce). Ciclo geral 90-150 dias após o plantio da rama (120, ponto médio); varia por cultivar (Beauregard 120-150 dias; Brazlândia ~150 dias). Propagação vegetativa por ramas (ponteiros de 6-8 entrenós, ~30cm); rama plantada diretamente no local definitivo, sem fase separada de germinação/transplante.'),
  -- fonte: Embrapa — Sistema de Produção de Batata-Doce

  ('Batata roxa', NULL, NULL,
   'unico', NULL, NULL, 135,
   'IDENTIDADE: cultivares de batata-doce de polpa roxa (BRS Anembé, BRS Cotinga). Fonte: Embrapa (fichas das cultivares; Sistema de Produção de Batata-Doce). Ciclo mais longo (130-140 dias, 135 ponto médio) que a batata-doce comum. Resistentes ao nematoide-das-galhas (Meloidogyne javanica); BRS Cotinga tem alta exigência de calor, recomendado plantio em meses quentes em regiões frias. Fichas de cultivar não detalham rega/adubação específicas — regime de manejo pode ser extrapolado da Batata-doce comum (ver linha correspondente), com confiança média.'),
  -- fonte: Embrapa — fichas BRS Anembé / BRS Cotinga

  ('Beldroega', NULL,
   'Planta tolerante à seca; não exige rega frequente (frequência exata não encontrada).',
   'continuo', NULL, NULL, NULL,
   'Fonte: Embrapa (capítulo sobre PANCs do Nordeste). Confiança baixa — germina "rapidamente" sem quantificação; transplante e colheita sem fonte confiável em número de dias. Semeadura direta viável, transplante não é etapa obrigatória.'),
  -- fonte: Embrapa — Espécies nativas da flora brasileira (PANCs Nordeste)

  ('Berinjela', 'Solo com boa retenção de umidade e boa drenagem; não tolera encharcamento.',
   NULL,
   'continuo', 5, 30, 60,
   'Fonte: Embrapa Hortaliças (Produção de mudas; Tratos culturais; Solos; cultivar Ciça). Dias até colheita (~60 dias após transplante) referem-se à cultivar Ciça (alto potencial produtivo, ~120 t/ha).'),
  -- fonte: Embrapa Hortaliças — cultivar Ciça

  ('Beterraba', NULL,
   'Reposição diária da água evapotranspirada, fracionada em várias aplicações (especialmente na fase de emergência, semeadura direta no verão).',
   'unico', NULL, 25, 90,
   'Fonte principal: Boletim Técnico IAC/Embrapa (Beterraba: do Plantio à Comercialização, fonte dedicada à espécie), 70-110 dias até colheita (90, ponto médio). Fonte alternativa (Sebrae, Catálogo Brasileiro de Hortaliças) cita 60-70 dias, descartada por ser tabela geral menos específica. Germinação sem fonte confiável em dias (só temperatura ótima, 10-15°C).'),
  -- fonte: Boletim Técnico IAC/Embrapa (dedicado à beterraba)

  ('Boldo', NULL,
   'Água limpa e de boa qualidade; a planta não tolera solo encharcado (frequência exata não encontrada).',
   'continuo', NULL, NULL, NULL,
   'Fonte: Embrapa (Boldo — Folder Técnico 74). Colheita seletiva de folhas adultas, antes da floração, sem prazo fixo em dias. Espaçamento 0,50m x 1m. Propagação usual por estaquia de galhos.'),
  -- fonte: Embrapa Infoteca-e FOL74

  ('Bredo', NULL,
   'Irrigar quando necessário para aumentar a produção de folhas; a planta tolera bem estresse hídrico.',
   'continuo', NULL, NULL, 42,
   'Identidade: bredo/caruru (Amaranthus spp.), cultivar Embrapa BRS Ilekalu. Fonte institucional (Embrapa) indica colheita de folhas, compatível com corte contínuo, 35-49 dias (42, ponto médio). Fonte comercial (blog, confiança baixa) diverge, classificando como colheita única da planta inteira (40-60 dias) — optou-se pela classificação institucional (contínuo). Dado de adubação (até 3,0kg/m² de composto) é de fonte não institucional, confiança baixa, não incluído em regime_manejo.'),
  -- fonte: Embrapa — Caruru BRS Ilekalu (institucional)

  ('Cana-de-açúcar', NULL, NULL,
   'continuo', NULL, NULL, 360,
   'Fonte: Embrapa (Sistema de Produção de Cana-de-açúcar para Agricultura Familiar). Propagação vegetativa por toletes/minitoletes (viveiro de minitoletes: 30-60 dias). 1º corte aos 10-14 meses (360 dias, ponto médio); cultura semiperene com cortes de soqueira/cana-soca por vários anos (uma fonte cita 5-7 anos no RS) sem replantio.'),
  -- fonte: Embrapa — Sistema de Produção de Cana-de-açúcar

  ('Cebolinho', NULL,
   'Rega diária.',
   'continuo', 6, 35, 105,
   'Fonte principal: Embrapa Infoteca FOL105 (ficha dedicada à Cebolinha), ciclo de 3-4 meses (90-120 dias, usado 105 como ponto médio). Fontes alternativas divergem: Emater-PA cita 60 dias após plantio definitivo; Embrapa Semiárido CT47 cita 70-90 dias desde semeadura — descartadas por serem tabelas gerais de hortaliças, menos específicas que a ficha dedicada à espécie.'),
  -- fonte: Embrapa Infoteca-e FOL105 (dedicada à cebolinha)

  ('Cenoura', NULL,
   'Irrigação em dias alternados até o 1º desbaste; depois a cada 3 dias por ~60 dias; depois semanal até a colheita, suspendendo na semana final.',
   'unico', 7, NULL, 85,
   'Fonte principal: Embrapa Semiárido (Sistema de Produção para Cenoura, Bahia — fonte dedicada à espécie) — cultivares Nova Kuroda (~80 dias) e Nantes (~90 dias), usado 85 dias como valor representativo. Convergente com tabela geral Embrapa (85-110 dias) e Emater-PA (90 dias). Semeadura direta, sem transplante.'),
  -- fonte: Embrapa Semiárido — Sistema de Produção para Cenoura (Bahia)

  ('Coentro', NULL,
   'Rega diária.',
   'unico', 6, NULL, 55,
   'Fonte: convergência entre Emater-PA, Embrapa Semiárido CT47 e Embrapa CNPH. Faixas divergem (40-70 dias); usado valor de sobreposição entre as fontes (~55 dias). Ciclo padrão da literatura é único (planta arrancada após colheita), mas cortes sucessivos das folhas são praticados informalmente por coletivos — vale testar na prática.'),
  -- fonte: Emater-PA + Embrapa (convergência entre fontes)

  ('Couve', NULL,
   'Rega diária até o pegamento das mudas, depois a cada 2-3 dias (ou diária se não chover, conforme a fonte).',
   'continuo', 4, 31, 75,
   'Fonte principal: IAC Boletim Técnico 214 (Couve de folha: do plantio à pós-colheita, fonte dedicada à espécie), início de colheita 60-90 dias após transplante (75, ponto médio). Outras fontes: Embrapa CNPH ~70 dias; Emater-PA 60 dias no verão. Ciclo produtivo total (170-240 dias / 6-8 meses) é diferente do início da colheita — não confundir. Dado de germinação inconsistente até dentro da mesma fonte (Emater-PA cita 3-4 dias em duas seções).'),
  -- fonte: IAC Boletim Técnico 214 (dedicado à couve de folha)

  ('Curry', NULL,
   'Regar 2-3x/semana enquanto jovem; espaçar regas na planta adulta (fonte comercial, confiança baixa).',
   'continuo', NULL, NULL, NULL,
   'Nenhuma fonte institucional brasileira (Embrapa/IAC/Emater) cobre esta espécie — única fonte encontrada é comercial (viveiro Sítio da Mata), confiança baixa. Todos os campos numéricos ficaram sem dado confiável.'),
  -- fonte: Sítio da Mata (comercial, confiança baixa — sem alternativa institucional)

  ('Erva-doce', NULL, NULL,
   'unico', 7, NULL, 80,
   'Fonte: Embrapa (DOC13004 Plantas Condimentares; CT70). Dados referem-se ao funcho (Foeniculum vulgare) — no Brasil, tanto funcho quanto anis (Pimpinella anisum) são popularmente chamados "erva-doce"; a ficha específica cobre apenas o funcho. Adubação orgânica de base (5 L/m² de composto/esterco) é pré-plantio (15-20 dias antes), não é cobertura recorrente — por isso não gerou linha em regime_manejo. Rega descrita apenas como "essencial", sem frequência.'),
  -- fonte: Embrapa — DOC13004 Plantas Condimentares

  ('Espinafre', NULL,
   'Rega diária na sementeira, a cada 2 dias no canteiro.',
   'continuo', 7, NULL, 35,
   'ATENÇÃO: as fontes institucionais tratam de Spinacia oleracea, espécie de clima ameno que se adapta mal ao calor de Recife — para horta tropical litorânea, avaliar substituição por espinafre-da-nova-zelândia (Tetragonia expansa), mais tolerante ao calor (sem fonte institucional própria localizada). Fonte principal: Embrapa CNPH, colheita 30-40 dias após transplante (35, ponto médio). Emater-PA diverge, classificando a espécie como semeadura direta (sem transplante), com colheita 50-60 dias após semeadura — as duas práticas aparecem na literatura sem uma ser claramente padrão; dias_para_transplante ficou NULL por falta de número em dias na fonte que recomenda transplante.'),
  -- fonte: Embrapa CNPH (Cultivo de Hortaliças) — divergência com Emater-PA

  ('Feijão', NULL,
   'Sem intervalo em dias definido; a cultura é mais sensível a déficit hídrico nas fases de floração e enchimento de vagens — atenção redobrada à umidade do solo nesses períodos.',
   'unico', NULL, NULL, 70,
   'Fonte: Embrapa (Aspectos Fenológicos do Feijoeiro Comum; 500 Perguntas 500 Respostas). Ciclo total varia por tipo de crescimento: Tipo I (arbustivo determinado) 60-80 dias (usado aqui, 70 dias, mais comum em hortas comunitárias); Tipo II 80-90 dias; Tipo III 85-90 dias; Tipo IV (trepador) 100-110 dias — ajustar conforme a variedade cultivada. Semeadura direta, sem transplante. Germinação sem fonte confiável em dias.'),
  -- fonte: Embrapa — Aspectos Fenológicos do Feijoeiro Comum

  ('Goiaba', NULL,
   'Irrigação diária em solo arenoso; intervalo máximo de 2 dias em solo médio a argiloso.',
   'continuo', NULL, 150, 450,
   'Fonte: Embrapa (A cultura da goiaba — Coleção Plantar; Boas práticas agrícolas para produção orgânica de goiaba, Doc 254/2022). Primeira produção com 12-18 meses (450 dias, ponto médio) da muda; cultivares enxertadas atingem plena colheita comercial (~40 t/ha) por volta de 30 meses após transplantio — marco diferente, não confundir. dias_para_transplante (150 dias) refere-se a mudas por estaquia (4-6 meses sob ripado); mudas por semente não têm prazo em dias, só critério de altura (30-40cm). Germinação de semente sem fonte confiável.'),
  -- fonte: Embrapa — A cultura da goiaba (Coleção Plantar)

  ('Graviola', NULL,
   'Necessidade hídrica de 1.000-1.200mm/ano; no Nordeste semiárido, irrigação a cada 14 dias (ex.: 20L/planta a cada 2 semanas).',
   'continuo', NULL, NULL, 700,
   'Fonte: Embrapa (A cultura da gravioleira — Coleção Plantar), fonte única mas específica e detalhada. Propagação recomendada por enxertia (garfagem) sobre porta-enxerto, não por semente pura — produz plantas uniformes com início de produção mais cedo (antes do 2º ano vs 3º ano por semente); dias_para_colheita (700 dias) é aproximado por falta de número exato na fonte. Germinação e duração exata do viveiro sem fonte confiável.'),
  -- fonte: Embrapa — A cultura da gravioleira (Coleção Plantar)

  ('Hortelã', 'Solo mantido úmido e sombreado.',
   'Manter solo úmido e sombreado (sem frequência exata em dias).',
   'continuo', NULL, NULL, NULL,
   'Fonte: Embrapa Infoteca-e (Hortelã, FOL90). Propagação vegetativa por divisão de rizomas/estolões (~10cm), plantados diretamente (espaçamento 20x30cm). Colher no início da floração; 2-3 cortes/ano; lavoura com longevidade de até 4 anos. Registro único mescla as entradas duplicadas "Hortelã" e "Hortela" da pesquisa original (mesma espécie).'),
  -- fonte: Embrapa Infoteca-e FOL90 (mescla Hortelã + Hortela)

  ('Jaboticaba', NULL,
   '~3x/semana em períodos secos, principalmente nos primeiros anos (fonte de confiança baixa).',
   'continuo', NULL, NULL, 1460,
   'Fonte principal para tempo até frutificação/rega/adubação/poda: Estado de Minas (confiança baixa, não institucional); fenologia de floração/maturação (florada de set. a out., frutos maduros nas 2 primeiras semanas de novembro) é de fonte Embrapa Clima Temperado (Doc 129), confiança alta. Nenhuma fonte institucional (Embrapa/IAC) foi encontrada com números específicos de tempo até frutificação. Usado valor de muda enxertada/alporquia (3-5 anos = 1460 dias, ponto médio), método recomendado para antecipar frutificação; muda de semente leva 8-15 anos.'),
  -- fonte: Estado de Minas (confiança baixa) + Embrapa Doc 129 (fenologia)

  ('Jiló', NULL,
   'Irrigação por gotejamento recomendada (sem intervalo exato); alternativa regional: a cada 2-3 dias.',
   'continuo', 14, 35, 90,
   'Fonte: Embrapa Infoteca-e (Coleção Plantar: Jiló; CT47). Colheita: 80-100 dias desde a semeadura (90, ponto médio), compatível com faixa regional de 90-100 dias. 1-2 colheitas semanais, prolongando-se por 3-5 meses.'),
  -- fonte: Embrapa Infoteca-e — Coleção Plantar: Jiló

  ('Laranja', NULL,
   'Rega diária em viveiro; pomar formado depende de regime pluvial de 900-1.500mm/ano.',
   'continuo', NULL, NULL, 1278,
   'Fonte: Embrapa (Sistemas de Produção — Citros Nordeste; 500 Perguntas 500 Respostas: Citros; Documentos 444). Dado regional Nordeste, aplicável ao clima de Recife/PE. Início de produção aos 3-4 anos (1278 dias, ponto médio) da muda enxertada; produção máxima entre 10-12 anos. Propagação vegetativa por enxertia sobre porta-enxerto; dias de germinação do porta-enxerto e duração exata do viveiro não especificados (Embrapa só estabelece limite máximo de 24 meses de idade da muda).'),
  -- fonte: Embrapa — Sistemas de Produção Citros Nordeste

  ('Limão', NULL,
   'Rega diária em viveiro; pomar formado depende de regime pluvial de 900-1.500mm/ano.',
   'continuo', NULL, NULL, 1278,
   'Fonte: Embrapa (dado geral do gênero Citros, não desagregado por espécie — mesmas fontes de Laranja: Sistemas de Produção Citros Nordeste; 500 Perguntas 500 Respostas; Documentos 444). Início de produção aos 3-4 anos (1278 dias, ponto médio) da muda enxertada. Propagação vegetativa por enxertia.'),
  -- fonte: Embrapa (dado geral de citros, igual à Laranja)

  ('Macaxeira', NULL,
   'Cultivo tradicionalmente de sequeiro; recomenda-se plantio no início da estação chuvosa, com chuva regular nos 4 meses seguintes.',
   'unico', NULL, NULL, 240,
   'Fonte: Embrapa (Cartilha Mandioca 2013; Circular Técnica 77). 8º mês (240 dias) apontado como ponto ótimo entre produtividade de raízes e qualidade culinária (estudo regional, cultivar Aipim Manteiga, Amazonas — dado regional, confiança média para este número específico). Faixa geral 6-12 meses. Propagação vegetativa por manivas (estacas de caule, 15-20cm, de plantas com 10-14 meses); manivas plantadas diretamente, sem transplante.'),
  -- fonte: Embrapa — Cartilha Mandioca / Circular Técnica 77

  ('Mamão', NULL,
   'Rega diária (viveiro coberto) ou 2x/dia (viveiro descoberto); planta adulta conforme chuvas/umidade do solo.',
   'continuo', 15, 45, 225,
   'Fonte: Embrapa (Coleção Plantar: Mamão; Mamoeiro do Grupo Solo). Início de produção 7-8 meses após plantio (225 dias, ponto médio) — variedade Improved Sunrise Solo: 8º mês; outras do grupo Solo: 7-10 meses. Floração inicia aos 3-4 meses.'),
  -- fonte: Embrapa — Coleção Plantar: Mamão

  ('Manjericão', NULL,
   'A cada 2-3 dias ou quando o solo estiver seco (fonte comercial, confiança baixa).',
   'continuo', 10, 18, 90,
   'Fonte principal: Embrapa (Manjericão: Cultivo e Utilização DOC11004; Folder Manjericão) — dados qualitativos de alta confiança (colher na floração, retirando as primeiras florações para prolongar produção), mas sem número exato de dias. Números de germinação, transplante, rega e colheita majoritariamente de fonte comercial (Blog Plantei), confiança baixa. Registro único mescla as entradas duplicadas "Manjericao Verde" e "Manjericao" da pesquisa original (mesma espécie, Ocimum basilicum).'),
  -- fonte: Embrapa DOC11004 (qualitativo) + Blog Plantei (números, confiança baixa)

  ('Maracujá', NULL, NULL,
   'continuo', 6, 75, 210,
   'Fonte: Embrapa/Incaper (Colheita — Portal Embrapa; Produção de Mudas de Maracujá-doce; Recomendações Técnicas; Teste de germinação Incaper). Germinação (4-8 dias, 6 ponto médio) é de teste laboratorial (BOD, Incaper) — não necessariamente representa condição de viveiro/campo. Muda pronta para plantio definitivo 60-90 dias após germinação (75, ponto médio); fonte alternativa cita 80-90 dias antes da implantação, com transplante intermediário aos 21 dias. Primeira colheita 6-8 meses após plantio da muda (210 dias); após florescimento, frutos prontos em mais 40-60 dias. Colheita realizada 3x/semana.'),
  -- fonte: Embrapa (múltiplas) + Incaper (teste de germinação)

  ('Maxixe', NULL,
   'Regas a cada 3 dias.',
   'continuo', NULL, NULL, 65,
   'Fonte: Embrapa (O cultivo de hortaliças); UFERSA (germinação sob estresse salino — menciona apenas que mudas foram transplantadas 7 dias após emergência, em contexto experimental, sem número exato de germinação). Semeadura direta, sem transplante (prática padrão é semear 2-3 sementes/cova, com raleio). Adubação de cobertura sem fonte confiável especificamente para maxixe.'),
  -- fonte: Embrapa Infoteca-e + UFERSA

  ('Melancia', NULL,
   'Rega a cada 2-4 dias em solo arenoso, 5-7 dias em solo argiloso; reduzir/interromper perto da maturação dos frutos.',
   'unico', NULL, 12, 95,
   'Fonte: Embrapa (Sistema de Produção Melancia — produção de mudas, adubação, tratos culturais; Como produzir melancia; Apostila Manejo Eficiente). Ciclo 80-110 dias após o plantio (95, ponto médio); uma fonte cita ~85 dias total; frutos amadurecem 40-45 dias após abertura das flores (métrica diferente). Germinação sem fonte confiável em dias (só temperatura ideal, 20-35°C).'),
  -- fonte: Embrapa — Sistema de Produção Melancia

  ('Melissa', NULL, NULL,
   'continuo', NULL, NULL, NULL,
   'Fonte: Embrapa Clima Temperado (Folder Erva-cidreira FOL85). Propagação por estacas (fácil enraizamento, prazo exato não informado); muda plantada diretamente no espaçamento definitivo (50x70cm), sem fase de transplante separada. Colheita de folhas adultas e flores, sem prazo definido. Ciclo produtivo presumido contínuo (planta perene de folhas colhidas repetidamente), mas a fonte não classifica isso explicitamente.'),
  -- fonte: Embrapa Clima Temperado FOL85

  ('Melão', NULL,
   'Necessidade hídrica total do ciclo: 300-550mm; fase de frutificação é a mais crítica. No polo Nordeste, irrigação diária por gotejamento.',
   'unico', NULL, 11, 68,
   'Fonte: Embrapa (PLANTAR Melão; A Cadeia Produtiva do Melão no Nordeste). Usado dado regional do Nordeste (polo Vale do São Francisco/Mossoró-Açu, mais próximo do contexto de Recife-PE): 65-70 dias após o plantio (68, ponto médio). Fonte por grupo de cultivar diverge: precoces 55-70 dias, médias 75-80 dias, tardias 80+ dias. Germinação sem fonte confiável em dias.'),
  -- fonte: Embrapa — Cadeia Produtiva do Melão no Nordeste (dado regional)

  ('Menta', 'Prefere solo úmido.', NULL,
   'continuo', NULL, NULL, NULL,
   'Fonte: Embrapa (Hortelã, Folder FOL90) — a fonte trata do gênero Mentha/"hortelã" genericamente; não há ficha específica para "menta" como nome popular distinto. Propagação vegetativa por divisão de rizomas/estolões (~10cm), plantados a 20x30cm, sem fase de transplante separada. Lavoura com longevidade de até 4 anos, 2-3 cortes/ano.'),
  -- fonte: Embrapa Infoteca-e FOL90 (gênero Mentha, genérico)

  ('Milho', NULL,
   'Turnos frequentes (a cada 1-2 dias) nos primeiros 15 dias após a semeadura (fase crítica); depois conforme evapotranspiração de cada fase.',
   'unico', 5, NULL, 75,
   'Fonte: Embrapa (Com39 Germinação e Emergência; Plantio; Milho Verde espaçamentos; Manejo da Irrigação). Usado dado de milho verde (colheita 70-80 dias, 75 ponto médio), mais relevante para consumo em horta comunitária; milho seco em grãos leva ~120 dias. Germinação: 4-5 dias em condições favoráveis (pode levar até 2 semanas em baixa temperatura/pouca umidade). Semeadura direta, sem transplante.'),
  -- fonte: Embrapa — Com39 (Germinação e Emergência) e correlatas

  ('Mirra', 'Candidato (a) C. myrrha: solo bem drenado, baixa retenção de umidade, tolera seca — incompatível com o clima tropical litorâneo úmido de Recife a céu aberto.',
   NULL,
   'unico', NULL, NULL, NULL,
   'IDENTIDADE AMBÍGUA — dois candidatos possíveis para "Mirra": (a) Commiphora myrrha (mirra verdadeira, clima árido/semiárido, incompatível com o clima de Recife a céu aberto) ou (b) Tetradenia riparia ("falsa-mirra", mais adaptável ao clima tropical úmido brasileiro, vendida em viveiros no Brasil). Nenhuma fonte institucional brasileira de agronomia cobre qualquer um dos dois candidatos — confiança baixa em todos os campos. Recomenda-se esclarecer com o coletivo qual planta é efetivamente cultivada antes de usar este registro operacionalmente.'),
  -- fonte: Jardineiro.net (a) + Revista Científica Rural/URCAMP (b, acesso não confirmado) — ambas confiança baixa

  ('Morango', NULL,
   'Irrigação por gotejamento, mantendo o solo próximo à capacidade de campo (raiz efetiva a ~30cm).',
   'continuo', NULL, NULL, 70,
   'Fonte: Embrapa (Sistema de Produção do Morango). Propagação vegetativa: mudas de plantas matrizes por cultura de tecidos, multiplicadas por estolões — não é espécie propagada por semente comercialmente; muda de estolão plantada diretamente, sem fase de transplante de muda de semente. Colheita se prolonga por 4-6 meses (diária ou a cada 3 dias no máximo).'),
  -- fonte: Embrapa — Sistema de Produção do Morango

  ('Pepino', NULL,
   'Cultura exigente em água, manter próximo à capacidade de campo (frequência exata não especificada).',
   'continuo', 8, 9, 45,
   'Fonte: Embrapa (A cultura do pepino ct113; Qualidade fisiológica de sementes cv. Pérola; CT47). Início da colheita 40-50 dias após a semeadura (45, ponto médio), estendendo-se por 60-80 dias com múltiplas passagens. Fonte genérica de hortaliças cita 70-80 dias após o plantio, sem clareza se do mesmo marco. Germinação (8 dias) é de protocolo de teste de sementes em laboratório (25°C), não necessariamente tempo em viveiro/campo — confiança média-baixa para este número.'),
  -- fonte: Embrapa Infoteca-e — A cultura do pepino (ct113)

  ('Pimenta', NULL, NULL,
   'continuo', NULL, 30, 105,
   'Fonte: Embrapa (Sistema de Produção Pimenta — Colheita, Plantio; Embrapa Hortaliças — Adubação). Colheita: 90 dias (cultivares precoces, ex. Murupi) a 120 dias (tardias) após semeadura — usado 105 como ponto médio. Dado de transplante (25-35 dias, 30 ponto médio) é regra geral de hortaliças em muda (CT47), não específico de pimenta. Germinação sem fonte confiável em dias.'),
  -- fonte: Embrapa — Sistema de Produção Pimenta (Capsicum spp.)

  ('Pimentão', NULL,
   'Sementeira: irrigação 2x/dia nos primeiros 15 dias, depois 1x/dia até o transplantio. Campo: irrigação diária, depois em dias alternados (ou fertirrigação semanal, 2x/semana em solo arenoso).',
   'continuo', NULL, 38, 105,
   'Fonte: Embrapa (Orientações para cultivo do pimentão em Roraima; CT47; DOC152 Embrapa Hortaliças). Colheita: 100-110 dias desde a semeadura (CT47, usado 105 dias); Embrapa Roraima descreve marco similar via transplante (30-45 dias) + colheita geral aos 100-120 dias — dados convergentes em ordem de grandeza. Germinação sem fonte confiável em dias.'),
  -- fonte: Embrapa CT47 + Orientações para cultivo do pimentão em Roraima

  ('Pinha', NULL, NULL,
   'continuo', 43, 105, 1278,
   'Fonte: Embrapa (Sistema Produtivo da Pinheira 2023). Germinação 35-50 dias (85-95% de germinação, 43 ponto médio). Muda pronta para plantio definitivo aos 90-120 dias após semeadura (105, ponto médio); porta-enxerto para enxertia usado aos 220 dias (propósito diferente, não usado aqui). Primeira frutificação a partir de 3-4 anos (1278 dias) — fonte não deixa 100% claro se conta desde a semeadura ou desde o plantio da muda. Vingamento natural de frutos é baixo (3-5%); polinização manual eleva para até 90%.'),
  -- fonte: Embrapa — Sistema Produtivo da Pinheira 2023

  ('Pitaia', NULL, NULL,
   'continuo', NULL, NULL, 330,
   'Fonte: Embrapa (Pitayas: atividades de pesquisa — Doc 374); IFSULDEMINAS (Crescimento inicial da pitaya). Início de produção antes de completar 1 ano após o plantio das estacas (aproximado em 330 dias). Desenvolvimento do fruto após floração: 60-80 dias (S. undatus) a 91-98 dias (S. setaceus) — métrica diferente (floração-fruto, não plantio-colheita). Propagação vegetativa por estaquia de cladódios (mais usada, rápida e fiel geneticamente); dias de enraizamento/transplante não encontrados.'),
  -- fonte: Embrapa Doc 374 + IFSULDEMINAS

  ('Pitanga', NULL, NULL,
   'continuo', 21, 180, 730,
   'Fonte: Embrapa/Alice (capítulo Eugenia uniflora — Pitanga). Germinação 20-22 dias (21, ponto médio). Muda: ~6 meses (180 dias) após semeadura até ~25cm de altura, quando pronta para plantio; propagação também por estaquia/enxertia, com porta-enxerto usado aos 9-12 meses. Primeira produção a partir do 2º ano após plantio da muda (aproximado em 730 dias); produção se estabiliza no 6º ano. Duas florações/frutificações anuais em Pernambuco (mar-mai e ago-dez) — dado regional relevante para Recife. Irrigação e adubação de cobertura não especificadas na fonte.'),
  -- fonte: Embrapa/Alice — capítulo Eugenia uniflora (Pitanga)

  ('Quiabo', NULL,
   'Irrigação a cada 2-3 dias (hortaliça de fruto).',
   'continuo', NULL, NULL, 95,
   'Fonte principal: Embrapa CT47 (Recomendações técnicas para hortaliças), 90-100 dias até colheita (95, ponto médio) — preferida sobre Sebrae (Catálogo Brasileiro de Hortaliças, 70-80 dias) pela hierarquia de fontes (Embrapa > Sebrae). Colhido "verde", antes do fruto endurecer. Semeadura direta é a forma mais usual. Germinação sem fonte confiável.'),
  -- fonte: Embrapa CT47 (preferida sobre Sebrae pela hierarquia de fontes)

  ('Quiabo estrela', NULL, NULL,
   'unico', NULL, NULL, NULL,
   'IDENTIDADE DA ESPÉCIE NÃO CONFIRMADA — nenhuma fonte confiável localizada para "quiabo estrela" nesta pesquisa (busca esgotada). Todos os campos numéricos e qualitativos ficaram sem dado. Recomenda-se esclarecer com o coletivo a que espécie este nome se refere antes de usar este registro operacionalmente.'),
  -- fonte: nenhuma localizada (busca esgotada)

  ('Rabanete', NULL,
   'Irrigação diária nas fases iniciais (4-10 L/m²).',
   'unico', NULL, NULL, 33,
   'Fonte principal: Embrapa CT47, 30-35 dias até colheita (33, ponto médio) — preferida sobre Sebrae (25-30 dias) pela hierarquia de fontes. Colhido quando as raízes estão bem desenvolvidas, antes de ficarem fibrosas. Semeadura direta, sem transplante. Germinação e adubação de cobertura sem fonte confiável.'),
  -- fonte: Embrapa CT47 (preferida sobre Sebrae pela hierarquia de fontes)

  ('Repolho', NULL,
   'Irrigação diária nas fases iniciais (4-10 L/m²).',
   'unico', NULL, 30, 90,
   'Fonte principal: Embrapa CT47, 85-95 dias até colheita (85-90 no verão), usado 90 dias — preferida sobre Sebrae (90-110 dias) pela hierarquia de fontes. Colhido quando a parte aérea está parcialmente seca. Germinação sem fonte confiável.'),
  -- fonte: Embrapa CT47 (preferida sobre Sebrae pela hierarquia de fontes)

  ('Rúcula', NULL,
   'Rega diária.',
   'continuo', 5, NULL, 35,
   'Fonte: Embrapa (O Cultivo de Hortaliças); Emater-PA (Manual Técnico Cultivo de Olerícolas). Registro único mescla as entradas duplicadas "Rucula" e "Rucula (Semente)" da pesquisa original (mesma espécie, Eruca sativa — diferença era só propagação por muda comprada vs. semente própria, sem diferença nos dados). Semeadura direta, sem transplante; apenas raleação quando plantas atingem ~10cm.'),
  -- fonte: Embrapa + Emater-PA (mescla Rúcula + Rúcula Semente)

  ('Salsa', NULL,
   'Rega diária.',
   'continuo', 10, NULL, 60,
   'Fonte: Emater-PA (Manual Técnico Cultivo de Olerícolas); Embrapa (O Cultivo de Hortaliças). Colheita de folhas até no máximo 1 ano. Semeadura direta, sem transplante; raleação aos 4-5cm.'),
  -- fonte: Emater-PA + Embrapa

  ('Salsão', NULL,
   'Rega diária/frequente (gotejamento ou aspersão).',
   'unico', 18, 45, 125,
   'Fonte principal: IAC Boletim 200, 100-150 dias após transplante (125, ponto médio). Fontes alternativas divergem: Embrapa cita 90-100 dias após "plantio" (ambíguo se semeadura ou transplante); Emater-PA cita 160 dias como ciclo total desde a semeadura. Germinação varia com a temperatura do solo: 9 dias a 20°C, 26 dias a 10°C (18, ponto médio usado); Emater-PA cita valor único de 12 dias como alternativa.'),
  -- fonte: IAC Boletim 200 (dedicado, preferido sobre Embrapa/Emater-PA)

  ('Taioba', NULL,
   'Nunca deixar o solo sem irrigação (plantas adultas toleram melhor a falta de água).',
   'continuo', NULL, NULL, 68,
   'Fonte: CPT (Horta: como plantar Taioba) — fonte comercial, confiança baixa; não foi encontrada fonte institucional (Embrapa/IAC/Emater) com esses números especificamente para taioba. Colheita de folhas: 60-75 dias após o plantio (68, ponto médio); cormos para replantio/consumo tipo "inhame": 7-12 meses após o plantio (produto/prazo diferente). Ciclo produtivo não classificado explicitamente pela fonte — na prática, a colheita de folhas costuma ser sucessiva (usado "contínuo", mas vale confirmar com o coletivo). Propagação vegetativa por pedaços de cormo/rizoma ou rebentos laterais, plantados diretamente.'),
  -- fonte: CPT (comercial, confiança baixa — sem alternativa institucional)

  ('Terramicina', NULL, NULL,
   'unico', NULL, NULL, NULL,
   'Fonte: UFMT (identificação da espécie/nomes populares) — identificada como Alternanthera brasiliana, conhecida popularmente como "terramicina", "penicilina", "benzetacil", "ervaço", "pé-de-galinha", "perpétua branca", "suspiro". Uso tradicional para cicatrização de feridas/infecções, função popular análoga à babosa. Propaga-se facilmente por estaquia (galhos podados enraízam mesmo pousados sobre o solo). Sem dado agronômico confiável para rega/adubação/prazos — fontes descrevem planta rústica, fácil cultivo em quintais, sem exigências especiais relatadas.'),
  -- fonte: UFMT (identidade) — sem dado agronômico confiável

  ('Tomate', NULL,
   'Rega a intervalos de 3-4 dias.',
   'continuo', 6, 28, 95,
   'Fonte: Embrapa (O Cultivo de Hortaliças; Produção de mudas e Plantio — tomate de mesa); Emater-PA. Colheita: 90-100 dias após transplante (95, ponto médio), equivalente a ~115-130 dias desde a semeadura. Mudas comuns prontas com 20-30 dias; mudas enxertadas 28-40 dias.'),
  -- fonte: Embrapa Hortaliças (tomate de mesa)

  ('Tomate-cereja', NULL,
   'Rega a intervalos de 3-4 dias (extrapolado do tomate comum).',
   'continuo', 6, 28, 95,
   'Sem fonte institucional específica para a variedade cereja — mesma espécie botânica do tomate comum (Solanum lycopersicum var. cerasiforme). Valores extrapolados da ficha "Tomate" (linha correspondente), confiança baixa para os números. Publicação encontrada sobre tomate-cereja trata de manejo de pragas/substrato em cultivo protegido, sem números de ciclo, mas reforça o ciclo contínuo (colheitas seriadas).'),
  -- fonte: extrapolado de Tomate (Embrapa) — sem dado numérico próprio para a variedade cereja

  ('Vagem', NULL,
   'Rega a cada 3 dias.',
   'unico', NULL, NULL, 75,
   'Fonte principal: Embrapa (O Cultivo de Hortaliças), colheita 70-80 dias após o plantio (75, ponto médio). Fontes comerciais complementares (Canal do Horticultor; Hortas.info, confiança baixa) indicam faixa mais ampla, 50-90 dias, variando com a cultivar. Germinação: a única fonte com número (3-4 dias, Emater-PA) refere-se ao feijão-de-metro (Vigna unguiculata subsp. sesquipedalis), espécie diferente do feijão-vagem comum (Phaseolus vulgaris) — não usada aqui. Ciclo produtivo depende da cultivar: determinadas (arbustivas) concentram colheita em 10-15 dias; indeterminadas (trepadeiras) permitem colheita prolongada — fonte não classifica explicitamente qual é o padrão; usado "único" como default conservador, ajustar conforme a cultivar plantada. Semeadura direta, sem transplante.'),
  -- fonte: Embrapa — O Cultivo de Hortaliças (identidade botânica cuidadosamente distinguida do feijão-de-metro)

  ('Gengibre', NULL,
   'Irrigação diária (1x/dia), mantendo o solo úmido sem encharcar.',
   'unico', NULL, 30, 210,
   'Fonte: Embrapa (Comunicado Técnico sobre gengibre; Folder Gengibre; FOL88). Colheita: ~7 meses (210 dias) após o plantio (dado do Ceará, referência: parte aérea começa a secar); outras fontes Embrapa citam 6-10 meses ("gengibre verde", colheita mais precoce) e 10-12 meses (rizomas totalmente maduros) — variação conforme finalidade da colheita. Propagação vegetativa por rizomas ("gomos", 1-2 brotos). Quando há fase de viveiro, mudas prontas ~30 dias após o plantio dos gomos; alternativa comum é plantio direto do rizoma sem viveiro.'),
  -- fonte: Embrapa — Comunicado Técnico sobre gengibre e correlatas

  ('Ora-pro-nóbis', NULL,
   'Irrigar ao menos 1x/semana em período de seca.',
   'continuo', NULL, 38, 90,
   'Fonte: Embrapa CT156 (Cultivo de Ora-pro-nóbis em plantio adensado) — publicação técnica primária não acessada diretamente por erro de proxy/timeout; dados vêm de fontes secundárias (Horta e Flores; A Lavoura) que citam a pesquisa Embrapa Hortaliças, confiança média. Colheitas/podas sucessivas a cada 6-10 semanas (2-3 meses), 3-8 cortes/ano; planta pode manter-se produtiva por até 10 anos. Propagação vegetativa por estaquia (estacas de 20-30cm, ~15cm enterrados; material da região intermediária do caule enraíza melhor).'),
  -- fonte: Embrapa CT156 (via fontes secundárias, confiança média)

  ('Vinagreira', 'Não tolera encharcamento.',
   'Irrigação controlada (não tolera encharcamento).',
   'continuo', NULL, NULL, 75,
   'Fonte: UFRRJ/Agroecologia (Cartilha Vinagreira, fonte .edu.br). Dois produtos com prazos distintos: folhas/ramos colhidos 60-90 dias após o plantio (75, usado aqui como principal); cálices colhidos 150-180 dias após o plantio (165) — indicar ao coletivo qual produto é prioritário. Espaçamento 1,0x1,0m (ou 0,5m entre plantas para mais ramos/folhas). Manter altura entre 1-2m (máx. 2,5m) por poda/desponte.'),
  -- fonte: UFRRJ/Agroecologia — Cartilha Vinagreira

  ('Moringa', NULL,
   'Irrigação necessária até o pegamento das mudas; dispensável depois em regiões chuvosas. Em época seca, sombreamento parcial e irrigação diária até o pegamento.',
   'continuo', NULL, 75, 210,
   'Fonte: Embrapa (Circular Técnica CT119 — Cultivo e Processamento da Moringa; Ageitec — Moringa oleifera: uma planta de uso múltiplo). Dado de colheita (180-240 dias / 6-8 meses, 210 ponto médio) é para frutos/vagens de mudas propagadas por estaca; para folhas (manejo por poda intensiva), cortes ocorrem a cada 20-40 dias após a planta se estabelecer (poda quando o caule atinge 0,8-1,0cm de diâmetro ou a planta atinge 1,5m), mas o tempo do plantio até o 1º corte de folhas não é especificado. Germinação sem fonte confiável em dias.'),
  -- fonte: Embrapa — CT119 / Ageitec (Moringa)

  ('Capim-santo', NULL,
   'Lâmina diária de 5,4mm em todo o ciclo (Embrapa) ou 1x/semana (UnB) — fontes divergem em frequência.',
   'continuo', NULL, NULL, 135,
   'Fonte: Embrapa (Capim Cidreira — Série Plantas Medicinais, FOL77); UnB/HEMAC (Capim-Limão). Primeiro corte: 90-180 dias após o plantio (UnB, 135 ponto médio); Embrapa registra pico de biomassa fresca aos 180 dias — dados convergentes em ordem de grandeza. Propagação vegetativa por divisão de touceira/perfilhos (20-30cm, 1/3 basal enterrado), plantados diretamente na cova definitiva.'),
  -- fonte: Embrapa FOL77 + UnB/HEMAC (Capim-Limão)

  ('Chicória', NULL,
   'Irrigação diária nas fases iniciais.',
   'unico', NULL, NULL, 85,
   'Fonte principal: Circular Técnica 47 (Embrapa), 80-90 dias após transplantio (85, ponto médio) — preferida por ser fonte mais detalhada/específica sobre o sistema de cultivo. Fonte alternativa (O Cultivo de Hortaliças, Embrapa) cita 40-60 dias após semeadura — divergência provavelmente reflete tipo de cultivar/sistema; reportadas ambas. Temperatura ideal 12-22°C; época favorável mar-jul. Idade de transplante em dias não especificada (critério é 2-5 folhas e ~10cm de altura).'),
  -- fonte: Embrapa CT47 (preferida sobre Cultivo de Hortaliças, mais genérica)

  ('Almeirão', NULL,
   'Irrigação diária nas fases iniciais (mesmo padrão da chicória, CT47).',
   'unico', NULL, NULL, 75,
   'Fonte principal: Circular Técnica 47 (Embrapa), tipo folha comum de horta: 60-90 dias após o plantio (75, ponto médio), espaçamento final 25x25cm. ATENÇÃO: um documento Embrapa distinto ("O Cultivo de Hortaliças") descreve "almeirão" como chicória-de-raiz para produção de turiões (tipo Witloof/Belgian endive), com colheita só após ~1 ano de transplantio — provavelmente não é o tipo cultivado em horta comunitária; dado reportado à parte para não confundir os dois manejos. Fonte alternativa de confiança baixa (CPT) cita 50-100 dias, consistente em ordem de grandeza. Época favorável de plantio: abr-jun.'),
  -- fonte: Embrapa CT47 (tipo folha — não confundir com o tipo raiz/turião de outra ficha Embrapa)

  ('Inhame', 'Solos leves, não muito arenosos, profundos, bem drenados.',
   NULL,
   'unico', NULL, NULL, 240,
   'Fonte: Embrapa (Ageitec — Colheita do inhame, Mata Sul Pernambucana; Circular Técnica 18 — Cultivo do Cará). Colheita: 210-270 dias (7-9 meses) após o plantio (240, ponto médio) — fontes convergem (7-9 meses genérico / ~9 meses no contexto específico de Pernambuco, Mata Sul — dado regional relevante para Recife). Precipitação anual ideal ~1.500mm. Propagação vegetativa por tubérculo/rizoma ("torolho", 50-250g), plantado diretamente na cova/camalhão definitivo, sem transplante. Cobertura morta (capim) sobre a cova logo após o plantio.')
  -- fonte: Embrapa — Ageitec (Mata Sul Pernambucana) + CT18 (Cultivo do Cará)

on conflict (nome) do nothing;

-- -----------------------------------------------------------------------------
-- 2) culturas_regime_manejo (33 linhas — só onde havia dado numérico claro de
--    intervalo recorrente no texto de regime_manejo da pesquisa)
-- -----------------------------------------------------------------------------

-- Abóbora: adubação de cobertura em 2 aplicações — 20-30 e 40-50 dias após a
-- germinação (usados os pontos médios: 25 e 45 dias, intervalo de 20 dias).
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'germinacao', 25, 20,
  '2 aplicações: aos 25 e 45 dias após a germinação (pontos médios das faixas 20-30 e 40-50 dias, Embrapa CT-175).'
from culturas where nome = 'Abóbora'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Alho poró: adubação de cobertura 30 dias após o plantio, repetida mais 2
-- vezes a intervalos de 25-30 dias.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'plantio', 30, 28,
  'Adubação de cobertura aos 30 dias após o plantio, repetida mais 2 vezes a intervalos de 25-30 dias (28, ponto médio).'
from culturas where nome = 'Alho poró'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Banana: esquema de 3 aplicações parceladas por cultivar, aos 40, 80 e 120
-- dias após o plantio (intervalo constante de 40 dias).
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'plantio', 40, 40,
  'Esquema por cultivar: aplicações aos 40, 80 e 120 dias após o plantio (intervalo de 40 dias); fonte alternativa cita 1ª aplicação genérica aos 30-45 dias após o plantio.'
from culturas where nome = 'Banana'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Batata-doce: N e K — metade da dose no plantio, metade aos 45 dias após o
-- plantio (quando dose de K > 60kg/ha).
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'plantio', 45, 45,
  'Metade da adubação de N (e de K, se dose > 60kg/ha) no plantio, metade aos 45 dias após o plantio.'
from culturas where nome = 'Batata-doce'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Berinjela: adubação de cobertura regional (DF) — 2 aplicações, aos 45 e
-- 90 dias após o transplante.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'transplante', 45, 45,
  'Adubação de cobertura varia por região (Embrapa): DF 2 aplicações (45 e 90 dias pós-transplante, usado aqui); SP 4-6 parceladas desde 30 dias; MG 6 aplicações a cada 15 dias; RJ 2 aplicações. Ajustar conforme a região.'
from culturas where nome = 'Berinjela'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Beterraba: adubação de cobertura em 3 aplicações, aos 15, 30 e 50 dias
-- após a germinação (intervalos não uniformes, aproximados para 18 dias).
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'germinacao', 15, 18,
  '3 aplicações aos 15, 30 e 50 dias após a germinação (intervalos não uniformes: 15 e depois 20 dias; aproximado aqui para 18 dias).'
from culturas where nome = 'Beterraba'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Cenoura: adubação de cobertura (sulfato de amônio) aos 20 e 40 dias após a
-- germinação.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'germinacao', 20, 20,
  'Adubação de cobertura (sulfato de amônio) aos 20 e 40 dias após a germinação, coincidindo com os desbastes.'
from culturas where nome = 'Cenoura'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Cenoura: desbaste em 2 etapas, aos 20 e 40 dias após a germinação.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'raleamento', 'germinacao', 20, 20,
  'Desbaste em 2 etapas: aos 20 e aos 40 dias após a germinação.'
from culturas where nome = 'Cenoura'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Coentro: adubação de cobertura 10 dias após o plantio, repetindo a cada
-- 10 dias.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'plantio', 10, 10,
  'Adubação de cobertura 10 dias após o plantio, repetindo a cada 10 dias (Emater-PA).'
from culturas where nome = 'Coentro'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Couve: adubação de cobertura quinzenal a partir de 15 dias após o
-- transplante (IAC/Emater-PA); Embrapa CNPH diverge (aplicação única aos 30 dias).
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'transplante', 15, 15,
  'Divergência real entre fontes: Embrapa CNPH cita aplicação única aos 30 dias após o transplante; IAC e Emater-PA citam repetições quinzenais a partir de 15 dias — usado o padrão quinzenal (2 de 3 fontes convergem); testar ambas as práticas com o coletivo.'
from culturas where nome = 'Couve'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Espinafre: adubação de cobertura a cada 30 dias após o transplante,
-- reforçada após cada corte.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'transplante', 30, 30,
  'Adubação de cobertura a cada 30 dias após o transplante, reforçada após cada corte (Embrapa CNPH).'
from culturas where nome = 'Espinafre'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Goiaba: adubação de cobertura a cada 60 dias (6x/ano), nunca ultrapassando
-- 90 dias entre aplicações.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'plantio', 60, 60,
  'Adubação de cobertura a cada 60 dias (6x/ano), nunca ultrapassando 90 dias entre aplicações.'
from culturas where nome = 'Goiaba'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Goiaba: podas subsequentes a cada 3-4 meses (~105 dias), após poda de
-- formação inicial.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'poda', 'plantio', 105, 105,
  'Poda de formação inicial (haste única até 50-70cm, 3-4 pernadas), seguida de podas subsequentes a cada 3-4 meses (~105 dias), sempre na parte lignificada dos ramos.'
from culturas where nome = 'Goiaba'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Graviola: adubação trimestral (~90 dias) nos 3 primeiros anos após o
-- plantio.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'plantio', 90, 90,
  'Nos 3 primeiros anos após o plantio, adubação trimestral (~90 dias, fórmula 10-15-15); a partir do 4º ano passa a ser parcelada em 4 momentos fenológicos (não mais por intervalo fixo em dias).'
from culturas where nome = 'Graviola'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Jiló: adubação de cobertura (N e K) a cada 15 dias após o transplante.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'transplante', 15, 15,
  'Adubação de cobertura de N e K a cada 15 dias (marco exato de início não especificado na fonte; assumido desde o transplante).'
from culturas where nome = 'Jiló'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Mamão: N e K parcelados em 8 doses iguais, aplicadas mensalmente.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'plantio', 30, 30,
  '8 doses mensais e iguais de N e K, a partir de ~30 dias após o plantio.'
from culturas where nome = 'Mamão'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Manjericão: adubação de cobertura a cada 40 dias (fonte comercial,
-- confiança baixa).
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'plantio', 40, 40,
  'Adubação de cobertura a cada 40 dias após o plantio (fonte comercial — Blog Plantei — confiança baixa; Embrapa só confirma adubação inicial no plantio, 5kg de esterco de curral/m², sem intervalo de cobertura).'
from culturas where nome = 'Manjericão'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Maracujá: adubação de cobertura em marcos de 30/60/90/120-180 dias após o
-- plantio, com doses crescentes de N.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'plantio', 30, 30,
  '4 aplicações com doses crescentes de N: aos 30, 60, 90 e 120-180 dias após o plantio — os 3 primeiros intervalos são de 30 dias; o último se estende (marcado aqui como 30 para simplificar, mas pode chegar a 90 dias).'
from culturas where nome = 'Maracujá'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Melancia: adubação de cobertura em 2 aplicações, aos 25 e 40-45 dias após
-- o plantio.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'plantio', 25, 18,
  '2 aplicações de N e K, aos 25 e 40-45 dias após o plantio; em solo arenoso, dividir em 20 e 40 dias.'
from culturas where nome = 'Melancia'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Melão: N aos 25 dias após o plantio (ou 20/40 em solo arenoso); K aos 40
-- dias após o plantio.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'plantio', 25, 15,
  'N aplicado aos 25 dias após o plantio (dividido em 20 e 40 dias em solo arenoso); K aos 40 dias após o plantio — modelado aqui como 2 aplicações com intervalo aproximado de 15 dias.'
from culturas where nome = 'Melão'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Milho: adubação de cobertura em 2 aplicações — planta com 4 folhas
-- (~14 dias após emergência) e com 7 folhas (~35 dias).
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'germinacao', 14, 21,
  '1ª aplicação com a planta em 4 folhas totalmente desdobradas (~14 dias após a emergência); 2ª com 7 folhas (~35 dias) — intervalo de ~21 dias entre elas.'
from culturas where nome = 'Milho'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Ora-pro-nóbis: 1ª adubação aos 60 dias após o transplantio; aplicações
-- seguintes após cada corte (a cada 6-10 semanas).
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'transplante', 60, 56,
  '1ª aplicação (~40kg/ha N) aos 60 dias após o transplantio; aplicações seguintes (~30kg/ha N + 20-40kg/ha K2O) após cada corte — cortes ocorrem a cada 6-10 semanas (~56 dias, usado como intervalo aproximado).'
from culturas where nome = 'Ora-pro-nóbis'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Ora-pro-nóbis: podas periódicas a cada 2-3 meses (~75 dias).
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'poda', 'transplante', 75, 75,
  'Podas periódicas a cada 2-3 meses (~75 dias), mantendo a planta entre 1,0-1,2m de altura. Poda apical ("quebra da ponta") ~10 dias antes da colheita para consumo próprio não incluída aqui por ser evento pontual, não recorrente em dias fixos.'
from culturas where nome = 'Ora-pro-nóbis'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Pepino: adubação de cobertura — 1ª aplicação 15 dias após o transplante
-- (ou 20 dias após a semeadura), demais a intervalos de 20 dias.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'transplante', 15, 20,
  '1ª aplicação 15 dias após o transplante (alternativa: 20 dias após a semeadura); demais aplicações a intervalos de 20 dias (total 3 aplicações, parcelando 70% do N e K).'
from culturas where nome = 'Pepino'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Pimenta: adubação de cobertura em intervalos de 30-45 dias após o
-- plantio/transplante, mantida até o fim do ciclo em cultivares de ciclo longo.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'transplante', 38, 38,
  'Adubação de cobertura em intervalos de 30-45 dias (38, ponto médio) após o transplante (20-50kg/ha N + 20-50kg/ha K2O), mantida até o fim do ciclo em cultivares de ciclo longo.'
from culturas where nome = 'Pimenta'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Pimentão: adubação de cobertura aos 15, 35 e 55 dias após o transplantio
-- (intervalo constante de 20 dias).
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'transplante', 15, 20,
  'Adubação de cobertura aos 15, 35 e 55 dias após o transplantio (5,5g ureia ou 12g sulfato de amônio/planta + 1,5g cloreto de potássio/planta).'
from culturas where nome = 'Pimentão'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Pitaia: adubação de cobertura a cada 2 meses (60 dias).
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'plantio', 60, 60,
  'Adubação de cobertura a cada 2 meses (60 dias): ~200g de mistura + 10kg de esterco por planta.'
from culturas where nome = 'Pitaia'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Gengibre: adubação de cobertura em 2 aplicações, aos 90 e 150 dias após o
-- plantio.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'plantio', 90, 60,
  '2 aplicações: aos 90 e aos 150 dias após o plantio (5 t/ha de esterco em cada, cultivo orgânico) — intervalos não uniformes (90 dias até a 1ª, depois 60 dias até a 2ª).'
from culturas where nome = 'Gengibre'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Capim-santo: adubação com esterco bovino curtido, repetida a cada 3 meses
-- (90 dias).
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'plantio', 90, 90,
  'Embrapa: 5L/cova de esterco bovino curtido, repetido a cada 3 meses (90 dias); fonte alternativa (UnB) recomenda adubo orgânico após cada corte (evento, não intervalo fixo).'
from culturas where nome = 'Capim-santo'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Salsão: adubação de cobertura parcelada aos 20 e 40 dias após o
-- transplante (IAC).
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'transplante', 20, 20,
  'IAC: 2 aplicações, aos 20 e 40 dias após o transplante (usado aqui). Fonte alternativa (Embrapa) cita aplicação única de 30-40g de sulfato de amônio aos 25-30 dias após o transplantio.'
from culturas where nome = 'Salsão'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Tomate: adubação de cobertura — 20g de sulfato de amônio a cada 20 dias,
-- em 4 aplicações.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'transplante', 20, 20,
  '4 aplicações de 20g de sulfato de amônio, a cada 20 dias (marco de início assumido a partir do transplante).'
from culturas where nome = 'Tomate'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Tomate-cereja: mesmo regime do tomate comum, extrapolado (confiança baixa).
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'transplante', 20, 20,
  'Extrapolado da ficha "Tomate" (mesma espécie botânica) — sem dado numérico próprio para a variedade cereja, confiança baixa.'
from culturas where nome = 'Tomate-cereja'
on conflict (cultura_id, tipo_manejo) do nothing;

-- Salsa: adubação de cobertura 10 dias após a germinação, repetindo a cada
-- 10 dias.
insert into culturas_regime_manejo (cultura_id, tipo_manejo, referencia, dias_inicio, intervalo_dias, observacao)
select id, 'adubacao', 'germinacao', 10, 10,
  'Adubação de cobertura: 10 dias após a germinação aplicar ~200g de esterco de galinha entre os sulcos, repetindo a cada 10 dias; nova adubação também após cada corte (evento, não incluído no intervalo fixo).'
from culturas where nome = 'Salsa'
on conflict (cultura_id, tipo_manejo) do nothing;
