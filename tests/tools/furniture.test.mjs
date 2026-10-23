import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readPng } from '../../scripts/png.mjs';
import '../../tools/asset-positioner/fit-geometry.js';
import '../../tools/asset-positioner/furniture-geometry.js';

const G = globalThis.CafeFurnitureGeometry, F = globalThis.AssetFitGeometry;
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('Planos usam 2:1 e a altura muda somente Y, conservando a origem do tile',()=>{
  for(const width of [.48,.76,1]) {
    const floor=G.plane(width),top=G.plane(width,49.2);
    for(let i=0;i<4;i++) { near(floor[i].x,top[i].x);near(floor[i].y-top[i].y,49.2);
      const next=(i+1)%4;near(Math.abs((top[next].y-top[i].y)/(top[next].x-top[i].x)),.5); }
    near(top.reduce((s,p)=>s+p.x,0)/4,0);near(top.reduce((s,p)=>s+p.y,0)/4,40-49.2);
  }
});
test('Quatro rotações mantêm o assento, pés no chão e frames que abrangem todas as faces',()=>{
  for(const kind of ['table','chair'])for(let rotation=0;rotation<4;rotation++) {
    const model=G.model({kind,rotation});
    for(const face of model.faces)for(const p of face.points) {
      assert.ok(p.x>=model.frame.left && p.x<model.frame.left+model.frame.width);
      assert.ok(p.y>=model.frame.top && p.y<model.frame.top+model.frame.height);
    }
    near(model.guide.center.y,40-(kind==='table'?49.2:32));
  }
  near(G.rotate(.2,.3,4)[0],.2);near(G.rotate(.2,.3,4)[1],.3);
});
test('Calibração usa cantos assimétricos para fixar largura, ângulo e altura, preservando verticais',()=>{
  const points={left:{x:4,y:72},back:{x:130,y:9},right:{x:257,y:74},foot:{x:133,y:180}};
  const t=G.calibrate(points,{width:1,height:49.2,support:.76});
  const [back,right,,left]=G.plane(1,49.2);
  for(const [source,target] of [[points.left,left],[points.back,back],[points.right,right]]) {
    const p=F.map(t,source);near(p.x,target.x);near(p.y,target.y);
  }
  near(F.map(t,points.foot).y,G.plane(.76)[2].y);
  near(F.map(t,{x:80,y:100}).x,F.map(t,{x:80,y:200}).x);
  assert.ok(t.c>0);
});
test('A correção e o recorte conservam alpha zero; não criam fundo opaco',()=>{
  const data=new Uint8ClampedArray(16*16*4);
  for(let y=4;y<12;y++)for(let x=4;x<12;x++)data.set([190,110,60,255],(y*16+x)*4);
  const r=F.render(data,16,16,F.rectTransform(-8,-8,1.3));
  assert.equal(r.data[3],0); assert.ok(F.alphaBox(r.data,r.width,r.height));
  assert.ok(r.data.some((value,i)=>i%4===3 && value>0 && value<255));
});
test('Medidas incoerentes e pontos invertidos são recusados antes de reamostrar',()=>{
  assert.throws(()=>G.model({thickness:40})); assert.throws(()=>G.model({rotation:4}));
  assert.throws(()=>G.model({legInset:.01}));assert.throws(()=>G.calibrate({}));
  assert.throws(()=>G.calibrate({left:{x:10,y:0},back:{x:5,y:0},right:{x:2,y:0},foot:{x:5,y:20}}));
});

test('Tampo e base calibrados separadamente conservam 26,565° em ambos os planos',()=>{
  for(const classname of ['original_glass_table','original_striped_table']) {
    const item=JSON.parse(fs.readFileSync(new URL(`../../game/public/assets/items/${classname}/item.json`,import.meta.url),'utf8'));
    const c=item.source.calibration,points=c.points;
    const mapping=G.calibratePlanes(points,{width:c.surface,height:c.topHeight,support:c.support});
    for(const [a,b] of [[points.left,points.back],[points.back,points.right],[points.groundLeft,points.foot],[points.foot,points.groundRight]]) {
      const ma=mapping.map(a),mb=mapping.map(b);near(Math.abs((mb.y-ma.y)/(mb.x-ma.x)),.5);
    }
    near(mapping.map(points.back).y,40-40*c.surface-c.topHeight);
    near(mapping.map(points.foot).y,mapping.foot.y);
    for(const x of [0,35,130,228,262]) for(const y of [0,65,130,170,210]) {
      const mapped=mapping.map({x,y}),original=mapping.inverse(mapped);
      near(original.x,x);near(original.y,y);
      near(mapping.map({x,y:y+1}).x,mapped.x);
    }
    const front={x:points.left.x+points.right.x-points.back.x,y:points.left.y+points.right.y-points.back.y};
    const below=mapping.map({x:front.x,y:front.y+1e-7}),above=mapping.map({x:front.x,y:front.y-1e-7});
    assert.ok(Math.abs(below.y-above.y)<1e-6);
  }
});

test('Balcão e fogão preservam IDs, mas usam as categorias funcionais corretas',()=>{
  for(const [classname,id,kind] of [['original_striped_table',9030103,'counter'],['original_barbecue',9090103,'stove']]) {
    const item=JSON.parse(fs.readFileSync(new URL(`../../game/public/assets/items/${classname}/item.json`,import.meta.url),'utf8'));
    assert.equal(item.id,id);assert.equal(item.kind,kind);
    const png=readPng(new URL(`../../game/public/assets/items/${classname}/rotation-0.png`,import.meta.url));
    assert.equal(png.width,item.parts[0].width);assert.equal(png.height,item.parts[0].height);
    assert.ok(png.data.some((v,i)=>i%4===3&&v===0));
  }
});

test('Fogão mantém seus pixels e sua escala; apenas o registro desce 10 px',()=>{
  const directory=new URL('../../game/public/assets/items/original_barbecue/',import.meta.url);
  const item=JSON.parse(fs.readFileSync(new URL('item.json',directory),'utf8')),part=item.parts[0];
  const source=readPng(new URL('../../tools/asset-positioner/references/originals/behance-4286853-001/03.png',import.meta.url));
  const s=160/source.width,old=F.render(source.data,source.width,source.height,F.rectTransform(-80,70-source.height*s,s));
  const box=F.alphaBox(old.data,old.width,old.height),expected=new Uint8ClampedArray(box.width*box.height*4);
  for(let y=0;y<box.height;y++)expected.set(old.data.subarray(((y+box.top)*old.width+box.left)*4,((y+box.top)*old.width+box.left+box.width)*4),y*box.width*4);
  const current=readPng(new URL(part.file,directory));
  assert.deepEqual(current.data,expected);assert.equal(part.left,old.left+box.left);assert.equal(part.top,old.top+box.top+10);
});

test('Postes da cadeira não intersectam o volume do painel em nenhuma rotação',()=>{
  for(let rotation=0;rotation<4;rotation++) {
    const model=G.model({kind:'chair',rotation}),panel=model.solids.find(s=>s.role==='back-panel');
    for(const post of model.solids.filter(s=>s.role==='back-post')) {
      const overlapU=Math.min(panel.maxU,post.maxU)-Math.max(panel.minU,post.minU);
      const overlapV=Math.min(panel.maxV,post.maxV)-Math.max(panel.minV,post.minV);
      assert.ok(overlapU<1e-8 || overlapV<1e-8,'postes e encosto não podem ocupar o mesmo volume');
    }
  }
});
