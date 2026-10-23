"""Place generated raster parts in the existing 160x80 world; masks are geometry only."""
import json
from math import sqrt, ceil
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

walkway('coast-walkway',NEAR_WALK,WALK_DEPTH,-.5,None)
# The sand-side edge shows the existing block tops, never a vertical face into grass.
coast_top = strip('coast-curb-top','curb',NEAR_WALK,24,-.5,None)
coast_top['matrix']=[1,-.5,1,.5]
coast_top['clip']=[0,0,16000,0,16000,5,0,5]
walkway('far-walkway',FAR_WALK,WALK_DEPTH,.5,NEAR_WALK)
start = strip('city-road-start','road-start',ROAD_FAR,320,.5,NEAR_WALK)
start['clip']=[8320,0,8470,0,8150,320,8000,320]
road_start = NEAR_WALK + 150
strip('city-road','road',ROAD_FAR,320,.5,road_start)
walkway('cafe-walkway',NEAR_WALK,WALK_DEPTH,.5,0)
strip('far-curb','curb',ROAD_FAR-6,24,.5,NEAR_WALK)
# This street edge faces away from the camera: the sidewalk occludes its riser.
near_top=strip('near-curb-top','curb',NEAR_WALK,24,.5,NEAR_WALK)
near_top['matrix']=[1,.5,-1,.5]
near_top['clip']=[8000,0,16000,0,16000,5,8000,5]
# Road paint uses BOTH floor axes, so its ends remain straight across the lane.
paint_c = ROAD_FAR + 160 - 8
paint_start = ceil((8000+road_start-paint_c)/(256*.65))*(256*.65)
part('road-markings','terrain/road-marking.png',-8000,-4000+paint_c,16000,16,
     matrix=[1,.5,-1,.5],repeat=dict(x=.65,y=1),sampling='direct',
     clip=[paint_start,0,16000,0,16000,16,paint_start,16])
part('crossing','terrain/crosswalk.png',345,ROAD_FAR+.5*345+25,270,55,matrix=[-1,.5,1,.5],sampling='direct')

def prop(name, x, y, width, anchor=(.5,.94), suffix=''):
    image=Image.open(DEST/'props'/f'{name}.png')
    height=width*image.height/image.width
    return part(name+suffix,f'props/{name}.png',round(x-width*anchor[0],2),round(y-height*anchor[1],2),width,round(height,2))

# Foot points keep the urban shore parallel to the cafe's left wall. These are
# decorative world positions, never new navigation tiles or owned furniture.
prop('rock-palm',-1650,575,270,suffix='-west')
prop('umbrella-orange',-1300,350,230,anchor=(.42,.85),suffix='-west')
part('pier-shadow','props/pier-shadow.png',-1430,-350,620,372)
prop('boat',-915,-320,300,anchor=(.5,.75))
# Static parts use painter order: the pier rail must occlude the moored hull.
prop('pier',-900,-40,580,anchor=(.91,.91))
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
