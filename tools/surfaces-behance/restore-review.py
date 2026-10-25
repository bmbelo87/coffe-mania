"""Preview or apply the reviewed repairs; never deletes legacy PNGs or starts servers."""
import hashlib, json, sys
import numpy as np
from PIL import Image, ImageDraw
import audit, rooms

def three_sheet(out):
    sheet=Image.new('RGB',(1200,700),'#dedbd4'); d=ImageDraw.Draw(sheet)
    targets=[('behance_floor_musketeer_star','Rosa dos Ventos',True),
             ('behance_floor_paris_blue','Paris Azul: lajota inteira',True),
             ('behance_wall_games_sky','Ceu e Morros: arte aprovada',False)]
    for i,(name,label,floor) in enumerate(targets):
        im=Image.open(out/'proposed'/f'{name}.png').convert('RGBA')
        flat=audit.flat(im,floor); target=(320,320) if floor else (246,320)
        sheet.paste(flat.resize(target),(i*400+(400-target[0])//2,35)); d.text((i*400+20,12),label,fill='black')
        canvas=Image.new('RGBA',(500,330))
        if floor:
            for x in range(3):
                for y in range(3): canvas.alpha_composite(im,(168+(x-y)*80,20+(x+y)*40))
        else:
            wall=im.resize((64,198),Image.Resampling.LANCZOS)
            for n in range(4): canvas.alpha_composite(wall,(100+n*64,10+n*32))
        tile=canvas.resize((390,257),Image.Resampling.LANCZOS); sheet.paste(tile,(i*400+5,400),tile)
    sheet.save(out/'final-three.png')

def main():
    approved=json.loads((rooms.HERE/'repairs/reviewed.json').read_text())
    out=audit.OUT; (out/'proposed').mkdir(parents=True,exist_ok=True)
    chosen=[s for s in rooms.SURFACES if s['classname'] in approved]
    sheet=Image.new('RGB',(1000,((len(chosen)+1)//2)*295),'#dedbd4'); d=ImageDraw.Draw(sheet)
    repeats=Image.new('RGB',(1000,((len(chosen)+1)//2)*330),'#dedbd4'); rd=ImageDraw.Draw(repeats)
    report=[]
    for n,s in enumerate(chosen):
        folder=rooms.ITEMS/s['classname']; manifest=json.loads((folder/'item.json').read_text(encoding='utf-8'))
        backup=out/'before'/s['classname']; backup.mkdir(parents=True,exist_ok=True)
        if not (backup/'item.json').exists(): (backup/'item.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
        for part in manifest['parts']:
            if not (backup/part['file']).exists(): Image.open(folder/part['file']).save(backup/part['file'])
        room,sizes,parts=rooms.extract(s); im=parts[0]; im.save(out/'proposed'/f"{s['classname']}.png")
        flat=audit.flat(im,s['kind']=='floor'); flat.save(out/'proposed'/f"{s['classname']}-flat.png")
        old_image=Image.open(backup/manifest['parts'][0]['file']).convert('RGBA')
        old=audit.flat(old_image,s['kind']=='floor')
        x,y=n%2*500,n//2*295
        d.text((x+5,y+5),s['classname'].replace('behance_','')+' | antes / depois',fill='black')
        sheet.paste(old.resize((240,240)),(x+5,y+27)); sheet.paste(flat.resize((240,240)),(x+252,y+27))
        x,y=n%2*500,n//2*330
        rd.text((x+5,y+5),s['classname'].replace('behance_',''),fill='black')
        if s['kind']=='floor':
            for tx in range(3):
                for ty in range(3): repeats.paste(im,(x+168+(tx-ty)*80,y+30+(tx+ty)*40),im)
        else:
            wall=im.resize((60,186),Image.Resampling.LANCZOS)
            for k in range(5): repeats.paste(wall,(x+65+k*60,y+23+k*30),wall)
        assert im.size==old_image.size, s['classname']
        assert np.array_equal(np.array(im)[:,:,3],np.array(old_image)[:,:,3]),s['classname']+' alpha'
        report.append(dict(classname=s['classname'],size=im.size,alphaUnchanged=True,
            beforeSha256=hashlib.sha256(old_image.tobytes()).hexdigest(),afterSha256=hashlib.sha256(im.tobytes()).hexdigest(),
            generatedRegions=approved[s['classname']].get('generatedPatch',{}).get('rects',[])))
        if '--write' in sys.argv: rooms.write(s,room,sizes,parts)
    sheet.save(out/'comparison.jpg',quality=96); repeats.save(out/'repeated.png')
    three_sheet(out)
    (out/'report.json').write_text(json.dumps(dict(applied='--write' in sys.argv,repairs=report,portsOpened=0),ensure_ascii=False,indent=2))
    print(f"{len(report)} repairs; unchanged dimensions and alpha; applied={'--write' in sys.argv}")

if __name__=='__main__': main()
