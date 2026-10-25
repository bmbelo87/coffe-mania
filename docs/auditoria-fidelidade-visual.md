# Auditoria de fidelidade visual — clone × Café Mania original

Levantamento de 23/10/2026. Nada foi implementado. Este documento compara a versão 0.5.0 com as referências do jogo original e propõe a ordem do trabalho.

As pranchas lado a lado (clone à esquerda, original à direita, com a data) ficam em `.runtime/auditoria-visual/`, fora do repositório:

| Prancha | Assunto |
| --- | --- |
| `01-sala-e-hud.jpg` | Sala, HUD e barra de amigos |
| `02-cenario.jpg` | Cenário da cidade |
| `03-livro.jpg` | Livro de Receitas |
| `04-temperos.jpg` | Temperos |
| `05-empregados.jpg` | Empregados |
| `06-configuracoes.jpg` | Configurações e controles |
| `07-bloqueado.jpg` | "Bloqueado!" e confirmação de expansão |
| `08-popularidade-estrelas.jpg` | Popularidade e Café Estrela |
| `09-loja.jpg` | Loja |
| `10-guarda-roupa.jpg` | Guarda-roupa |
| `11-callouts.jpg` | Balões do fogão e do balcão |
| `12-sucos.jpg` | Máquina de Sucos |

## Fontes consultadas

- Acervo documentado (`artes-referencia/cafe-mania-acervo-documentado/`): 146 posts de blogs de fãs, 2010–2014, com 119 capturas de interface, 82 de missões, 70 de decoração, 28 de máquinas e expansões, 16 de temperos e 10 do Café Estrela.
- Behance (`artes-referencia/cafe-mania-behance-alta-qualidade-documentado/`): 16 coleções dos artistas da Vostu, publicadas de 2012 a 2016. A coleção `15414597` (UI, assets e banners) é a mais útil para a interface final.
- Vídeo `cafe mania muito tempo de jogo.mp4`: quadros de 10 em 10 segundos em `artes-referencia/cenario-praia/video/`, de uma conta nível 130 por volta de 2013.
- Blog oficial da Vostu e 60.736 comentários de jogadores, pela skill `acervo-cafe-mania`.
- Fórum da Vostu (`08_wayback/forums.vostu.com`): o arquivo só guardou a pele do fórum (ícones e cabeçalho), nenhuma captura do jogo. Não serviu como referência visual.

## As épocas do visual

O jogo mudou de cara em datas que os posts registram. Misturar épocas é o principal risco de uma reconstrução.

| Época | Marco | O que muda na tela |
| --- | --- | --- |
| Lançamento (jul–dez 2010) | Primeiras capturas dos blogs | HUD com barra de XP em faixa marrom, popularidade "105,0" com carinha, coluna vertical de botões à direita (+, −, tela cheia, olho, música, som), ícones antigos de categoria |
| Café Estrela (15/11/2011) | Post "O Café mais popular" | A popularidade ganha estrelas douradas; o teto passa de 105 para 120, 135, 160… conforme as estrelas |
| Renovação visual (29/12/2011) | Post "Mudanças no visual do Café Mania!" | Novo painel de XP, energia e suprimentos (a chama fica vermelha até 50 e azul acima); temperos redesenhados; ícones de categoria da loja e da barra de ações novos; barra de vizinhos em madeira |
| Visual final (2012–2014) | Behance 2012–2013, vídeo de ~2013, capturas de 2014 | Barra inferior branca com cartões "Agregar Amigo"; colunas de ícones nas laterais (missões à esquerda, construíveis à direita); carrossel de novidades sob a barra; Livro de Receitas marrom com dois chefs; janelas de missão em madeira |

O clone já segue o visual final na maior parte: os ícones de `game/public/assets/ui/`, a barra de ações, o painel do topo e o Livro de Receitas. Por isso este documento usa **2012–2014 como alvo**. Telas sem captura dessa época podem seguir a de 2010 até aparecer referência melhor, desde que isso fique registrado.

## Resumo

| Situação | Itens |
| --- | --- |
| Fiel ao visual final | Painel do topo (caféGranas, caféOuros, XP, energia, suprimentos), barra de ações, Livro de Receitas, janela "Parabéns!!!", guarda-roupa, loja, Máquina de Sucos (2010), balão "Clique no fogão para preparar um prato!", placa "Terreno à venda" |
| Arte reconstruída, mas com o layout certo | Empregados (2010), "Bloqueado!" (2010), balão de pensamento, 16 pratos, 25 peças da orla |
| Desenhado em código onde o original tinha arte | Ícones de caféGrana e caféOuro do topo, Configurações, confirmação de expansão (com logo improvisado), "Bloqueado!", cartões de expansão, balão "Prato pronto", dica da Máquina de Sucos, barra de amigos "beta" |
| Diferente do original | Popularidade sem estrelas e com teto 105, ausência das colunas laterais, cenário sem placas, obras e figurantes |

## 1. Desenhado em código no lugar de arte

Pela regra do `AGENTS.md`, painéis, ícones e elementos ilustrados devem ser imagens. Texto dinâmico, áreas de clique e indicadores funcionais podem continuar em código. Fora o modo dev, a varredura de `new Graphics()` em `game/src` encontrou estes casos visíveis:

| Onde | Arquivo | O que é desenhado | Referência para a arte |
| --- | --- | --- | --- |
| Topo da tela | `screens/room/CurrencyHud.ts` (`createCashIcon`, `createGoldIcon`) | Nota verde de caféGrana e moeda de caféOuro, como polígono e círculos | Ícones do HUD final (Behance `15414597/007.png`, vídeo); a moeda do efeito de compra (`GoldBurstEffect`) já é arte e pode ser reaproveitada |
| Configurações | `ui/SettingsModal.ts` (11 desenhos) | Painel branco com moldura, caixas de seleção, controles deslizantes, ícones de nota musical e alto-falante | Ver a seção 2: o original não tinha esta janela |
| Confirmação de expansão | `screens/room/SellConfirmModal.ts` | Moldura, **logo "CAFÉ MANIA" numa elipse amarela**, botões de fechar e confirmar. O próprio arquivo marca a arte como provisória | O logo real já está recortado (`.runtime/video/logo-cafemania-recorte.png`). A moldura pode seguir o padrão creme das janelas de 2010 (P017, P020) |
| "Bloqueado!" / "Comprar Expansão?" | `screens/room/ExpansionModal.ts` (9 desenhos) | Moldura azul com raios, cadeado, botão de fechar, ícones de moeda e nota | P066_01, P066_02 e P066_03 mostram a janela raster original, com cadeado de arte e botão roxo "Desbloquear por" |
| Cartões de expansão da loja | `screens/room/StoreActionBar.ts` (`renderCards`) | Moldura, cadeado e botão "Comprar" | Behance `15414597/008-009` (cartões da loja); já listado como pendente em `docs/cafe-inicial-2014.md` |
| Abas superiores da loja | `screens/room/StoreActionBar.ts` | Abas com chanfro e brilho | Behance `15414597/008` |
| Balão "Prato pronto." | `screens/room/ReadyDishCallout.ts` | Balão vetorial branco com contorno marrom | O balão de arte de `IdleStoveCallout` já existe e pode ser reaproveitado; P145_08 mostra o balão do balcão ("Nachos de Queijo / 29 porções restantes / Servindo Agora") |
| Progresso do preparo | `CookProgressCallout.ts`, `CookProgressBar.ts` | Trilha cinza e preenchimento | Indicador funcional: pode ficar em código, mas a moldura deveria ser arte |
| Dica da Máquina de Sucos | `RoomScreen.ts` (`juiceTooltip`) | Texto com contorno, sem balão | P072_07 mostra os balões "Máquina Vazia" e "Suco Pronto / 6 Copos restantes" |
| Barra de amigos | `screens/room/ActionBarBetaSlots.ts` | Oito espaços "beta" com moldura desenhada (o arquivo diz "Conteúdo provisório") | Vídeo ~2013: cartões laranja "Agregar Amigo" e cartões com nome, foto, estrela de nível e XP |
| Cartões do livro | `CookScreenModal.ts` | Fundo das pílulas de recursos, botões verdes, caixa de favorito | Uso aceitável como interface funcional; conferir com o quadro 003 do vídeo |
| Paredes | `screens/room/ProceduralWallView.ts` | Estrutura vetorial (topo e bordas), com o papel de parede como textura | Aceitável enquanto o perfil bater com as capturas; conferir espessura e topo com P117_02 e o vídeo |
| Tela de carregamento | `screens/loading/ProgressBar.ts`, `SecondLoadingOverlay.ts` | Listras e brilho da barra | Barra funcional; vale comparar com o carregamento original numa etapa própria |

## 2. Telas, comparadas por época

