# Rotações das máquinas e reconstrução das cadeiras

Lote concluído em 25/10/2026. IDs, preços, unidades compradas e pegadas lógicas foram preservados.

- [x] Quatro direções nos três estágios da máquina de café e nos quatro estágios do suco.
- [x] Giro com R e prévia da evolução atual no modo decoração, inclusive no cursor.
- [x] Cadeira rosa refeita com ImageGen, com um desenho novo conforme solicitado.
- [x] Poltrona amarela/preta reconstruída, com braços e encosto em camadas próprias.
- [x] Apoio do quadril animado no assento, nas quatro direções, sentado e comendo.

## Artes e referências

As frentes das máquinas em execução foram reutilizadas. As sete traseiras são reconstruções novas a partir de cada estágio: painéis ocultos e verso das placas não possuem PNG original recuperado e não são apresentados como artes históricas confirmadas. As direções complementares são espelhadas, como nos demais móveis. São 28 poses de máquina ao todo.

A rosa ganhou estrutura de madeira marrom e estofamento rosa, sem reutilizar a textura geométrica anterior. A cadeira clássica existente foi referência de linguagem visual. A amarela/preta mantém as laterais curvas de Pac-Man, ponto preto e almofadas pretas; as imagens anteriores, derivadas do acervo de Sabrina Contino, orientaram a reconstrução. Foram geradas duas vistas reais por cadeira e espelhadas as complementares.

Foi usado o **ImageGen integrado**. Prompts, referências e origens: [prompts.json](../tools/furniture-rotations/prompts.json). A limpeza final do painel vermelho está em [red-panel-final.json](../tools/furniture-rotations/red-panel-final.json). Gerações com manchas ou reservatório extra foram corrigidas antes da exportação.

Arquivos em execução:

- `game/public/assets/items/coffee_machine/stages/stage-N-rotation-R.png`, N de 1 a 3 e R de 0 a 3.
- `game/public/assets/items/juice_machine/stages/stage-N-rotation-R.png`, N de 1 a 4 e R de 0 a 3.
- `game/public/assets/items/pink_square_chair/front-v2.png` e `back-v2.png`.
- `game/public/assets/items/acervo_chair_yellow_black/front-v2.png` e `back-v2.png`.

As prévias das janelas de café e suco permanecem idênticas, conferidas por hash. As frentes posicionadas foram comparadas pixel a pixel com a versão anterior. Os arquivos antigos das cadeiras permanecem preservados.

Registros reproduzíveis: [machines-export.json](../tools/furniture-rotations/machines-export.json), [back-support.json](../tools/furniture-rotations/back-support.json) e [chairs-export.json](../tools/furniture-rotations/chairs-export.json). A rosa tem largura de 84 px nas duas fontes e a poltrona 110 px. O export usa escala uniforme. O apoio inferior das traseiras passa pelo reamostrador do Asset Studio na projeção 2:1, preservando X, verticais e região superior. Contornos arredondados não são tratados como se todos os seus trechos fossem arestas retas.

## Contratos do runtime

`machinePoseFor` escolhe a direção separadamente da evolução. O carregamento assíncrono confere novamente a evolução e a rotação atuais e ignora vistas substituídas. Textura, registro e hitbox alpha mudam juntos. O modo decoração usa a mesma pose no fantasma e no cursor. R e a persistência de rotação 0–3 reaproveitam as regras existentes.

As cadeiras declaram `seatingAnchors` por pose. O baker projeta as duas raízes das coxas do rig (`Bone4`/`Bone8`) nos quadros SIT/EAT e registra o ponto médio em `seatingHip`. O avatar alinha esse contato ao assento, com folga de 3 px entre articulação e almofada. Assim o apoio do quadril não depende do ponto dos pés de outro clipe. O deslocamento afeta somente o sprite do corpo: raiz, sombra, posição compartilhada e profundidade no chão ficam intactas. Ao levantar, o offset é removido. Atlases anteriores sem esse contato têm fallback para a âncora visual legada.

`seatingBackrests` admite também as rotações 0/1, isolando os braços frontais da poltrona. Nas costas, somente as superfícies realmente à frente do ocupante cobrem o corpo; o assento não sobe inteiro para a camada do encosto. As máscaras são locais ao PNG montado, incluindo as poses espelhadas. O calibrador consulta as novas máscaras autorais para não reaplicar o recorte antigo.

