# Plano de features do Café Mania

Levantamento de 20/10/2026, inicialmente entregue sem implementação. A classificação considera o código atual, a arte disponível e o trabalho de persistência e simulação, além da interface.

**Andamento em 21/10/2026:** E01 concluída. E02 parcialmente aplicada: 16 receitas novas (20 no livro), mantendo pendências de arte específica de preparo e conferência completa. O lote adicional de fila do chef e empregados locais (M08) foi implementado; veja [fila e garçons](fila-chef-e-garcons.md). E03 ainda será preparada e E02 será terminada depois, conforme a ordem solicitada. E04 e demais lotes seguem planejados.

- [x] Fila FIFO de cozinhar, limpar e servir, com fogões pendentes transparentes.
- [x] Identificar a janela histórica de empregados e registrar divergências das fontes.
- [x] Janela modular com arte Image Gen, cadeados, vagas por nível e contratação local persistida.
- [x] M08: garçons autônomos, prato carregado, reserva de atendimento e consumo confirmado no servidor.
- [x] Compatibilidade com o cerco clássico de garçons e travessia após espera quando só outro ator obstrui.
- [x] Rostos variados dos garçons com olhos, bocas, sobrancelhas e cabelos existentes; escolhas estáveis e uniforme preservado.
- [x] Investigar satisfação/popularidade em blogs, suporte oficial arquivado e vídeo local; [evidências e lacunas](satisfacao-e-popularidade.md).
- [x] Garçons: coletar pelos quatro lados, escolher a menor distância entre acessos livres e preservar a regra do cerco clássico (22/10/2026).
- [x] Corrigir faixas recortadas e encontro das calçadas no entroncamento da rua, reutilizando a arte vetorial existente (22/10/2026).
- [x] Levantar referências e apresentar o [plano do cenário modular da praia](cenario-praia-modular.md), separando orla urbana e filial.
- [x] Orla do café urbano: 25 PNGs reconstruídos com Image Gen ou recortados dessas artes, 41 partes modulares, mar/areia/costa, calçada/rua, árvores, guarda-sóis, cadeiras, píer e lancha estáticos; [registro da execução](cenario-cafe-urbano.md).
- [x] Faixa de areia molhada em ocre-dourado, com transição suave junto à espuma e camada modular própria, baseada no detalhe da referência original.
- [x] Revisar faixa borrada, pedras deformadas, relevo da calçada, encaixe junto às paredes, árvores no passeio, barco sobre o píer e excesso de ondas; conferência pelo carregador normal do jogo e nove testes específicos (22/10/2026).
- [x] Suavizar calçada, igualar largura dos passeios, reproduzir meio-fio em blocos e corrigir a projeção do tracejado, incluindo as pontas.
- [x] Arco/placa “CAFÉ DE PRAIA”, escadinha e sombra sob o píer em peças independentes, com entrada aberta no corrimão; 11 testes específicos passaram.
- [x] Decoração: selecionar mesa ocupada remove seus clientes e devolve porções servidas sem penalidade, com persistência e proteção contra pagamento duplicado.
- [x] Manter a porta visualmente fechada durante a decoração, inclusive quando já estava aberta ou há clientes atravessando.
- [x] Clientes podem chegar e sair pelas duas calçadas, usando três extremidades e passando pelo encontro dos passeios; [regras e verificação](decoracao-e-calcadas.md).
- [x] Encostar os passeios na face externa das paredes nos dois lados, considerando a espessura sem alterar o grid; corrigir direção das faces do meio-fio e retirar bordas duplicadas do asfalto. Doze testes do cenário e conferência no café inicial/expandido.
- [ ] Conferir demais pormenores da orla contra referências adicionais: partes encobertas e variações históricas. Reconstrução não equivale a sprite original recuperado.
- [ ] Filial na praia e viagem/cutscene do barco: planejar e implementar em lotes futuros, sem habilitação neste background urbano.
- [ ] Confirmar os cortes das expressões do HUD original antes de substituir as dez faixas provisórias atuais.
- [ ] E03: apresentar e implementar a próxima coleção de decoração.
- [ ] Concluir E02: referências específicas de preparo e conferência restante das receitas.
- [ ] H02: empregados de contas/amigos reais, integração social e gorjetas.

## Direção e forma de trabalhar

Proposta: consolidar o café clássico e suas funções de 2010–2011 primeiro. Filiais, equipamentos avançados e sistemas de 2013–2014 entram depois, com a versão histórica identificada. Não misturar recompensas, custos ou requisitos de épocas diferentes como se fossem uma única configuração oficial.

