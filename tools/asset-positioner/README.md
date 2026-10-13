# Asset Studio — Coffe Mania 0.4.0

Ferramenta simples, local e independente do jogo. No Windows, dê dois cliques em **abrir.cmd**, ou abra **index.html** no Chrome, Edge ou Firefox. Não precisa de Python, npm, servidor ou internet. Os arquivos permanecem no seu dispositivo.

Também pode executar `npm run tools` na raiz da distribuição e abrir http://127.0.0.1:5175/. Esse servidor requer somente Node.js, sem PocketBase ou servidor do jogo.

## Uso rápido

A interface **Asset Studio** organiza as três ferramentas como um editor desktop: ações de arquivo no topo, propriedades à esquerda, canvas ao centro, saída/exportação à direita e mensagens na barra inferior. Os grupos de propriedades podem ser recolhidos. Arraste os separadores laterais para redimensionar os painéis; dois cliques restauram a largura padrão. Com o separador focado, as setas ajustam sua largura; Shift aumenta o passo. Em janelas estreitas, os painéis ficam abaixo do canvas.

Essa camada é exclusivamente visual: controles, valores, atalhos, geometria, offsets, recorte e exportação continuam usando os mesmos algoritmos. Os ícones são um subconjunto SVG local da [Lucide](https://lucide.dev/guide/static), com licença em `vendor/LUCIDE-LICENSE.txt`; não há CDN, framework, dependência npm adicional ou envio de imagens. `desktop.css` e `desktop-ui.js` isolam a apresentação dos scripts de edição.

1. Importe um PNG transparente ou solte a imagem na área de trabalho.
2. Escolha a categoria/preset: **Móvel**, **Piso**, **Papel de parede** ou **Porta**. Para móveis e pisos, escolha a pegada: 1×1, 2×1, 1×2 ou 2×2. Porta mantém a pegada 1×1 e uma faixa fina junto à borda traseira.
3. Arraste a imagem; use o quadradinho roxo inferior direito para redimensionar. Também pode informar largura, altura, escala e posição numericamente. A proporção é preservada por padrão.
4. Alinhe o apoio do móvel ao losango azul. O botão **Centralizar base na pegada** coloca o centro inferior da imagem no centro do chão; é um ponto inicial, não uma detecção automática dos pés. Margens transparentes na imagem original podem exigir ajuste manual.
5. Aumente **Altura acima da origem** para móveis altos. O plano verde é uma referência; o amarelo delimita a área exportável. Aumente a margem para saliências laterais ou edite o **recorte manual**.
6. No painel de saída, escolha **Fundo do PNG**: **Sem fundo — transparente** ou **Fundo branco**. Exporte o PNG e salve o **JSON de offsets**. Salve um **projeto** se quiser continuar depois: ele contém a imagem original e os ajustes, inclusive a escolha do fundo.

O gabarito, o fundo quadriculado e os contornos não são exportados. O posicionador não remove o fundo de uma imagem opaca. O **Image Cutter** remove o que fica fora de sua máscara, mas não limpa fundos ou outros assets dentro da seleção e não corrige automaticamente a perspectiva.

## Inverter uma imagem

Clique com o **botão direito** na área de trabalho e escolha **Inverter** para espelhar a imagem horizontalmente. Funciona no Posicionador e no Image Cutter; clicar novamente desfaz. O espelhamento preserva posição e tamanho, aparece na prévia e é aplicado ao PNG exportado. No Posicionador, também fica salvo no projeto. Projetos antigos abrem sem espelhamento.

O arraste com o botão direito continua movendo a visão; o menu fecha ao arrastar, clicar fora ou pressionar Esc. Também pode usar a caixa **Espelhar imagem horizontalmente** na lateral.

No jogo, `Wall17` usa apenas a face atual `Wall17-2.png`, com `wallpaperRotation: 1` no manifesto. A outra orientação é espelhada ao renderizar, inclusive nos offsets relativos ao tile, sem exigir outro PNG nem modificar a estrutura procedural. Para novas faces, `wallpaperRotation: 0` indica a orientação de rotação par e `1`, a ímpar.

## Presets do posicionador

- **Móvel:** mantém o comportamento de altura livre, com o chão e planos elevados como referência.
- **Piso:** ao selecionar, configura automaticamente pegada 1×1, altura zero, margem de 2 px e exportação da área inteira. O recorte começa em **164×84 px**, bem próximo do tile nativo de **160×80**; use margem 0 para essa caixa exata. Outras pegadas continuam disponíveis. A imagem é centralizada no plano do chão, sem redimensionamento automático.
- **Papel de parede:** mostra diretamente a face vertical esquerda ou direita, com inclinação de ±26,565°. Ajuste comprimento e altura; a área automática acompanha a caixa da face mais a margem. Com uma aresta, altura 208 e margem 0, o recorte tem **80×248 px**. Essa é a altura da face da parede procedural atual; o topo e a espessura são desenhados pelo jogo. O botão de centralização alinha o centro da imagem ao centro dessa face, em vez de colocar sua base no meio do chão.
- **Porta:** item de chão com pegada fixa **1×1**, altura inicial **200 px**, espessura **8 px** e margem **2 px**. O losango azul continua sendo o tile inteiro; a faixa estreita indica a base da porta e o contorno verde mostra sua folha alta. A porta fica junto à aresta traseira (o lado perto da origem vermelha, oposto à frente do tile), não centralizada no losango. O lado inicial é **traseira esquerda, tx = 0**; selecione **traseira direita, ty = 0** se sua arte tiver a inclinação inversa. O guia deixa 2 px entre a base e a aresta, preserva o ângulo 2:1 e permite ajustar altura e espessura. **Alinhar à face traseira** posiciona a caixa inferior da arte no guia; **Ajustar tamanho à porta** também ajusta a escala preservando a proporção. As margens transparentes da imagem original continuam contando, portanto recorte-as primeiro se necessário. Os offsets registram essa posição traseira; a origem do tile não é deslocada.

Para pisos e papéis de parede, **Ajustar tamanho ao preset** redimensiona a imagem inteira para caber na caixa do guia, preservando a proporção e depois centralizando-a. Isso inclui eventuais margens transparentes do PNG original; use o Image Cutter se precisar remover essas margens primeiro. Não há deformação automática da perspectiva.

Selecionar uma categoria reinicia a área de recorte para o automático e aplica seus valores padrão, sem apagar ou reamostrar a imagem original. Altura/comprimento/margem podem ser ajustados depois; o recorte manual continua disponível. Os presets são guias de posicionamento e caixa de exportação: não aplicam a máscara poligonal do Image Cutter. Para uso no jogo, prefira PNGs transparentes fora da arte desejada; o fundo branco é uma alternativa de exportação para suas referências e edições.

O preset de porta não transforma a imagem nem a cadastra no jogo. A folha precisa vir desenhada na perspectiva correta; o gabarito serve para altura, espessura, apoio e offsets. O JSON registra a categoria `door`, `sizeX=1`, `sizeY=1`, lado traseiro, altura e espessura. O ajuste de abertura/dobradiça no runtime continua separado da exportação.

Ao enviar um recorte do Image Cutter, o posicionador recebe também a categoria e o lado correspondentes, preservando os offsets, dimensões e área exata do recorte, sem reaplicar a margem padrão de 2 px. Categoria e configurações da parede são incluídas em **Salvar projeto** e no JSON de offsets; projetos antigos continuam abrindo como móveis.

## Image Cutter: extrair pisos, itens altos e papéis de parede

Abra a aba **Image Cutter** na mesma janela. O posicionador mantém seu trabalho ao alternar entre as abas.

1. Importe a imagem maior que contém vários assets. A importação começa na escala original, sem redimensionamento automático.
2. Escolha **Piso / item** ou **Papel de parede**.
3. Para chão, escolha **1×1**, **1×2 para esquerda**, **1×2 para direita (2×1)** ou **2×2**. A máscara é o polígono exato da grade, com arestas a ±26,565°, não um retângulo comum.
4. Para papel de parede, escolha a **face esquerda ou direita**, o comprimento em arestas de tile e a altura vertical. Cada aresta mede 80 px na horizontal por 40 px de desnível. Uma face de 1 aresta com altura 208 px gera um PNG de **80×248**, transparente nos cantos. É a face visível; os PNGs antigos do jogo têm também espaço transparente na outra metade do canvas de 160 px. A altura continua editável, e projetos salvos conservam a altura escolhida.
5. Arraste a máscara sobre o asset desejado. No seletor **Ao arrastar**, também pode escolher mover a imagem sob a máscara. Escala, rotação e espelhamento horizontal ajudam a alinhar uma arte já isométrica; a máscara sempre mantém o ângulo nativo.
6. Use **Focar recorte** para aferir as bordas e confira a prévia transparente na lateral. O restante da imagem aparece suavizado para localizar os assets vizinhos, mas não entra na exportação.
7. Exporte o PNG e, se necessário, os offsets JSON. Ou clique em **Enviar ao posicionador** para continuar com o resultado, sem baixar e reimportar. Se houver outra imagem no posicionador, a ferramenta pede confirmação antes de substituí-la.

O recorte mantém a caixa nativa inteira da máscara, sem aparar suas pontas transparentes. Não há margem extra. Origem da máscara X/Y indica **onde procurar na folha de assets**, não o offset do PNG no jogo. Os offsets exportados continuam relativos à origem do tile, mesmo depois de mover a máscara. A prévia e o PNG usam o mesmo polígono.

O Image Cutter aceita PNGs transparentes ou imagens opacas, mas não detecta os assets automaticamente: se uma rebarba estiver dentro da máscara, ela também será recortada. Ajuste o enquadramento para selecionar apenas o asset desejado. A folha original nunca é sobrescrita.

As configurações do cutter permanecem na aba durante a sessão; **Salvar projeto** guarda o trabalho do posicionador. Para conservar um resultado do cutter, exporte-o ou envie-o ao posicionador e salve o projeto ali.

### Altura do recorte para itens altos

Em **Piso / item**, ajuste **Altura acima do tile (px)** de 0 a 4096. Com 0, a máscara continua sendo o losango do piso. Valores maiores estendem o contorno para cima como um volume isométrico, sem mudar a pegada, o apoio no chão ou a escala da imagem. Por exemplo, um item 1×1 com altura 200 gera uma caixa de **160×280 px**, com offsets `left=-80` e `top=-200`.

A altura atualiza a máscara, a prévia e o PNG, fica registrada nos offsets JSON e é mantida ao enviar ao posicionador (categoria **Móvel** para alturas maiores que zero). Os guias azul do piso e verde do topo não são exportados. **Papel de parede** continua usando seu controle independente de altura vertical.

## Twister: converter paredes e pisos entre isométrico e retangular

Abra a aba **Twister**, escolha o tipo **Parede** ou **Piso** e o sentido **Isométrico → retangular** para endireitar a imagem, ou **Retangular → isométrico** para projetar uma textura plana na perspectiva do jogo. Para paredes, escolha a face **Esquerda ↘** ou **Direita ↙**; as verticais permanecem verticais e as arestas seguem a projeção 2:1 (±26,565°), sem espelhar a arte.

1. Importe ou solte uma imagem na área de trabalho.
2. Selecione a área de origem com X, Y, largura e altura. Para uma parede isométrica, selecione a caixa de uma única face; para um piso isométrico, selecione a caixa inteira do losango/paralelogramo e escolha a pegada correspondente. Inclua os cantos transparentes nas duas situações. **Remover margens transparentes** ajuda com PNGs que têm espaço vazio ao redor; para folhas com vários assets, ajuste a seleção manualmente. Arraste a seleção para movê-la sobre a imagem.
3. Confira origem e resultado lado a lado. **Enquadrar**, scroll e o controle de zoom alteram apenas a visualização; o arraste direito move a visão.
4. Escolha o filtro suave ou nearest-neighbor e clique em **Exportar PNG**. Transparência e detalhes internos são preservados; guias e áreas externas não entram no arquivo.

A largura horizontal e a altura vertical da face são mantidas. Por exemplo, uma imagem retangular **80×208 px** vira uma parede **80×248 px**; a conversão inversa devolve **80×208 px**. Para larguras ímpares, a caixa isométrica arredonda o desnível para cima para acomodar meio pixel. A altura informada na área de origem é a altura da **caixa inteira**, incluindo o desnível quando a entrada é isométrica.

Para **Piso**, escolha **1×1**, **2×1 para direita**, **1×2 para esquerda** ou **2×2**. A resolução padrão de **160 px por tile retangular** produz as mesmas pegadas do jogo:

| Pegada | Imagem retangular | Caixa isométrica |
| --- | --- | --- |
| 1×1 | 160×160 px | 160×80 px |
| 2×1 | 320×160 px | 240×120 px |
| 1×2 | 160×320 px | 240×120 px |
| 2×2 | 320×320 px | 320×160 px |

A textura selecionada é ajustada à pegada e à resolução escolhidas, mesmo que a entrada tenha outras dimensões. Na conversão inversa, a caixa da origem deve conter exatamente o piso da pegada escolhida; o exterior do polígono fica fora do retângulo exportado. O canto superior esquerdo do retângulo corresponde ao canto traseiro do piso, e seus eixos seguem `+tx` e `+ty`. **Resolução por tile retangular** aceita múltiplos de 4 de 4 a 4096 px, respeitando os limites da exportação. Por exemplo, resolução 320 dobra as dimensões da tabela. O losango e seus cantos transparentes aparecem somente na saída isométrica.

**Usar resultado como entrada** carrega a conversão e inverte o sentido, conservando tipo, pegada e resolução, permitindo continuar sem baixar e reimportar. Cada ajuste parte da entrada atual; alternar entre as abas conserva o trabalho durante a sessão. Conversões sucessivas podem reamostrar pixels, especialmente com o filtro suave. O Twister transforma um plano na projeção 2:1; paredes com duas faces precisam de seleções separadas. Fundos opacos dentro da seleção continuam opacos.

O Twister funciona offline, não altera assets do jogo e exporta apenas o PNG. Os offsets para uso no jogo podem ser definidos depois no Posicionador. Entrada, seleção e saída respeitam os limites de 8192 px por lado e 16 milhões de pixels.


## Escala e altura

Os pixels do editor são os pixels nativos dos assets do jogo. O zoom de visualização só facilita o trabalho, sem alterar a exportação.

- Tile: **160×80 px**; projeção 2:1, arestas a ±26,565°.
- Origem vermelha: `(0,0)`, canto superior/traseiro do primeiro tile.
- Um passo em `tx`: `(+80,+40)`; em `ty`: `(-80,+40)`.
- Altura H: deslocamento vertical de H pixels acima da origem. Não há altura obrigatória por tamanho de tile.
- Área automática: `left = -sizeY*80 - margem`, `top = -altura - margem`, largura `(sizeX+sizeY)*80 + 2*margem`, altura `altura + (sizeX+sizeY)*40 + 2*margem`.

Assim um fogão 1×1 pode ser alto: mantenha a mesma pegada e aumente a altura disponível. Não precisa usar um canvas quadrado nem limitar todo PNG a 512×512.

## Encaixe no tile: alinhar a arte ao ângulo 2:1

Artes recortadas de capturas e portfólios costumam vir num ângulo um pouco diferente do tile, por exemplo 28°–30° em vez de 26,565°. Nesse caso, o contorno do tile aparece por baixo das laterais ou da frente do móvel. Mover a imagem não resolve: o fogão inicial tinha os cantos laterais 4 px acima dos cantos do tile e a frente já apoiada. A seção **Encaixe no tile** do Posicionador mede e corrige isso, na categoria **Móvel**.

1. Importe o PNG e clique em **Detectar cantos da arte**. A silhueta gera os pontos da **base** (laranja: E, F, D = esquerdo, frontal, direito) e do **tampo** (ciano: E, T, D = esquerdo, traseiro, direito). Os ângulos medidos aparecem no painel.
2. Confira os pontos. Pés, sombras, plantas e saliências não formam um losango: arraste cada ponto até o canto real. Os pontos ficam presos à imagem e acompanham movimento, escala e espelhamento.
3. Escolha o **plano de referência**. **Base** encaixa o apoio no chão; serve para fogões, caixas e móveis cujo corpo ocupa o tile. **Tampo** encaixa o tampo no losango, numa altura livre, e mantém a frente da base apoiada na frente do tile. Use-o em balcões cujo corpo é mais estreito que o tampo; o corpo continua recuado, com arestas paralelas ao tile.
4. Escolha o **modo** e clique em **Encaixar na pegada**:
   - **Só mover — 1:1**: translação inteira, sem reamostrar pixels. O ângulo da arte não muda; o desvio residual é dividido entre os cantos.
   - **Escala uniforme — sem distorção**: mesma escala nos dois eixos. Também preserva o ângulo da arte.
   - **Corrigir ângulo**: leva as arestas a exatamente 26,565°. As verticais continuam verticais; cada face visível (esquerda e direita do vértice) recebe sua escala horizontal e um cisalhamento vertical, e a imagem inteira recebe uma escala vertical comum, calculada para que a outra face (tampo ou base) também chegue a 26,565°. O painel mostra essas escalas: o fogão inicial ficou com 104%/96% na horizontal e 89% na vertical.

Nenhum modo tomba as verticais nem aplica perspectiva. Uma arte assimétrica, com o vértice fora do centro, só fica exata no modo de ângulo. Mudar o ângulo sem reamostrar é impossível, então os modos uniforme e de ângulo reamostram a partir do original com o filtro escolhido; o projeto continua guardando a imagem original. Com a correção ativa, largura, altura e escala ficam bloqueadas, enquanto mover e as setas continuam livres. **Remover correção de ângulo** volta ao tamanho nativo. Espelhar também remove a correção, porque troca as faces; clique de novo em Encaixar. A correção, os pontos, o plano e o modo são salvos no projeto e registrados no JSON de offsets (`template.image.angleCorrection` e `template.fit`).

Os itens já cadastrados podem ser conferidos e corrigidos pela linha de comando, na raiz da distribuição, com a mesma geometria (`fit-geometry.js`):

```sh
npm run assets:fit                                        # relatório: ângulos e desvio atual de cada móvel de chão
npm run assets:fit -- starter_counter:top --preview=PASTA # PNGs da arte sobre o contorno do tile, em cada modo
npm run assets:fit -- starter_stove --mode=angle --write  # regrava PNGs e parts; depois npm run assets:room
```

`classname:top` usa o tampo como referência. `--write` exige `--mode` e nomes explícitos. Ele mantém o tamanho do tile e a origem, atualiza `width`, `height`, `left` e `top` de cada part e ajusta `itemHeight` quando ele era o topo das parts. Elementos posicionados sobre o tampo com offsets fixos, como `STOVE_DISH_Y` e `COUNTER_DISH_Y` em `RoomScreen.ts`, precisam acompanhar a nova altura informada no relatório com `:top`.

## Recorte e limiar

**Fundo branco** preenche somente o PNG final com branco sólido, atrás da arte, depois de calcular o recorte por alfa. Assim, alternar o fundo não muda dimensões nem offsets e não interfere no limiar de transparência. A prévia do posicionador também alterna entre branco e quadriculado; os guias nunca entram no PNG. A opção fica salva no projeto e no JSON de offsets; projetos antigos abrem com fundo transparente. **Sem fundo** preserva a transparência existente, mas não remove um fundo opaco que já faça parte da imagem importada. O Image Cutter continua exportando seus recortes com transparência.

**Recortar transparência automaticamente** gera o menor retângulo que contém os pixels com alfa acima do limiar, dentro da área amarela. Por padrão o limiar é 0: até pixels quase invisíveis de uma sombra são considerados.

Aumentar o limiar pode reduzir margens formadas por resíduos quase transparentes, mas pode cortar sombras muito suaves. Ele muda o cálculo do retângulo, não apaga pixels dentro do recorte. Desmarque o recorte automático para exportar a área amarela inteira com o fundo escolhido.

Para controle exato, escolha **Recorte manual em pixels** e informe esquerda, topo, largura e altura. Todas as coordenadas são relativas à origem vermelha. A ferramenta avisa antes de exportar quando a caixa da imagem ultrapassa os limites; essa caixa inclui suas margens transparentes.

Posições, dimensões e offsets finais são inteiros. O filtro suave é indicado para ilustrações; nearest-neighbor evita interpolação para pixel art. Cada ajuste parte da imagem original, sem sucessivos redimensionamentos destrutivos.

## Colocar o PNG no jogo

O JSON de offsets contém `sizeX`, `sizeY` e `frames`, com `file`, `width`, `height`, `left` e `top`. O ponto de origem pode ficar fora do PNG recortado: isso é normal. Não centralize novamente a imagem depois de exportar.

Copie o PNG para `game/public/assets/items/<classname>/` e transfira `file`, `width`, `height`, `left` e `top` do JSON de offsets para as entradas de `parts` no `item.json` correspondente. O manifesto precisa também dos dados do item, como ID, classname, nome, tipo e preço. Execute `npm run assets:room` na raiz da distribuição e reinicie os serviços para atualizar o catálogo incorporado ao Go. Os exports do editor não alteram automaticamente o jogo.

## Controles

- Arrastar a imagem: mover; quadradinho roxo: redimensionar.
- Setas, com o canvas focado: 1 px; Shift + setas: 10 px.
- Scroll: zoom na posição do cursor.
- Clique direito: menu **Inverter**. Arraste direito ou fora da imagem: mover a visão.
- **Enquadrar**: mostra a área exportável e a imagem inteira.

Limites de proteção: exportação de até 8192 px por lado e 16 milhões de pixels. A altura automática aceita até 4096 px; o recorte manual permite áreas diferentes.

## Oficina de móveis do Café Mania

Abra **Oficina de móveis** na barra de ferramentas, ou [furniture.html](furniture.html) diretamente no navegador. Funciona também offline. A oficina usa o tile deste jogo, **160×80**, com origem no vértice traseiro e arestas a **26,565°**; não usa as medidas do Restaurant City como padrão.

Os botões **Mesa de madeira** e **Cadeira rosa** montam reconstruções geométricas inspiradas nas capturas fornecidas pelo responsável. Tampo, assento, encosto, espessura, recuo, largura dos pés e cores têm controles separados. A mesa começa com tampo a 49,2 px acima do chão, acompanhando a mesa branca cadastrada (centro em y=−9,2); o assento começa a 32 px e o encosto a 97,4 px, aproximados pela cadeira clássica cadastrada. Esses números são calibrações deste projeto, não especificações históricas oficiais. **Comparar mesa e cadeira juntas** e **Sobrepor item atual do jogo** ajudam a conferir as proporções. O zoom só altera a visualização.

Para adaptar outro PNG, importe ou escolha um recorte e marque os cantos **esquerdo, traseiro e direito do tampo/assento**, depois o **apoio frontal mais próximo**. Defina a largura do plano, sua altura e a pegada dos pés. Para alinhar também as arestas dos pés ou da estrutura, marque os **apoios esquerdo e direito**. A correção por dois planos fixa o tampo e o chão separadamente, mantendo a continuidade entre eles e as verticais da arte. Assim, aumentar a altura não muda a angulação dos pés. Medir o topo do encosto como assento produz uma calibração errada. Sombras, braços e pontas de toalha não devem determinar esses pontos.

A mesa de vidro e o balcão listrado usam a calibração por dois planos. O balcão acompanha o suporte de pratos do runtime, com o centro do tampo em y=9; seus seis pontos medem a estrutura, e não as pontas da toalha. O fogão churrasqueira mantém a escala original e usa o registro da fonte deslocado 10 px para baixo, com apoio frontal em y=80. Na oficina, marcar um ponto no fogão passa do registro fixo para a calibração editável.

As exportações de arte têm **alpha RGBA real**. Fundo quadriculado, guias e referência sobreposta ficam somente na prévia. **Exportar gabarito PNG** salva apenas as linhas transparentes, separado da arte. **Exportar pacote ZIP** inclui quatro vistas da reconstrução, `item.json` com offsets e `calibration.json`; um PNG importado exporta somente a vista disponível. **Exportar item.json** sozinho descreve somente a rotação exibida. O projeto salvo incorpora a imagem original e os parâmetros, permitindo continuar offline. Classe, ID e preço são editáveis: use um ID livre e trate preço como regra do projeto.

### Biblioteca e itens já cadastrados

Os **75 PNGs** de `_recortes` estão preservados em `references/originals/`, com origem, dimensões e contagem de pixels alpha em `references/library.js`. Eles incluem móveis, pisos/salas, alimentos/bebidas e ícones. **Exportar recorte original** permite reutilizar qualquer um sem a transformação de móveis. Alimentos e ícones não foram convertidos automaticamente em receitas ou objetos de chão.

**Assets do jogo**, o filtro inicial, omite os 23 recortes de ícones antigos. Eles aparecem somente em **Ícones antigos · referência**, identificados como material histórico e sem exportação de manifesto de móvel. Os ícones mais novos já usados em `game/public/assets/ui/` continuam sendo o padrão da interface; o acervo antigo não deve substituí-los nem ser misturado a eles. Móveis, personagens e demais assets podem ser reaproveitados independentemente da época de origem.

Foram cadastrados 14 itens novos em `game/public/assets/items/`:

- Reconstruções: `wood_inlay_table` e `pink_square_chair`, ambas com quatro rotações.
- Mesas originais: `original_glass_table` e `original_gold_table`. Uma imagem é reutilizada nas rotações; não existem quatro vistas originais dessas mesas no acervo.
- Balcão: `original_striped_table` é **Balcão com Toalha Listrada**, com `kind: counter`. A classe e o ID foram preservados para manter as unidades existentes.
- `original_gold_armchair`: frente e costas originais com espelhamento para quatro direções. Largura e apoio seguem a cadeira clássica; ainda requer conferência do encaixe do avatar sentado no jogo.
- Decorações: `original_black_piano` e `original_cream_piano`.
- Fogão: `original_barbecue` é **Fogão Churrasqueira**, com `kind: stove`, e usa as regras normais de cozimento. A classe e o ID foram preservados.
- Pisos: `original_water_floor`, `original_stone_floor`, `original_pool_floor`, `original_sand_floor`, `original_grass_floor`. Cada bloco original foi reduzido e mascarado para um tile em mosaico; não foi reconstruída a repetição dos subtiles da folha.

Para importar novamente de uma pasta de fontes, sem alterar o outro projeto:

```powershell
node scripts/import-cafe-originals.mjs "C:/caminho/para/_recortes"
npm run assets:room
```

O importador recusa sobrescrever PNGs e manifestos existentes que tenham conteúdo diferente; o índice derivado `references/library.js` é regenerado. Ele inclui as fontes incorporadas para exportar e salvar projetos offline sem reamostrar o original. A origem e a calibração estão em `source` nos manifestos. Nenhum preço foi atribuído como valor oficial do jogo original. Reinicie os serviços Go para carregar o catálogo sincronizado; a ferramenta não escreve no banco nem altera o inventário de contas existentes.

Para aplicar as calibrações corrigidas a exports anteriores dessas três classes, acrescente `--update=original_glass_table,original_striped_table,original_barbecue` ao comando de importação. Essa opção autoriza somente os exports dessas classes; as fontes continuam preservadas e a cópia anterior fica em `.runtime/asset-audit/geometry-before/`. Não é necessário alterar os outros itens.

Verificação específica da geometria: `node --test tests/tools/furniture.test.mjs`. A validação de manifests e dimensões continua em `npm run assets:room`.

A **Máquina de Sucos** foi cadastrada separadamente, com os 12 recortes de bebidas e serviço compartilhado de NPCs. Consulte [sucos.md](../../docs/sucos.md) para os nomes históricos, valores confirmados e calibrações do projeto. Os ícones antigos continuam restritos à biblioteca de referência.

O [navegador do acervo](../acervo/index.html) indexa as 666 imagens em `artes-referencia/`, com pesquisa, fontes e visualização dos itens preparados. Funciona por arquivo local ou em `/acervo/` no servidor de ferramentas. O primeiro lote adiciona 13 móveis com 30 vistas à Oficina; a calibração e os limites das reconstruções e espelhamentos estão em [acervo-moveis.md](../../docs/acervo-moveis.md). Execute `node scripts/index-reference-art.mjs` para atualizar o índice depois de adicionar ou recalibrar esses itens.

O [lote 02](../../docs/acervo-moveis-lote-02.md) acrescenta três mesas e duas cadeiras italianas e revisa balcão, cadeira rosa e poltronas. Os manifestos aceitam `flipX: true` por parte: o carregador espelha a imagem uma vez e mantém os offsets da vista. A biblioteca offline incorpora os pixels já espelhados para importar a mesma pose do jogo.
