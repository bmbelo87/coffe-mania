"""Place generated raster parts in the existing 160x80 world; masks are geometry only."""
import json
from math import sqrt
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
DEST = ROOT / 'game/public/assets/scenery/coast-city'
PREFIX = '../scenery/coast-city/'
parts = []
# Authored at the inner floor edge; wallContact makes the renderer subtract the
# live wall thickness from the entire scenery, preserving every modular seam.
WALL_EDGE = 80
WALK_DEPTH = 160
NEAR_WALK = WALL_EDGE - WALK_DEPTH
ROAD_FAR = NEAR_WALK - 320
FAR_WALK = ROAD_FAR - WALK_DEPTH

def part(name, file, left, top, width, height, **extra):
    item = dict(id=name, file=PREFIX + file, left=left, top=top, width=width, height=height, **extra)
    parts.append(item)
    return item

def plane(name, texture, clip=None, scale=(1, 1)):
    return part(name, 'terrain/' + texture + '.png', -8000, -8000, 16000, 16000,
                repeat=dict(x=scale[0], y=scale[1]), **({'clip':clip} if clip else {}))

# Follow the generated band alpha, not a second approximate coastline that could
# expose a slit between sand and sea. Mirrored export makes the profile periodic.
foam = Image.open(DEST / 'terrain/shoreline.png').convert('RGBA')
alpha = foam.getchannel('A')
profile = []
for x in range(foam.width):
    weights = [alpha.getpixel((x, y)) for y in range(foam.height)]
    profile.append(sum(y*w for y,w in enumerate(weights))/max(1,sum(weights)))
coast = []
wet_edge = []
for local_x in range(0, 16001, 32):
    x = local_x - 8000
    offset = profile[int(local_x/4) % foam.width] - foam.height/2
    coast.extend([x + 8000, -.5*x - 500 + offset + 8000])
    wet_edge.extend([local_x, offset + 32])

plane('lawn', 'grass', scale=(4,4))
reversed_coast = [n for i in range(len(coast)-2,-1,-2) for n in coast[i:i+2]]
sea = plane('sea', 'water', clip=[0,0,16000,0] + reversed_coast, scale=(1.2,1.2))
# Rotate UVs parallel to the coast (slope -1/2), without scaling the waves
# or changing the repeat density, raster, shoreline mask or world geometry.
sea['textureMatrix'] = [2/sqrt(5), -1/sqrt(5), 1/sqrt(5), 2/sqrt(5)]
plane('sand', 'sand', clip=coast + [16000, -.5*8000+NEAR_WALK+8000, 0, -.5*-8000+NEAR_WALK+8000])
# Same sampled coastline as the sand/sea split; only the sand side is shaded.
# The generated alpha softens the lower edge, below the separate white foam.
part('wet-sand', 'terrain/wet-sand.png', -8000, 4000-500-32, 16000, 96,
     repeat=dict(x=4,y=1), matrix=[1,-.5,0,1], clip=wet_edge+[16000,96,0,96])
part('foam', 'terrain/shoreline.png', -8000, 4000-500-32, 16000, 64, repeat=dict(x=4,y=1), matrix=[1,-.5,0,1])

def strip(name, texture, c, height, slope, minimum_s, scale=(1,1)):
    # For the NE road, s = x+yLocal+c and x begins at -8000.
    clip = None
    if minimum_s is not None:
        edge_top = 8000 + minimum_s - c
        edge_bottom = edge_top-height
        clip=[edge_top,0,16000,0,16000,height,edge_bottom,height]
    return part(name,'terrain/'+texture+'.png',-8000,slope*-8000+c,16000,height,
                matrix=[1,slope,0,1],repeat=dict(x=scale[0],y=scale[1]),**({'clip':clip} if clip else {}))

# wallGeometry's inner ground edges are s/v=80, including every door opening.
# Cover that shared boundary rather than inferring it from a wallpaper PNG.
def walkway(name, c, height, slope, minimum_s):
    p = strip(name,'sidewalk',c,height,slope,minimum_s)
    p['textureMatrix']=[1,-slope,0,1]
    return p