Antes de cada lote, apresentar: função e escopo, imagens de referência, assets reutilizáveis, artes faltantes, regras confirmadas ou propostas, critérios de aceite e verificações específicas. O plano do lote precisa estar visível antes da implementação. Se o responsável mudar o escopo, atualizar esse plano antes de prosseguir.

Fluxo de arte obrigatório:

1. Procurar a imagem em `game/public/assets/`, no acervo e nos anexos do responsável.
2. Reutilizar o asset pronto quando compatível com o padrão atual. Se houver uma prancha limpa e aproveitável, extrair, preservar transparência e calibrar no Asset Studio.
3. Quando não houver asset pronto/aproveitável, gerar com **Image Gen**, usando imagens de referência. Salvar fonte, prompt e PNG final. Não criar um substituto ilustrado em SVG, CSS ou Graphics.
4. Separar moldura, ilustração, ícone, texto e interação. Assim o mesmo painel pode servir a diferentes recompensas e estados. Texto variável e hitboxes continuam no runtime.
5. Apresentar a prévia composta no jogo e conferir proporção, legibilidade, transparência e comportamento.

Os ícones atuais em `game/public/assets/ui/` continuam sendo o padrão. Pranchas antigas de ícones servem como referência histórica, sem substituir a identidade atual. Uma captura com cenário, texto ou marca d'água é referência, não um sprite pronto. Uma imagem de outra produção em um portfólio misto não comprova um asset do Café Mania.

## O que foi verificado

| Local | Conteúdo encontrado | Uso no plano |
| --- | --- | --- |
| `game/public/assets/` e código atual | 51 entradas no catálogo de itens, incluindo pisos e paredes; 21 receitas cadastradas, 20 disponíveis no livro; sucos, temperos, avatar e painéis atuais | Evitar propor como novidade o que já funciona; priorizar extensões pequenas |
| `tools/acervo/catalogo.json` | 671 entradas indexadas de imagens/pranchas | Localizar e conferir referências; isso não representa 671 sprites prontos |
| `artes-referencia/cafe-mania-acervo-documentado/cafe-mania-acervo/` | Guia, catálogo de itens, publicações e capturas de receitas, conquistas, bônus diário, missões e expansões | Evidências históricas e visuais, com IDs Pxxx |
| `artes-referencia/cafe-mania-acervo-complementar-2/cafe-mania-acervo-2/` | Catálogos de publicações, materiais de artistas e 67 registros de missões de 2013 | Regras e evolução de equipamentos; não confundir o registro de uma missão com seus requisitos completos |
| `artes-referencia/cafe-mania-behance-alta-qualidade-documentado/cafe-mania-behance/` | Pranchas maiores de itens, personagens, interfaces e narrativas | Recortes e reconstruções com referência de qualidade |
| `C:/Users/Ulisses/Desktop/Projetos/Projeto-Cafe-Arquivo/CafeMania-Clone/Acervo-CafeMania/06_inventario/` | 340 posts recuperados do blog oficial e 16 artigos de suporte recuperados | Fontes primárias locais; conferir a data e eventuais trechos de outros jogos presentes na coleta |
| `C:/Users/Ulisses/Desktop/CaféMania/` | PNGs avulsos de interface, incluindo presentes, troféu, mapa e uniforme | Comparar com o kit atual; a presença no Desktop não implica que um ícone deva substituir o atual |
| Web | Relatos contemporâneos e reproduções de textos oficiais sobre domínio de cafés, máquinas, crítico e recompensas diárias | Complementar o acervo e registrar divergências |

Algumas páginas consultadas diretamente hoje retornaram bloqueio ou erro. Foram usados os arquivos locais preservados e os textos indexados acessíveis; não se presume que todas as URLs históricas ainda abram normalmente.

## Base existente e lacunas

Já existe: sala compartilhada por WebSocket, movimento de jogadores e clientes, decoração/inventário, compra e venda, cozimento e porções nos balcões, limpeza e comida estragada, temperos consumíveis, progressão e aviso de nível, expansão/pátio, sucos com estoque/domínio/evolução visual, guarda-roupa modular e balões/avisos raster.

Ainda não confundir com sistema completo:

- `trophy.png`, `waiter.png`, `gift.png`, `yellow-box.png` e `map.png` estão disponíveis. Os cliques funcionais abrem roupa, decoração, temperos e empregados locais. Os ícones restantes, sozinhos, não entregam conquistas, presentes ou missões.
- `waiterSlots` limita agora a equipe local de M08; contratação social entre contas continua pendente em H02.
- Visita por identificador de sala e infraestrutura para visitantes já existem. A barra social usa agora arte de 2012–2014, dados tipados, paginação e convite por link; relações de vizinhança, lista persistente e ajuda entre amigos ainda dependem de M12/H01. Ver [barra social](barra-social.md).
- Domínio de sucos e evolução visual existem, mas o caminho de servir consultado incrementa domínio e recursos sem entregar automaticamente o móvel-prêmio histórico ao inventário.
- Os fogões cadastrados compartilham o preparo básico. Ter o PNG de um fogão especial não ativa velocidade, bocas adicionais ou evolução por missões.
- Temperos funcionam como consumíveis. Montar uma prateleira com peças é outra feature.
- Receitas fora do livro podem existir apenas para resolver dados antigos; não devem ser contadas como conteúdo novo disponível ao jogador.

## Dificuldade

**Fácil:** uma entrega pequena sobre um fluxo existente, com pouca regra nova. A falta de arte aproveitável pode aumentar o trabalho.

**Média:** exige estado durável, regras de recompensa ou novo fluxo de jogo, mesmo que o painel seja simples. Deve ser dividida em entregas funcionais.

**Difícil:** altera a simulação, envolve vários jogadores/ambientes ou depende de vários sistemas anteriores. Não cabe em uma troca de imagens ou em um único modal.

Não foram prometidos prazos em dias. Primeiro será fechado o escopo visual e funcional de cada lote.

## Features fáceis

| ID | Categoria / feature | Entrega proposta | Arte e referência | Limite |
| --- | --- | --- | --- | --- |
| E01 | Personalização — nome do café | **Implementada:** escolher antes de entrar, editar clicando no nome e manter após recarregar | Composição dos anexos de nomeação; wallpapers Behance 13020873; botão verde atual; moldura reconstruída com Image Gen | Primeiro lote inclui rotação diária e calendário configurável. Não pressupõe contratação |
| E02 | Cozinha — mais receitas comuns | Acrescentar pequenos lotes de receitas ao livro existente | P107, imagens de receitas e pranchas de pratos, como Behance 4432119/002; livro atual | Exigir arte do preparo e do prato pronto, além de custo, duração, porções e XP com fonte. Se faltar uma etapa visual, usar Image Gen; nomes ou valores ilegíveis ficam pendentes |
| E03 | Decoração — completar coleções | Acrescentar móveis, pisos e paredes de uma coleção por vez | Pranchas 4286853/4432119 e capturas P019/P071/P093; `tools/acervo/` e Asset Studio | Fácil para peças básicas com imagens adequadas. Novas funções de equipamento e novas vistas não são incluídas automaticamente |
| E04 | Orientação — ajuda ilustrada | Instruções curtas nos sistemas já existentes, com estados reais | Suporte recuperado, capturas do livro, sucos e temperos; painéis e balões atuais | Não equivale ao tutorial com objetivos/recompensas de M04; não inventar botões sem função |

### Condição para retomar E02

Adicionar receitas na sequência do livro original, começando por Nachos de Queijo → X-Tudo → Mousse de Maracujá e continuando apenas com a ordem seguinte comprovada. Não escolher pratos avulsos só porque há imagens disponíveis. A posição no livro e o nível de desbloqueio são informações distintas e precisam de fontes próprias.

Para cada próxima receita, apresentar antes de implementar: posição no livro, nome, nível, custo, duração, porções, valor de venda por porção e XP; captura ou outra evidência da edição histórica escolhida; referência artística identificada; origem da arte de preparo e do prato pronto. Separar PNG utilizável, referência a recortar/calibrar e reconstrução com Image Gen. Uma reconstrução visual não comprova regras nem ordem.

A revisão local de 21/10/2026 encontrou quatro receitas no livro e imagens `stage_1.png`/`stage_2.png` para elas. Os registros em `game/public/assets/foods/*/recipe.json` indicam a sequência Nachos → X-Tudo → Mousse → Churrasco, mas deixam níveis sem confirmação e documentam mudanças históricas nos valores do Churrasco. Esses registros não comprovam a continuação completa. Não alterar as receitas existentes nem ampliar o livro neste lote; preparar E03 primeiro.