| Tela | No clone | No original | O que ajustar |
| --- | --- | --- | --- |
| **Sala e HUD** | Topo e barra de ações iguais ao visual final | Mais três elementos: coluna de **missões** à esquerda (rostos dos personagens, chapéu, fogão), coluna de **construíveis** à direita (fogão, casa, taça, caminhão, com contadores), bandeja de ingredientes acima da carinha e carrossel de novidades sob a barra | Começar pelas colunas, mesmo sem as mecânicas, só depois de decidir quais funções elas teriam no clone |
| **Popularidade** | "80,9/105", carinha e nome do café | Com o Café Estrela (nov/2011): "106,7/160", cinco estrelas sob o número, balão "Café Estrela" com popularidade máxima e próxima estrela, janela "Seu Café ganhou uma Estrela!" | O teto 105 é do lançamento; com o HUD final, o certo são as estrelas. É mecânica, além de arte: exige planejar |
| **Barra de amigos** | Oito espaços "beta" | Cartões "Agregar Amigo" nas pontas; cartões com nome, foto ou silhueta, estrela de nível e XP | Trocar o provisório por cartões de arte, mesmo sem amigos reais (vizinhos de NPC ou "Agregar Amigo") |
| **Livro de Receitas** | Muito próximo do quadro 003 do vídeo | O painel da direita mostra sempre a receita selecionada, com o relógio, "Compra por N ouros", "Ganha no total N XP" e "Outros ganhos" (porções e c/un.). Os cartões bloqueados têm o botão roxo "Desbloquear por N" | Tirar o estado vazio "Sabia que…?" e implementar o botão roxo, já registrado como pendente. A aba **Deluxe** não aparece nas capturas de 2013 (Básico, Avançado, Especiais, Favoritos): confirmar a fonte antes de manter |
| **Temperos** | Seis colunas lado a lado, com "Comprar" e "Usar" | 2010: janela "Temperos" com as abas **Prateleira / Mercado** e grade 3×2. No visual final, seis cartões creme lado a lado: é a captura do jogo final enviada pelo responsável, origem registrada em `game/public/assets/ui/spices/source.json` | **Já segue o visual final.** A primeira versão desta auditoria dizia que o layout não tinha referência; estava errada, porque a captura não está no acervo, só no `source.json` |
| **Empregados** | Quatro cartões, cadeados e "Trabalhando" (layout de 2010) | 2013 (P145_09): cartão "DONO", cartões com foto, "Demitir", "Posição disponível" e "Contratar", setas laterais | Coerente com 2010. Para o visual final, falta a variante de 2013 |
| **Configurações** | Janela grande desenhada em código | Não existia janela. Em 2010, coluna vertical de botões à direita (+, −, tela cheia, olho, música, som); em 2013, a engrenagem azul da barra abre um menu pequeno | Trocar por botões de arte. Os ícones da engrenagem e da barra já existem |
| **Guarda-roupa** | Igual a P145_12 | Mostra o preço de cada peça (moeda e valor) sob o ícone | Conferir se o preço deve aparecer; o resto bate |
| **Loja** | Próxima de Behance `15414597/008` | Painel à direita com o nome do item e a prévia ("Nome do Item"); etiquetas de preço nos cartões | Painel de detalhe e etiquetas |
| **"Bloqueado!" e expansão** | Mesmo layout de P066, desenhado em código | Arte raster | Ver seção 1 |
| **Máquina de Sucos** | Igual a P072_04 | Dicas em balão sobre a máquina; janela "Chame reforços!" (chaveiro) com arte própria | Balões de arte; conferir a janela do chaveiro |
| **Subida de nível** | Igual a P022 e P142_04 | — | Nada |
| **Missões, eventos e conquistas** | Não existem | Janelas em madeira com personagem ("Missão Cumprida!", "Dojo Culinário", "Teste de Admissão"), "Conquistas" com estrelas e "Cozinhe Diariamente" / "Prêmio Diário" | Funcionalidades inteiras, com arte de referência abundante. Planejar como lotes próprios |

## 3. Cenário

O que já existe: a orla da cidade com mar, areia molhada e seca, píer com o arco "CAFÉ DE PRAIA", lancha, guarda-sóis, espreguiçadeiras, boia, pranchas, pedra com palmeira, calçadas, rua com faixa de pedestres, árvores e a placa "Terreno à venda". Todas as peças são reconstruções (`docs/cenario-cafe-urbano.md`).

O que aparece no original (vídeo ~2013 e capturas de 2010) e falta no clone:

| Elemento | Onde aparece | Observação |
| --- | --- | --- |
| Placa **"Expansão à venda"** (amarela, com faixas pretas) | Quadro 002, no gramado junto à borda do café | Par da "Terreno à venda". Hoje a expansão só se compra pela loja |
| **Obras "Construa-me!"** | Quadro 002, junto à cozinha | Construíveis (fogões especiais); depende da mecânica |
| **Barraca de feira com vendedora** | Quadro 002, no gramado | Pode ser a barraca de ingredientes das missões; confirmar a fonte |
| **Elevador "Primeiro andar"** | Quadro 012, na calçada | Segundo piso, liberado por missões (acervo: 14 capturas de `segundo-piso`) |
| **Estacionamento com faixa zebrada e placa "E"** | Quadro 003, ao lado da parede da porta | Já listado em `docs/cafe-inicial-2014.md`; ligado aos suprimentos |
| **Figurantes da praia**: banhistas, vendedor de picolé com carrinho | Quadro 005 | Hoje a praia não tem figurantes; precisa de arte e de comportamento |
| **Mobiliário urbano de 2010**: hidrante vermelho, banco vermelho, flores, bueiro | P117_07, P115_01 | É da calçada de 2010, que tinha piso vermelho. No visual final a calçada é de pedra cinza; usar só se aparecer em captura posterior |
| Poste de luz no píer | Quadro 005 | Conferir se a haste ao fundo do píer do clone é esse poste |
| Ilha e viagem de barco para a filial na praia | Quadros 006, 007 e 010 | Já fora do escopo atual (`docs/cenario-praia-modular.md`) |

Posição dos objetos: no vídeo, o café fica com a rua passando junto à parede da porta e o mar a noroeste, como no clone. As placas de venda ficam no gramado, coladas às bordas do café: "Terreno à venda" à esquerda, "Expansão à venda" à direita. O elevador fica na calçada, depois da faixa de pedestres. Essas posições vêm de uma conta já expandida; num café inicial, as distâncias precisam ser calibradas de novo.

## 4. Inconsistências de época e números

