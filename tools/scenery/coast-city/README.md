# Orla urbana modular

Arte reconstruída com o Image Gen integrado, baseada no Café Mania original. Não é um pacote de PNGs recuperados. Veja `source.json` e `../../../docs/cenario-cafe-urbano.md`.

Para reexportar os masters selecionados com Node, Sharp e Python/Pillow disponíveis:

```text
node tools/scenery/coast-city/export.mjs
python tools/scenery/coast-city/build_scene.py
```

`SHARP_MODULE` pode indicar o Sharp do runtime empacotado; não foi adicionada uma dependência ao cliente. Os caminhos acima partem da raiz do projeto. A exportação preserva a transparência gerada e só remove margens vazias, redimensiona e prepara repetição. Os masters não são sobrescritos.

Antes de publicar uma revisão, comparar a silhueta e a paleta com os recortes de `references/`, conferir alfa sobre fundo colorido e montar com o cenário. Não adicionar ornamentos, reflexos, texturas realistas ou alterar o estilo original. Detalhes encobertos precisam de referência adicional; não os anunciar como recuperados.

Revisão de 22/10: masters selecionados `water-calm`, `curb-raised` e `crosswalk-crisp`, com prompts homônimos. A água esparsa usa repetição espelhada de maior dimensão; a borda usa um recorte explícito da face gerada; a faixa é exportada em resolução dupla e usa amostragem direta. `textureMatrix` mantém as pedras proporcionais sem alterar a silhueta da calçada. São 20 PNGs e 35 partes. A prévia isolada chama o carregador normal do jogo e aplica a escala externa da tela.

Revisão de direção da água: `water-calm-aligned` substitui `water-calm` na exportação, com as mesmas cinco faixas orientadas horizontalmente pelo Image Gen. Uma rotação pura de UVs acompanha a linha da areia, sem nova escala ou densidade. O prompt homônimo e o master anterior estão preservados.

Revisão do píer: `pier-single-lamp` mantém somente o poste alto, com luminária cônica, e remove a saliência acima do poste central do corrimão. A variação intermediária `pier-lamps-draft` não é publicada. Ambas foram feitas com Image Gen integrado e têm prompts homônimos. A exportação continua em 700×675 para preservar a calibração do cenário e a camada acima do barco.

Areia molhada: master e prompt `wet-sand`, gerados pelo Image Gen integrado a partir de `references/wet-sand-detail.png`. O alfa preserva a transição suave para a areia seca; o runtime recorta a sobreposição pelo mesmo perfil da espuma. Total atual: 21 PNGs e 36 partes.

Seleção atual após revisão da rua e do píer: `sidewalk-muted`, `curb-blocks`, `pier-arch`, `pier-steps`, `pier-shadow` e `pier-open-entry`, todos com prompts homônimos. A placa, degraus e sombra são peças separadas. `road-marking` reutiliza um bloco branco de `crosswalk-crisp` por recorte, redimensionamento e margem transparente; a projeção usa os dois eixos do chão. Passeios compartilham profundidade de 160 pixels. Total atual: 25 PNGs, 41 partes. Masters anteriores e o rascunho da primeira calçada suavizada foram preservados.

Contato externo das paredes: `scene.json` declara `wallContact: outer`; o carregador aplica a espessura real de `wallGeometry` à camada do cenário, mantendo o quarto e a navegação na origem. O gerador continua autorando as faixas na borda interna de 80 pixels. `coast-curb-top` e `near-curb-top` recortam apenas os primeiros cinco pixels do topo existente e usam os dois eixos do chão. A face vertical permanece no meio-fio distante voltado para a rua; a grama não recebe uma face de contenção. Os dois PNGs de asfalto agora recortam somente a superfície do master `road-start`, excluindo as bordas que já estavam desenhadas nele. Não houve nova geração de arte neste ajuste.

Meio-fio, faixa de pedestres e faixa central medidos no original (24/10/2026): `build_curbs.py` desenha `curb.png` (lado da rua, com topo, quina iluminada, espelho e linha escura no asfalto), `curb-top.png` (lado do café, só o topo com o chanfro claro) e `curb-top-beach.png` (lado da areia, topo com a junta escura) a partir das cores e medidas do vídeo "cafe mania muito tempo de jogo" (1:52–2:12). A escala vem da grade do piso do café: 33,5 px do vídeo = um tile, ou 2,39 px do mundo por pixel. Texturas em 2x, juntas a cada 160 px. A mesma medição reposiciona as quatro listras da faixa (espaçamento desigual, como no vídeo) e o tracejado central (38,2 de traço a cada 67,5). `build_scene.py` põe o topo sobre a calçada e o espelho sobre o asfalto, corta o fim do espelho na vertical e cobre o começo da rua com a areia em S medida (`road-end-sand`, mesma textura e alinhamento do plano de areia). `curbs.json` guarda a origem e os hashes; `export.mjs` não publica mais essas três peças. Não são sprites extraídos: são desenhos planos com as medidas do original.