**Nova evidência em 21/10/2026 — vídeo fornecido pelo responsável:** [catálogo e capturas de 00:29–00:46](../artes-referencia/video-cafe-mania-muito-tempo/receitas-0029-0046/LEIA-ME.md), com [galeria visual](../artes-referencia/video-cafe-mania-muito-tempo/receitas-0029-0046/index.html). Foram identificados 48 pratos em oito páginas observadas, incluindo a primeira página Básico: Nachos → X-Tudo → Mousse → Churrasco → Pamonha → Tacos Triplos. Uma varredura de todos os 509 quadros do intervalo permitiu capturar artes que apareciam brevemente após carregar. Nove pratos têm custo, porções e venda legíveis; há tempo e XP para 47. O vídeo não percorre todo o Básico e não fornece as etapas de preparo. O trecho isolado não confirma a economia completa da Pamonha nem os níveis dos próximos pratos básicos. A gravação mostra Churrasco com 75 XP/110 porções; preservar essa divergência de versão, sem mudar automaticamente o catálogo atual. Data da gravação desconhecida.

**Cruzamento posterior em 21/10/2026:** [lote de pesquisa e arte 01](../artes-referencia/receitas-cruzadas/lote-01/LEIA-ME.md), com 48 pratos indexados e fontes históricas adicionais para 16. Blogs de 2010 e a tabela de jogadores corroboram Pamonha no nível 3 (230 ouros, 12 h, 50 porções, 20/porção e 100 XP) e Tacos Triplos no nível 4 (120 ouros, 4 h, 50 porções, 11/porção e 55 XP). Sete fichas de pratos avançados também foram conferidas. A pesquisa registra diferenças de edição, inclusive Batatas Sorridentes com 10/30 minutos e Torta de Limão da Vovó com 270/170 porções. Originais ampliados convencionalmente e duas reconstruções transparentes de Image Gen foram salvos separadamente; estas são prévias derivadas, não sprites originais nem upscales idênticos. E02 continua sem implementação: ainda faltam referências de preparo, calibração e a apresentação do lote de cadastro com a versão das regras escolhida.

**Continuação da pesquisa em 21/10/2026:** [lote de pesquisa e arte 02](../artes-referencia/receitas-cruzadas/lote-02/LEIA-ME.md) para Vatapá e Mandioquinha, na ordem observada da segunda página Básico. O Vatapá reutiliza como referência a prancha de Marcela Rojas, além do vídeo; seus valores no vídeo são 60 ouros, 60 min, 65 porções, venda a 4/porção e 25 XP, com nível histórico 4. Mandioquinha tem 50 ouros, 12 min, 32 porções, venda a 4/porção e 50 XP no vídeo, mas o nível e a edição não foram corroborados. As duas ampliações convencionais e prévias Image Gen permanecem separadas. O [índice geral das receitas pesquisadas](../artes-referencia/receitas-cruzadas/index.html) reúne os 48 pratos, quatro prévias e os vínculos com as quatro receitas já existentes no runtime. Nenhum preparo ou cadastro novo foi implementado neste lote.

**Lote adicional de seis artes em 21/10/2026:** [lote de pesquisa e arte 03](../artes-referencia/receitas-cruzadas/lote-03/LEIA-ME.md) para Arroz de Carreteiro, Quindim, Salada Caesar, Bolo de Cenoura, Super À La Minuta e Carré de Carneiro. São os quatro últimos cartões da segunda página Básico e os dois primeiros da página Avançado observados no vídeo; essa mudança de aba não comprova a sequência completa do livro Básico. Os dois primeiros mantêm nível/economia pendentes, com tempo e XP lidos no vídeo. As quatro receitas restantes têm especificações históricas vinculadas às fontes. O índice geral passa a dez pratos com prévias, sempre separadas dos originais ampliados. E02 permanece sem novos cadastros; referências de preparo e calibração continuam necessárias.

**Novo lote e tabelas históricas em 21/10/2026:** [lote de pesquisa e arte 04](../artes-referencia/receitas-cruzadas/lote-04/LEIA-ME.md), com Torta de Limão da Vovó, Lagosta Nobre, Batatas Sorridentes, Salmão com Alcaparras, Pimentão Recheado do Chef e Banana Split. Os [onze anexos fornecidos](../artes-referencia/receitas-cruzadas/fontes-usuario/2026-10-21-tabelas/LEIA-ME.md) ficam preservados com hashes e transcrição das evidências usadas. A torta conserva os conjuntos 270 porções/líquido410 e 170 porções/líquido210; as batatas conservam 10min nas fichas e 30min no vídeo. A Banana Split tem nível57, 160 porções a12 e 13h18 nas tabelas nominais; custo490 e XP190 são associados à linha numérica compatível, com XP corroborado no vídeo. O índice soma dezesseis prévias em quatro lotes. Sem alteração de receitas ou simulação: arte de preparo, calibração e escolha explícita das regras de cada versão ainda antecedem novos cadastros E02.