- A popularidade usa o teto de 105 (2010) junto com o HUD de 2012–2014, que mostra estrelas e tetos maiores.
- O Livro de Receitas copia o layout de 2013, mas os números são de 2010: o Churrasco dá 110 XP no clone, e o vídeo de 2013 mostra "Ganha no total 75 XP". É questão de economia, fora do escopo visual; vale decidir a época dos números junto com a dos visuais.
- Empregados, Máquina de Sucos e "Bloqueado!" seguem 2010. Funciona, mas a janela de empregados mudou em 2013.

## 5. O que não dá para afirmar com as fontes

- O acervo não tem captura da janela de Temperos depois de 29/12/2011. A captura do visual final usada pelo clone foi enviada pelo responsável e não está no acervo.
- Não há captura de uma janela de configurações no visual final; só da engrenagem.
- A barraca do quadro 002 não tem nome nem post associado no acervo.
- O fórum arquivado não guardou imagens do jogo.
- O teto de popularidade de cada estrela vem de capturas de 2014 (120, 135, 160); não há tabela completa.

## 6. Plano proposto em lotes

Cada lote segue a regra do projeto: apresentar referências e assets antes de implementar.

| Lote | Conteúdo | Assets | Esforço |
| --- | --- | --- | --- |
| **F1 — Trocar o desenhado em código** | Nota e moeda do topo; logo e moldura da confirmação; "Bloqueado!"; balões "Prato pronto" e da Máquina de Sucos; cartões de expansão | Reaproveitar: logo recortado, balão do `IdleStoveCallout`, moeda do `GoldBurstEffect`, cadeado `ui/padlock.png`. Criar com Image Gen: moldura da janela, nota de caféGrana e cartão de expansão | Pequeno, quase só arte e troca de texturas |
| **F2 — Controles e configurações** | Coluna de botões (zoom, tela cheia, música, som) ou menu da engrenagem no lugar da janela grande | Ícones existentes da barra; criar os que faltarem | Pequeno |
| **F3 — Placas e estacionamento** | Placa "Expansão à venda" e a área cinza de estacionamento com borda zebrada, barreiras brancas e placa "E" (vídeo ~2013, quadros 002 e 003; P125_09) | Criar com Image Gen a partir dos quadros; a placa segue o estilo da "Terreno à venda" que já existe | Médio |
| **F4 — Barra de amigos e popularidade com estrelas** | Cartões "Agregar Amigo" e de vizinhos; estrelas sob a popularidade, balão "Café Estrela" e janela de estrela nova | Criar cartões, estrelas e janela a partir de P123 e do vídeo. Mecânica de estrelas e teto variável no servidor | Médio a grande (mecânica) |
| **F5 — Cenário** | Placa "Expansão à venda", estacionamento com placa "E", figurantes da praia | Criar com Image Gen a partir dos quadros 002, 003 e 005 | Médio |
| **F6 — Colunas laterais** | Missões à esquerda e construíveis à direita, primeiro só como interface | Recortar e reconstruir os ícones do vídeo | Depende de decidir as mecânicas |
| Depois | Missões, conquistas, prêmio diário, segundo piso, filial na praia | Referências abundantes no acervo | Grande; cada um é uma funcionalidade |

Sugestão de ordem: F1 e F2 primeiro, porque são baratos e removem o que mais destoa. Depois F3, que antecipa a parte de placas do F5. F4, F5 e F6 pedem decisões de mecânica antes da arte.

O F3 original (Temperos no layout de 2010) foi cancelado em 23/10/2026: o layout atual já é o do visual final.

## Andamento do F1 (23/10/2026)

Feito com arte que já existia:

- **HUD:** a nota de caféGrana e a moeda de caféOuro vêm do atlas `icon_bundle_1.png`, o mesmo do Livro de Receitas.
- **Balão branco de dica:** é a arte restaurada do "Comida estragada" (`HoverBalloon.ts`). Agora serve também para:
  - "Prato pronto!", com a foto do prato;
  - o prato do balcão ("Nachos de Queijo / 29 porções restantes", como em P145_08);
  - a Máquina de Sucos ("Máquina Vazia", "Suco Pronto / N copos restantes", "Máquina trancada", como em P072_07).
- **Confirmação:** logo real do Café Mania (`ui/logo/`, recortado da faixa Behance 49023909), botão vermelho de fechar dos Temperos e visto verde da loja.
- **"Bloqueado!" / "Comprar Expansão?":**
  - cadeado `ui/padlock.png`;
  - botão vermelho de fechar;
  - botões verdes com a arte dos Temperos;
  - nota e moeda da loja.

Arte nova, gerada pelo responsável com o ChatGPT a partir das referências e só recortada aqui. Origem em `ui/dialog/source.json` e `store/expansion-cards/source.json`:

| Arte | Onde entra |
| --- | --- |
| Fundo da janela "Bloqueado!" (P066) | "Bloqueado!" e "Comprar Expansão?" |
| Botão roxo "Desbloquear por" | Mesmo nine-slice do botão verde |
| Moldura creme (P017_03) | "Confirmação!" |
| Cartões altos: destacado e bloqueado | Aba Expansões, com o cadeado e o "Comprar" de arte |

O cartão branco comum (`normal.png`) ficou guardado, mas ainda não é usado. Os desenhos em código dessas peças só aparecem até a arte terminar de carregar.

## Andamento do F2 (23/10/2026)

