"""Show actual room cells next to their coordinates for manual occlusion review."""
import json, sys
import numpy as np
from PIL import Image, ImageDraw
import rooms

OUT = rooms.ROOT / '.runtime/surface-cleanup'
def main():
    for s in rooms.SURFACES:
        if s['classname'] not in sys.argv[1:]: continue
        room = rooms.Room(s['room'])
        m = json.loads((rooms.ITEMS/s['classname']/'item.json').read_text(encoding='utf-8'))
        tile=m['source']['measuredTile']
        w,h=150,174
        sheet=Image.new('RGB',(6*w, ((len(s['cells'])+5)//6)*h),'#dedbd4'); d=ImageDraw.Draw(sheet)
        for n,cell in enumerate(s['cells']):
            if s['kind']=='floor':
                v,u=(np.mgrid[0:144,0:144]+.5)/144
                xs,ys=room.floor_xy((cell[0]+u)*tile[0],(cell[1]+v)*tile[1])
            else:
                hs,xx=(np.mgrid[0:144,0:144]+.5)/144
                xs,ys=room.wall_xy(s['kind'], (cell+xx)*tile[0],hs)
            im=Image.fromarray(np.uint8(room.sample(xs,ys)))
            x,y=n%6*w,n//6*h
            sheet.paste(im,(x+3,y+22)); d.text((x+4,y+4),str(cell),fill='black')
        sheet.save(OUT/f"{s['classname']}-candidates.jpg",quality=96)
        print(s['classname'],len(s['cells']))

if __name__=='__main__': main()