**Aplicação de E02 em 21/10/2026:** os lotes 01–04 foram integrados ao jogo após autorização: 16 receitas novas, 20 no livro, separadas em Básico/Avançado e ordenadas por posição observada, não por tempo. A [documentação de aplicação](receitas-aplicadas.md) registra os valores provisórios autorizados, os marcadores `provisionalRules`, a panela de preparo reutilizada e as versões escolhidas de Torta/Batatas. Há validação de nível no servidor. E02 tem agora cadastro e ciclo funcional para esses pratos; referências específicas de preparo e verificação completa em sala continuam pendentes e não são anunciadas como recuperação dos sprites originais.

## Features médias

| ID | Categoria / feature | Primeira entrega funcional | Arte disponível / lacuna | Dependências e atenção |
| --- | --- | --- | --- | --- |
| M01 | Recompensas — dispensa/caixa de presentes | Receber e usar prêmios enviados pelo próprio jogo: porções, energia, temperos e decoração | Ícones atuais `gift`/`yellow-box`, capturas P117 e suporte S02; painel interno exige recorte ou Image Gen | Definir tipos de prêmio, consumo único e destino de cada item. Envio entre jogadores fica em H01 |
| M02 | Retenção — bônus diário | Ciclo de sete dias, painel, coleta e retomada correta da sequência | Captura P047, botões e ícones atuais; reconstruir as partes do painel que não estiverem prontas | M01 para os prêmios que viram itens. Relógio do servidor e coleta única; decidir a versão antes de implementar |
| M03 | Progressão — conquistas | Serviço Eficiente, Cardápio Variado e Grande Investidor, com etapas e recompensa | `trophy.png` atual e capturas P043/P117/P145; painel, medalhas e estrelas precisam ser separados ou reconstruídos | Contadores persistentes e recibos de prêmio. Confirmar se cada meta conta preparo, prato servido ou porção. Celebridade e Chef Generoso aguardam social/presentes |
| M04 | Missões — tutorial e primeiras tarefas | Uma cadeia curta do Papa dos Pudins com objetivos de cozinhar, servir e decorar | Sequência P126 e pranchas narrativas 7526833; retrato/painel limpos a localizar ou gerar | Reutilizar os eventos de progresso de M03 e a concessão de M01. Manter objetivo ativo após recarregar; não executar toda a série histórica de uma vez |
| M05 | Bebidas — máquina de café | Máquina, quatro cafés básicos, preparo, estoque, pedido do cliente e consumo | S03, blog oficial de 19/01/2011 e imagens de café no acervo externo; o balão modular e recursos atuais já servem | Estender o fluxo de bebidas existente, preservando regras específicas. A prancha de sucos não é arte de café; confirmar xícaras, máquina e valores de cada café |
| M06 | Bebidas — prêmios de domínio | Entregar o prêmio uma única vez quando o sabor atingir a meta | Lista oficial dos prêmios de sucos/cafés; parte da decoração existe em pranchas | M01 e mapeamento sabor→item. Exige o móvel correto, não só o texto do prêmio; M05 para cafés |
| M07 | NPC especial — crítico de restaurante | Visita, identificação, assento, refeição, estrela clicável e avaliação | Blog oficial de 19/08/2010, P074, `critico1.jpg`/`critico2a.jpg`; estrela e balão reutilizáveis | Novo estado do NPC e bônus único no servidor. Retrato não equivale a avatar animado; adaptar partes existentes ou produzir arte faltante com Image Gen |
| M08 ✓ | Atendimento — garçons locais | Implementado em 21/10/2026: contratação nas vagas, atendimento autônomo, prato carregado e cerco clássico | P039/P031/P111, suporte S02, moldura Image Gen e ícones/avatares atuais | Primeiro empregado automático e contratação gratuita provisórios; escolha entre amigos reais e gorjetas continuam em H02. Ver [entrega e testes](fila-chef-e-garcons.md) |
| M09 | Equipamentos — fogões rápidos/turbo | Bônus de velocidade por modelo sobre um preparo | P077, fogões já cadastrados e pranchas; o catálogo já suporta PNGs e rotações de fogões comuns | Fonte por modelo e duração final no servidor. Os relatos de 10%/20% não são um bônus universal para todos os PNGs |
| M10 | Construção — prateleira de temperos | Estoque de peças, progresso de montagem e liberação da prateleira | Tutorial oficial de 13/07/2010, S01 e imagens `tut-spice*`; consumíveis e painel atuais | Estoque de materiais e obtenção por recompensas/compra. Pedido aos amigos depende de H01; não desfazer silenciosamente os temperos já possuídos |
| M11 | Coleção — caixas misteriosas | Abrir uma caixa de conteúdo definido e receber o item no inventário | Blog oficial de 11/02/2011, caixas de 4432119/002, `yellow-box.png` | M01, conteúdo e regras definidos no servidor. Tipos/raridades e eventual custo são decisões documentadas; uma imagem não revela probabilidades |
| M12 | Social — vizinhos e barra de amigos | Convidar/aceitar/remover vizinho e visitar seu café | Interface visual concluída em 23/10/2026: convites laranja, seis cartões por página, quatro banners originais e preparo para perfis reais; ver [barra social](barra-social.md) | Amizades persistentes, pedidos e busca continuam pendentes. Visitas por link já existem; o convite local copia o endereço do próprio café. Orkut/Facebook serão substituídos por contas locais, adaptação explícita |
| M13 | Energia — pacotes e boosts | Consumir recargas e permitir excesso temporário de energia quando confirmado | FAQ de energia S02 e PNGs atuais do HUD; painel de pacotes por referência | M01 para guardar pacotes. Separar recarga comum de boost acima do limite; regras históricas variam entre versões |