- A engrenagem azul, na barra e na loja, abre um menu suspenso para cima (`SettingsMenu.ts`) com:
  - zoom + e −;
  - tela cheia;
  - música e som: ligam e desligam, e ao ligar de novo voltam ao volume anterior;
  - a engrenagem pequena de "Avançado".
- Os botões vêm da folha azul da interface atual (`ui/buttons_collection_1.png`). As variantes desligadas e "sair da tela cheia" foram geradas a partir dela (`ui/settings-menu/`).
- O menu aberto não tem captura do original: é reconstrução. As funções são as da coluna de 2010; o olho ficou de fora por falta de evidência do que fazia.
- "Avançado" é a antiga janela de Configurações, agora com a moldura creme e o fechar vermelho, sem a linha do nome do jogador. Ela guarda o volume fino, o modo bitter e o modo dev.
- O botão HTML de tela cheia do canto some na sala e continua no carregamento e no guarda-roupa.

### Correção pelo menu original (24/10/2026)

O vídeo "Café Mania level 400" (1:00–1:12) mostra o menu da engrenagem aberto, e ele era diferente da reconstrução acima (prancha `.runtime/auditoria-visual/20-menu-engrenagem-original.png`). O menu passou a seguir o vídeo:

- **Formato:** grade 2x3 alinhada pela direita da engrenagem. De cima para baixo, as linhas são − e +, olho e tela cheia, som e música. As medidas estão em fração da engrenagem: botão de 0,82, passo de 0,87 e 0,2 de folga até ela.
- **Direção:** no vídeo a grade **desce**, porque a engrenagem fica acima da barra. Aqui a engrenagem fica dentro da barra de ações do visual final, e descendo a grade cobria a barra de vizinhos e passava da borda da tela. Por isso ela **sobe**, com a mesma ordem de linhas e as mesmas medidas.
- **Comportamento:**
  - a grade fica aberta enquanto se joga, inclusive com janelas abertas, e só fecha com um novo clique na engrenagem;
  - fica acima das barras e abaixo das janelas.
- **Desligado:** som e música desligados aparecem só esmaecidos, com o mesmo ícone. As variantes `sound-off` e `music-off` foram retiradas; "sair da tela cheia" continua, porque o jogo em tela cheia mostra as setas para dentro.
- **Olho:** usa o botão `visualizar` da folha azul. Nenhuma fonte diz o que ele fazia. Aqui ele esconde as barras e os textos da interface, deixando só o café, a engrenagem e a grade. **Reconstrução sem evidência.**
- **"Avançado":** não existe no original. A engrenagem pequena fica à direita da engrenagem principal, porque à esquerda está o envelope.

## Andamento do F3 (23/10/2026)

- **Placa "Expansão à venda"** (`scenery/expansion-sale/`), reconstruída do quadro 002 do vídeo de ~2013 no estilo da "Terreno à venda". Fica no gramado em frente ao estacionamento, além da próxima expansão. Ao passar o mouse, o piso novo aparece em verde e surge o balão "Clique para expandir seu Café!". O clique abre "Comprar Expansão?" ou "Bloqueado!". Só aparece para o dono e enquanto houver expansão.
- **Estacionamento** (`scenery/coast-city/parking/`), reconstruído do quadro 003 e da captura "Encomenda de Suprimentos" (P125_09): quatro ladrilhos de concreto, borda zebrada nos três lados de grama, barreiras brancas e placa "E". Fica colado à calçada, logo depois da borda direita da próxima expansão, e anda junto quando o café cresce.
- **Limites:**
  - o estacionamento é só cenário: ainda não recebe a entrega de suprimentos;
  - a posição foi estimada pelo vídeo de uma conta já expandida;
  - os personagens não desviam das barreiras, porque o cenário externo não entra na grade de navegação.

## Andamento do F5, parte 1 (23/10/2026)

O "estacionamento" do F3 era, no original, a **plataforma de encomendas** (área de descarga de suprimentos). Foi refeita a partir do café novo do vídeo "Testando o Game" (5:06, pasta `videos-jogo/`):

- **Plataforma** (`scenery/coast-city/parking/platform.png`): piso 4x4 tiles com a borda tracejada. As 4 lajes pequenas do canto de trás são as vagas das encomendas (`PLATFORM_SLOTS`).
- **Entrada** (`entry.png`): asfalto com faixas brancas, setas ← → e a barreira zebrada na beira da rua.
- **Posição medida no vídeo:** no quadro de 4:36 do "Testando o Game" (café novo 6x9, sem a loja aberta), a grade isométrica foi ajustada pelos cantos do piso, e cada peça foi convertida em tiles a partir do canto direito do piso, onde termina a parede da porta. O resultado fica em `CAFE_SCENERY_LAYOUT` (`cafe-scenery.ts`):
  - plataforma 1 tile além da borda da frente, rente à linha da parede da porta;
  - placa "E" na quina do café;
  - duas barreiras sobre a borda do lado do café e duas um tile para fora da borda da frente;
  - barraca e vendedora quase 2 tiles adiante da frente do café, alinhadas com a plataforma.

  O erro de medida fica em torno de 0,2 tile. A conferência sobrepõe o clone ao quadro original no mesmo enquadramento (`.runtime/auditoria-visual/18-f5-posicoes-medidas.png`).