# Curb rasters come from build_curbs.py (profiles measured on the original video, 2x textures).
CURB_TOP_RISER = 27   # far curb: top and lit lip over the sidewalk
CURB_FAR_HEIGHT = 59  # plus riser and foot line over the asphalt
CURB_NEAR_HEIGHT = 30
CURB_BEACH_HEIGHT = 28
walkway('coast-walkway',NEAR_WALK,WALK_DEPTH,-.5,None)
walkway('far-walkway',FAR_WALK,WALK_DEPTH,.5,NEAR_WALK)
# The sand-side edge shows the block tops with a dark seam, never a vertical face into grass.
# Drawn over the far sidewalk so the band runs to the street corner; the road covers the rest.
coast_top = strip('coast-curb-top','curb-top-beach',NEAR_WALK,CURB_BEACH_HEIGHT,-.5,None,scale=(.5,.5))
coast_top['matrix']=[1,-.5,1,.5]
coast_top['clip']=[0,0,16000,0,16000,CURB_BEACH_HEIGHT,0,CURB_BEACH_HEIGHT]
start = strip('city-road-start','road-start',ROAD_FAR,320,.5,NEAR_WALK)
start['clip']=[8320,0,8470,0,8150,320,8000,320]
road_start = NEAR_WALK + 150
strip('city-road','road',ROAD_FAR,320,.5,road_start)
walkway('cafe-walkway',NEAR_WALK,WALK_DEPTH,.5,0)
far_curb = strip('far-curb','curb',ROAD_FAR-CURB_TOP_RISER,CURB_FAR_HEIGHT,.5,NEAR_WALK,scale=(.5,.5))
# At the road end the top turns the corner along the beach edge and the riser ends in a
# vertical cut, as in the video; the sand overlay below meets the foot of that cut.
far_end = 8000 + NEAR_WALK - (ROAD_FAR - CURB_TOP_RISER)
far_curb['clip'] = [far_end,0,16000,0,16000,CURB_FAR_HEIGHT,far_end-CURB_TOP_RISER,CURB_FAR_HEIGHT,
                    far_end-CURB_TOP_RISER,CURB_TOP_RISER]
# Foot of that cut in world px: origin of the measurements at the road end (A along the
# road, B across it, in units of the floor axes (2,1) and (-2,1)).
END_FOOT = (-8000 + far_end - CURB_TOP_RISER, -4000 + ROAD_FAR - CURB_TOP_RISER + .5*(far_end - CURB_TOP_RISER) + CURB_FAR_HEIGHT)
def from_foot(a, b):
    return END_FOOT[0] + 2*a - 2*b, END_FOOT[1] + a + b
# This street edge faces away from the camera: the sidewalk occludes its riser.
near_top=strip('near-curb-top','curb-top',NEAR_WALK,CURB_NEAR_HEIGHT,.5,NEAR_WALK,scale=(.5,.5))
near_top['matrix']=[1,.5,-1,.5]
near_top['clip']=[8000,0,16000,0,16000,CURB_NEAR_HEIGHT,8000,CURB_NEAR_HEIGHT]
# Road paint uses BOTH floor axes, so its ends remain straight across the lane. The video
# puts the center line at 49.4% of the visible asphalt; dashes 38.2 long every 67.5, the
# first one centered 88.1 px along the road from the foot of the curb cut (the crosswalk
# takes the place of the one before it).
DASH_PERIOD = 135  # local units along the strip (2 per world px along the road)
paint_c = ROAD_FAR + 166
dash = from_foot(88.1 - 38.2/2, (paint_c + 8.5 - ROAD_FAR - CURB_FAR_HEIGHT + CURB_TOP_RISER)/2)
dash_lx = dash[1] + 4000 - paint_c + .5*(dash[0] + 8000)
shift = dash_lx % DASH_PERIOD
part('road-markings','terrain/road-marking.png',round(-8000+shift,2),round(-4000+paint_c+shift/2,2),16000,17,
     matrix=[1,.5,-1,.5],repeat=dict(x=1,y=1),sampling='direct',
     clip=[round(dash_lx-shift,2),0,16000,0,16000,17,round(dash_lx-shift,2),17])
# Four blocks measured from the foot of the curb cut (build_curbs.CROSS_*); the part
# starts 25.3 px along the road from it.
cross_x, cross_y = from_foot(25.3, 0)
part('crossing','terrain/crosswalk.png',round(cross_x,2),round(cross_y,2),270,60,matrix=[-1,.5,1,.5],sampling='direct')
# The sand runs onto the road end in a slow S (video 1:58): A(B) along the road, measured
# every 6 px across it from the foot of the curb cut; the last points follow the trend
# under the cafe wall. Same tiling as the 'sand' plane, so the texture stays continuous.
WAVE = [(0,0),(6,2.4),(12,5.6),(18,6.6),(24,8.1),(30,8.8),(36,10.1),(42,10.6),(48,11.5),
        (54,10.8),(60,10.4),(66,9.4),(72,7.7),(78,6.8),(84,6.6),(90,6.6),(96,6.6),(102,7.9),
        (108,8.2),(114,9.1),(120,10.3),(126,11.4),(132,11.7),(138,12),(144,12.2),(150,12.4)]
