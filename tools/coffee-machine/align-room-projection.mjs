// Correct the lower housing's support plane, leaving the brew head, cup and controls at identity.
import fs from 'node:fs';
import {readPng,writePng} from '../../scripts/png.mjs';
import '../asset-positioner/fit-geometry.js';
const dir='game/public/assets/items/coffee_machine/stages';
const definitions=[
 {stage:1,left:{x:17.024590163934427,y:554.5759839218161},front:{x:245.5413505730836,y:693.9687922785674},right:{x:495.93859649122805,y:572.4858785677528},shelfFront:548,protectedCup:{x:220,y:345,width:170,height:128}},
 // Rounded feet are excluded: these points describe the housing, not its alpha bounding box.
 {stage:2,left:{x:14,y:544},front:{x:237,y:668},right:{x:474,y:555},shelfFront:523,protectedCup:{x:120,y:315,width:265,height:115}},
 // This support plane is inferred from the rounded shell; it is not a claim of straight outline edges.
 {stage:3,left:{x:14.016129032258064,y:685.3323045687504},front:{x:212.34404344196273,y:765.1269080304035},right:{x:497.856783919598,y:666.264196269553},shelfFront:710,protectedCup:{x:225,y:475,width:120,height:130},roundedSupport:true},
];
const report=[];
for(const spec of definitions){
 const original=readPng(`${dir}/stage-${spec.stage}-room-source.png`);
 const {left:L,front:F,right:R}=spec;
 const base=x=>x<F.x?L.y+(F.y-L.y)*(x-L.x)/(F.x-L.x):F.y+(R.y-F.y)*(x-F.x)/(R.x-F.x);
 const pivot=x=>spec.shelfFront-Math.abs(x-F.x)*.5;
 const delta=x=>F.y-Math.abs(x-F.x)*.5-base(x);
 const inverse=({x,y})=>{
  const u=Math.max(L.x,Math.min(R.x,x)),p=pivot(u);
  return {x,y:y<=p?y:p+(y-p)/(1+delta(u)/(base(u)-p))};
 };
 const mapped=AssetFitGeometry.renderMapped(original.data,original.width,original.height,{
  bounds:{minX:0,minY:0,maxX:original.width,maxY:original.height},inverse,
 });
 // The unaffected region is copied byte-for-byte; resampling cannot soften cups or upper controls.
 for(let y=0;y<original.height;y++)for(let x=0;x<original.width;x++)if(y+1<=pivot(Math.max(L.x,Math.min(R.x,x)))){
  const i=(y*original.width+x)*4;mapped.data.set(original.data.subarray(i,i+4),i);
 }
 const file=`stage-${spec.stage}-room-aligned.png`;writePng(`${dir}/${file}`,mapped);
 const before=[Math.atan((F.y-L.y)/(F.x-L.x)),Math.atan((F.y-R.y)/(R.x-F.x))].map(a=>a*180/Math.PI);
 report.push({stage:spec.stage,file,method:'Lower housing plane rectification with the Asset Studio premultiplied-alpha sampler. X is unchanged; vertical edges remain vertical; upper illustration is copied unchanged.',
  beforeDegrees:before,afterDegrees:[Math.atan(.5)*180/Math.PI,Math.atan(.5)*180/Math.PI],
  controls:spec,sourceSize:[original.width,original.height],resultSize:[mapped.width,mapped.height],
  targetCorners:[L,F,R].map(p=>({x:p.x,y:F.y-Math.abs(p.x-F.x)*.5}))});
 console.log(`stage ${spec.stage}: ${before.map(a=>a.toFixed(2)).join('/')} -> 26.565/26.565; cup and controls preserved`);
}
fs.writeFileSync('tools/coffee-machine/room-projection.json',JSON.stringify(report,null,2)+'\n');
