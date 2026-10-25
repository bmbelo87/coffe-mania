import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {readPng} from '../../scripts/png.mjs';
import {build} from 'esbuild';
const root='game/public/assets/items',baseline=JSON.parse(fs.readFileSync('tools/furniture-rotations/baseline.json'));
const hash=data=>createHash('sha256').update(data).digest('hex');
const manifest=name=>JSON.parse(fs.readFileSync(`${root}/${name}/item.json`));
const inside=(p,poly)=>{let yes=false;for(let i=0,j=poly.length-2;i<poly.length;j=i,i+=2){const x=poly[i],y=poly[i+1],u=poly[j],v=poly[j+1];if((y>p.y)!==(v>p.y)&&p.x<(u-x)*(p.y-y)/(v-y)+x)yes=!yes;}return yes;};

test('identities, purchases and original modal previews survive the art replacement',()=>{
 for(const old of baseline.items){const now=manifest(old.classname);for(const [key,value]of Object.entries(old))assert.equal(now[key],value);}
 for(const stage of baseline.machines)assert.equal(hash(fs.readFileSync(stage.previewFile)),stage.previewSha256);
});

test('all seven machine stages have four complete poses with exact mirrored pixels and registrations',()=>{
 let count=0;
 for(const kind of ['coffee_machine','juice_machine']){
  const stages=JSON.parse(fs.readFileSync(`${root}/${kind}/stages/catalog.json`)).stages;
  assert.equal(stages.length,kind==='coffee_machine'?3:4);assert.deepEqual(manifest(kind).parts.map(p=>p.rotation),[0,1,2,3]);
  for(const stage of stages){
   assert.deepEqual(stage.poses.map(p=>p.rotation),[0,1,2,3]);
   const images=stage.poses.map(p=>readPng(`${root}/${kind}/stages/${p.frame.file}`));
   const old=baseline.machines.find(s=>s.classname===kind&&s.stage===stage.stage);assert.equal(hash(images[0].data),old.frontRGBAsha256);
   for(let i=0;i<4;i++)assert.deepEqual([images[i].width,images[i].height],[stage.poses[i].frame.width,stage.poses[i].frame.height]);
   for(const [a,b] of [[0,1],[2,3]]){
    assert.equal(images[a].width,images[b].width);assert.equal(images[a].height,images[b].height);
    const A=stage.poses[a].frame,B=stage.poses[b].frame;
    assert.equal(A.left+B.left+images[a].width,0);assert.equal(A.top,B.top);
    for(let y=0;y<images[a].height;y++)for(let x=0;x<images[a].width;x++){
     const i=(y*images[a].width+x)*4,j=(y*images[a].width+images[a].width-1-x)*4;
     assert.deepEqual(images[a].data.subarray(i,i+4),images[b].data.subarray(j,j+4));
    }
   }
   assert.notEqual(hash(images[0].data),hash(images[2].data),'rear must not be a serving-front copy');count++;
  }
 }
 assert.equal(count,7);
});

test('chair hip contacts mirror with their sprites and foreground stencils exclude the front seat',()=>{
 for(const name of ['pink_square_chair','acervo_chair_yellow_black']){
  const m=manifest(name);assert.deepEqual(m.parts.map(p=>p.rotation),[0,1,2,3]);assert.deepEqual(m.seatingAnchors.map(p=>p.rotation),[0,1,2,3]);
  for(const [a,b]of [[0,1],[2,3]]){assert.equal(m.seatingAnchors[a].x,-m.seatingAnchors[b].x);assert.equal(m.seatingAnchors[a].y,m.seatingAnchors[b].y);}
  for(const part of m.parts){
   const seat=m.seatingAnchors[part.rotation],local={x:seat.x-part.left,y:seat.y-part.top};
   assert.ok(local.x>=0&&local.x<=part.width&&local.y>=0&&local.y<=part.height);
   const mask=m.seatingBackrests.find(mask=>mask.rotation===part.rotation);
   const occludes=mask?.polygons.some(poly=>inside(local,poly))??false;
   assert.equal(occludes,part.rotation>=2,`${name}, R${part.rotation}: seat or rear mask is misplaced`);
   for(const poly of mask?.polygons??[])for(let i=0;i<poly.length;i++)assert.ok(poly[i]>=0&&poly[i]<=(i%2?part.height:part.width));
  }
 }
});

test('machine facing selection is independent of evolution stage',async()=>{
 const compiled=await build({stdin:{contents:"export {machinePoseFor} from './game/src/game/machine-poses';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,external:['pixi.js']});
 const code=compiled.outputFiles[0].text.replaceAll('"pixi.js"',JSON.stringify(import.meta.resolve('pixi.js')));
 const {machinePoseFor}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 for(let stage=1;stage<=4;stage++){const art={poses:[0,1,2,3].map(rotation=>({rotation,stage}))};for(let r=0;r<4;r++)assert.deepEqual(machinePoseFor(art,r),{rotation:r,stage});}
});

test('yellow armchair opening follows the occupied actor direction instead of its mirror',()=>{
 const m=manifest('acervo_chair_yellow_black'),views=m.source.seatingCalibration.views;
 const facing=[[80,40],[-80,40],[-80,-40],[80,-40]];
 for(const part of m.parts){
  const authored=Object.entries(views).find(([name])=>part.file===`${name}-v2.png`)?.[1];
  assert.ok(authored?.opening,'source landmarks are required to verify facing independently of the rotation label');
  const [[ax,ay],[bx,by]]=authored.opening;
  const direction=[(bx-ax)*(part.flipX?-1:1),by-ay];
  const dots=facing.map(([x,y])=>x*direction[0]+y*direction[1]);
  assert.equal(dots.indexOf(Math.max(...dots)),part.rotation,`R${part.rotation}: artwork opens opposite the actor`);
 }
});
