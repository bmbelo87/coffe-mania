# Fundo modular do café urbano

Execução autorizada em 22/10/2026, seguindo o [plano da orla](cenario-praia-modular.md). Escopo: o cenário que aparece atrás do café da cidade. A filial na praia, a viagem pelo mar, missões e novos pontos caminháveis não foram implementados.

## Entrega

25 PNGs em `game/public/assets/scenery/coast-city/`, organizados por um manifesto `scene.json` com 41 partes independentes. Cada parte tem posição, tamanho e camada; terrenos repetíveis têm escala, base isométrica e máscara próprias. Não é uma captura achatada única. A integração está nos carregadores normais de assets e no renderizador de cenário do `RoomScreen`.

| Grupo | PNGs publicados |
| --- | --- |
| Terreno e água | `water`, `sand`, `wet-sand`, `grass`, `shoreline` |
| Urbanização | `sidewalk`, `curb`, `road`, `road-start`, `road-marking`, `crosswalk` |
| Vegetação | `tree-round`, `tree-conifer`, `rock-palm` |
| Objetos da areia | `umbrella-green`, `umbrella-orange`, `umbrella-folded`, `beach-chair`, `lifebuoy`, `surfboards` |
| Atracadouro | `pier`, `boat`, `pier-arch`, `pier-steps`, `pier-shadow` |

**Todas as 25 artes são reconstruções por Image Gen ou recortes dessas reconstruções**, não PNGs originais extraídos. Os móveis, piso, paredes, personagens e ícones da interface continuam usando seus assets existentes. Os PNGs urbanos técnicos anteriores do Restaurant City foram preservados e deixaram de ser o fundo carregado pelo fluxo normal do jogo.

Os objetos são modulares por sprite: é possível mudar uma árvore, guarda-sol, cadeira, barco ou píer sem refazer o terreno. O grupo de rochas/vegetação é uma peça; o corpo do píer inclui corrimão e apoios, mas arco/placa, escadinha e sombra sob o píer são sprites separados. As demais sombras dos objetos continuam incorporadas ao respectivo PNG. Separar corrimãos e piso será necessário se futuramente houver atores andando no píer. Nesta entrega nenhum ator é enviado ao píer e nenhum botão de viagem foi criado.

## Referências e regra visual

