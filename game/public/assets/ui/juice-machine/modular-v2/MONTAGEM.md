# Assets separados do menu Sucos!

Abra `preview.html` na pasta do projeto para conferir o painel vazio, o encaixe das abas e o cartão de evolução. Funciona com imagens locais, sem iniciar servidores do jogo. Os dez PNGs têm versões em resolução nativa e em 2× (`@2x.png`). As saídas originais de imagegen ficam preservadas em `sources/`; os prompts completos estão em `prompts.json`. O ZIP de entrega contém os PNGs, prévias estáticas, prompts e medidas; a prévia HTML reutiliza imagens das outras pastas do projeto.

| Peça | PNG | Tamanho lógico |
| --- | --- | --- |
| Painel sem conteúdo | `painel-vazio.png` | 594×508 |
| Aba selecionada, sem texto | `aba-ativa.png` | 130×35 |
| Aba disponível, sem texto | `aba-inativa.png` | 130×35 |
| Aba bloqueada, sem texto ou cadeado | `aba-bloqueada.png` | 130×35 |
| Janela azul da máquina, vazia | `janela-maquina.png` | 154×162 |
| Moldura e raios, sem conteúdo | `evolucao-fundo.png` | 154×174 |
| Título de três linhas | `evolucao-titulo.png` | 140×49 |
| Silhueta angular e interrogação | `evolucao-silhueta.png` | 62×82 |
| Fundo branco da linha de suco | `linha-suco.png` | 362×77 |
| Fundo amarelo da linha servindo | `linha-suco-servindo.png` | 362×77 |

A origem é o canto superior esquerdo do painel. O corpo começa em **y=119**. Posicione as abas em **y=86**, nos x **12, 147, 284 e 419**. Sua base chega a y=121, cobrindo 2 px do corpo. A aba ativa tem a borda inferior aberta; não acrescente contorno ou sombra embaixo dela. As posições se multiplicam uniformemente por 2 ao usar os PNGs em 2×.

O cartão de evolução começa em **(28,314)**. Acrescente o título em **(35,319)** e a silhueta em **(74,372)**. O texto inferior é texto normal da interface, separado da arte: “Aprimore seus sucos” e “para descobrir!”, centralizado em x=105, linhas em y=455 e y=467, Arial 11 px, cor `#174d70`. O preview usa essas medidas. Título e silhueta mantêm a proporção original de geração; não redimensione os eixos independentemente.

As quatro linhas de suco começam em **x=199**, nos y **135, 225, 315 e 405**. Sobreponha aos fundos os sucos, ícones, texto e botões existentes. Os fundos branco/amarelo ficam vazios para permitir essa montagem; nenhuma informação da receita está gravada neles.

`layout.json` contém todas as medidas, caixas e pontos de apoio. Os fundos vazios foram exportados nas medidas do gabarito, com o encontro entre cabeçalho e corpo registrado em y=119. Apenas as artes sem texto recebem ajuste ao retângulo de destino; texto e silhueta usam escala uniforme. Os PNGs possuem alpha RGBA real fora das formas. O quadriculado do preview não está nos arquivos.

Os sucos, a máquina, o título Sucos! e o botão de fechar da prévia vêm dos assets existentes. O botão de fechar usa o atlas `game/public/assets/ui/buttons_collection_1.png`, recorte **(1206,297,227,234)**, o mesmo carregado no livro de receitas. Não foram gerados novos ícones de recursos, cadeados ou botões. Reutilize os componentes do jogo para textos, ações, valores e barras de progresso; a prévia de peças não inventa receitas ou regras.

O pacote é uma reconstrução raster com imagegen orientada pela captura; não contém pixels extraídos do screenshot original. As versões anteriores foram preservadas. Estes arquivos foram entregues separadamente para montagem e não substituem automaticamente a interface ativa do jogo.

Para reexportar depois de ajustar fontes ou medidas, na raiz do projeto:

```sh
node scripts/export-juice-modular.mjs
```

Conferência: PNGs RGBA, cantos transparentes, dimensões 1×/2×, proporção do texto e da silhueta e preview real no Chromium. Não foram iniciados banco ou servidor de quartos para essa entrega de assets.
