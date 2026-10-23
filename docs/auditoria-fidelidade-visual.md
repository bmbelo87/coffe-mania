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

