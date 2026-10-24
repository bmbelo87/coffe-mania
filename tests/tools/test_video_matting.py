"""Regression checks for dark solid details, intentional gaps, and steam on a dark backdrop."""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/video-to-item'))
from matting import neutral_vapor, opaque_cutout
from repair_grandma import resize


class VideoMattingTests(unittest.TestCase):
    def setUp(self):
        self.background = np.array([30, 42, 57], dtype=np.float32)
        self.rgb = np.full((80, 80, 3), self.background, dtype=np.uint8)
        self.excluded = np.zeros((80, 80), dtype=bool)

    def test_dark_shoe_is_solid_and_keeps_its_source_color(self):
        self.rgb[10:50, 20:60] = [210, 150, 130]
        # These solid colors fall below the former threshold of 36.
        self.rgb[45:70, 20:50] = [52, 24, 29]
        result = opaque_cutout(self.rgb, self.background, self.excluded)
        np.testing.assert_array_equal(result[58, 35], [52, 24, 29, 255])
        self.assertEqual(result[75, 35, 3], 0)

    def test_real_negative_space_is_not_filled(self):
        self.rgb[10:70, 10:70] = [180, 110, 70]
        self.rgb[25:50, 25:50] = self.background
        result = opaque_cutout(self.rgb, self.background, self.excluded)
        self.assertEqual(result[35, 35, 3], 0)
        self.assertEqual(result[18, 18, 3], 255)
        self.assertTrue(np.any((result[..., 3] > 0) & (result[..., 3] < 255)))

    def test_boundary_uses_art_color_instead_of_backdrop(self):
        self.rgb[20:60, 20:60] = [220, 140, 90]
        result = opaque_cutout(self.rgb, self.background, self.excluded)
        edges = (result[..., 3] > 0) & (result[..., 3] < 255)
        self.assertTrue(edges.any())
        np.testing.assert_array_equal(result[edges, :3], np.tile([220, 140, 90], (edges.sum(), 1)))

    def test_connected_navy_backdrop_residue_is_rejected(self):
        self.rgb[15:65, 25:65] = [220, 140, 90]
        # Both specks join the main silhouette, so keeping its largest component alone fails.
        self.rgb[25:38, 8:25] = [48, 60, 75]
        self.rgb[44:57, 12:25] = [58, 70, 85]
        result = opaque_cutout(self.rgb, self.background, self.excluded)
        self.assertEqual(result[30, 16, 3], 0)
        self.assertEqual(result[50, 18, 3], 0)
        self.assertEqual(result[35, 40, 3], 255)

    def test_contour_rejects_one_pixel_burrs_before_antialiasing(self):
        self.rgb[15:65, 25:65] = [220, 140, 90]
        self.rgb[30, 21:25] = [220, 140, 90]
        result = opaque_cutout(self.rgb, self.background, self.excluded)
        self.assertEqual(result[30, 22, 3], 0)
        self.assertLess(abs(int(result[30, 24, 3]) - int(result[38, 24, 3])), 15)

    def test_steam_recovers_partial_coverage_without_dark_rgb(self):
        white = np.array([241, 247, 249])
        self.rgb[20:60, 20:60] = np.round(.2 * white + .8 * self.background)
        result = neutral_vapor(self.rgb, self.background, np.ones((80, 80), bool))
        np.testing.assert_array_equal(result[35, 35, :3], white)
        self.assertTrue(38 < result[35, 35, 3] < 46)
        self.assertEqual(result[5, 5, 3], 0)

    def test_vapor_cannot_leak_into_the_opaque_artwork(self):
        self.rgb[20:60, 20:60] = [100, 110, 120]
        domain = np.ones((80, 80), bool); domain[30:50, 30:50] = False
        result = neutral_vapor(self.rgb, self.background, domain)
        self.assertEqual(result[40, 40, 3], 0)
        self.assertGreater(result[25, 25, 3], 0)

    def test_resizing_faint_steam_does_not_quantize_its_color_to_dark_bands(self):
        frame = np.zeros((30, 30, 4), dtype=np.float32)
        color = np.array([241, 247, 249]) / 255
        frame[5:25, 5:25, 3] = .04
        frame[..., :3] = frame[..., 3:4] * color
        result = np.array(resize(frame, (17, 17)))
        visible = result[..., 3] > 4
        self.assertTrue(visible.any())
        self.assertLessEqual(np.max(np.abs(result[visible, :3].astype(int) - [241, 247, 249])), 1)


if __name__ == '__main__':
    unittest.main()
