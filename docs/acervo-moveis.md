# Móveis do acervo — lote 01

Este documento registra a primeira entrega. O [lote 02](acervo-moveis-lote-02.md) substitui o balcão Pequena Itália pela arte oficial, reconstrói a poltrona amarela e preta e acrescenta o conjunto italiano. O ZIP do lote 01 permanece como histórico; as contagens e verificações abaixo descrevem aquela entrega.

O primeiro lote prioriza fogões, balcões, mesas e cadeiras. São 13 itens cadastrados em `game/public/assets/items/acervo_*/`, com 30 PNGs RGBA e pelo menos duas vistas por item. O catálogo completo das referências contém 666 imagens; isso não significa que todas foram extraídas ou integradas ao jogo.

Abra [o navegador do acervo](../tools/acervo/index.html) diretamente no navegador, ou execute `npm run tools` e acesse `http://127.0.0.1:5175/acervo/`. Ele pesquisa arquivos, autores e metadados, mostra as fontes e oferece uma visão dos móveis cadastrados. As categorias são sugestões pelos metadados; uma prancha pode conter outros tipos de item. A [Oficina de móveis](../tools/asset-positioner/furniture.html) também inclui as 30 vistas novas, com os mesmos offsets do jogo e importação offline.

| Grupo | Itens | Arte | Direções |
| --- | --- | --- | --- |
| Fogões | Vermelho e Dourado; Prateado com Guirlanda; Preto com Resistência Vermelha; Prateado com Grelha; Branco e Dourado | Recortes originais de `StuffsArtboard-1-copy.webp` | Vista original e espelhamento |
| Fogões | Futurista Cinza e Ciano; de Presente | Recortes das pranchas de Sabrina Contino, Behance 4286853 | Vista original e espelhamento |
| Cadeira | Poltrona Amarela e Preta | Frente e costas originais de Sabrina Contino | Quatro vistas: frente, frente espelhada, costas, costas espelhada |
| Cadeira | Vermelha — Anos 50 | Reconstrução com imagegen a partir da ficha pequena do blog | Frente e costas reconstruídas, mais seus espelhamentos |
| Mesas | Vermelha; Redonda Ciano — Anos 50 | Reconstruções com imagegen | Vista reconstruída e espelhamento |
| Balcões | Anos 50; Pequena Itália | Reconstruções com imagegen | Vista reconstruída e espelhamento |

As reconstruções procuram preservar desenho, cores e silhueta. Não são cópias pixel a pixel nem PNGs recuperados do jogo. Os originais pequenos e os resultados brutos continuam preservados. Os prompts estão em `tools/acervo/gerados/prompts.json`.

## Calibração e rotação

- Tile nativo: 160×80 px; origem no vértice traseiro. Arestas dos planos marcados: ±26,565°.
- Mesas: plano de apoio em 49,2 px; assentos: 32 px; balcões e fogões: 32 px. O ponto central de comida permanece no padrão do runtime.
- Mesas e cadeiras podem ter pegadas visuais menores dentro do mesmo tile lógico. A forma dos braços, encosto, pedestal e ornamentos segue cada desenho.
- A calibração registra cantos e apoio em `source.calibration` no manifesto. Planos separados corrigem tampo e chão onde há marcas suficientes, mantendo as verticais.
- Todos os PNGs exportados têm alpha real, com margens transparentes. O fundo quadriculado da galeria não é gravado no asset.
- Itens com duas imagens alternam entre elas nas quatro rotações do runtime. O segundo PNG é um espelhamento: não representa uma vista independente das costas. Isso está registrado em `source.views`. Nenhum nome oficial desconhecido foi inventado.
- As duas cadeiras têm quatro PNGs. Não foi necessário alterar a regra de profundidade ou a caminhada para integrá-las.

## Funções e referências históricas

