"""Recompose the existing native Road vector; no invented illustrated shapes.

The two road axes share a pavement bisector at world y=-470. Their asphalt
is a union, while curb decoration belongs to only one side of that bisector.
Remove whole native dash subpaths around the junction, never clipped fragments.
"""
import copy, re, xml.etree.ElementTree as E
from pathlib import Path
NS='http://www.w3.org/2000/svg'
E.register_namespace('',NS)
r=E.parse(str(Path(__file__).parent / 'source/Road.svg')).getroot()
shape=copy.deepcopy(next(x for x in r.iter() if x.get('id')=='shape0'))
for child in list(shape):
    if child.get('fill')=='#a2c957': shape.remove(child)
asphalt=next(x for x in shape if x.get('fill')=='#888885')
def element(tag, attrs={}, parent=None):
    el=E.Element('{'+NS+'}'+tag,attrs)
    if parent is not None: parent.append(el)
    return el
out=element('svg',{'width':'1990','height':'2200','viewBox':'-340 -1400 1990 2200'})
defs=element('defs',parent=out)
for name,transform in [('main','scale(2)'),('branch','scale(-2 2)')]:
    g=element('g',{'id':name+'-asphalt','transform':transform},defs)
    g.append(copy.deepcopy(asphalt))
right=element('clipPath',{'id':'right','clipPathUnits':'userSpaceOnUse'},defs)
element('rect',{'x':'0','y':'-5000','width':'6000','height':'10000'},right)
for name,other in [('main','branch'),('branch','main')]:
    mask=element('mask',{'id':name+'-decoration','x':'-5000','y':'-5000','width':'10000','height':'10000','maskUnits':'userSpaceOnUse'},defs)
    element('rect',{'x':'-5000','y':'-5000' if name=='main' else '-470','width':'10000','height':'4530' if name=='main' else '5470','fill':'white'},mask)
    if name=='main': element('rect',{'x':'-5000','y':'-5000','width':'5000','height':'10000','fill':'white'},mask)
element('rect',{'x':'-5000','y':'-5000','width':'10000','height':'10000','fill':'#a2c957'},out)
for name,transform in [('main','scale(2)'),('branch','scale(-2 2)')]:
    outer=element('g',{'clip-path':'url(#right)'} if name=='branch' else {},out)
    masked=element('g',{'mask':'url(#'+name+'-decoration)'},outer)
    bg=element('g',{'transform':transform},masked);bg.append(copy.deepcopy(shape[0]))
element('use',{'href':'#main-asphalt'},out)
element('use',{'href':'#branch-asphalt','clip-path':'url(#right)'},out)
for name,transform in [('main','scale(2)'),('branch','scale(-2 2)')]:
    clip=element('g',{'clip-path':'url(#right)'} if name=='branch' else {},out)
    masked=element('g',{'mask':'url(#'+name+'-decoration)'},clip)
    g=element('g',{'transform':transform},masked)
    for child in shape:
        if child.get('fill') in ['#888885','#6e6d6b']:continue
        child=copy.deepcopy(child)
        if child.get('fill')=='#d0d0d0':
            kept=[]
            for part in re.findall(r'M[^M]*',child.get('d')):
                nums=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',part)))
                xs=[x*2*(-1 if name=='branch' else 1) for x in nums[0::2]]
                if max(xs)<-340 or min(xs)>1000:kept.append(part)
            child.set('d',' '.join(kept))
        g.append(child)
E.ElementTree(out).write(str(Path(__file__).parent / 'junction.svg'),encoding='utf-8',xml_declaration=True)
