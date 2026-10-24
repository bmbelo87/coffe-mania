"""Cut the generated supply-order art into runtime PNGs and register anchors and hashes.

Sources are the ChatGPT generations in .runtime/arte-para-gerar/11..14 (local, not
published). Only cropping by the alpha box (4 px margin) and cell splitting; no resizing.
Ground anchors are the centre of each footprint, measured on the alpha:
- boxes: the 2:1 bottom face, x between the side corners, y a quarter of its width above
  the lowest (front) corner;
- cone: its square base is drawn slightly turned, so the centre is the mean of the four
  base corners (the hidden back one mirrors the front corner).
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / '.runtime/arte-para-gerar'
SCENERY = ROOT / 'game/public/assets/scenery/supplies'
UI = ROOT / 'game/public/assets/ui'
MARGIN = 4
BOXES = ['express', 'media', 'premium', 'jumbo', 'spoiled']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def trim(image):
    alpha = np.array(image.getchannel('A')) > 8
    ys, xs = np.nonzero(alpha)
    box = (max(0, xs.min() - MARGIN), max(0, ys.min() - MARGIN),
           min(image.width, xs.max() + 1 + MARGIN), min(image.height, ys.max() + 1 + MARGIN))
    return image.crop(box), box


def corners(image):
    alpha = np.array(image.getchannel('A')) > 128
    ys, xs = np.nonzero(alpha)
    left, right, bottom = xs.min(), xs.max(), ys.max()
    return {
        'left': (int(left), float(ys[xs == left].mean())),
        'right': (int(right), float(ys[xs == right].mean())),
        'bottom': (float(xs[ys == bottom].mean()), int(bottom)),
    }


def box_anchor(image):
    c = corners(image)
    left, right, bottom = c['left'][0], c['right'][0], c['bottom'][1]
    return round((left + right) / 2, 1), round(bottom - (right - left) / 4, 1)


def cone_anchor(image):
    c = corners(image)
    (lx, ly), (rx, ry), (bx, by) = c['left'], c['right'], c['bottom']
    back = (lx + rx - bx, ly + ry - by)
    return round((lx + rx + bx + back[0]) / 4, 1), round((ly + ry + by + back[1]) / 4, 1)


def outline(image, points=8):
    """Convex silhouette for hit testing: tall boxes in front must not catch clicks meant
    for the box behind them. Monotone-chain hull, then the least significant corners go."""
    alpha = np.array(image.getchannel('A')) > 96
    ys, xs = np.nonzero(alpha)
    edge = sorted({(int(x), int(y)) for x, y in zip(xs, ys)
                   if x in (xs[ys == y].min(), xs[ys == y].max())})

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in edge:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(edge):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    hull = lower[:-1] + upper[:-1]
    while len(hull) > points:
        index = min(range(len(hull)), key=lambda k: abs(cross(hull[k - 1], hull[k], hull[(k + 1) % len(hull)])))
        hull.pop(index)
    return [v for p in hull for v in p]


def main():
    SCENERY.mkdir(parents=True, exist_ok=True)
    (UI / 'supplies').mkdir(parents=True, exist_ok=True)
    pieces = {}
    cone, _ = trim(Image.open(ART / '11-cone-encomenda/gerado.png').convert('RGBA'))
    cone.save(SCENERY / 'cone.png')
    x, y = cone_anchor(cone)
    pieces['cone'] = {'anchor': {'x': x, 'y': y}, 'outline': outline(cone), 'size': list(cone.size), 'sha256': sha(SCENERY / 'cone.png')}
    sheet = Image.open(ART / '12-caixas-suprimentos/gerado.png').convert('RGBA')
    for index, name in enumerate(BOXES):
        cell, _ = trim(sheet.crop((index * 512, 0, index * 512 + 512, 512)))
        cell.save(SCENERY / f'{name}.png')
        x, y = box_anchor(cell)
        pieces[name] = {'anchor': {'x': x, 'y': y}, 'outline': outline(cell), 'size': list(cell.size), 'sha256': sha(SCENERY / f'{name}.png')}
    registration = {
        'origin': 'Reconstruções geradas com o ChatGPT (Image Gen) a pedido do responsável pelo projeto, em 24/10/2026, '
                  'a partir dos vídeos "Café Mania level 400" e "Nível 300" (cones) e da captura P125_09 de 2014 (caixas). '
                  'Não são PNGs originais recuperados. A caixa estragada não tem referência preservada: é reconstrução.',
        'processing': 'tools/supplies/cut-art.py: recorte pela caixa do alfa com 4 px de margem e divisão da folha de caixas em '
                      'células de 512 px, sem redimensionar. Âncora = centro da pegada no chão; outline = silhueta convexa para o clique.',
        'pieces': pieces,
    }
    (SCENERY / 'registration.json').write_text(json.dumps(registration, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    van = Image.open(ART / '13-van-encomendas/gerado.png').convert('RGBA')
    van.save(UI / 'action-icons/van.png')
    window = Image.open(ART / '14-janela-encomendas/gerado.png').convert('RGBA')
    window.save(UI / 'supplies/window.png')
    ui_source = {
        'origin': 'Reconstruções geradas com o ChatGPT (Image Gen) a pedido do responsável pelo projeto, em 24/10/2026. '
                  'Van: ícone da barra de ações de ~2013 (vídeo "cafe mania muito tempo de jogo", 0:26). Janela: nenhuma '
                  'captura mostra a janela de encomendas aberta; reconstrução no estilo da janela de Temperos, com o título "Encomendas".',
        'processing': 'Cópia sem alteração (van 270x327, mesmo quadro do ícone da galinha; janela 1330x600, mesmo quadro da de Temperos).',
        'files': {'action-icons/van.png': sha(UI / 'action-icons/van.png'), 'supplies/window.png': sha(UI / 'supplies/window.png')},
    }
    (UI / 'supplies/source.json').write_text(json.dumps(ui_source, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(pieces, indent=1))


if __name__ == '__main__':
    main()