def smooth_wave(step=2, sigma=6):
    # The video edge is anti-aliased; a light Gaussian over the 6 px samples removes the
    # measurement jitter so the stencil edge does not zigzag.
    from math import exp
    out = []
    b = 0
    while b <= WAVE[-1][0]:
        weights = [(exp(-((bb - b) / sigma) ** 2 / 2), aa) for bb, aa in WAVE]
        total = sum(w for w, _ in weights)
        a = sum(w * aa for w, aa in weights) / total if b > 0 else 0
        out.append((a, b))
        b += step
    return out
wave = [from_foot(-CURB_TOP_RISER/2 - 4, -CURB_TOP_RISER/2 - 4)]
wave += [from_foot(a, b) for a, b in smooth_wave()]
wave.append(from_foot(-30, 150))
wave.append(from_foot(-30, -CURB_TOP_RISER/2 - 4))
plane('road-end-sand','sand',clip=[round(n + 8000, 2) for point in wave for n in point])

def prop(name, x, y, width, anchor=(.5,.94), suffix=''):
    image=Image.open(DEST/'props'/f'{name}.png')
    height=width*image.height/image.width
    return part(name+suffix,f'props/{name}.png',round(x-width*anchor[0],2),round(y-height*anchor[1],2),width,round(height,2))

# Foot points keep the urban shore parallel to the cafe's left wall. These are
# decorative world positions, never new navigation tiles or owned furniture.
prop('rock-palm',-1650,575,270,suffix='-west')
prop('umbrella-orange',-1300,350,230,anchor=(.42,.85),suffix='-west')
shadow = part('pier-shadow','props/pier-shadow.png',0,0,700,420)
prop('boat',-915,-320,300,anchor=(.5,.75))
# Static parts use painter order: the pier rail must occlude the moored hull.
pier = prop('pier',-900,-40,580,anchor=(.91,.91))
# Calibrate the existing shadow's six footprint corners to the pier's support
# plane, not its transparent bounds or the elevated deck. Keep this registration
# relative to the pier so moving/scaling it cannot detach the shadow again.
pier_scale = pier['width'] / Image.open(DEST/'props/pier.png').width
shadow.update(left=round(pier['left'] + 2.179761436*pier_scale,6),
              top=round(pier['top'] + 268.005282131*pier_scale,6),
              matrix=[round(v*pier_scale,9) for v in
                      (1.012752741, .026247217, -.018411051, 1.109612120)])
steps=prop('pier-steps',0,0,220,anchor=(0,0))
steps['left'],steps['top']=-992,-80
part('pier-arch','props/pier-arch.png',-1000,-308,150,300)
prop('lifebuoy',-400,-65,85)
prop('umbrella-folded',-310,-120,75,anchor=(.3,.94))
prop('beach-chair',-430,45,105,suffix='-a')
prop('beach-chair',-245,-30,105,suffix='-b')
prop('umbrella-green',-120,-210,230,anchor=(.42,.85))
prop('rock-palm',185,-390,250,suffix='-east')
prop('umbrella-orange',460,-510,230,anchor=(.42,.85),suffix='-east')
prop('surfboards',850,-680,175)
for i,(x,y) in enumerate([(850,-240),(1220,-100),(1730,130),(2230,380),(2730,620),(3230,870)]):
    prop('tree-round',x,y,250,suffix=f'-{i}')
for i,(x,y) in enumerate([(1180,-440),(1510,-290),(2010,-50),(2510,200),(3010,440)]):
    prop('tree-conifer',x,y,175,suffix=f'-{i}')

scene=dict(id='coast-city',source='Image Gen reconstructions from original Cafe Mania urban-coast references; tools/scenery/coast-city/source.json',
           file=PREFIX+'terrain/grass.png',left=-3200,top=-1630,width=6400,height=3600,
           groundColor=0x80a514,wallContact='outer',horizontalCover=dict(left=-4028,right=4000),tiles=parts,sources=[],
           scope='Static urban background only; no beach branch, travel, new walkable tiles or missions.')
(DEST/'scene.json').write_text(json.dumps(scene,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'{len(parts)} independently positioned scene parts; {len(set(x["file"] for x in parts))} PNGs.')
