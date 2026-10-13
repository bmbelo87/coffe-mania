import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
const root=path.resolve(import.meta.dirname,'..'),files=new Map();
const add=file=>{if(!files.has(file))files.set(file,fs.readFileSync(path.join(root,file)));};
const json=(file,data)=>files.set(file,Buffer.from(JSON.stringify(data,null,2)+'\n'));
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const batch=read('tools/acervo/moveis-lote-02.json'),chairs=read('tools/acervo/correcoes-cadeiras-lote-02.json');
const counter=read('tools/acervo/moveis.json').find(s=>s.classname==='acervo_counter_italy');
const specs=[...batch,...chairs,counter],names=[...specs.map(s=>s.classname),'original_gold_armchair'];
let sprites=0;
for(const name of names){const folder='game/public/assets/items/'+name,item=read(folder+'/item.json');add(folder+'/item.json');
 for(const file of new Set(item.parts.map(p=>p.file))){add(folder+'/'+file);sprites++;}}
for(const spec of specs){if(spec.original)add('artes-referencia/'+spec.original);
 for(const key of ['generated','backGenerated'])if(spec[key])add('tools/acervo/gerados/'+spec[key]+'.png');
 for(const key of ['crop','backCrop','surfaceCrop'])if(spec[key])add('tools/acervo/recortes/'+spec[key]+'.png');}
const cropIds=new Set(specs.flatMap(s=>[s.crop,s.backCrop,s.surfaceCrop].filter(Boolean)));
const crops=fs.readdirSync(path.join(root,'tools/acervo')).filter(f=>/^extracoes(?:-lote-\d{2})?\.json$/.test(f))
 .flatMap(f=>read('tools/acervo/'+f)).filter(c=>cropIds.has(c.id));
for(const crop of crops){add('tools/acervo/'+crop.source);add('artes-referencia/'+crop.original);}
json('tools/acervo/extracoes-lote-02.json',crops);json('tools/acervo/moveis.json',[counter]);
for(const file of ['tools/acervo/moveis-lote-02.json','tools/acervo/correcoes-cadeiras-lote-02.json','tools/acervo/gerados/lote-02/prompts.json',
 'tools/acervo/fontes/lote-02/cadeira-rosa-frente-costas.png','tools/acervo/fontes/lote-02/mesa-xadrez-verde-aprovada.png',
 'tools/acervo/fontes/lote-02/referencia-mesas-cadeiras-anexada.png','tools/acervo/recortes/chair_yellow_front.png','tools/acervo/recortes/chair_yellow_back.png',
 'tools/acervo/gerados/lote-02/table_italy_green.png','docs/acervo-moveis-lote-02.md','game/src/game/room-inventory.ts','scripts/sync-room-catalog.mjs',
 'scripts/png.mjs','scripts/import-reference-furniture.mjs','scripts/extract-reference-crops.mjs','tools/asset-positioner/fit-geometry.js','tools/asset-positioner/furniture-geometry.js'])add(file);
files.set('LEIA-ME.txt',Buffer.from('Lote 02: 8 itens, 16 PNGs ativos e 8 manifestos. Cadeira rosa rejeitada retirada do pacote.\nCopie os itens para o projeto atual, que inclui suporte a parts.flipX no carregador. O código do carregador está incluído para revisão; este pacote não é o jogo completo.\nConsulte docs/acervo-moveis-lote-02.md para fontes, geração, calibração e verificação.\nAs especificações e recortes do pacote incluem somente os móveis desta entrega.\n'));
json('manifesto-arquivos.json',{items:names,sprites,files:[...files].map(([file,bytes])=>({file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}))});
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);return n>>>0;});
const crc=bytes=>{let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const chunks=[],central=[];let offset=0;
for(const [file,bytes]of files){const name=Buffer.from(file),packed=deflateRawSync(bytes),sum=crc(bytes);
 const header=Buffer.alloc(30+name.length);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);
 header.writeUInt32LE(sum,14);header.writeUInt32LE(packed.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(name.length,26);name.copy(header,30);
 const index=Buffer.alloc(46+name.length);index.writeUInt32LE(0x02014b50);index.writeUInt16LE(20,4);index.writeUInt16LE(20,6);index.writeUInt16LE(0x800,8);index.writeUInt16LE(8,10);
 index.writeUInt32LE(sum,16);index.writeUInt32LE(packed.length,20);index.writeUInt32LE(bytes.length,24);index.writeUInt16LE(name.length,28);index.writeUInt32LE(offset,42);name.copy(index,46);
 chunks.push(header,packed);central.push(index);offset+=header.length+packed.length;
}
const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.size,8);end.writeUInt16LE(files.size,10);end.writeUInt32LE(central.reduce((n,b)=>n+b.length,0),12);end.writeUInt32LE(offset,16);
const output=path.join(root,'tools/exports/acervo-moveis-lote-02.zip');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,Buffer.concat([...chunks,...central,end]));
console.info(`${names.length} itens, ${sprites} PNGs ativos, ${files.size} arquivos; ${(fs.statSync(output).size/1048576).toFixed(2)} MiB.`);
