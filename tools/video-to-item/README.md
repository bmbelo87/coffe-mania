# Recorte de vídeos e animação da Vovó Chef

`video_to_item.py` continua sendo o conversor genérico. A animação já cadastrada da
Vovó Chef tem uma receita específica em `grandma.json`, reconstruída do vídeo
`artes-avulsas/Vovó Chef com Omelete e Molho.mp4`. Não é um PNG original recuperado
do jogo Flash; é o processamento do vídeo-fonte desta personagem no projeto.

## Refazer a Vovó Chef

Requer Python com Pillow, NumPy e SciPy, além de FFmpeg no PATH:

```powershell
python tools/video-to-item/repair_grandma.py --qa-dir .runtime/grandma-repair/qa
python tests/tools/test_video_matting.py
```

O comando grava somente `frame-000.png` e `animation.webp` no item
`game/public/assets/items/grandma_chef/`. Não reescreve o manifesto nem o catálogo.
`--output PASTA` permite comparar uma candidata antes de substituir a arte; a opção
`--frames-dir PASTA` reutiliza os quadros `f0001.png`…`f0240.png` extraídos pelo FFmpeg.

O enquadramento permanece em 189×207 pixels lógicos, com folha em resolução 2×,
72 quadros a 15 fps, dez colunas e quatro pixels lógicos transparentes de margem.
Os offsets continuam em `left=-95`, `top=-151`. A receita usa os quadros-fonte
32…174, de dois em dois, mantendo a sequência da folha anterior.

## Contratos do recorte

- A máscara sólida combina contraste de luminosidade com diferenças entre os
  canais de cor. O limiar baixo de luminosidade sozinho preservava os sapatos,
  mas também promovia resíduos azulados ligados à borda a parte opaca da arte.
  A separação cromática preserva o marrom e rejeita esses resíduos. Os limiares
  são calibrados para este vídeo; não são uma regra universal de remoção de fundo.
- Abertura e mediana de três pixels removem pontas de compressão antes de suavizar
  o contorno pela distância assinada. O ajuste de 0,65 pixel e a suavização de
  dois pixels são medidos no vídeo-fonte, equivalendo a frações de pixel lógico.
  A cobertura fracionária segue esse contorno limpo; o interior opaco mantém a
  cor do vídeo. Espaços negativos reais, entre prato e braço, continuam abertos.
- O vapor tem uma máscara separada, delimitada pela borda superior da comida e
  da louça em cada coluna. Assim, um corte retangular não deixa um bloco escuro
  acima do prato nem remove o contorno da comida.
- A cobertura do vapor é estimada pela composição sobre o fundo do vídeo,
  assumindo vapor claro `(241,247,249)`. Um único vídeo RGB não permite recuperar
  seu alfa original exato. Essa hipótese, a intensidade e o descarte de ruído
  estão explícitos na receita.
- A passagem final conserva a dissolvência curta do corpo e usa uma dissolvência
  mais longa para o vapor. Ambos são filtrados com alfa pré-multiplicado em ponto
  flutuante. Arredondar antes da redução produzia faixas de cor nas partes tênues.
- A folha usa WebP sem perdas, inclusive nas cores. O custo é um arquivo maior;
  as dimensões da textura na GPU permanecem as mesmas.

Como referência de arquitetura, foi consultado o
[FurnitureVisualization do Nitro Renderer](https://github.com/billsonnn/nitro-renderer/blob/main/src/nitro/room/object/visualization/furniture/FurnitureVisualization.ts),
que trata textura, alfa e offsets separadamente. Aqui a correção é feita no
processamento da textura; não muda profundidade, grade, navegação ou interpolação.

## Conferência visual

`--qa-dir` exporta seis pranchas: os 72 quadros sobre rosa e os mesmos 72 sobre roxo,
além de uma prévia animada com transparência. Revise as pranchas em tamanho nativo
e amplie os sapatos, o braço que sustenta a louça e as bordas do cabelo/avental.
As miniaturas não bastam para verificar rebarbas. Examine também recortes
ampliados do prato/braço, cabelo, braço direito, bainha e solas, inclusive nos
quadros da transição do laço.

Os oito testes específicos cobrem detalhes escuros, espaços negativos, bordas
sem a cor do fundo, resíduos azulados conectados à silhueta, pontas de um pixel,
cobertura e confinamento do vapor e precisão de cor na redução.

Na revisão de 24/10/2026 foram conferidos todos os quadros nos dois fundos e cinco
instantes no carregador Pixi real: 0, 24, 48, 71 e retorno ao 0, nos zooms 0,55,
1 e 2,40. Foi usado um preview isolado, sem banco ou simulação da sala. Isso
confirma a textura e sua composição; não equivale a um teste multiplayer completo.

A conferência ampliada percorreu prato/antebraço, cabelo/óculos/braço direito e
bainha/sapatos nos 72 quadros. Uma checagem adicional nos quadros-fonte não
encontrou perda de opacidade em núcleos situados mais de quatro pixels para
dentro da silhueta nessas regiões. Essa medida protege o interior; a inspeção
ampliada é que verifica a limpeza da borda. Os oito testes passaram.
