# Separa o logo do Café Mania (adesivo com contorno branco) do degradê da faixa Behance 49023909/001.
# Uso: python cut_logo.py <faixa.png> <saida.png> <escala>
# A transição recebe alfa estimado: cada pixel da borda é uma mistura do branco do contorno
# com a cor local do fundo, que vem do pixel de fundo mais próximo.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
src, out, scale = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
rgb = im[0:205, 520:880]
white = rgb.min(axis=2) > 200
lab, _ = ndimage.label(~white)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border))
lab2, n = ndimage.label(~bg)
sizes = ndimage.sum(~bg, lab2, range(1, n + 1))
logo = ndimage.binary_fill_holes(lab2 == (1 + int(np.argmax(sizes))))
# Fundo "puro": afastado 2 px do logo, para não contaminar a cor local com a borda.
pure_bg = ~ndimage.binary_dilation(logo, iterations=3)
_, (iy, ix) = ndimage.distance_transform_edt(~pure_bg, return_indices=True)
bgcol = rgb[iy, ix]
W = np.array([255, 255, 255], np.float32)
d = W - bgcol
a = ((rgb - bgcol) * d).sum(axis=2) / np.maximum((d * d).sum(axis=2), 1)
a = np.clip(a, 0, 1)
band = ndimage.binary_dilation(logo, iterations=3) & ~ndimage.binary_erosion(logo, iterations=2)
alpha = np.where(logo & ~band, 1.0, 0.0)
alpha[band] = a[band]
alpha[pure_bg] = 0
color = rgb.copy()
color[band] = W  # na transição a arte é o branco do contorno
ys, xs = np.nonzero(alpha > 0.01)
y0, y1, x0, x1 = ys.min() - 2, ys.max() + 3, xs.min() - 2, xs.max() + 3
alpha, color = alpha[y0:y1, x0:x1], color[y0:y1, x0:x1]
# Amplia com alfa pré-multiplicado para não criar halo escuro.
pm = np.dstack([color * alpha[..., None], alpha * 255]).astype(np.float32)
big = [np.asarray(Image.fromarray(pm[..., c]).resize((pm.shape[1] * scale, pm.shape[0] * scale), Image.LANCZOS)) for c in range(4)]
big = np.dstack(big)
A = np.clip(ndimage.gaussian_filter(big[..., 3], 0.5 * scale / 3), 0, 255)
rgbo = np.clip(big[..., :3] / np.maximum(big[..., 3:4], 1e-3) * 255, 0, 255)
res = np.dstack([rgbo, A]).astype(np.uint8)
Image.fromarray(res, 'RGBA').save(out)
print(out, res.shape)
