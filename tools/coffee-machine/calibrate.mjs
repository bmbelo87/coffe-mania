// Registration uses uniform sampling: the footprint never reshapes a machine's illustration.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import {readPng} from '../../scripts/png.mjs';
const dir='game/public/assets/items/coffee_machine';
const previous=JSON.parse(fs.readFileSync(`${dir}/stages/catalog.json`));
const stages=[];
for(let stage=1;stage<=3;stage++){
 const file=`room-stage-${stage}.png`;
 const image=readPng(`${dir}/stages/${file}`);
 const registration=JSON.parse(fs.readFileSync(`tools/coffee-machine/generated/stage-${stage}-registration.json`));
 stages.push({...previous.stages.find(value=>value.stage===stage),stage,frame:{file,width:image.width,height:image.height,left:registration.left,top:registration.top},source:registration.source});
}
fs.writeFileSync(`${dir}/stages/catalog.json`,JSON.stringify({stages},null,2)+'\n');
const frame=stages[0].frame;
fs.copyFileSync(`${dir}/stages/${frame.file}`,`${dir}/rotation-0.png`);
const manifest=JSON.parse(fs.readFileSync(`${dir}/item.json`));
manifest.parts=[{...frame,file:'rotation-0.png'}]; manifest.itemHeight=-frame.top;
manifest.source.calibration='Carcaça inferior reprojetada em 2:1, com verticais e parte superior preservadas; tools/coffee-machine/room-projection.json. Export final em escala uniforme e apoio por estágio, sem alterar a pegada lógica 1×1.';
manifest.source.roomArt.projection='tools/coffee-machine/room-projection.json';
fs.writeFileSync(`${dir}/item.json`,JSON.stringify(manifest,null,2)+'\n');
if(previous.stages.some(value=>value.poses)){
 const result=spawnSync('python',['tools/furniture-rotations/export-machines.py'],{stdio:'inherit'});
 if(result.status!==0)throw Error('Não foi possível sincronizar as quatro rotações das máquinas.');
}
