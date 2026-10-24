"""Cut the beach extras (ice-cream vendor with cart, bather) into runtime PNGs.

Sources: ChatGPT generations in .runtime/arte-para-gerar/18-sorveteiro and 19-banhista,
drawn from "cafe mania muito tempo de jogo" (1:54) and frame 005 of the coast video.
Only cropping by the alpha box (4 px margin); the anchor is the ground point between
the lowest contacts (cart wheel and flip-flops; the bather's feet).
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / '.runtime/arte-para-gerar'
OUT = ROOT / 'game/public/assets/scenery/beach-extras'
MARGIN = 4


def cut(source, name):
    image = Image.open(source).convert('RGBA')
    alpha = np.array(image.getchannel('A')) > 128
    ys, xs = np.nonzero(alpha)
    left, top = max(0, xs.min() - MARGIN), max(0, ys.min() - MARGIN)
    piece = image.crop((left, top, min(image.width, xs.max() + 1 + MARGIN), min(image.height, ys.max() + 1 + MARGIN)))
    bottom = ys.max()
    contacts = xs[ys > bottom - 25]
    anchor = {'x': round(float(contacts.min() + contacts.max()) / 2 - float(left), 1), 'y': float(bottom - 8 - top)}
    path = OUT / f'{name}.png'
    piece.save(path)
    return {'anchor': anchor, 'size': list(piece.size), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    pieces = {
        'ice-cream-vendor': cut(ART / '18-sorveteiro/gerado.png', 'ice-cream-vendor'),
        'bather': cut(ART / '19-banhista/gerado.png', 'bather'),
    }
    registration = {
        'origin': 'Reconstruções geradas com o ChatGPT (Image Gen) a pedido do responsável pelo projeto, em 24/10/2026, a partir '
                  'do vídeo "cafe mania muito tempo de jogo" (1:54) e do quadro 005 do vídeo da orla. Não são PNGs originais recuperados.',
        'processing': 'tools/scenery/beach-extras/cut-art.py: recorte pela caixa do alfa com 4 px de margem, sem redimensionar. '
                      'Âncora = ponto no chão entre os contatos mais baixos.',
        'pieces': pieces,
    }
    (OUT / 'registration.json').write_text(json.dumps(registration, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(pieces))