- A entrada foi encurtada 0,58 tile no asfalto liso entre as setas e a barreira, para a barreira ficar na mesma distância do vídeo.
- Tudo acompanha a borda do café atual, como no original. A prévia verde da próxima expansão pode passar por baixo da plataforma.
- **Barraca de feira** (`scenery/market-stall/`): toldo listrado e caixotes de frutas, com a vendedora separada, em frente ao café.
- Saíram o ladrilho e o meio-fio zebrado do F3. A placa "E" e as barreiras continuam.

Falta a parte 2: van, janela de encomenda, cone a caminho, caixas, recolher com energia, entrega imediata e estragar.

## F4 — interface da barra social (23/10/2026)

Concluída a parte visual da barra: cartões beta removidos, convite laranja da variante observada no vídeo, seis posições de jogadores entre dois convites, paginação, quatro banners originais e alternância pelo envelope. Dados de jogadores entram por contrato tipado, sem nomes/níveis/XP aleatórios. O convite por link usa a moldura atual como adaptação local. Fontes, recortes, reconstruções e verificações estão em [barra-social.md](barra-social.md).

Ainda pendentes neste F4: popularidade com estrelas, balão Café Estrela e janela de estrela nova. M12 também segue pendente na parte de relações persistentes, pedidos/aceitação/remoção e busca; a preparação visual não conclui essas mecânicas.

## Ajustes de contato e recorte (23/10/2026)

- Concluídas as sombras de chão da barraca, da vendedora (elipse nos pés) e das placas de venda. Apoios e camadas separados conforme [sombras-cenario.md](sombras-cenario.md).
- Plataforma: separadores e faixa zebrada regularizados com ImageGen e exportação calibrada no mesmo losango 2:1, com alfa real.
- Cadeira clássica: máscara traseira corrigida para excluir o assento que cobria o cliente. Técnica reutilizável e ferramentas de verificação em [encostos-cadeiras.md](encostos-cadeiras.md).
- Verificação específica: regressão dos pixels de assento, profundidade, tipos, sincronização dos catálogos e render isolado dos sete modelos de cadeira em quatro rotações. Não conclui as mecânicas pendentes de encomendas, relações sociais ou outras etapas do plano.


## Revisão dos apoios e da borda da plataforma (23/10/2026)

A conferência ampliada encontrou afunilamento que persistia no PNG gerado da plataforma, além de contatos estimados no centro do canvas em vez do centro das bases. A composição agora regulariza a faixa com um ciclo raster existente, em cache, nos quatro lados, preservando alfa, lajes e apoio. As sombras acompanham os contatos medidos nos pixels dos sapatos e da madeira, incluindo as duas estacas da placa de expansão. Conferência no RoomScreen real, sem acessar o banco, com zoom ampliado e apoios marcados. Medições, contrato e testes em [sombras-cenario.md](sombras-cenario.md).

### Cadeira clássica: faixa junto da haste

Concluída a revisão da máscara na região afunilada do poste, que ainda promovia uma faixa de assento sobre a camisa. A regressão agora varre a área inteira do banco em vez de depender somente de pontos isolados, e textura/máscara compartilham o arredondamento de pixels. Reprodução no RoomScreen com look contrastante e os mesmos frames sentado/comendo nas duas vistas traseiras; conferência nos zooms 0,55, 1 e 2,4. Procedimento e limites em [encostos-cadeiras.md](encostos-cadeiras.md).

### Ajuste fino da parte 1 (23/10/2026)

Conferido por sobreposição com o quadro de 4:36 do "Testando o Game", ampliado 8x a 10x:

- **Barreiras:** posições medidas no quadro: duas logo antes da borda do lado do café e duas a 0,8 tile da borda da frente-direita. As hastes da arte gerada eram curtas; foram alongadas 50 px sem mexer no trilho nem nos pés.
- **Barreira zebrada da entrada:** na geração ela passava das bordas da pista e foi aparada na largura do asfalto.
- **Plataforma:** mede 4,15 tiles no vídeo e foi ajustada para isso.
- **Barraca:** arte refeita pelo responsável, recolocada na posição e no tamanho do vídeo.
- **Placa "Terreno à venda":** sem pátio comprado, fica a 3,8 tiles da borda da frente, na linha da quina direita do piso.
- **Placa "Expansão à venda":** não aparece em nenhum vídeo de café novo (níveis 1 a 6), só em cafés já expandidos (níveis 130 a 300). Agora ela só aparece depois da primeira expansão.

Prancha: `.runtime/auditoria-visual/19-f5-cafe-novo.jpg`.

## Meio-fio, faixa de pedestres e fim da rua (24/10/2026)

Comparados com o vídeo "cafe mania muito tempo de jogo" (1:52–2:12), sobrepondo o clone ao quadro na mesma escala. A escala veio da grade do piso do café: 1 px do vídeo = 2,39 px do mundo.

