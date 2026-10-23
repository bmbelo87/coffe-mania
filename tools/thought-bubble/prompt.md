# Balão de pensamento — Image Gen

Modo: ferramenta integrada `image_gen`, com transparência solicitada. Referência visual: `reference.jpg`, fornecida pelo responsável pelo projeto. O resultado selecionado está em `source.png`; o recorte preserva o alpha e não redesenha a arte.

Especificação da geração modular: moldura oval branca horizontal com aro amarelo-dourado e contornos marrom-escuros, seguindo o balão da referência. Sem bebida, texto, personagem ou cenário incorporados. Duas bolhas circulares independentes, em tamanhos diferentes, separadas da moldura e entre si para permitir montagem no runtime. A geração foi refinada para separar as peças e retirar o fundo.

Prompt da última edição aplicada:

> Background extraction only. Remove ALL the black/brown/orange glowing background and ALL halos and outer shadows from this modular UI sheet. Outside the solid dark brown outer outline of each of the THREE pieces, everything must be completely transparent (alpha zero), including ALL gaps between the pieces. Keep the three exact shapes and positions unchanged: one white oval with flat yellow-gold rim and dark brown outlines on top, two separate white circular thought dots with yellow-gold rims and dark brown outlines at bottom. Preserve opaque white centers and crisp anti-aliased dark brown outer contours. NO glow or shading outside the contours, no dark matte, no ground shadow, no backdrop, no new objects, no text. Genuine alpha transparency, not a black background. Export clean production sprite sheet.

Assets finais: `game/public/assets/ui/thought-bubble/oval.png`, `dot-large.png`, `dot-small.png`. Para repetir apenas o empacotamento: `python tools/thought-bubble/pack-art.py` com Pillow disponível.
