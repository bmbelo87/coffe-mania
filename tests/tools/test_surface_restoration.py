"""Targeted regressions for trusted samples and localized raster repairs."""
import sys, unittest
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import binary_erosion

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/surfaces-behance'))
import rooms

class SampleRoom:
    def floor_xy(self,u,v): return u,v
    def sample(self,u,v):
        local=np.mod(u,1)
        valid=((u<1)&(local<.5))|((u>=1)&(local>=.5))
        return np.where(valid[...,None],np.array([24,160,72]),np.array([255,0,255]))

class SurfaceRestoration(unittest.TestCase):
    def test_occluded_pixels_cannot_vote_outside_reviewed_regions(self):
        spec={'cells':[(0,0),(1,0)],'reviewRegions':[
            [[0,0],[0,0,.5,1]],[[1,0],[.5,0,1,1]]]}
        image=np.array(rooms.floor_cell(SampleRoom(),spec,(1,1)))
        # Lanczos reconstruction at the transparent silhouette can overshoot; inspect only the
        # opaque interior to distinguish that existing edge filter from foreign sample colours.
        interior=binary_erosion(image[:,:,3]==255,iterations=3)
        np.testing.assert_array_equal(image[interior,:3],np.tile([24,160,72],(int(interior.sum()),1)))

    def test_uncovered_region_fails_instead_of_exporting_a_hole(self):
        spec={'cells':[(0,0)],'reviewRegions':[[[0,0],[0,0,.5,1]]]}
        with self.assertRaisesRegex(ValueError,'sem nenhuma amostra'):
            rooms.floor_cell(SampleRoom(),spec,(1,1))

    def test_wall_right_edge_uses_only_unobstructed_height_bands(self):
        class WallRoom:
            def wall_xy(self,kind,x,h): return x,h
            def sample(self,x,h):
                clear=((x>=6)&(x<6.87))|((x>=2.87)&(x<3)&(h<=.72))|((x>=3.87)&(x<4)&(h>=.72))
                return np.where(clear[...,None],[30,150,60],[240,0,240])
        spec={'kind':'left','cells':[[6,0,1,0,.87],[2,0,.72,.87,1],[3,.72,1,.87,1]]}
        image=np.array(rooms.wall_cell(WallRoom(),spec,1))
        interior=binary_erosion(image[:,:,3]==255,iterations=3)
        np.testing.assert_array_equal(image[interior,:3],np.tile([30,150,60],(int(interior.sum()),1)))

    def test_texture_phase_centers_the_art_without_changing_silhouette(self):
        class GradientRoom:
            def floor_xy(self,u,v): return u,v
            def sample(self,u,v): return np.stack([u*200,v*200,np.full(u.shape,60)],-1)
        original=np.array(rooms.floor_cell(GradientRoom(),{'cells':[(0,0)]},(1,1)))
        shifted=np.array(rooms.floor_cell(GradientRoom(),{'cells':[(0,0)],'texturePhase':[.14,-.03125]},(1,1)))
        np.testing.assert_array_equal(original[:,:,3],shifted[:,:,3])
        np.testing.assert_allclose(shifted[41,81,:2].astype(int)-original[41,81,:2].astype(int),[28,-6.25],atol=1)

    def check_patch(self,size):
        rng=np.random.default_rng(7)
        original=rng.integers(0,256,size=(size[1],size[0],4),dtype=np.uint8)
        master=ROOT/'.runtime/surface-cleanup/test-master.png'
        master.parent.mkdir(parents=True,exist_ok=True)
        try:
            Image.new('RGB',(256,256),(210,72,30)).save(master)
            result=np.array(rooms.generated_patch(Image.fromarray(original),dict(file=str(master),rects=[[192,192,256,256]])))
        finally: master.unlink(missing_ok=True)
        np.testing.assert_array_equal(result[:,:,3],original[:,:,3])
        yy,xx=np.mgrid[:size[1],:size[0]]+.5
        if size==(162,82):
            u=np.mod(((xx-81)+2*(yy-1))/160,1); v=np.mod((-(xx-81)+2*(yy-1))/160,1)
        else: u=np.clip(xx/80,0,1); v=np.clip((yy-xx/2)/208,0,1)
        selected=(u>=.75)&(u<=1)&(v>=.75)&(v<=1)&(original[:,:,3]>0)
        self.assertTrue(selected.any())
        np.testing.assert_array_equal(result[~selected],original[~selected])
        np.testing.assert_allclose(result[selected,:3],np.tile([210,72,30],(int(selected.sum()),1)),atol=1,rtol=0)

    def test_floor_patch_preserves_all_pixels_outside_approved_area(self): self.check_patch((162,82))
    def test_wall_patch_preserves_all_pixels_outside_approved_area(self): self.check_patch((80,248))

if __name__=='__main__': unittest.main()
