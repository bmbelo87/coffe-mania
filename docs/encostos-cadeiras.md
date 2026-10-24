# Encostos e personagem sentado

Correção de 20/10/2026. A referência fornecida mostra o encosto da cadeira clássica atrás de um cliente sentado de costas para a câmera.

## Causa e contrato visual

`setSeatedActorRoomDepth` colocava o personagem depois da imagem inteira da cadeira. Isso serve às vistas de frente, mas esconde o encosto nas vistas traseiras. Inverter a ordem da cadeira inteira também seria incorreto: promoveria o assento sobre o corpo.

A ordem agora é **base/assento → ocupante → encosto traseiro**. As três camadas compartilham a pegada, o apoio e a âncora intrínseca da cadeira; usam deslocamentos de camada pequenos (0, +1, +2). A altura, o tamanho do PNG e suas margens não escolhem a profundidade.

`ChairBackrest.ts` reaproveita a própria textura montada da cadeira e aplica uma máscara funcional que isola encosto e hastes. Não gera nem redesenha pixels. `seatingBackrests` no manifesto registra os polígonos nas coordenadas da pose montada, incluindo o espelhamento. Esse é um dado de calibração da arte, não uma exceção na ordenação global. `tools/seating/calibrate-backrests.py` mantém os registros editáveis dos sete modelos do catálogo.

As rotações 0/1 mantêm o assento e o encosto da imagem-base atrás do ocupante. Nas rotações 2/3, a camada do encosto fica visível somente enquanto houver um personagem sem passo ativo nos estados `seated`, `eating`, `thirsty` ou `drinking` naquela cadeira. Ao levantar, sair, entrar na decoração ou remover a cadeira, a camada deixa de participar. Atores continuam usando a referência da cadeira durante a postura; ao levantar retornam à profundidade normal.

Posição, direção, quadros de animação, projeção e troca de tile lógico na metade do passo foram preservados. Não há novas gravações de movimento ou alteração da simulação Go.

## Referência técnica

O [FurnitureVisualization do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/visualization/furniture/FurnitureVisualization.ts) resolve a direção e calcula profundidade relativa por camada, separadamente dos offsets da imagem. O [AvatarVisualization](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/visualization/avatar/AvatarVisualization.ts) trata postura, offsets e profundidade do avatar em contratos próprios. Aqui esse princípio se traduz em camadas intrínsecas sobre a geometria compartilhada da cadeira; os algoritmos e sinais de profundidade não são copiados do Nitro.

## Verificações

- `node tools/seating/verify-depth.mjs`: frente e costas, cache entre quadros, diferentes pegadas/âncoras, vizinhos, levantamento e preservação da interpolação/troca de tile na metade do passo.
- `npm run assets:room`: valida e sincroniza os metadados de encosto com os catálogos.
- `npm run typecheck`.
- Chrome/WebGL isolado: cadeira clássica e estofada com dois looks reais, nas quatro rotações, sentado e comendo. A comparação registra tile lógico, posição, direção, clipe, frame e tempo da animação, conservados entre os quadros.
- `RoomScreen` real em fixture: encosto ativo ao sentar, comer, esperar suco e beber; inativo ao levantar, iniciar passo ou entrar na decoração.

Na verificação inicial, as máscaras foram cadastradas para os sete modelos e a comparação visual detalhada usou dois deles. As capturas em `.runtime/seating/` não representam todas as sobreposições possíveis de uma sala multiplayer.

## Técnica de calibração por superfície (23/10/2026)

Uma caixa larga em torno de uma haste também pode selecionar o banco visível ao lado dela. Na cadeira clássica, isso promovia pequenas faixas do assento sobre o tronco. As duas vistas traseiras agora acompanham o contorno de cada haste e arco, sem incluir essas faixas. O PNG continua intacto.

Para cadastrar ou revisar outros formatos:

1. Abra a pose **montada**, em resolução nativa, com uma grade em pixels. Use a mesma origem do `frame`, antes de aplicar `left`, `top`, câmera ou zoom. Não meça a captura da tela diretamente.
2. Separe as superfícies que devem cobrir o corpo: montantes, travessas, arcos, encosto estofado e, quando necessário, braços. Crie um polígono por superfície. Em torno de aberturas, use polígonos separados; não feche um grande contorno que inclua tecido do banco.
3. Nas junções com o assento, siga a borda da madeira do montante. Não prolongue um retângulo para os lados. O banco e suas travessas inferiores permanecem exclusivamente na camada-base. Poltronas e bancos com outro formato precisam de contornos próprios, sem reaproveitar a máscara da cadeira clássica.
4. Espelhe coordenadas somente quando as poses forem de fato espelhadas. A borda geométrica espelhada é `largura − x`; as coordenadas são contínuas, não índices de pixels. Recorte as coordenadas no tamanho da pose para variações com dimensões diferentes.
5. Marque pontos conhecidos do **assento que devem ficar excluídos** e do **encosto que deve permanecer**. `tools/seating/verify-masks.py` registra os pontos de regressão da cadeira clássica. Para um modelo novo, acrescente os seus próprios pontos medidos na arte.
6. Gere a prancha abaixo. O rosa mostra apenas pixels existentes selecionados pela máscara, preservando os vazios transparentes. Examine especialmente as junções junto ao quadril e às costas; nenhuma mancha do tampo deve aparecer em rosa.
7. Confira o render com avatar nas quatro rotações, sentado e comendo, incluindo um quadro em que o braço ou tronco exponha a junção. Compare também sem a camada de encosto para identificar os pixels promovidos. Registre modelo, tile, direção, clipe, frame e instante; depois confira levantar, caminhar e decoração.

```sh
python tools/seating/calibrate-backrests.py --preview .runtime/seating/masks.png
python tools/seating/calibrate-backrests.py --check
python tools/seating/verify-masks.py
node tools/seating/verify-depth.mjs
npm run assets:room
```

`--check` não escreve manifestos. `--preview` exporta uma imagem de diagnóstico e requer Pillow; a calibração normal usa apenas a biblioteca padrão do Python. A prancha não substitui o render com avatar.

Nesta revisão, o Chromium/WebGL isolado exibiu os sete modelos nas quatro rotações com dois looks alternados (sentado na clássica, comendo nos demais). Tile, posição, direção, clipe e frame ficaram iguais entre a imagem-base e a composição final. As poses de espera, bebida, levantamento, passo e decoração foram conferidas na regra de visibilidade do `RoomScreen`. Não foi uma sessão multiplayer completa. Capturas e medições locais: `.runtime/scenery-fixes/`.

## Junção afunilada da haste e do assento

A conferência por pontos isolados não cobria a faixa inteira junto ao poste. O PNG da clássica afunila a haste lateral: entre `y68..101`, a borda da madeira anda de aproximadamente `x39` para `x42`. Uma máscara com a borda fixa em `x38` promovia uma faixa de 1–3 pixels nativos de assento sobre a camisa, mesmo passando pelos pontos de teste anteriores. A ampliação tornava essa faixa evidente.

O polígono agora acompanha esse afunilamento. A pose espelhada foi conferida no seu próprio PNG; as duas artes não são espelhos pixel a pixel, mas não precisam de um deslocamento global. A máscara `Graphics` também usa o mesmo `roundPixels` da textura, evitando divergência de registro nos zooms fracionários. A projeção do personagem e a ordem base → corpo → encosto continuam iguais.

Para impedir a repetição do erro:

- `verify-masks.py` percorre a região inteira da superfície do banco e verifica que seus pixels opacos de cor plana não pertencem ao encosto. A comparação tolera variação de três níveis por canal e exige alfa acima de 240. Não classifica realces semitransparentes dos arcos como banco só por terem cor parecida. Essa checagem, incluindo a leitura dos PNGs, requer Pillow.
- Os pontos positivos de postes e travessas continuam obrigatórios. Uma correção não pode passar no teste simplesmente apagando a haste ou a travessa.
- Em outro modelo, escolha sua própria região semântica e as cores do banco; o filtro de cor da clássica não é uma regra universal. Encostos e assentos da mesma cor exigem regiões de exclusão medidas pela geometria.
- Compare a composição real sobre o mesmo look e nos mesmos quadros. Uma camisa com cor contrastante ajuda a enxergar o vazamento que uma pose genérica pode esconder.

Na reprodução específica, o `RoomScreen` montou um cliente de cabelo castanho, camisa azul e calça castanha, nas rotações 2/3, sentado no frame 35 e comendo no frame 38 (160 ms). As capturas antes/depois preservam look, tile, posição, direção, clipe, frame e profundidades. A composição final também foi conferida nos zooms 0,55, 1 e 2,4. Os sete modelos foram exibidos em quatro rotações após igualar o arredondamento da máscara. Evidências locais: `.runtime/chair-second-audit/before.png`, `after.png`, `after-zoom-*.png` e respectivos metadados JSON. Essa fixture verifica a composição do jogo sem depender de dados de uma conta ou da simulação multiplayer.