No runtime, os fogões deste lote usam o preparo básico já existente; os balcões recebem porções prontas; mesas e cadeiras participam do atendimento dos NPCs. A aparência não ativa bônus, velocidade, múltiplas bocas ou evolução. Essas funções especiais precisam de uma referência confirmada e implementação própria antes de serem anunciadas.

O nome **Balcão Pequena Itália** foi confirmado no post [Mamma Mia!](https://jogandocafemania.blogspot.com/2010/08/mamma-mia.html), de 26/08/2010. Os demais nomes deste lote são descritivos. O acervo local também documenta as funções básicas em `cafe-mania-acervo/documentacao/catalogo-itens.json`; o post [Níveis do Café Mania](https://jogandocafemania.blogspot.com/2010/07/niveis-do-cafe-mania.html) distingue os desbloqueios de fogões e balcões em 2010. As regras de progressão antigas não foram aplicadas automaticamente ao projeto atual.

Os preços das fichas pequenas foram preservados quando legíveis: mesa vermelha 1000, mesa redonda 2000, cadeira vermelha 1300, balcão Anos 50 2100 e Pequena Itália 2000, todos em ouro. Nos demais itens, 200 ouro é um valor de projeto, identificado no manifesto. Não foi usado o `game-config.xml.txt` adulterado para inventar atributos históricos.

Pranchas de interfaces antigas permanecem como referência. Os ícones atuais em `game/public/assets/ui/` não foram alterados. A porção de outro jogo no portfólio misto 43063757 está sinalizada no navegador do acervo.

## Fontes, reprodução e continuidade

`artes-referencia/` permanece intacta. `tools/acervo/fontes/` contém cópias PNG decodificadas das três pranchas usadas na extração. `extracoes.json` registra o caminho original e o retângulo de cada recorte. `moveis.json` registra as classes, IDs e pontos de calibração. Os manifestos incluem SHA-256 da referência original.

```sh
node scripts/extract-reference-crops.mjs
node scripts/import-reference-furniture.mjs
npm run assets:room
node scripts/index-reference-art.mjs
```

O importador aceita uma repetição idêntica e recusa sobrescrever um export diferente. Para recalibrar os exports deste lote após revisar `moveis.json`, use `node scripts/import-reference-furniture.mjs --update`. Os arquivos originais não são sobrescritos.

Os dois recortes azuis da prancha 4286853/002 foram preservados em `tools/acervo/recortes/chair_blue_*.png`, com identificadores provisórios de extração. Eles ainda não foram cadastrados: a função histórica precisa de confirmação. Pranchas de fogões evolutivos, mecanismos grandes e conjuntos com personagens continuam disponíveis no índice para extração posterior; não foram convertidas em objetos de função presumida.

## Verificação realizada

`npm run assets:room` validou e sincronizou 45 itens e 5 receitas. A auditoria deste lote verificou 13 manifestos, 30 PNGs RGBA, dimensões, margens transparentes e inclinação dos planos marcados. Uma fixture WebGL com os renderizadores reais do projeto conferiu 16 quadros das duas cadeiras: quatro direções, sentado em 0 ms e comendo em 250 ms, registrando tile lógico, posição, direção, frame e profundidade. Não houve erros de execução nesses quadros.

A prévia geométrica também comparou os novos móveis com fogão, balcão, mesa e cadeira existentes. Esses quadros isolados não confirmam todas as sobreposições de uma sala em movimento, nem fazem uma compra ou preparo real no banco. A verificação usou uma porta temporária, sem iniciar PocketBase e sem encerrar serviços existentes.

O navegador do acervo foi conferido por arquivo local e HTTP, com as 666 referências, os 13 móveis e carregamento de imagens. A Oficina carregou 105 entradas (75 anteriores e 30 novas), e a importação/exportação de uma vista de balcão manteve as dimensões calibradas. As rotas novas do servidor de ferramentas foram conferidas para não expor arquivos fora das raízes públicas declaradas.

Assets de terceiros conservam autoria e licença próprias; a licença MIT do código não transfere direitos sobre as artes.