Referências principais: vídeo local em 00:48–00:50 e 01:58–02:00; prancha [002 de Erica Perez](../artes-referencia/cafe-mania-acervo-complementar-2/cafe-mania-acervo-2/artes/49023909/002.png), com [origem no portfólio](https://www.behance.net/gallery/49023909/Cafe-Mania-Vostu). Os recortes utilizados estão em `tools/scenery/coast-city/references/`.

Estilo obrigatório registrado também em `AGENTS.md`: silhuetas, paleta, contornos, proporções e sombras do Café Mania original; nenhuma reinterpretação realista ou com brilho extra. As peças foram comparadas com os recortes e sobre fundo colorido para verificar o alfa efetivo. O primeiro barco tinha uma faixa lateral não confirmada e recebeu revisão para casco creme. A costa recebeu revisão e o contorno efetivamente renderizado foi conferido. Masters e tentativas anteriores foram preservados, mas só as versões selecionadas são publicadas.

Fidelidade visual não significa identidade pixel a pixel: as referências contêm sobreposições, compressão e áreas encobertas. A referência adicional `references/pier-gate-original.png` confirma o arco e a placa amarela “CAFÉ DE PRAIA”, agora reproduzidos. Outros detalhes escondidos pelos indicadores superiores permanecem sem confirmação. Não foi incluído o elevador/construção funcional, vendedores ou eventos como se fossem parte pronta do mapa. As reconstruções devem continuar sendo comparadas com novas evidências, especialmente nesses pormenores.

## Montagem e contratos

- Grade 160×80 e referência lógica do café preservadas. O terreno usa a mesma câmera, sem mudar a troca de tile na metade do passo.
- Máscaras e matrizes representam áreas e projeção; não desenham ilustrações substitutas. Mar, areia, calçada e estrada vêm dos PNGs gerados. A linha da costa acompanha o centro do alfa da própria faixa branca para evitar frestas.
- Texturas repetíveis têm cópias espelhadas nos PNGs publicados para unir bordas. A orla usa curvas largas e rasas; objetos únicos não são repetidos como textura.
- O asfalto sem pintura no fim da rua impede que a linha central se sobreponha às barras curtas da travessia. Estas usam os dois eixos do chão, não barras verticais de tela. A PNG é exportada com duas vezes a dimensão lógica; amostragem direta sem mipmaps mantém as separações também no carregamento normal do jogo.
- Peças de fundo não recebem cliques e não bloqueiam a seleção ou arrasto de móveis. Terrenos repetíveis se estendem além da área visível; os limites declarados da câmera permanecem separados dessa extensão, inclusive no celular.
- As faixas atuais de circulação externa dos NPCs continuam contidas nas calçadas. A navegação compartilhada e a persistência não foram alteradas; nenhum passo é gravado por frame no banco.
- Aplicado o princípio de origem, base e máscara separados de [RoomPlane do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/visualization/room/RoomPlane.ts), já consultado no levantamento. Nosso runtime usa sprites/tiling sprites e máscaras locais; não é o rasterizador de planos do Nitro.

## Arquivos de trabalho

- `tools/scenery/coast-city/masters/`: saídas originais selecionadas e tentativas anteriores do Image Gen.
- `tools/scenery/coast-city/prompts/`: instruções exatas de cada geração/revisão.
- `tools/scenery/coast-city/source.json`: classificação, recortes, dimensões, hashes, recorte de transparência e exportação de cada PNG.
- `tools/scenery/coast-city/export.mjs`: exportação determinística, calibração, recorte de margens e repetição espelhada; não pinta arte nova.
- `tools/scenery/coast-city/build_scene.py`: posicionamento, máscaras e pontos de apoio no espaço do jogo.
- `game/dev/coast-city.html`: prévia isolada com móveis reais, café inicial/expandido, zoom e enquadramento do píer; não altera contas.

## Verificações

`npm run typecheck` passou nas revisões anteriores de TypeScript. Este lote modifica assets, montagem e verificações específicas; não altera o runtime TypeScript. `node --test tests/unit/scenery.test.mjs` passou com 11 casos: compatibilidade das imagens antigas, continuidade entre partes, máscaras locais, arquivos/limites válidos, projeção da travessia, proporção das pedras nas duas diagonais, encontro da calçada com as bases reais das paredes, afastamento das árvores, calçadas contendo os pés dos atores externos existentes, largura igual dos passeios e projeção das duas pontas dos traços da pista.

### Revisão após comparação com o jogo original

- A primeira correção levou o fim da calçada de s/v=0 até a face interna das paredes em s/v=80. A revisão de espessura abaixo substitui esse contato pela face externa em s/v=66; paredes, móveis e lógica dos atores permanecem na origem existente.
- A textura das pedras recebia escala desigual e a mesma inclinação da silhueta. `textureMatrix` separa sua base da máscara inclinada, preservando as proporções. O princípio de matriz de textura e geometria separadas foi conferido novamente no `RoomPlane` do Nitro.
- A borda `curb-raised` foi criada com o Image Gen integrado a partir do passeio original: topo claro, face vertical cinza e sombra de base. É exportada como `curb.png` e repetida em módulos; a camada costeira fica abaixo do entroncamento para não atravessar a rua.
- A faixa `crosswalk-crisp` foi refeita com Image Gen e recebe amostragem direta no renderizador, comum aos dois caminhos de carregamento. A prévia agora chama `loadGameAssets`, evitando que a conferência use apenas o caminho auxiliar `loadIndoorArt`.
- O barco foi deslocado para a água ao lado da extremidade do píer. As duas primeiras árvores tiveram os apoios afastados dos passeios, com folga para as sombras no chão.
- Ajuste posterior de camada: o píer é composto depois do barco no manifesto, cobrindo o casco onde houver sobreposição com o corrimão. Posições, tamanhos e PNGs foram preservados.
  Referência técnica consultada: [RoomSpriteCanvas do Nitro](https://github.com/billsonnn/nitro-renderer/blob/main/src/room/renderer/RoomSpriteCanvas.ts), que ordena sprites antes de compor a tela. Neste fundo estático, o manifesto já define essa ordem; não foi necessário alterar a profundidade dos atores ou móveis. A comparação antes/depois confirmou que apenas a ordem mudou nas 35 partes.
- `water-calm` substitui o master inspirado no mar de viagem: poucas faixas largas e discretas. A exportação espelhada elimina frestas de repetição; a frequência é muito menor que na versão anterior. Não representa a futura cutscene.
- Direção das ondas: o Image Gen integrado revisou somente a orientação das cinco faixas do master, duas escuras e três claras, em `water-calm-aligned`, mantendo seu porte e espaçamento. Seus eixos agora são horizontais antes da repetição, evitando que o espelhamento alterne a inclinação. A matriz de textura gira os UVs em −26,565°, acompanhando a linha média da areia (inclinação −1/2). É uma rotação pura, sem escala adicional nem aumento na densidade de repetição. A máscara da costa e as demais partes não mudam. Reutiliza a separação entre textura e geometria descrita acima, com referência no `RoomPlane` do Nitro. Master anterior preservado; prompt em `tools/scenery/coast-city/prompts/water-calm-aligned.txt`.

As versões anteriores dos masters foram preservadas. Prompts e hashes das três novas gerações estão em `tools/scenery/coast-city/`; o arquivo `source.json` registra quais versões são publicadas.

Revisão posterior do píer: o master selecionado é `pier-single-lamp`, editado com Image Gen integrado. A ponta do poste alto tem luminária cônica; a saliência de madeira e o pequeno poste adicional foram removidos, mantendo o poste normal do corrimão. A variação intermediária com duas luminárias foi descartada da publicação. O PNG conserva 700×675, a posição no mapa e a composição acima do barco. Prompts e referências estão na mesma pasta de trabalho.

Revisão da areia molhada: o detalhe ampliado `references/wet-sand-detail.png`, extraído da referência original já catalogada, mostra uma faixa ocre-dourada logo abaixo da espuma, suavizada até a areia seca. `wet-sand.png` foi criado com Image Gen integrado como uma sobreposição com alfa em degradê, sem espuma ou água incorporadas. A camada fica entre a areia seca e a espuma; sua máscara reutiliza o mesmo perfil amostrado da costa e restringe a cor ao lado da areia. A banda ocupa 96 pixels locais, incluindo a região encoberta pela espuma e o término transparente. Reutiliza a projeção e a separação entre arte e máscara já documentadas a partir do `RoomPlane` do Nitro. Nenhum objeto ou onda mudou de posição.

### Passeios, tracejado e entrada do píer

- `sidewalk-muted` substitui as pedras de contraste alto, usando tons próximos de cinza-bege e contornos suaves conforme `references/road-curb-original.png`. `curb-blocks` substitui a borda contínua por blocos claros com tampo, face e juntas discretas.
- Os passeios têm a mesma profundidade de 160 pixels locais. O passeio junto ao café diminuiu de 200 para 160 e o oposto aumentou de 120 para 160. A base das paredes continua em s/v=80; a borda próxima da rua passa a −80, mantendo o café encostado. A pista e a travessia acompanham esse deslocamento de 40 pixels. As rotas dos NPCs não mudam; a verificação usa o centro do tile onde os pés são desenhados, com folga de 40 pixels para a borda.
- O tracejado foi separado do asfalto. Um bloco branco já gerado da faixa de pedestres é recortado, redimensionado e recebe intervalo transparente, sem desenhar nova pintura em código. `road-marking.png` é repetido pelos dois eixos do chão, corrigindo as pontas que antes herdavam apenas a inclinação do asfalto. A sequência começa em um intervalo completo para não cortar o primeiro traço.
- `pier-arch`, `pier-steps` e `pier-shadow` são artes Image Gen independentes. A placa amarela contém “CAFÉ DE PRAIA”; os três degraus se encaixam na entrada e a sombra translúcida acompanha a pegada sob todo o píer. O master do corpo passa a `pier-open-entry`, removendo apenas o fechamento transversal do corrimão nessa entrada. Continua em 700×675, acima do barco.
- Os princípios de projeção por dois eixos e ordem de composição permanecem os já consultados em `RoomPlane` e `RoomSpriteCanvas` do Nitro. Nosso cenário continua estático; a placa não habilita viagem ou nova navegação.

Masters, tentativas e prompts anteriores foram preservados. A seleção atual, dimensões, hashes e recortes estão em `source.json`; os prompts novos são `sidewalk-muted`, `curb-blocks`, `pier-arch`, `pier-steps`, `pier-shadow` e `pier-open-entry`. A primeira tentativa `sidewalk-soft-draft` não é publicada.

Conferência visual com WebGL na prévia isolada, usando `loadGameAssets` e a escala externa calculada da largura real do canvas. Nas revisões anteriores foram vistos cafés 7×10 e 13×17 e zoom 0,55/1/2,40. No lote de passeios, tracejado e arco foram conferidos a composição do café 7×10, o detalhe da rua em zoom 2 e a entrada do píer em zoom 1, incluindo o vão do corrimão. Não houve teste visual com uma conta real nem cobertura de todos os tamanhos de sala, dispositivos e instantes de NPCs. Os limites dessas verificações permanecem distintos de uma confirmação multiplayer completa. Nenhum build do cliente ou suíte completa foi necessário.

![Composição em execução](../tools/scenery/coast-city/preview.png)

[Detalhe da faixa e borda](../tools/scenery/coast-city/preview-crossing.png) · [Barco junto ao píer](../tools/scenery/coast-city/preview-pier.png)

[Areia molhada em execução](../tools/scenery/coast-city/preview-wet-sand.png): conferida com o carregador normal na prévia WebGL. Os nove testes específicos do cenário passaram novamente após incluir essa camada.

### Espessura das paredes e orientação do meio-fio

O contato atual usa a face externa de `wallGeometry`. A face interna continua em s/v=80 e a espessura de 14 pixels leva o limite exterior a s/v=66. O manifesto declara `wallContact: outer`; `sceneBackgroundOffset` desloca apenas os sprites e máscaras do cenário em −14 pixels verticais. Todas as partes recebem o mesmo deslocamento para preservar suas emendas. Não houve mudança em tiles, hitboxes, movimento, posição do café ou servidor.

Os passeios continuam com a mesma largura. Suas faixas autoradas em [−80,80] ficam em [−94,66] na execução, ainda contendo o apoio dos atores externos, que permanece em s/v=−40. A geometria foi comparada nas duas orientações, em segmentos distantes da origem e nos limites do café expandido.

A face vertical cinza na borda costeira voltada para a grama foi removida. A borda da areia reaproveita somente o topo claro dos blocos de `curb.png`, recortando a face vertical e projetando a faixa pelos dois eixos do chão. O mesmo vale para o meio-fio próximo da rua, cuja face é encoberta pelo próprio passeio; o meio-fio distante conserva a face voltada para a pista. As pedras da calçada foram preservadas.

O master do asfalto tinha duas bordas incorporadas que se somavam aos blocos separados. A exportação de `road.png` e `road-start.png` agora recorta somente o asfalto, eliminando as faixas sobrepostas nos encontros. Nenhuma nova geração de arte foi necessária. A referência técnica segue sendo a separação entre geometria e matriz de textura no [RoomPlane do Nitro](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/visualization/room/RoomPlane.ts), adaptada ao cenário estático deste runtime.

Verificação: `npm run typecheck` e os 12 testes de `node --test tests/unit/scenery.test.mjs` passaram. Conferência WebGL com o carregador normal em `/dev/coast-city.html`: café 7×10 e 13×17, dois extremos de parede a 240%, soleira e encontro da rua com a areia. Esses quadros são estáticos e sem atores; a circulação foi verificada pela geometria das faixas, não por uma sessão multiplayer.

[Visão geral](../tools/scenery/coast-city/preview-wall-clearance.png), [limite esquerdo](../tools/scenery/coast-city/preview-wall-left.png) e [limite direito](../tools/scenery/coast-city/preview-wall-right.png).
