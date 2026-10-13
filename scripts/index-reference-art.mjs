import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve(import.meta.dirname,'..'), folder=path.join(root,'artes-referencia');
const output=path.join(root,'tools/acervo');
const read=relative=>JSON.parse(fs.readFileSync(path.join(folder,relative),'utf8'));
const hqRoot='cafe-mania-behance-alta-qualidade-documentado/cafe-mania-behance';
const blogRoot='cafe-mania-acervo-documentado/cafe-mania-acervo';
const extraRoot='cafe-mania-acervo-complementar-2/cafe-mania-acervo-2';
const hq=read(`${hqRoot}/catalogo.json`), blogs=read(`${blogRoot}/manifesto.json`), extra=read(`${extraRoot}/catalogo.json`);
const entries=[];
function add(entry) {
  const absolute=path.join(folder,entry.file);
  if(!fs.existsSync(absolute))throw Error(`Fonte ausente: ${entry.file}`);
  const sha256=crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
  const categories=[];
  const text=[entry.description,entry.title,entry.category,entry.file].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  for(const [category,pattern] of [['Fogões',/fogao|fogoes|stove/],['Balcões',/balcao|balcoes|counter/],['Mesas',/mesa|table/],['Cadeiras',/cadeira|chair/],['Interface',/interface|\bui\b|icon/]])if(pattern.test(text))categories.push(category);
  entries.push({...entry,sha256,categories,url:`../../artes-referencia/${entry.file}`,status:'referência',
    restriction:entry.project==='43063757'&&entry.order>=13?'Outro jogo — não importar':
      entry.project==='4432119'&&entry.order===1?'Ícones antigos — somente referência':''});
}
for(const a of hq.assets)add({id:`behance-${a.project}-${a.order}`,collection:'Behance HQ',project:a.project,order:a.order,
  file:`${hqRoot}/${a.file}`,width:a.width,height:a.height,alpha:a.alpha,description:a.description,title:a.title,artist:a.artist,source:a.page,originalUrl:a.url,category:hq.projects.find(p=>p.id===a.project)?.category});
for(const a of blogs.assets)add({id:`blog-${a.id}`,collection:'Blogs',file:`${blogRoot}/${a.arquivo}`,width:a.largura,height:a.altura,alpha:a.canal_alpha,
  description:a.referencias.map(r=>r.filename_hint||r.alt||'').join(' · '),title:a.referencias[0]?.title,source:a.referencias[0]?.post_url,category:a.categoria,originalUrl:a.url_baixada});
for(const a of extra.images)add({id:`extra-${a.group}-${a.order}`,collection:'Complementar',file:`${extraRoot}/${a.file}`,width:a.width,height:a.height,alpha:a.alpha,
  description:a.description,title:a.title,artist:a.artist,source:a.page,originalUrl:a.download_url,category:a.kind});
for(const file of fs.readdirSync(folder).filter(f=>f.endsWith('.webp')))add({id:file,collection:'Artboards',file,description:'Prancha de sprites fornecida pelo responsável. Categoria a confirmar visualmente.'});
const attached=path.join(folder,'anexos-usuario');
if(fs.existsSync(attached))for(const batch of fs.readdirSync(attached,{withFileTypes:true}).filter(e=>e.isDirectory()))for(const file of fs.readdirSync(path.join(attached,batch.name)).filter(f=>f.endsWith('.png'))){
 const header=fs.readFileSync(path.join(attached,batch.name,file));
 const approved=file.includes('aprovada');
 add({id:`anexo-${batch.name}-${file}`,collection:'Anexos do projeto',file:`anexos-usuario/${batch.name}/${file}`,width:header.readUInt32BE(16),height:header.readUInt32BE(20),
  description:approved?'Mesa xadrez verde — reconstrução com imagegen aprovada pelo responsável.':file.includes('balcao')?'Balcão Pequena Itália — arte oficial enviada pelo responsável.':'Móveis — referência de jogo enviada pelo responsável.',artist:approved?'Reconstrução com imagegen; desenho de referência do Café Mania':'Vostu — origem informada pelo responsável',title:file});
}
const hashes=new Map();
for(const e of entries){if(hashes.has(e.sha256))e.duplicateOf=hashes.get(e.sha256);else hashes.set(e.sha256,e.id);}
const itemsRoot=path.join(root,'game/public/assets/items');
const items=fs.readdirSync(itemsRoot,{withFileTypes:true}).filter(f=>f.isDirectory()).flatMap(f=>{
  const file=path.join(itemsRoot,f.name,'item.json');if(!fs.existsSync(file))return[];
  const item=JSON.parse(fs.readFileSync(file,'utf8'));if(!item.source?.acervo)return[];
  return [{classname:item.classname,name:item.name,kind:item.kind,views:item.parts.length,source:item.source,
    parts:item.parts.map(p=>({...p,url:`../../game/public/assets/items/${f.name}/${p.file}`}))}];
});
for(const entry of entries){const used=items.filter(item=>item.source.acervo===entry.file);if(used.length){entry.usedBy=used.map(item=>item.classname);entry.status=used.some(item=>/imagegen/i.test(item.source.method))?'referência de reconstrução':'recortada';}}
const data={statistics:{files:entries.length,unique:hashes.size,registered:items.length},entries,items};
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'catalogo.json'),JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(path.join(output,'catalogo.js'),'globalThis.CafeReferenceArchive = '+JSON.stringify(data)+';\n');
console.info(`${entries.length} imagens indexadas; ${hashes.size} fontes únicas; ${items.length} itens deste acervo cadastrados.`);
