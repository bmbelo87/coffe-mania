# Sombras de contato do cenário

`game/src/screens/room/scenery-shadow.ts` mantém perfis de contato em coordenadas nativas do PNG. A sombra copia âncora, escala, espelhamento, pivô, rotação e posição da arte. Uma translação de origem permite manter a sombra de uma placa aninhada na camada de chão do quarto. Não há compensações soltas do centro do tile, nem o deslocamento vertical da sombra genérica dos avatares. Nenhuma das artes desses objetos foi redesenhada.

| Peça | Contato nativo | Forma |
| --- | --- | --- |
| Vendedora, 400×640 | (226,620), centro dos dois sapatos | Uma elipse de raios 42×14 |
| Terreno à venda, 476×616 | (238,582), centro da base da madeira | Uma elipse de raios 66×33 |
| Expansão à venda, 600×560 | (175,385) e (450,536) | Uma elipse de raios 44×22 por estaca |
| Barraca, 800×640 | (122.5,545), (296.5,627), (682,475); fechamento traseiro (508,393) | Pegada pelas bases com margem paralela de 14 px |

As pontas inferiores das solas e das bases de madeira são vértices frontais da pegada, não seu centro. Na barraca, as diagonais acompanham os pés da arte existente; forçá-las a 26,565° deslocaria a sombra. A margem é perpendicular e constante em todas as arestas. Medições também registradas nos `registration.json` das peças.

As sombras são objetos separados na camada do chão (`FLOOR_DRAW_PRIORITY + 2`), sem eventos de ponteiro. A arte em pé conserva sua ordenação pelo tile. Ao reconstruir o cenário ou as ofertas de expansão, cada sombra é removida junto com sua peça. Margens transparentes e altura do toldo não determinam a pegada. O efeito não simula luz direcional ou sombra projetada distante.

O [FurnitureVisualization do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/visualization/furniture/FurnitureVisualization.ts) trata a sombra numa camada própria, com alfa e profundidade separados das demais camadas. Aqui esse princípio usa a camada de chão do nosso runtime; os valores e algoritmos do Nitro não são copiados.

## Limpeza da plataforma em 23/10/2026

`game/public/assets/scenery/coast-city/parking/platform.png` é uma reconstrução, não um PNG original recuperado. A edição usou o gerador integrado ImageGen, com o próprio PNG como referência. O arquivo final preserva 1280×640, canal alfa e apoio `(640,2)`. `registration.json` registra o arquivo gerado de origem, hash e os quatro cantos usados para calibrar novamente a projeção 2:1. As outras peças do estacionamento foram preservadas.

Prompt enviado ao ImageGen:

> Use case: precise-object-edit. Edit target: attached existing transparent PNG isometric parking platform from Cafe Mania fan game. Correct ONLY the inconsistent widths and lengths of the painted dark gray straight separators between the slabs, especially the lower-left arm of the large central cross which is narrower/shorter than the other arms. All long arms must have same thickness in ground-plane coordinates and reach the surrounding dark gray border cleanly with identical junctions. Also ensure yellow-black hazard stripe dashes along the two bottom edges have consistent full lengths, no small shortened run compared to others. Keep EXACT original diamond corners, canvas composition, 2:1 projection, three big slabs and four small upper slabs, same colors and flat Flash-game style. Do not add objects, shadows, text, outlines, realism, texture or extra gradients. Background genuinely transparent. Preserve existing object shape and internal slab colors. This is a technical cleanup of current art, no redesign.

A geração regularizou as separações internas, com pequenas diferenças nos limites das lajes e gradientes, mas a borda frontal continuou afunilada: aproximadamente 12,25 px junto do canto lateral contra 3,25 px perto do canto inferior. A escala uniforme do Sprite não causava essa diferença; a borda interna já estava inclinada no PNG.

`ParkingPlatform.ts` corrige a composição ao carregar a arte: reutiliza um ciclo preto/amarelo da faixa traseira esquerda, repete 13 ciclos completos e iguais em cada lado e mantém a largura perpendicular em aproximadamente 8,75 px. A faixa é espelhada na projeção 2:1. A transição copia o cinza existente até 20 px e mistura até 24 px; as lajes começam além dessa zona. O alfa, os quatro cantos, o apoio e todos os pixels mais internos permanecem iguais ao PNG. O resultado é uma textura em cache, calculada uma vez por textura de origem; não há processamento por frame nem dependência de um PNG novo no cache do navegador.

Esse é um recorte, repetição e calibração do raster existente, sem novos desenhos vetoriais ou geração de outra plataforma. A origem do Container nativo permanece no canto superior esquerdo e o runtime aplica pivô (640,2) e escala 0,52, conservando a posição do lote.

O [RoomPlane do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/visualization/room/RoomPlane.ts) separa textura, matriz do plano e cache. Aqui a calibração do conteúdo fica independente da transformação no mundo; os algoritmos do Nitro não são copiados.

## Verificação da correção

- `node tools/scenery/verify-contacts.mjs`: centros medidos, offsets dos frames, espelhamento, duas estacas independentes e paralelismo/margem da pegada da barraca.
- `node --test tests/unit/parking-platform.test.mjs`: preservação de alfa e interior; quatro lados com ciclos inteiros e limite interno uniforme.
- `npm run typecheck`.
- Chromium/WebGL isolado com o **RoomScreen real**, usando `refreshCafeScenery` e `refreshLandSign`: quatro capturas em zoom 1,7–2,8, mais a conferência com os contatos marcados. Isso verifica a montagem que o jogo usa, sem simular dados de uma conta real ou acessar o banco. Capturas e posições em `.runtime/scenery-precision/`.
