"""Matting helpers for opaque artwork and neutral translucent effects on a flat backdrop."""
import numpy as np
from scipy import ndimage as ndi


def border_color(rgb: np.ndarray) -> np.ndarray:
    return np.median(np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]), axis=0)


def opaque_cutout(rgb: np.ndarray, background: np.ndarray, excluded: np.ndarray,
                  threshold: float = 36, edge_sigma: float = 2,
                  chroma_thresholds: tuple[float, float] = (18, 14), inset: float = .65,
                  coverage_width: float = 1.6) -> np.ndarray:
    """Keep dark solid details independent of an effect's opacity.

    Brightness alone cannot distinguish a dark brown shoe from blue backdrop residue.
    Channel differences protect distinct foreground hues without accepting a uniformly
    brighter patch of backdrop. All geometric values are in source-video pixels.

    Only the largest connected subject is retained. Interior negative spaces remain holes.
    Smoothing the signed distance repairs the contour itself before computing fractional
    coverage; blurring a dirty binary mask would merely soften its spikes. Color propagation
    is confined to the antialiased boundary, leaving opaque interior RGB intact.
    """
    pixels = rgb.astype(np.float32)
    distance = np.max(np.abs(pixels - background), axis=2)
    chroma = np.abs((pixels[..., :2] - pixels[..., 2:3]) - (background[:2] - background[2]))
    mask = ((distance > threshold) | np.any(chroma > chroma_thresholds, axis=2)) & ~excluded
    mask = ndi.binary_closing(mask, structure=np.ones((3, 3)))
    labels, count = ndi.label(mask)
    if not count:
        return np.zeros((*mask.shape, 4), dtype=np.uint8)
    areas = np.bincount(labels.ravel()); areas[0] = 0
    mask = labels == areas.argmax()
    mask = ndi.binary_opening(mask, structure=np.ones((3, 3)))
    mask = ndi.median_filter(mask, size=3)
    signed_distance = ndi.distance_transform_edt(mask) - ndi.distance_transform_edt(~mask)
    contour = ndi.gaussian_filter(signed_distance, edge_sigma)
    mask = contour > inset
    alpha = np.clip(.5 + (contour - inset) / coverage_width, 0, 1)
    inner = ndi.binary_erosion(mask, iterations=3)
    if not inner.any():
        inner = mask
    _, nearest = ndi.distance_transform_edt(~inner, return_indices=True)
    colors = rgb.copy()
    boundary = alpha < .99
    colors[boundary] = rgb[nearest[0][boundary], nearest[1][boundary]]
    out = np.dstack([colors, np.round(alpha * 255)]).astype(np.uint8)
    out[out[..., 3] == 0] = 0
    return out


def neutral_vapor(rgb: np.ndarray, background: np.ndarray, domain: np.ndarray,
                  color: tuple[int, int, int] = (241, 247, 249), noise_floor: float = .012,
                  strength: float = .85, sigma: float = 1.2) -> np.ndarray:
    """Recover coverage from C = alpha * steam + (1 - alpha) * background.

    A neutral steam color is an explicit assumption: a single RGB video does not contain
    the original alpha. Estimating coverage along that color direction removes the dark
    backdrop without turning the gray composite into opaque soot. The noise floor rejects
    compression residue. RGB remains light even in faint wisps.
    """
    foreground = np.asarray(color, dtype=np.float32)
    direction = foreground - background
    denominator = float(np.dot(direction, direction))
    if denominator < 1:
        raise ValueError('Vapor and backdrop must have distinct colors.')
    coverage = np.maximum(0, ((rgb.astype(np.float32) - background) * direction).sum(axis=2)
                          / denominator - noise_floor)
    coverage = ndi.gaussian_filter(coverage, sigma) * strength * domain
    rgba = np.zeros((*domain.shape, 4), dtype=np.uint8)
    rgba[..., :3] = color
    rgba[..., 3] = np.round(np.clip(coverage, 0, 1) * 255)
    rgba[rgba[..., 3] == 0] = 0
    return rgba