- **Meio-fio da rua:** no original ele tem cerca de 59 px de mundo (topo 22, quina iluminada 5, espelho 21, linha escura 7), com juntas a cada ~160 px. O nosso tinha 24 px, quase todo espelho. Refeito com as cores medidas: o topo fica sobre a calçada e o espelho sobre o asfalto. Calçada visível 132 px (original 131–136); asfalto visível 288 px (original 306).
- **Lado da praia:** no original aparece o topo do meio-fio (cinza-claro, junta escura e uma linha clara). Aqui ele quase sumia: a calçada do outro lado da rua cobria a faixa perto da esquina. Agora a faixa segue a areia até a esquina.
- **Lado do café:** só o topo, com o chanfro claro do lado da calçada, como no vídeo.
- **Fim da rua:** a areia entra no asfalto numa curva em S de até 12 px de mundo. O traçado foi medido a cada 6 px e suavizado; o espelho do meio-fio termina num corte vertical, onde a curva começa.
- **Faixa de pedestres:** quatro listras de 26,8 × 17,7 px, com espaçamento desigual (27,7 a 32,9), igual em todos os quadros dessa câmera. As cinco listras antigas estavam juntas demais.
- **Faixa central:** traço de 38,2 a cada 67,5 px (antes 41,6 a cada 83), na fase do vídeo, a 49,4% do asfalto visível.
- **Limite:** a rua do clone é cerca de 6% mais estreita que a do vídeo; a geometria do café não foi mexida por isso.

Verificação: sobreposição com o quadro de 1:58 (meio-fio, listras, curva e traços coincidem), conferência no zoom normal e `node --test tests/unit/scenery.test.mjs` (12 testes; os que fixavam as alturas antigas foram atualizados).

## Andamento do F5, parte 2 — encomendas de suprimentos (24/10/2026)

- **Arte:** cone, cinco caixas (Express, Média, Premium, Jumbo e estragada), ícone da van e janela "Encomendas". São gerações do ChatGPT a partir dos vídeos e da captura P125_09; a caixa estragada e a janela são reconstruções sem captura. Recorte e registro em `tools/supplies/cut-art.py`, com âncora no centro da pegada e silhueta convexa para o clique.
- **Servidor (`database/supplies.go`):** pedido, entrega imediata, recolher, salvar e descartar, cada um numa transação com recibo idempotente (`supply_orders`, `supply_operations`).
  - **Plataforma:** 4 vagas [Com. 2011-03-21, 2011-04-10].
  - **Recolher:** gasta 1 de energia [Com. 2011-03-21] e só cabe o que a despensa (`crates_max`) comporta. O resto fica na caixa, como no original.
  - **Validade:** a caixa estraga 24 h depois de chegar (balanceamento do projeto) e pode ser salva por 1 caféGrana [Blog 2011-09-14]. Descartar é adaptação local.
  - **Preços em caféOuros:**

    | Tamanho | Suprimentos | Tempo | Preço | Origem |
    | --- | --- | --- | --- | --- |
    | Express | 4 | 10 min | 3.000 | fontes |
    | Média | 15 | 2 h | 20.000 | sem fonte |
    | Premium | 40 | 12 h | 75.000 | fontes |
    | Jumbo | 60 | 24 h | 125.000 | fontes; entrega imediata por 4 caféGranas |

  - **Sem fonte:** a Média inteira, os níveis de liberação (1, 2, 4 e 6) e a entrega imediata das outras (1 a 3 caféGranas).
- **Cliente:**
  - a van fica entre a galinha e o envelope na barra de ações e abre a janela com os quatro tamanhos, a despensa e as vagas livres;
  - na plataforma, o cone aparece enquanto a encomenda vem, depois a caixa do tamanho pedido e, por fim, a caixa estragada, nas quatro lajes pequenas (centros medidos na arte);
  - o balão segue o texto do original ("Premium: chega em HH:MM:SS / Clique para Entrega Imediata");
  - os pagamentos usam a janela "Confirmação!".
- **Dev:** os comandos `supplies_arrive` e `supplies_spoil` adiantam o relógio das encomendas, e `reset_cafe` também apaga as encomendas.
- **Limites:**
  - só o dono vê as caixas;
  - nenhum prato gasta suprimentos ainda;
  - não existem despensas à venda, então um café novo guarda só 4 (despensa base do original) e as encomendas maiores são recolhidas em várias vezes.
- **Verificação:** `go test` do pacote `database` (inclui 5 testes novos de encomendas) e conferência no Chromium do ambiente isolado. O teste no navegador cobriu a janela, os quatro cones, a chegada, o recolher da caixa da frente e da de trás (energia e despensa), a entrega imediata e o salvar pelo clique, e a caixa estragada.

## Andamento do F5, parte 3 — figurantes da praia (24/10/2026)

- **Arte:** sorveteiro com o carrinho e banhista com picolé (`scenery/beach-extras/`), gerados com o ChatGPT a partir do vídeo "cafe mania muito tempo de jogo" (1:54) e do quadro 005. Recorte em `tools/scenery/beach-extras/cut-art.py`, com apoio no ponto entre os contatos com o chão.
- **Comportamento (`BeachExtras.ts`):** como no original, os dois ficam **parados**. Uma primeira versão os fazia andar, por engano: entre os quadros quem se movia era a câmera.
- **Posição:**
  - medida no quadro de 1:54 e levada para o nosso cenário pelo letreiro "Café de Praia", pelo pé da escada do píer e pela boia;
  - os objetos da praia do clone não têm exatamente a mesma disposição nem o mesmo tamanho dos do original, por isso a referência é o píer, o objeto mais próximo;
  - o sorveteiro fica à direita do pé da escada, um pouco afastado dela, e o banhista mais abaixo, à esquerda;
  - comparação lado a lado em `.runtime/auditoria-visual/23-figurantes-praia.png`.
