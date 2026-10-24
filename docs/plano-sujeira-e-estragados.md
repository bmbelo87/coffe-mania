# Fogões sujos e pratos estragados — levantamento e plano

Data: 23/10/2026. Status: levantamento concluído; arte e implementação ainda não iniciadas. O `AGENTS.md` pede a apresentação do plano, das referências e dos assets antes da implementação.

## Direção proposta

Reutilizar integralmente as artes limpas. A referência mais clara, enviada pelo responsável e atribuída ao [vídeo em 01:23](https://www.youtube.com/watch?v=pbWxTxuNTBQ&t=83s), mostra **comida em verde oliva com pontos escuros, contaminação localizada sobre a louça e aros branco/azulados preservados**. Portanto, o efeito compartilhado precisa distinguir regiões: recolorir a comida e permitir manchas pontuais na louça, conservando seus detalhes claros. O alfa do PNG continua sendo o limite externo exato.

Cada receita pode receber dados de recorte/encaixe — uma máscara simples ou regiões 2D — sem desenhar uma nova arte estragada. Perfis de recipientes repetidos podem ser reutilizados. A transparência sozinha resolve o contorno, mas não identifica quais pixels são comida ou louça; não prometer essa separação perfeita por uma regra automática de cor/brilho.

Fogão sujo usa arte raster modular, dividida por superfície, com dados de encaixe do tampo e das faces visíveis de cada modelo. Uma única imagem esticada sobre o retângulo do fogão não acompanha as diferenças entre grelha aberta, tampo fechado, ornamentos e frente com botões.

O efeito é compartilhado; o encaixe é calibrado. Uma peça nova de formato incomum exige cadastrar suas superfícies, mas não redesenhar toda a sujeira ou todas as receitas estragadas.

## O que as referências comprovam

| Fonte | Observação | Limite |
| --- | --- | --- |
| [Captura enviada pelo responsável: três pratos](../artes-referencia/fogoes-sujos-e-estragados/referencia-usuario-tres-pratos.png), fonte informada: [YouTube, 01:23](https://www.youtube.com/watch?v=pbWxTxuNTBQ&t=83s) | Comida verde oliva, pontos escuros e escorridos; bordas da louça continuam claras/turquesa. Nos fogões há gordura amarela/ocre no tampo, frente, laterais e quinas; azul e cinza da arte permanecem visíveis. | A captura é referência visual, não um asset recuperado. URL/timestamp fornecidos pelo responsável; o acesso à página não permitiu verificar metadados independentemente. Não comprova o mecanismo gráfico. |
| `videos-jogo/Café Mania   Testando o Game.mp4`, 01:04 | Prato estragado identificado pelo responsável no fogão da frente. Comida verde acinzentada; tons oliva em partes da louça; trechos claros do aro. Ver [recorte nativo](../artes-referencia/fogoes-sujos-e-estragados/video-testando-01m04s-prato-native.png). | MP4 nativo 854×470, 30 fps; recorte sem ampliação. Compressão limita a leitura fina. A interpretação inicial do levantamento deixou passar essa região e foi corrigida. |
| `videos-jogo/Café Mania   Testando o Game.mp4`, 00:20, 00:24 e 00:28 | Cozinhar, servir e fogão após a retirada do prato. Ver [sequência local](../.runtime/dirty-stove-research/testando-stoves-sequence.jpg). | As manchas não são legíveis de forma conclusiva; não comprova o desenho de um fogão sujo. |
| Mesmo vídeo, 01:12–01:16 | Sálvia Salvadora descrita como recuperação de prato apodrecido. | Confirma a função, não a cor da louça ou o mecanismo gráfico. |
| `videos-jogo/Café Mania Level 500.mp4`, 00:05 | Material escuro/esverdeado repetido junto de recipientes cinza e tampos laranja. | Pode ser preparo normal. Não classificar como sujeira ou apodrecimento. |
| `artes-referencia/cafe-mania-acervo-documentado/cafe-mania-acervo/imagens/temperos/P096_06_tut-spice6_3fa983bb.jpg` | Captura histórica da prateleira com Sálvia e sua função. | Não mostra um prato estragado. |
| [FAQ Básico da Cozinha, 03/03/2012](https://cafemaniaevolution.blogspot.com/2012/03/faq-basico-da-cozinha.html) | Reprodução do fórum da Vostu: servir deixa o fogão sujo; comida esquecida pode estragar. | Documento textual; não informa máscara, filtro, sprite nem a paleta. |
| [Relato de jogadora, 22/03/2011](https://cafemaniajogadohonestamente.blogspot.com/p/somente-para-jogadores-de-cafe-mania.html) | Relaciona pratos rápidos a estragarem mais depressa. | Não estabelece fórmula universal nem documenta a arte. |

Amostragem dos oito MP4s locais, recortes, hashes, timestamps e descartes: [evidence.json](../.runtime/dirty-stove-research/evidence.json). As datas de publicação originais dos vídeos não estão preservadas junto dos arquivos; data do arquivo não equivale à data do vídeo.

**Revisão do levantamento:** a indicação posterior do quadro de 01:04 e, sobretudo, a nova captura dos três fogões preenchem a lacuna visual da análise inicial. Há evidência de comida deteriorada com pontos e de louça afetada localmente, conservando bordas claras. Também há referência direta de gordura no fogão. Continua faltando uma comparação limpa/estragada do mesmo prato e uma transição sujo/limpo no mesmo enquadramento; não inferir daí os valores exatos de um filtro ou se cada escorrido já existia no desenho limpo.

O arquivo enviado foi preservado byte a byte, sem nitidez artificial ou alteração de cor. Origem, hash, dimensões, recortes e limites estão em [fontes.json](../artes-referencia/fogoes-sujos-e-estragados/fontes.json). O tom exato ainda deve ser calibrado levando em conta a compressão da captura.

Também não é possível concluir, só por capturas, se o Flash original usava transformação de cor, máscara ou PNGs específicos. Nenhum SWF deste jogo foi descoberto. O plano não depende de obter um SWF.

**Fontes descartadas como prova histórica:** `.runtime/video/coffe-mania-features.mp4`, `.runtime/spices/open-frame-*.png` e `spoiled-hover.png` mostram a recriação. Não usar o visual já implementado no clone como confirmação do original.

## Situação do runtime

- `game/src/screens/room/RoomScreen.ts`: o fogão inteiro recebe `DIRTY_STOVE_TINT = 0x8a7a6a`; o prato inteiro recebe `SPOILED_DISH_TINT = 0x9aae6a`. São alterações multiplicativas de cor, sem manchas ou máscara ilustrada.
- Há nove fogões e 21 receitas prontas no catálogo. A [prancha dos formatos atuais](../.runtime/dirty-stove-research/formatos-atuais.jpg) é referência do clone, não captura histórica. A churrasqueira é aberta e tem outra geometria; não presumir tampo pelo tamanho do PNG ou por `itemHeight`.
- `DishPresentation.ts` conserva o apoio do prato com `fitDish`. O efeito precisa preservar as dimensões, o alfa e o registro da textura original para continuar usando esse encaixe.
- O apoio atual no fogão usa `STOVE_DISH_Y = 11`, fixo a partir do fogão inicial. O cadastro de superfícies deve oferecer um `dishAnchor` e ser usado tanto pelo prato como pela sujeira; isso evita compensações independentes.
- `database/cooking.go` e o servidor compartilhado já controlam servir, sujar, limpar, estragar, descartar e recuperar. O visual deve consumir esses estados, sem novas gravações por frame.
- `shared/recipecatalog/catalog.go` declara que a validade histórica não é conhecida. O fallback atual usa o tempo de preparo limitado entre 30 minutos e 48 horas; trata-se de regra provisória da reconstrução. Nenhum manifesto atual preenche `validitySeconds`. Este lote visual não redefine prazos.

## Prato estragado: efeito que serve a qualquer forma

1. Usar o PNG de prato pronto que a receita já possui, incluindo sua louça e os vazios transparentes.
2. Transformar a região de comida para verde oliva com dessaturação controlada e pontos/manchas compartilhados, mantendo diferenças de luminosidade, contornos e detalhes. Não sobrepor uma placa verde opaca, que apagaria o desenho. Apenas multiplicar por uma cor tende a escurecer excessivamente pratos de cores diferentes.
3. Preservar o alfa original: `A_saida = A_original`. Não reaplicar o alfa sobre si mesmo, pois isso afina bordas suavizadas e pode gerar halos.
4. Usar uma região de comida e uma região opcional de manchas na louça para orientar o mesmo efeito. O resultado acompanha louça redonda, quadrada, travessa, panela, bolo alto ou receita irregular, preservando aro branco/turquesa fora das manchas. Os mapas são dados de recorte, não artes completas de cada prato estragado.
5. Reproduzir os pontos e escorridos visíveis usando motivos raster compartilhados e o alfa como limite. Não alterar a silhueta do alimento para inventar escorridos: primeiro conferir quais já pertencem ao PNG limpo. Fora da silhueta original não nasce conteúdo novo neste lote. Não acrescentar moscas, fumaça ou outros sinais ausentes na referência.
6. Gerar/cachear a textura resultante uma vez por textura de origem e versão do efeito; conservar as dimensões e os offsets. Remover ou recuperar o estado volta à textura limpa. Não recalcular os pixels a cada quadro ou por personagem.

Na versão local Pixi 8.19, a máscara de Sprite usa o canal vermelho por padrão. Se houver uma camada recortada por outro Sprite colorido, é necessário selecionar explicitamente `channel: 'alpha'`. Caso contrário, um prato vermelho e um prato verde poderiam produzir coberturas diferentes. Isso foi conferido no código instalado e na [documentação oficial de canais de máscara](https://pixijs.com/blog/june-2026#sprite-mask-channels). A composição simples de cor pode manter o alfa diretamente, sem criar uma segunda máscara em execução.

## Fogão sujo: arte compartilhada e superfícies cadastradas

Assets a reutilizar: os nove fogões atuais, seus frames por rotação, projeção 2:1 e o contrato de profundidade do quarto. As artes limpas permanecem intactas.

Assets propostos para produção com ImageGen a partir da nova captura, mantendo suas cores e linguagem visual:

| Asset | Conteúdo | Uso |
| --- | --- | --- |
| `dirty-top.png` | Manchas planas amarelas/ocres de gordura sobre fundo alfa, sem desenhar um fogão | Projetado no tampo de cada modelo. |
| `dirty-front.png` | Resíduos amarelados nas frentes/quinas, sem botões ou partes de fogão embutidas | Projetado nas faces visíveis, preservando janela azul e partes cinzas. |
| `spoiled-speckles.png` | Pequenos pontos/manchas oliva escuros na densidade da comida da captura | Mesmo motivo recortado nas regiões de comida das receitas. |
| `spoiled-spills.png`, se necessário | Pequenas manchas/escorridos verdes para os trechos que não vierem do próprio desenho limpo | Posicionado em regiões autorizadas da louça e recortado pelo alfa. |

A resolução de geração não define o tamanho no jogo. Exportar após recorte/calibração, em resolução suficiente para o zoom máximo, com alfa real. Não gerar um losango rígido contendo bordas de fogão: a geometria pertence aos dados de encaixe. A silhueta, cor e densidade das manchas precisam vir das capturas, sem realismo, textura fotográfica, brilho extra ou sujeira inventada apresentada como original.

Cada vista efetivamente usada pelo fogão terá um perfil com:

- quadrilátero do tampo e regiões de faces verticais, medidos no frame montado;
- exclusões de vazios, botões, grelha aberta e ornamentos que devam ficar legíveis;
- ponto de apoio do prato;
- correspondência com o frame real, incluindo espelhamento;
- intensidade e variação estáveis, sem aleatoriedade a cada quadro.

A arte é projetada nessas superfícies e recortada também pelo alfa da peça. O alfa externo impede manchas fora do fogão; o perfil das superfícies impede que o mesmo desenho se espalhe por pernas e aberturas. Nenhum desses dois recortes substitui o outro.

O fogão novo pode herdar um perfil já medido apenas quando a geometria coincidir. Em formatos não cadastrados, usar o estado visual simples de forma explícita até a calibração, sem chamar esse fallback de encaixe perfeito.

## Integração proposta e referência Nitro

Separar apresentação em `DishConditionPresentation` e `StoveConditionPresentation`, consumidas tanto pelo cozimento local quanto pelos sprites compartilhados. A textura derivada só muda quando mudar estado, origem da arte, perfil ou rotação.

O [FurnitureVisualization do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/visualization/furniture/FurnitureVisualization.ts) mantém textura, offsets, cor, alfa e profundidade por camada. O [RoomPlane](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/visualization/room/RoomPlane.ts) separa projeção de superfície e cache. Aplicar esses princípios ao runtime atual, preservando `setItemOverlayDepth`, sem copiar as APIs antigas do Nitro para Pixi 8.

Pontos de extensão: `indoor-art.ts`, `ItemManifest`/`room-inventory.ts` e validação de catálogo para os perfis de fogão; `RoomScreen.updateSharedStoves` e a apresentação local de cozimento para consumir os efeitos. Não alterar projeção, troca de tile na metade do passo ou movimento de NPCs.

## Lote de execução e critérios de aceitação

1. Comparação de cinco receitas contrastantes: bolo alto, tacos, lagosta irregular, banana split em travessa e carré em prato redondo. Conferir comida oliva com pontos, louça clara com contaminação localizada e contorno original intacto, usando a nova captura como referência principal.
2. Medir tampo, frente e apoio do prato nos nove fogões e nas quatro rotações; vistas reutilizadas continuam ligadas aos frames corretos.
3. Produzir e revisar os módulos raster de sujeira com referências confirmadas. Rejeitar geração que mude o estilo ou inclua partes de eletrodoméstico.
4. Integrar composição/cache e substituir o tint provisório nos caminhos local e compartilhado.
5. Regressões específicas: alfa de prato idêntico; nenhum pixel de sujeira fora das regiões permitidas; recuperação restaura a arte limpa; rotação e decoração preservam registro; dois clientes veem o mesmo estado. Conferir servir → sujo → limpo e pronto → estragado → recuperado.

O levantamento não executou build, testes ou alterações de runtime. As capturas e pranchas produzidas são referências de pesquisa, não artes novas nem prova de que o efeito está implementado.
