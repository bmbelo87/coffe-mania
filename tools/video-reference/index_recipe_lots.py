"""Index existing research lots without merging historical editions into runtime rules."""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / 'artes-referencia/receitas-cruzadas'
VIDEO = ROOT / 'artes-referencia/video-cafe-mania-muito-tempo/receitas-0029-0046/receitas.json'


def main():
    runtime = {}
    for path in (ROOT / 'game/public/assets/foods').glob('*/recipe.json'):
        manifest = json.loads(path.read_text(encoding='utf-8'))
        if manifest['inBook']:
            runtime[manifest['name']] = manifest['id']
    observations = json.loads(VIDEO.read_text(encoding='utf-8'))['recipes']
    lots = []
    for path in sorted(FOLDER.glob('lote-*/cruzamento.json')):
        lots.append((path.parent.name, json.loads(path.read_text(encoding='utf-8'))))
    recipes = []
    for observed in observations:
        record = {'name': observed['name'], 'category': observed['category'],
                  'observedPage': observed['observedPage'], 'observedSlot': observed['slotInPage'],
                  'videoCard': '../video-cafe-mania-muito-tempo/receitas-0029-0046/' + observed['cardEvidence']['file'],
                  'research': [], 'artPreviews': []}
        if record['name'] in runtime:
            record['existingRuntimeRecipe'] = '../../game/public/assets/foods/' + runtime[record['name']] + '/recipe.json'
        for lot_name, data in lots:
            for recipe in data['recipes']:
                if recipe['name'] == observed['name']:
                    record['research'].append({'lot': lot_name, 'file': f'{lot_name}/cruzamento.json',
                                                'historicalClaims': recipe.get('historicalClaims', []),
                                                'fieldSources': recipe.get('fieldSources', {}),
                                                'conflicts': recipe.get('conflicts', []), 'gaps': recipe.get('gaps', [])})
            for asset in data['art']:
                if asset['name'] == observed['name']:
                    record['artPreviews'].append({'lot': lot_name,
                                                  **{k: f'{lot_name}/{asset[k]}' for k in ('reference', 'conventional4x', 'derivedReconstruction', 'prompt')}})
        recipes.append(record)
    stats = {'observedRecipes': len(recipes), 'lots': len(lots),
             'recipesWithGeneratedPreviews': sum(bool(r['artPreviews']) for r in recipes),
             'alreadyRegisteredRuntimeRecipes': sum('existingRuntimeRecipe' in r for r in recipes),
             'runtimeChangesByResearch': False}
    result = {'reviewDate': '2026-10-21', 'statistics': stats,
              'policy': 'This is a reference index. Keep video observations, historical claims and generated art provenance separate. No registration or balancing is performed.',
              'recipes': recipes}
    (FOLDER / 'catalogo.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    body = ['<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Café Mania — referências de receitas</title>',
            '<style>body{font:16px system-ui;background:#eee8db;color:#29231c;margin:24px}main{max-width:1280px;margin:auto}a{color:#075a80}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}article{background:#fff9eb;padding:16px;border-radius:8px}img{max-width:100%;height:auto;max-height:200px;object-fit:contain}input{padding:12px;width:min(500px,90%)}.lot{display:inline-block;padding:12px;background:white;margin:6px 12px 16px 0}small{display:block;color:#5d5142}[hidden]{display:none!important}</style><main>',
            '<h1>Café Mania — referências de receitas</h1>',
            f'<p>{stats["observedRecipes"]} pratos observados · {stats["lots"]} lotes de pesquisa · {stats["recipesWithGeneratedPreviews"]} pratos com prévias Image Gen · {stats["alreadyRegisteredRuntimeRecipes"]} receitas já existentes no jogo</p>',
            '<p>Referências, ampliações convencionais e reconstruções permanecem separadas. Os links “Receita já cadastrada” apontam para a versão usada no jogo, incluindo indicadores de valores provisórios. Cada lote conserva o registro histórico anterior à aplicação.</p>',
            '<p><a href="catalogo.json">Catálogo com vínculos e pendências</a> · <a href="../video-cafe-mania-muito-tempo/receitas-0029-0046/index.html">Capturas do vídeo</a></p>']
    for lot_name, data in lots:
        names = ', '.join(asset['name'] for asset in data['art'])
        body += [f'<a class="lot" href="{lot_name}/index.html">{lot_name}: {html.escape(names)}</a>']
    body += ['<p><label>Buscar prato <input type="search" id="search" placeholder="Nome ou categoria"></label></p><div class="grid">']
    for recipe in recipes:
        body += [f'<article data-search="{html.escape(recipe["name"] + " " + recipe["category"], quote=True)}"><h2>{html.escape(recipe["name"])}</h2>',
                 f'<a href="{recipe["videoCard"]}"><img loading="lazy" src="{recipe["videoCard"]}" alt="Cartão do vídeo"></a>',
                 f'<small>{recipe["category"]} · página observada {recipe["observedPage"]} · posição {recipe["observedSlot"]}</small>']
        if 'existingRuntimeRecipe' in recipe:
            body += [f'<p><a href="{recipe["existingRuntimeRecipe"]}">Receita já cadastrada</a></p>']
        for asset in recipe['artPreviews']:
            body += [f'<p><a href="{asset["lot"]}/index.html">Ver lote e especificações</a></p>',
                     f'<a href="{asset["derivedReconstruction"]}"><img loading="lazy" src="{asset["derivedReconstruction"]}" alt="Prévia reconstruída"></a>',
                     f'<p><a href="{asset["conventional4x"]}">Original ampliado</a> · <a href="{asset["prompt"]}">Prompt</a></p>']
        if not recipe['artPreviews'] and 'existingRuntimeRecipe' not in recipe:
            body += ['<p>Referência do vídeo disponível; arte separada pendente.</p>']
        body += ['</article>']
    body += ["</div><script>const norm=s=>s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();document.querySelector('#search').addEventListener('input',e=>{for(const card of document.querySelectorAll('article'))card.hidden=!norm(card.dataset.search).includes(norm(e.target.value))});</script></main></html>"]
    (FOLDER / 'index.html').write_text('\n'.join(body), encoding='utf-8')
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == '__main__':
    main()
