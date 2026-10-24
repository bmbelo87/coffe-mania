# Image Gen — partes reconstruídas

Gerador integrado do Codex, com `transparent_background: true`. Os resultados foram calibrados em `finalize-generated.py`; a composição final do convite reutiliza os pixels originais do casal, em vez dos personagens reinterpretados numa geração descartada.

## Moldura vazia do convite

Referência: `.runtime/social-bar/add-friend-original.png`, recorte de Guido 014.

Use case: precise-object-edit. Create only the EMPTY ORANGE CARD FRAME from this exact original Café Mania Flash social-card reference. Remove the two chefs entirely, remove the text Ruben Dario and Agregar Vecino entirely. Preserve the card's exact original orange background, shape, thin dark-orange rim, 2D simplicity, and separate rounded orange button at bottom. Upper section plain warm orange, about100of150height. Lower button about45of150height, blank, rounded with dark-orange outline and a narrow brighter orange top edge. No star glint, no decorative effects, no shadows outside card, no dramatic gradients, no textured background. Canvas600x900. Card fills canvas edge-to-edge except 2% transparent margin; exactratio2:3. Outside rounded card must be FULLY transparent alpha0; do not paint any orange glow, orange halo or colored backdrop outside the card. No characters, objects, text, letters, numbers, icons, scenery or drop shadow. The existing original chefs will be overlaid separately after export, so do not draw them here. Flat 2012 Flash UI in original colors, no photorealism or 3D.

## Silhueta de retrato

Referência: `.runtime/recipe-video/todos/quadros/quadro-487.png`.

Use case: precise-object-edit. Output ONLY the tiny anonymous friend portrait silhouette from the orange player portrait frames at the bottom of this original Café Mania screenshot. Enlarge/reconstruct that simple neutral GRAY HEAD AND SHOULDERS BUST cleanly: unadorned oval/round head, short neck, gently rounded shoulders tapering down to a flat bust bottom. Uniform light cool gray #acadaf, absolutely featureless, NO face, eyes, hair, clothing, shine, bevel, gradients or outline. Same neutral generic gray friend-photo loading placeholder as original. Single centered bust only, entire bust visible, transparent alpha0 outside. NO orange frame, background, box, level badge, stars, text or UI. Flat 2D Flash raster sprite. Canvas512x512 with bust occupying central70%width,80%height, ample empty transparent margin. Actual transparency, not painted checkerboard. Simplicity and matching the original outline are essential; do not invent a specific character.
