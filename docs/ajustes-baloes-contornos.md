# Ajustes de balões, abas e arte de sala — 24/10/2026

## Entrega

- [x] Abas da cafeteira: arte modular mais alta atrás da frente bege; capa arredondada preservada e continuação vertical até74 px. A área clicável continua na faixa visível. Títulos e cadeados têm espaços separados. Os quatro cliques, o hover e a ordem das camadas foram conferidos offline.
- [x] Balões de pensamento: o desenho usa até136×112 px da sua área visível. A parte de cima fica10 px acima do oval; a base mantém8 px de folga. Margens transparentes do PNG não reduzem artificialmente o item. Vale para café, suco, copos e futuros itens do mesmo componente. A parte que sai por cima também recebe o clique.
- [x] Encomendas: um aviso persistente acompanha a próxima encomenda a chegar, sem exigir hover. O relógio é o do servidor. O hover de outra vaga mostra essa encomenda; sem hover, volta à próxima entrega. Um único aviso evita sobreposição de quatro balões. Quando não há entregas em trânsito, o aviso automático some; caixas que chegaram continuam com as ações de coleta existentes.
- [x] Cafeteiras posicionadas: os três estágios possuem versões sem contorno grosso externo; as prévias da janela mantêm seus arquivos anteriores. Café, grelha, alça, recessos e peças realmente escuras não foram apagados.
- [x] Figurantes da praia: banhista e sorveteiro/carrinho usam versões sem o traço externo grosso, nas mesmas dimensões e com os mesmos pontos de apoio.
- [x] Mesas xadrez verde/vermelha: escala uniforme0,86, deslocamento visual(-3,-8) px. A redução de14% é o meio-termo escolhido; não houve redução adicional. Tiles lógicos, navegação e área de ocupação1×1 permanecem iguais. O ponto de apoio do prato é x=-3 e y=-10,14, para acompanhar o tampo.
- [x] Cadeiras correspondentes: escala uniforme0,93 nas duas vistas de cada cor, com as quatro rotações. O centro visual do assento em(0,8) foi preservado dentro do arredondamento de pixels. As máscaras do encosto usam as dimensões reais reamostradas, não só um fator nominal. As vistas espelhadas têm registro simétrico.

## Arquivos e contratos

`ThoughtBubble.ts` continua compartilhado por todas as bebidas. `contentTexture` em `alpha-hit.ts` reaproveita pixels existentes e recorta apenas a margem transparente para apresentação; a máscara de clique dos móveis e sua dilatação não mudaram. O recorte tem cache por textura. Não há criação de arte por Graphics: máscaras e a grade de diagnóstico são geometria funcional.

`SupplyPlatform.ts` mantém a simulação e os pagamentos existentes. A atualização visual não pede entrega imediata, não recolhe caixas e não altera saldos por conta própria. Atualiza o texto a cada segundo exibido e esconde o aviso durante decoração ou outra janela.

`mealAnchor` é calibração visual opcional de uma mesa: carregada do manifesto para `IndoorArtEntry` e consumida pelo prato em `RoomScreen`. Outras mesas conservam o ponto anterior. A ordenação usa a geometria do chão e as camadas do móvel, não a margem ou altura do PNG. A separação foi conferida em [FurnitureVisualization do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/master/src/nitro/room/object/visualization/furniture/FurnitureVisualization.ts), principalmente `updateSprite`, onde textura, offsets e profundidade são dados separados. Não foi copiado seu algoritmo nem alterado o avanço lógico na metade do passo.

Os PNGs anteriores de cafeteiras e figurantes foram preservados. As versões novas estão em `coffee_machine/stages/stage-N-room-source.png`, `room-stage-N.png` e `scenery/beach-extras/*-flat.png`. Prompts completos do ImageGen, mestres e exportação uniforme estão em `tools/visual-polish/`. Não são sprites originais recuperados. `register-machines.py` usa a versão de sala quando disponível, mantendo a prévia separada.

As mesas e cadeiras foram reamostradas a partir das cópias anteriores em `.runtime/visual-polish/`; as informações de calibração anterior permanecem em `source.runtimeVisualScale.beforeParts`. A redução das mesas permanece um compromisso visual: não equivale a reduzir26,5% para inscrever toda a projeção no losango. O deslocamento adicional melhora o alinhamento da borda frontal. `offset-tables-scale-chairs.py` registra os deslocamentos sem acumular aplicações.

## Referências e lacunas

- Abas: janela nova de `videos-jogo/Café Mania level 400.mp4`, quadro114 s; recortes e prompts em `tools/coffee-machine/references/` e `tab-prompts.json`.
- Figurantes: quadros originais de `cafe mania muito tempo de jogo`, 1:54, preservados nas pastas18/19 de `.runtime/arte-para-gerar/`. Mostram acabamento com faces pintadas, sem o contorno pesado das nossas reconstruções.
- Cafeteiras: três modelos fornecidos pelo responsável e máquina de sucos já posicionada como referência de acabamento. Não foi localizada uma captura nítida desses três modelos especificamente colocados na sala. Por isso a remoção do contorno na versão de sala é uma harmonização solicitada, não uma comprovação de que todo filete estava ausente em todas as versões históricas.
- Encomendas: plataforma/cones/caixas nas capturas P125_09 e vídeos de nível300/400. A [publicação de10/04/2014 sobre o pátio](https://cafemaniamania.blogspot.com/2014_04_06_archive.html) confirma o contexto de encomendas, mas não demonstra o layout exato do contador. A busca na web e os quadros consultados não forneceram uma captura nítida específica do timer. Foi reutilizado o balão de dica já adotado no projeto, com os textos de encomenda existentes. A visibilidade automática é a alteração solicitada.

## Verificações

- `npm run assets:room`: catálogos sincronizados; dimensões dos PNGs e `mealAnchor` validados.
- `npm run typecheck`.
- `python tools/seating/calibrate-backrests.py --check --preview .runtime/visual-polish/chair-masks.png`: sete modelos conferidos, incluindo as máscaras reamostradas das duas cadeiras.
- `node tools/seating/verify-depth.mjs`: camadas nas quatro direções, vizinhos, cache, levantar e troca lógica no meio do passo preservados.
- `python tools/seating/verify-masks.py`: regressão semântica da cadeira clássica preservada; esse teste não é apresentado como cobertura semântica específica das cadeiras italianas.
- Chromium/WebGL offline: quatro formatos de ícone, área clicável acima do balão, limites laterais/inferior, contador sem hover, avanço do relógio, mudança de encomenda e ocultação em janela. Nenhum pagamento automático foi chamado. O carregador real de arte devolveu os dois pontos de prato esperados.
- Arte inspecionada sobre rosa; composição final exibiu os três estágios, os dois figurantes, mesas e cadeiras nas quatro direções. A calibração das máscaras e a ordem das camadas foram verificadas, mas não foi executada uma nova sessão multiplayer com NPCs sentados nesta revisão.

Prancha e relatórios: `.runtime/visual-polish/preview.png`, `report.json`, `table-fit-report.json`, `chair-masks.png`. Testes visuais usaram arquivos locais e não abriram portas HTTP. Os serviços do jogo não foram iniciados para essas verificações.