O [AvatarVisualization do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/master/src/nitro/room/object/visualization/avatar/AvatarVisualization.ts) separa postura, offsets do avatar e camada da sombra. O [FurnitureVisualization](https://github.com/billsonnn/nitro-renderer/blob/master/src/nitro/room/object/visualization/furniture/FurnitureVisualization.ts) também separa direção, registro e profundidade. Esses contratos orientaram a solução; o posicionamento usa nosso rig e nossos pixels, sem copiar os valores de postura do Habbo.

## Verificação

- Quatro testes específicos: identidade/preços e prévias preservados; 28 poses e espelhamentos exatos; contatos e máscaras das cadeiras; direção independente da evolução.
- Calibrador de máscaras dos sete modelos e teste de profundidade sentada, cache, vizinhos, levantar e troca lógica de tile na metade do passo.
- Prévia Pixi com avatar real: 16 combinações de cadeira, direção e ação. Contato do quadril conferido em cada quadro; raiz e sombra não se movem; levantar remove o offset.
- Prévia das máquinas: 28 direções e chamadas aos atualizadores reais do RoomScreen; evolução e cargas atrasadas preservam a direção e respeitam vistas descartadas.
- Controlador real de decoração: R, fantasma e cursor nas quatro peças, totalizando 16 combinações.
- Catálogos sincronizados e typecheck do cliente.

Prévias em `.runtime/furniture-rotations/`: `chairs.png`, `chairs-empty.png`, `machines-coffee.png` e `machines-juice.png`. Os relatórios registram tile, direção, rotação, quadro e instante. São verificações offline, sem iniciar banco ou servidor do jogo e sem simular uma compra multiplayer. Navegação e calibração do passo não foram alteradas. E02/E03 conservam seu andamento anterior.

Para reproduzir os exports: `python tools/furniture-rotations/export-chairs.py`, `python tools/furniture-rotations/export-machines.py` e `npm run assets:room`. Os exportadores de café e suco preservam as quatro direções ao recalibrar os estágios.

## Correção da poltrona amarela — 25/10/2026

A arte frontal estava invertida no cadastro: o PNG sem espelhamento abre para sudeste (+x no chão), mas estava atribuído à rotação 1, cujo ocupante olha para sudoeste (+y). O contato numérico do quadril passava nos testes anteriores, porém o corpo atravessava o assento na direção errada. A frente sem espelho agora pertence à rotação 0; a frente espelhada, à 1. As vistas traseiras mantêm as rotações 2/3. As máscaras próximas acompanham essa associação, sem mudar a convenção do servidor `[1,7,5,3]`.

O contato frontal foi recuado do centro da almofada para junto da união com o encosto: ponto autoral (375,360), em vez de (430,400). Nas costas, o ponto é (388,365). No registro do quarto, os contatos são aproximadamente (±5,68;16,07) na frente e (±0,03;18,30) nas costas, antes da folga de 3 px. Isso deixa a área à frente do quadril para as coxas. Raiz do ator, sombra, tile lógico, hitbox e profundidade compartilhada permanecem com seus contratos anteriores.

A solução reutiliza os PNGs atuais, com largura 110 px. Não houve geração de arte nova, deformação ou alteração da cadeira rosa. O export pode ser limitado ao item: `python tools/furniture-rotations/export-chairs.py acervo_chair_yellow_black`; ele preserva os registros das outras cadeiras no relatório.

O [AvatarVisualization do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/master/src/nitro/room/object/visualization/avatar/AvatarVisualization.ts) foi consultado novamente: direção, deslocamento da postura e sombra são tratados separadamente. Aqui o erro estava na associação da vista e no ponto autoral de contato, não na regra de movimento ou na direção enviada pelo servidor.

Verificação específica:

- Cinco testes em `tests/unit/furniture-rotations.test.mjs`, incluindo nova regressão que compara a abertura desenhada, medida por dois pontos da fonte, com a direção projetada de cada rotação.
- `calibrate-backrests.py --check`: máscaras dos sete modelos válidas, incluindo as novas associações frontais.
- `verify-yellow-seating.mjs`: 40 estados distintos, dois visuais, quatro direções, SIT frame 35 e EAT frames 36–39 em 0/80/160/240 ms. Confere quadril no contato, raiz/sombra estáveis e ordem cadeira → corpo → máscara após atualizar cada quadro.
- Catálogos sincronizados: 99 itens, 21 receitas e 16 cafés. Sem iniciar servidor ou banco.

Prévias e relatório: `.runtime/yellow-chair-seating/reference-0.png`, `reference-240.png`, `default-*.png` e `report.json`. A comparação visual é offline com o avatar e as camadas reais do cliente; não confirma uma sessão multiplayer ao vivo. A prancheta antiga testava um único instante de comer e não verificava a direção física da abertura; ela não era suficiente para detectar essa inversão. E02/E03 mantêm o andamento anterior.
