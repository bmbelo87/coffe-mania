// Correct only the generated lower support; the upper panels and signage keep their authored pixels.
import fs from 'node:fs';
import {readPng,writePng} from '../../scripts/png.mjs';
import '../asset-positioner/fit-geometry.js';
const F=globalThis.AssetFitGeometry,reports=[];
for(const kind of ['coffee_machine','juice_machine']){
 const dir=`game/public/assets/items/${kind}`,catalog=JSON.parse(fs.readFileSync(`${dir}/stages/catalog.json`));
 for(const stage of catalog.stages){
  const pose=stage.poses[2],file=`${dir}/stages/${pose.frame.file}`,image=readPng(file);
  const points=F.detect(F.alphaChannel(image.data,image.width,image.height),image.width,image.height),base=points.base;
  if(!base){reports.push({kind,stage:stage.stage,skipped:'No reliable support V; no invented square outline.'});continue;}
  const {left:L,front:A,right:R}=base,shelf=A.y-image.height*.20;
  const line=x=>x<A.x?L.y+(A.y-L.y)*(x-L.x)/(A.x-L.x):A.y+(R.y-A.y)*(x-A.x)/(R.x-A.x);
  const pivot=x=>shelf-Math.abs(x-A.x)*.5;
  const delta=x=>A.y-Math.abs(x-A.x)*.5-line(x);
  const inverse=({x,y})=>{const u=Math.max(L.x,Math.min(R.x,x)),p=pivot(u);return{x,y:y<=p?y:p+(y-p)/(1+delta(u)/(line(u)-p))};};
  const output=F.renderMapped(image.data,image.width,image.height,{bounds:{minX:0,minY:0,maxX:image.width,maxY:image.height},inverse});
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(y+1<=pivot(Math.max(L.x,Math.min(R.x,x)))){const i=(y*image.width+x)*4;output.data.set(image.data.subarray(i,i+4),i);}
  writePng(file,output);
  const mirrored=new Uint8ClampedArray(output.data.length);for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const i=(y*image.width+x)*4;mirrored.set(output.data.subarray(i,i+4),(y*image.width+image.width-x-1)*4);}
  writePng(`${dir}/stages/${stage.poses[3].frame.file}`,{...output,data:mirrored});
  if(stage.stage===1)for(const r of [2,3])fs.copyFileSync(`${dir}/stages/${stage.poses[r].frame.file}`,`${dir}/rotation-${r}.png`);
  reports.push({kind,stage:stage.stage,controlBase:base,afterDegrees:[F.TILE_ANGLE,F.TILE_ANGLE],method:'Lower support only; X and upper artwork unchanged. Rounded feet remain curves.'});
 }
}
fs.writeFileSync('tools/furniture-rotations/back-support.json',JSON.stringify(reports,null,2)+'\n');
console.log('Lower rear supports aligned with the shared Asset Studio sampler.');
