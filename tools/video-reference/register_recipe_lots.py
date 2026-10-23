"""Export reviewed recipe art and provenance into the runtime catalogue.

Missing historical rules use explicit, replaceable provisional balance metadata.
Prepared-dish originals and Image Gen masters remain untouched in the archive.
"""
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / 'artes-referencia/receitas-cruzadas'
FOODS = ROOT / 'game/public/assets/foods'
REPORT = ROOT / 'docs/receitas-lotes-01-04.json'

# These estimates are gameplay choices, not recovered original game values.
PROVISIONAL_RULES = {
    'mandioquinha': {'unlockLevel': (5, 'Nível estimado para progressão inicial; custo, porções, venda, tempo e XP vêm do vídeo.')},
    'arroz_carreteiro': {
        'unlockLevel': (10, 'Nível estimado para um prato intermediário de duas horas.'),
        'costGold': (180, 'Custo estimado; referência histórica ausente.'),
        'portions': (120, 'Rendimento estimado; referência histórica ausente.'),
        'saleGoldPerPortion': (4, 'Venda estimada; 480 brutos e 300 líquidos por lote de duas horas.')},
    'quindim': {
        'unlockLevel': (6, 'Nível estimado para sobremesa inicial de 25 minutos.'),
        'costGold': (90, 'Custo estimado; referência histórica ausente.'),
        'portions': (60, 'Rendimento estimado; referência histórica ausente.'),
        'saleGoldPerPortion': (4, 'Venda estimada; 240 brutos e 150 líquidos por lote de 25 minutos.')},
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    exports = []
    for lot in sorted(ARCHIVE.glob('lote-*/cruzamento.json')):
        data = json.loads(lot.read_text(encoding='utf-8'))
        for art in data['art']:
            recipe = next(r for r in data['recipes'] if r['name'] == art['name'])
            id = art['id']
            if lot.parent.name == 'lote-01':
                page, slot = recipe['video']['observedPage'], recipe['video']['slotInPage']
                category = 'basic'
                values = dict(zip(['unlockLevel','costGold','durationSeconds','portions','saleGoldPerPortion','xp'],
                    [3,230,43200,50,20,100] if id == 'pamonha' else [4,120,14400,50,11,55]))
            else:
                page, slot = recipe['observedPage'], recipe['observedSlot']
                category = 'advanced' if recipe.get('observedCategory') == 'Avançado' else 'basic'
                values = dict(recipe['values'])
            provisional = {}
            field_names = {'unlockLevel':'level','saleGoldPerPortion':'profitGold'}
            for key, (value, reason) in PROVISIONAL_RULES.get(id, {}).items():
                if values[key] is not None:
                    raise ValueError(f'Never replace confirmed historical data with an estimate: {id}/{key}')
                values[key] = value
                provisional[field_names.get(key,key)] = {'value':value,'reason':reason}
            destination = FOODS / id
            destination.mkdir(exist_ok=True)
            source = lot.parent / art['derivedReconstruction']
            with Image.open(source) as original:
                rgba = original if original.mode == 'RGBA' else original.convert('RGBA')
                bounds = rgba.getchannel('A').getbbox()
                rgba = rgba.crop(bounds)
                rgba.thumbnail((496, 496), Image.Resampling.LANCZOS)
                offset = ((512 - rgba.width) // 2, 512 - rgba.height)
                canvas = Image.new('RGBA', (512,512))
                canvas.paste(rgba, offset)
                canvas.save(destination / 'stage_2.png', optimize=True)
            preparation = FOODS / 'churrasco/stage_1.png'
            shutil.copyfile(preparation, destination / 'stage_1.png')
            if any(value is None for value in values.values()):
                raise ValueError(f'Missing runtime rule: {id}')
            citation = f"{lot.parent.relative_to(ROOT).as_posix()}/cruzamento.json; receita {recipe['name']}. "
            citation += 'Ordem/categoria observadas no vídeo, não ordem de desbloqueio. '
            if provisional:
                citation += 'PROVISÓRIO: campos estimados identificados em provisionalRules, não confirmados como regras originais. '
            citation += 'Preparo provisório reutiliza a panela tampada de churrasco; sprite histórico específico não recuperado. '
            if id == 'torta_limao_vovo':
                citation += 'Versão escolhida: ficha P076_03 com 270 porções, líquido410; alternativa170/líquido210 preservada no acervo. '
            if id == 'batatas_sorridentes':
                citation += 'Versão escolhida: P076_05 com 10min; alternativa30min do vídeo preservada no acervo. '
            if id == 'banana_split':
                citation += recipe['sourceAssociation']
            runtime = {'id':id,'name':recipe['name'],'level':values['unlockLevel'],
                       'durationSeconds':values['durationSeconds'],'portions':values['portions'],
                       'profitGold':values['saleGoldPerPortion'],'costGold':values['costGold'],'xp':values['xp'],
                       'inBook':True,'category':category,'bookOrder':(page-1)*6+slot,'source':citation}
            if provisional:
                runtime['provisionalRules'] = provisional
            manifest = destination / 'recipe.json'
            if manifest.exists():
                old = json.loads(manifest.read_text(encoding='utf-8'))
                if old != runtime:
                    raise ValueError(f'Existing manifest differs; review before replacing {id}')
            manifest.write_text(json.dumps(runtime,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            exports.append({'id':id,'archive':source.relative_to(ROOT).as_posix(),'archiveSha256':sha(source),
                            'stage2Sha256':sha(destination/'stage_2.png'),'stage1Sha256':sha(preparation),
                            'canvas':[512,512],'visibleSize':list(rgba.size),'offset':list(offset),
                            'referenceAlphaBox':list(bounds),'category':category,'bookOrder':runtime['bookOrder'],
                            'provisionalRules':provisional,'recipe':manifest.relative_to(ROOT).as_posix()})
    REPORT.write_text(json.dumps({'exports':exports,'preparation':'Reused generic lidded pot, not a recovered historical preparation sprite.','provisionalPolicy':'Missing historical fields use explicit provisionalRules; archive observations remain unchanged.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Exported {len(exports)} recipes; {sum(bool(e["provisionalRules"]) for e in exports)} with provisional fields.')


if __name__ == '__main__':
    main()