## Features difíceis

| ID | Categoria / feature | Por que é mais difícil | Arte / fonte e divisão proposta |
| --- | --- | --- | --- |
| H01 | Social — presentes e ajuda aos vizinhos | Envolve remetente/destinatário, limite diário, aceitação, recibos, recompensas e ações em outra sala | S02; presente e energia/tempero/materiais atuais. Depois de M01/M12: primeiro um tipo de presente, depois retribuição, limpeza e temperar pratos |
| H02 | Atendimento — equipe de amigos e gorjetas | Funcionários contratados entre contas, aparência, múltiplas tarefas e concorrência no caminho | Suporte de contratação e relatos históricos. Depende de M08/M12; separar contratar da simulação de vários garçons |
| H03 | Equipamentos — fogões montáveis, evolução e várias bocas | Um fogão pode ter vários preparos, estados/offsets de pratos, evolução e requisitos distintos | Missões de 2013, P140 e pranchas 12918119. Depois de M09/M04/M10: construir → evoluir → múltiplas bocas |
| H04 | Máquinas de entretenimento | Cliente deve usar o equipamento, acumular rendimento, liberar coleta, gastar energia e tratar conserto | Blog oficial de 24/09/2010 e 06/01/2011; snacks, jukebox, fliperama e sorveteria. Fazer uma máquina completa e reaproveitar o sistema nas demais |
| H05 | Expansão — filial na praia e filiais adicionais | São ambientes persistidos com acesso, desbloqueio, inventário e simulação próprios; não apenas outro fundo | Blog oficial de 06/07/2011 e imagens de praia; P127/P140 para outras filiais. Começar apenas pela praia depois de missões e materiais |
| H06 | Expansão — segundo piso e elevador | Novo ambiente/andar, circulação, visibilidade, construção e salvamento; não é aumentar a altura do PNG | P121 e suas 14 capturas. Fazer somente depois da base para vários ambientes de H05 |
| H07 | Produção — pátio de suprimentos e receitas especiais | Acrescenta encomendas de materiais, estoques, tempos e objetivos de missão | Guia local e referências de 2014; nível 40 é relato daquela edição. Diferente do pátio de mesas que já existe |
| H08 | Progressão — estrelas e itens Star | Muda a progressão tardia e introduz máquinas que dependem de suprimentos | P123: banheiro, Wi-Fi, souvenir e outros. Depende de H04/H07; não substituir os limites atuais de popularidade sem decidir a versão |
| H09 | Narrativa — internacionais e eventos completos | Muitas etapas, personagens, receitas, recompensas, cenas e prazos; não basta cadastrar títulos de missão | P120/P122/P124/P127, missões de 2013 e 7526833. Motor M04 primeiro; depois um episódio pequeno. Páscoa/piratas/Popstar entram como temporadas separadas |

## Ordem recomendada de entregas

Uma entrega deve ter um resultado utilizável, com imagem, regra e persistência, antes de iniciar a seguinte. Os itens abaixo são uma sequência proposta, não autorização de implementação nesta pesquisa.