- **Escala:** a altura no vídeo é de 62 px para o banhista e 82 px para o sorveteiro, com o guarda-sol. Com 1 px = 2,39 px do mundo, as escalas ficam em 0,31 e 0,32.
- **Profundidade:** o cenário da orla continua na ordem fixa do `scene.json`. Cada figurante entra entre os objetos de pé pela linha do chão, e a sombra do píer, que é decalque, não conta.
- **Limites:** só decoração, no cliente: não entram na navegação, no servidor nem no clique. Nossos objetos da praia (boia, cadeiras, guarda-sóis) estão maiores e mais espalhados que no original; isso fica registrado para uma revisão própria do cenário.

## Revisão de apresentação — abas, balões e arte de sala (24/10/2026)

Concluídos: abas altas por trás da frente bege; conteúdo maior nos balões com sobra apenas acima; aviso persistente da próxima encomenda; remoção do contorno grosso das três cafeteiras posicionadas e dos dois figurantes da praia; mesas xadrez com redução14% e registro(-3,-8); cadeiras correspondentes com redução7% e máscaras sincronizadas. O ponto do prato acompanha o tampo, sem mudar tiles, navegação ou ordem de camadas. Fontes, diferenças históricas, calibração e verificações offline estão em [ajustes de balões e contornos](ajustes-baloes-contornos.md). E02/E03 e a entrega de prêmios de domínio não são marcados como concluídos por esta revisão visual.

## Revestimentos do acervo e apoio das cafeteiras — 25/10/2026

- [x] Calibrar a carcaça inferior dos três estágios da cafeteira na projeção 2:1, preservando as regiões das xícaras e os controles.
- [x] Importar 12 pisos e 12 papéis de parede das pranchas 008/009 de Manati P, com repetição unitária medida e preços identificados como provisórios.
- [x] Sincronizar o catálogo e conferir transparência, registro, quatro orientações de piso e os três estágios junto à parede no renderizador offline.

Fontes, limitações e verificações estão em [revestimentos do Behance e cafeteiras](revestimentos-behance-e-cafeteiras.md). A revisão não altera o estado de E02/E03.

## Quatro rotações e reconstrução das cadeiras — 25/10/2026

- [x] Café: quatro direções nos três estágios; suco: quatro direções nos quatro estágios, com vistas traseiras reconstruídas.
- [x] Cadeira rosa nova e poltrona amarela/preta reconstruída, calibradas nas quatro direções.
- [x] Apoio do quadril por quadro, máscaras de braços/encostos, fantasma de decoração e cursor com a direção correta.

Identidades e preços preservados. Prévias, fontes e verificações estão em [rotações das máquinas e cadeiras](rotacoes-maquinas-e-cadeiras.md). E02/E03 não foram marcados como concluídos por este lote.

## Limpeza dos pisos e paredes extraídos — 25/10/2026

- [x] Revisar os 47 revestimentos ativos e corrigir resíduos em nove pisos e uma parede, preservando as outras 37 superfícies.
- [x] Restringir a extração às células/faixas visualmente livres e registrar as reconstruções localizadas por ImageGen.
- [x] Aplicar a arte integral aprovada de Céu e Morros, limpar o canto da Rosa dos Ventos e centralizar a lajota de Paris Azul.
- [x] Preservar alfa, dimensões, registros, IDs e preços; conferir a repetição e sincronizar os catálogos.

Fontes, regiões corrigidas, prompts e limites estão em [restauração dos revestimentos](restauracao-revestimentos.md). E02/E03 não foram marcados como concluídos por esta revisão de arte.

## Rotação e apoio na poltrona amarela — 25/10/2026

- [x] Corrigir a associação das vistas frontais R0/R1, com máscaras e contatos correspondentes.
- [x] Recuar o quadril para o apoio junto ao encosto, preservando raiz, sombra e tile.
- [x] Conferir dois visuais, quatro direções e todos os quadros de comer: 40 composições offline; acrescentar regressão da direção física da abertura e sincronizar os catálogos.

Detalhes e evidências na seção final de [rotações das máquinas e cadeiras](rotacoes-maquinas-e-cadeiras.md). E02/E03 mantêm o andamento anterior.

## Decoração sem bloqueio por NPCs — 25/10/2026

- [x] Liberar seleção e colocação diante de clientes/garçons, inclusive móveis ocupados e trajetos em andamento.
- [x] Após uma alteração persistida, liberar reservas e conservar refeição/bebida até o término no apoio original; então encaminhar o cliente à saída sem penalidade.
- [x] Preservar cancelamento, operações recusadas, contabilidade da refeição, apoio na reconexão/dormência e a calibração do passo.

Regras, verificações e limites em [decoração sem bloqueio por NPCs](decoracao-sem-bloqueio-npcs.md). E02/E03 não foram marcados como concluídos por esta alteração.
