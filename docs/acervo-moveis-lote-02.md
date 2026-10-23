# Móveis do acervo — lote 02

Três mesas e duas cadeiras italianas foram cadastradas. O balcão Pequena Itália mantém sua classe e ID e agora usa o PNG oficial enviado pelo responsável. A poltrona amarela e preta foi reconstruída com imagegen em duas vistas reais, frente e costas. As gerações da cadeira rosa foram rejeitadas e descartadas; a versão anterior do item foi restaurada, preservando sua classe e ID. A poltrona dourada conserva sua arte original e tem a ordem do giro corrigida.

| Item | Classe | Arte em execução |
| --- | --- | --- |
| Mesa Xadrez Verde | `acervo_lote02_table_italy_green_check` | Imagem completa aprovada pelo responsável; escala uniforme |
| Mesa Xadrez Vermelho | `acervo_lote02_table_italy_red_check` | Recoloração com imagegen da verde aprovada |
| Mesa Italiana Vermelha | `acervo_lote02_table_italian_red` | Base reconstruída com imagegen; tampo e medalhão originais do screenshot |
| Banco Verde | `acervo_lote02_chair_italy_green` | Frente reconstruída; costas extraídas do screenshot |
| Cadeira Estofada | `acervo_lote02_chair_italy_red` | Frente reconstruída; costas extraídas do screenshot |
| Balcão Pequena Itália | `acervo_counter_italy` | Arte oficial extraída do anexo, com pratos e cortinas originais |
| Cadeira Rosa | `pink_square_chair` | Versão anterior restaurada; gerações rejeitadas excluídas do uso e do pacote |
| Poltrona Amarela e Preta | `acervo_chair_yellow_black` | Frente e costas reconstruídas conforme os recortes de Sabrina Contino |
| Poltrona Dourada | `original_gold_armchair` | PNGs originais preservados; ordem SE → SW → NW → NE |

As cadeiras desta revisão usam dois PNGs no manifesto e quatro poses, com `flipX` nas vistas complementares. A tecla R continua avançando uma posição por vez na regra existente. Na dourada, os índices das duas vistas de frente estavam invertidos. Os arquivos de rotações anteriores permanecem preservados, mas o manifesto atual referencia `front.png` e `back.png`.

Os sprites exportados têm canal RGBA e transparência real. A oficina e a galeria mostram o quadriculado somente na prévia. O tile lógico continua 160×80, com origem traseira; a calibração registra offsets e pontos por vista. Para a verde aprovada e a poltrona amarela, a escala uniforme preserva silhueta e proporções. Os planos marcados dos demais recortes usam a geometria 2:1 compartilhada com o Asset Studio. Nenhuma margem ou altura do PNG determina a ordem de profundidade.

O [FurnitureVisualization do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/visualization/furniture/FurnitureVisualization.ts) resolve direção em `updateObject` e aplica textura, espelhamento e offsets em `updateSprite`, separadamente da profundidade relativa. Esse contrato orientou o ajuste: nossa implementação monta a pose espelhada em canvas uma vez no carregamento, compartilhando os pixels com a hitbox alpha. A projeção, a interpolação e a troca de tile lógico na metade do passo foram preservadas.

As referências recebidas estão em `artes-referencia/anexos-usuario/lote-02/`. Os PNGs brutos gerados, incluindo variantes anteriores, ficam em `tools/acervo/gerados/lote-02/`; os prompts e as referências de cada geração estão em [prompts.json](../tools/acervo/gerados/lote-02/prompts.json). Foi usado o imagegen integrado. Reconstruções por geração são aproximações visuais, mesmo quando aprovadas; não são arquivos oficiais recuperados. A imagem oficial do balcão foi recortada diretamente, sem substituição generativa.

Os nomes do conjunto italiano foram confirmados no post histórico [Mamma Mia!](https://jogandocafemania.blogspot.com/2010/08/mamma-mia.html). Preços legíveis das fichas: mesas xadrez 4000 ouro e cadeiras 1200 ouro. A mesa italiana custava 6 caféGranas nessa referência; o projeto usa 500 ouro, identificado no manifesto, pois a compra de móveis em caféGranas ainda não está implementada. Classes, IDs e preços dos quatro itens revisados foram preservados. Mesas, cadeiras e balcão usam as funções básicas já implementadas; o desenho não acrescenta bônus históricos presumidos. Os ícones atuais de interface foram preservados.

Para reproduzir os exports atuais:

```sh
node scripts/extract-reference-crops.mjs --batch=02
node scripts/import-reference-furniture.mjs --only=acervo_counter_italy
node scripts/import-reference-furniture.mjs --batch=02
node scripts/import-reference-furniture.mjs --spec=correcoes-cadeiras-lote-02.json --batch=02
npm run assets:room
node scripts/index-reference-art.mjs
```

Os importadores recusam substituir arquivos diferentes sem `--update`. A correção da dourada está descrita diretamente em seu manifesto; ela reutiliza os pixels originais das vistas frontais e traseiras. O lote 01 é histórico e sua especificação antiga da poltrona amarela não deve sobrescrever esta revisão. As versões anteriores dos três assentos e do balcão estão em `tools/acervo/historico/`.

Verificações da entrega antes do descarte da cadeira rosa: catálogo sincronizado com 50 itens e 5 receitas; typecheck; quatro testes específicos de registro, ordem de giro e profundidade sentada. A fixture WebGL usa o carregador e o renderizador reais, com o atlas assado a partir do clipe parado para manter o apoio usado no jogo. Foram registrados 40 quadros: cinco cadeiras, quatro direções, sentado em 0 ms e comendo em 250 ms. Dez poses espelhadas foram comparadas pixel a pixel com suas fontes no canvas. A auditoria verificou RGBA, dimensões e transparência nos nove manifestos desta entrega; a dourada mantém o recorte justo original, sem adicionar margem. A confirmação visual é de quadros isolados, sem compra no banco ou simulação de uma sala completa em movimento. Os serviços de teste foram encerrados; os serviços existentes não foram reutilizados.

O pacote [acervo-moveis-lote-02.zip](../tools/exports/acervo-moveis-lote-02.zip) reúne oito itens desta entrega; a cadeira rosa rejeitada foi retirada, especificações, fontes selecionadas e prompts. A galeria e a biblioteca offline incluem as vistas atualizadas. Os recortes preparatórios japoneses e de outras pranchas permanecem referências; não foram cadastrados como parte deste lote.

Após a rejeição da cadeira rosa, os PNGs gerados foram descartados, seus registros de geração removidos das especificações ativas e o catálogo sincronizado. A restauração foi conferida contra a cópia anterior. Esta tentativa de reconstrução foi encerrada sem outro design aprovado.