| Etapa | Entrega | Resultado visível |
| --- | --- | --- |
| 0 | Preparar a referência visual do lote escolhido | Mostrar imagens, partes reutilizáveis e faltantes, regras e escopo; fechar as lacunas antes do código |
| 1 | E01 + um pequeno lote E02/E03 | Nome editável e mais conteúdo no café usando os sistemas existentes; sugestões: até três receitas e uma coleção por lote, após conferir arte e dados |
| 2A | M01 — prêmios do próprio jogo | Caixa funcional que recebe e usa recompensas, sem depender de amigos |
| 2B | M02 — bônus diário | Primeiro ciclo completo de sete dias, com prêmio de hoje, próximos dias e coleta segura |
| 3A | M03 — três conquistas locais | Metas reais, progresso salvo e recompensa única |
| 3B | M04 — primeira cadeia do Papa | Orientação com tarefas e prêmio; reutiliza os mesmos eventos e concessões |
| 4A | M05 — quatro cafés básicos | Um novo equipamento utilizável e um novo pedido no balão do cliente |
| 4B | M06 — recompensas do domínio | Dar utilidade concreta ao domínio dos sucos e, depois, dos cafés |
| 5 | M08 → M07 | Primeiro garçom funcional; depois o crítico visitando a sala com recompensa por atendimento |
| 6 | M12 → H01 → H02 | Vizinhos reais, presentes/ajuda e só então contratação ligada a amigos |
| 7 | M10/M09 → H04 → H03 | Materiais, bônus de equipamento, primeira máquina completa e evolução de fogões |
| 8 | H05 → H06/H07 → H08/H09 | Praia, novos ambientes, produção e conteúdo tardio, em projetos separados |

M11 e M13 são opcionais entre as etapas 3 e 7, depois da caixa de prêmios. E04 acompanha cada sistema quando sua interface e regras estiverem prontas.

**Ordem atualizada em 21/10/2026:** depois do lote autorizado de fila do chef e M08, preparar a referência visual e o escopo de uma coleção pequena de E03. Concluir as pendências de E02 depois. Os registros de pesquisa acima descrevem o estado de cada etapa à época; a aplicação parcial de E02 e o checklist inicial representam o andamento atual.

**Primeiro sistema novo recomendado: M01 + M02, em duas entregas separadas.** O quadro diário tem uma referência visual muito clara, e a caixa de prêmios será reutilizada por conquistas, missões, domínio e presentes. Para um aquecimento menor antes disso, E01 é a mudança mais localizada.

## Escopo sugerido do primeiro bônus diário

Referência principal proposta: a imagem **Cozinhe Diariamente** de 2010, P047. A imagem mostra quadro de sete dias, prêmio atual, botão Receber prêmio, ouro, pratos surpresa, temperos e granas. Os ícones atuais de moeda/tempero/cadeado devem prevalecer; reconstruir quadro, papéis e enfeites apenas quando não houver partes prontas adequadas.

Antes de implementar, mostrar uma composição com esses elementos e fechar:

- **Versão:** na proposta de 2010, cozinhar no dia habilita o prêmio. O texto oficial de 20/05/2011 descreve prêmio por entrar no jogo. São alternativas históricas, não regras a combinar silenciosamente.
- **Calendário:** definir o dia do servidor, sequência, falta de um dia e reinício após o sétimo. A data do computador do jogador não decide o direito ao prêmio.
- **Economia:** transcrever números legíveis e rotular estimativas. O XML adulterado não é prova de valor oficial.
- **Pratos surpresa:** entregar porções/itens de recompensa válidos, sem fingir que uma receita do livro é um prêmio recebido. Se a categoria de prato não estiver pronta, tratá-la como dependência de M01, não preenchê-la com um prêmio inventado.
- **Aceite:** o mesmo dia não paga duas vezes; outra aba não duplica o prêmio; recarregar mantém o estado; usar o prêmio vai ao destino correto; nova data libera a etapa apropriada; datas e conexão não mudam a animação da sala.

Não gerar a arte final nem programar o bônus durante o levantamento. A apresentação do lote é o próximo passo após a escolha do responsável.

## Referências visuais já inspecionadas

### Quadro diário — P047

![Quadro diário histórico](../artes-referencia/cafe-mania-acervo-documentado/cafe-mania-acervo/imagens/interface-eventos-guias/P047_01_cafegranagratis_0e1188f1.jpg)

Referência completa disponível, mas é uma captura achatada. Não anunciar quadro, cadeados e papéis como PNGs independentes já prontos.

### Conquistas — P043

![Painel histórico de conquistas](../artes-referencia/cafe-mania-acervo-documentado/cafe-mania-acervo/imagens/interface-eventos-guias/P043_01_conquistas_9bd97cfe.jpg)

A captura registra títulos, disposição dos cartões e estrelas. Não comprova todas as metas e todos os valores de recompensa.

### Primeira missão — P126

![Referência de missão do Papa](../artes-referencia/cafe-mania-acervo-documentado/cafe-mania-acervo/imagens/missoes/P126_01_001_2076b410.png)

Esta referência tem marca d'água e texto incorporado. Localizar uma arte limpa equivalente ou reconstruir as peças com Image Gen; não colocar esta captura diretamente no runtime.

