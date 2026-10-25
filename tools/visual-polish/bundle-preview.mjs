import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {build} from 'esbuild';
const root=process.cwd(),out=path.join(root,'.runtime/visual-polish/offline');fs.mkdirSync(out,{recursive:true});
await build({entryPoints:['game/dev/visual-polish.js'],bundle:true,platform:'browser',format:'esm',outfile:path.join(out,'bundle.js'),define:{'import.meta.env.BASE_URL':JSON.stringify(pathToFileURL(path.join(root,'game/public/')).href)},loader:{'.css':'empty'},logLevel:'silent'});
fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><html><meta charset="utf-8"><style>body{margin:0}canvas{display:block;width:100vw;height:auto}</style><script type="module" src="./bundle.js"></script></html>');