### Itens e pratos — Behance 4432119/002

[Abrir a prancha de Marcela Rojas](../artes-referencia/cafe-mania-behance-alta-qualidade-documentado/cafe-mania-behance/artes/4432119/002.jpg). Contém pratos, fogões, balcões, decorações e caixas. É material para extração e calibração, não cadastro automático. A prancha 003 foi conferida: contém a máquina e bebidas de suco, não xícaras de café.

## Fontes e grau de certeza

- **S01 — blog oficial recuperado:** `C:/Users/Ulisses/Desktop/Projetos/Projeto-Cafe-Arquivo/CafeMania-Clone/Acervo-CafeMania/06_inventario/blog_cafe_mania_posts.md`. Posts consultados: Prateleira de Temperos (13/07/2010, `?p=4`), Crítico (19/08/2010, `?p=220`), máquinas (24/09/2010), Sorveteria (06/01/2011, `?p=475`), Domínio de cafés (19/01/2011, `?p=521`), ajudantes (28/01/2011, `?p=538`), Caixas Misteriosas (11/02/2011, `?p=560`), novo Prêmio Diário (20/05/2011, `?p=983`), filial de praia (06/07/2011) e Mapa de Progressos (24/08/2011, `?p=1518`). Fonte primária preservada; conferir cada post, sem extrapolar sua época.
- **S02 — suporte recuperado:** `faq_suporte_cafe_mania.md`, na mesma pasta. Seções consultadas: cozinha, contratação, avatar, energia, presentes, vizinhos e visitas. A coleta também contém perguntas de outros jogos; não incluir esses sistemas automaticamente.
- **S03 — cafés e máquinas:** [reprodução dos textos oficiais de janeiro de 2011 e setembro de 2010](https://cafemaniablogdedicas.blogspot.com/2011/02/). Confirma cafés básicos/médios/avançados e prêmios por domínio, além de montagem/coleta de máquinas; não fornece uma tabela completa de balanceamento para nossa edição.
- **S04 — interface e personalização:** [relato contemporâneo de março de 2011](https://cafemaniajogadohonestamente.blogspot.com/p/somente-para-jogadores-de-cafe-mania.html). Fonte secundária para nome do café e interface.
- **S05 — bônus antigo:** captura P047 e [relato de 2010 sobre cozinhar diariamente](https://jogandoocafemania.blogspot.com/2010/). Não substituir pela regra de login de 2011 sem registrar a mudança.
- **S06 — crítico:** [reprodução contemporânea do anúncio oficial](https://jogandocafemania.blogspot.com/), publicação de 19/08/2010, e post primário local S01. Confirma visita durante a sessão, estrela na refeição e avaliação.
- **S07 — conteúdo tardio:** `documentacao/guia.md`, fontes P121/P123/P127/P140 e `missoes-2013.csv` dos acervos locais. Boa evidência da existência; muitos números e passos continuam incompletos.
- **S08 — arte e autoria:** [Marcela Rojas](https://www.behance.net/gallery/4432119/CafeMania), [Sabrina Contino](https://www.behance.net/gallery/4286853/Items-Characters-for-CafeMania), [Kiaris Cosentino](https://www.behance.net/gallery/12918119/Cafe-Mania), [histórias de Milena](https://www.behance.net/gallery/7526833/Game-Storylines-CafeMania-Project). As cópias locais foram usadas para a inspeção; publicar o portfólio em determinado ano não prova lançamento do item naquele ano.

Existência de feature, aparência e valor numérico têm graus de certeza diferentes. Recompensas e probabilidades que faltam não serão preenchidas como fatos históricos. O arquivo `ripped/game-config.xml.txt` contém alterações explícitas, portanto serve para localizar nomes/estruturas e comparar evidências, não como configuração oficial intacta.

## Critérios gerais de conclusão de cada lote

O servidor Go continua dono da simulação compartilhada; o cliente apresenta e interpola. PocketBase mantém recursos, inventários e concessões duráveis. Conquistas e missões devem consumir eventos de ações confirmadas, sem gravar movimento por frame. Recompensas precisam de concessão única, inclusive em reconexão e duas abas.

Fazer testes curtos da regra alterada e conferir a composição com assets reais. Mudanças sociais exigem dois jogadores e isolamento de permissões; mudanças de NPC exigem passagem, ocupação e animação na sala. A animação de abertura dos novos modais deve reutilizar `ModalAnimation`/`PopupOpening`.

Neste levantamento foram revisados documentos, imagens e caminhos. Nenhum build, suíte de testes, alteração de banco ou implementação de feature foi necessário.
