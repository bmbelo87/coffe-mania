"""Build source-linked art-lot previews without modifying gameplay or source pixels."""
import argparse
import hashlib
import html
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('lot', type=Path)
    args = parser.parse_args()
    folder = args.lot.resolve()
    folder.relative_to(ROOT)
    data = json.loads((folder / 'lote.json').read_text(encoding='utf-8'))
    (folder / 'fontes').mkdir(exist_ok=True)
    art = []
    for recipe in data['recipes']:
        name = recipe['id']
        crops = [('original', recipe['referenceCrop'])]
        crops += [(crop['id'], crop) for crop in recipe.get('supportingCrops', [])]
        for suffix, crop in crops:
            with Image.open(ROOT / crop['source']) as original:
                original.crop(crop['box']).save(folder / f'fontes/{name}-{suffix}.png')
        reference = f'fontes/{name}-original.png'
        enlarged = f'fontes/{name}-original-4x.png'
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(folder / reference),
                        '-vf', 'scale=iw*4:ih*4:flags=lanczos', '-y', str(folder / enlarged)], check=True)
        master = recipe.get('generatedFile', f'gerados/{name}-imagegen.png')
        with Image.open(folder / master) as generated:
            alpha_bounds = generated.getchannel('A').getextrema() if generated.mode == 'RGBA' else None
            if alpha_bounds is None or alpha_bounds[0] != 0 or alpha_bounds[1] < 240:
                raise ValueError(f'{name}: expected transparent RGBA master')
            pixels = np.array(generated)
        # Keep the connected plate/bowl and its antialiasing; isolated alpha noise
        # is outside the illustration. The untouched Image Gen master stays saved.
        alpha = pixels[:, :, 3]
        labels, count = ndimage.label(alpha > 32)
        if not count:
            raise ValueError(f'{name}: empty foreground')
        sizes = np.bincount(labels.ravel())
        sizes[0] = 0
        keep = ndimage.binary_dilation(labels == sizes.argmax(), iterations=2)
        removed = int(((alpha > 0) & ~keep).sum())
        # Wide, almost invisible alpha noise must not be mistaken for food.
        # Bound both meaningful pixels and opacity mass before packing.
        removed_visible = int(((alpha > 8) & ~keep).sum())
        removed_alpha_fraction = float(alpha[~keep].sum() / alpha.sum())
        if removed_visible > max(5000, int((alpha > 8).sum() * 0.03)) or removed_alpha_fraction > 0.005:
            raise ValueError(f'{name}: unexpected foreground removal; inspect before packing')
        pixels[:, :, 3] = np.where(keep, alpha, 0)
        packed = Image.fromarray(pixels)
        bounds = packed.getchannel('A').getbbox()
        left, top, right, bottom = bounds
        bounds = (max(0, left - 8), max(0, top - 8), min(packed.width, right + 8), min(packed.height, bottom + 8))
        packed = packed.crop(bounds)
        preview = f'gerados/{name}-preview.png'
        packed.save(folder / preview)
        meta = {'width': packed.width, 'height': packed.height, 'mode': packed.mode,
                'alphaExtrema': packed.getchannel('A').getextrema(),
                'masterCropBox': bounds, 'removedIsolatedAlphaPixels': removed,
                'removedAlphaFraction': removed_alpha_fraction,
                'processing': 'RGB unchanged; remove detached alpha noise and crop transparent canvas. Original generated master preserved.'}
        art.append({'id': name, 'name': recipe['name'], 'reference': reference,
                    'conventional4x': enlarged, 'derivedReconstruction': preview, 'generatedMaster': master,
                    'prompt': f'{name}-prompt.txt', 'generationTool': 'built-in image_gen',
                    'correctionPrompt': recipe.get('correctionPrompt'),
                    'sha256': sha(folder / preview), 'image': meta,
                    'status': 'Prévia reconstruída com transparência, diferente dos pixels originais; não calibrada nem cadastrada no jogo.'})
    summary = {'reviewDate': data['reviewDate'], 'recipes': data['recipes'],
               'sources': data['sources'], 'searchAudit': data.get('searchAudit'),
               'art': art, 'runtimeChanges': False}
    (folder / 'cruzamento.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    sheet = Image.new('RGB', (1000, 350 * len(art)), '#eee8db')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 16)
    for i, entry in enumerate(art):
        y = i * 350
        draw.text((20, y + 12), entry['name'] + ' | original ampliado 4×', fill='black', font=font)
        draw.text((510, y + 12), 'Image Gen | reconstrução derivada', fill='black', font=font)
        with Image.open(folder / entry['conventional4x']) as original:
            original = original.convert('RGBA')
            original.thumbnail((440, 280))
            sheet.paste(original, (20, y + 50), original)
        with Image.open(folder / entry['derivedReconstruction']) as generated:
            generated = generated.convert('RGBA')
            support = generated.getchannel('A').point(lambda value: 255 if value >= 96 else 0)
            generated = generated.crop(support.getbbox())
            generated.thumbnail((440, 280))
            sheet.paste(generated, (510, y + 50), generated)
    sheet.save(folder / 'comparacao.png')
    show = lambda value: 'Pendente' if value is None else str(value)
    duration = lambda value: 'Pendente' if value is None else f'{value // 60} min'
    previous = data.get('previousLot', '../lote-01/index.html').replace('index.html', 'LEIA-ME.md')
    lines = ['# ' + data['title'], '', 'Revisão: ' + data['reviewDate'] + '.', '',
             f'[Galeria e comparação](index.html) · [Dados e fontes](cruzamento.json) · [Lote anterior]({previous}) · [Índice geral](../index.html)', '',
             data.get('scopeNote', 'Continuação do lote de pesquisa e arte. Os dois pratos aparecem nos slots 1 e 2 da segunda página Básico do vídeo. O livro, a simulação e os dados da conta não foram alterados.'), '',
             '## Especificações', '',
             '| Receita | Nível | Custo | Tempo | Porções | Venda/porção | XP | Receita bruta calculada | Líquido calculado |',
             '| --- | --- | --- | --- | --- | --- | --- | --- | --- |']
    for recipe in data['recipes']:
        v = recipe['values']
        gross = v['portions'] * v['saleGoldPerPortion'] if v['portions'] is not None and v['saleGoldPerPortion'] is not None else None
        net = gross - v['costGold'] if gross is not None and v['costGold'] is not None else None
        lines += [f"| {recipe['name']} | {show(v['unlockLevel'])} | {show(v['costGold'])} | {duration(v['durationSeconds'])} | {show(v['portions'])} | {show(v['saleGoldPerPortion'])} | {show(v['xp'])} | {show(gross)} | {show(net)} |"]
    lines += ['', data.get('specificationNotes', 'Custo, tempo, porções, venda e XP vêm dos respectivos painéis do vídeo. Vatapá: 00:32.232; Mandioquinha: 00:31.698. A lista de julho de 2010 corrobora apenas o nível do Vatapá neste lote; não atribuir o mesmo nível à Mandioquinha por proximidade no livro.'), '',
              '## Arte e fidelidade', '', '![Originais e prévias](comparacao.png)', '',
              data.get('artNotes', 'O Vatapá usa a prancha de Marcela Rojas como referência primária e o vídeo como comparação. A Mandioquinha usa o painel carregado do vídeo e o cartão menor para conferir o prato. Os recortes nativos são cópias retangulares dos pixels das fontes; as ampliações 4× usam Lanczos via FFmpeg. Não foram pintados novos detalhes nas versões convencionais.'), '',
              'As prévias Image Gen têm transparência e contornos reconstruídos. Mantêm a proposta de composição e cores, mas apresentam diferenças de curvas, volumes, folhas e gradações; não equivalem a sprites originais recuperados nem a ampliações idênticas. Não aplicar automaticamente no jogo. O fundo branco da prancha e os relógios/controles do vídeo são contexto da referência e não componentes do alimento.', '',
              data.get('generationNotes', 'O Vatapá teve uma segunda edição com Image Gen para retirar marcas circulares claras acrescentadas ao caldo na primeira geração. Os mestres gerados permanecem intactos em `gerados/`; os PNGs de prévia removem apenas ruído de transparência desconectado do prato e recortam a margem vazia, preservando os canais RGB. Essa preparação não equivale à calibração de tamanho e apoio no chão.'), '',
              '## Fontes e lacunas por prato', '']
    for recipe, entry in zip(data['recipes'], art):
        lines += ['### ' + recipe['name'], '',
                  f"[Original nativo]({entry['reference']}) · [Ampliação convencional]({entry['conventional4x']}) · [Prévia Image Gen]({entry['derivedReconstruction']}) · [Prompt exato]({entry['prompt']})", '']
        for gap in recipe['gaps']:
            lines.append('- ' + gap)
        for conflict in recipe['conflicts']:
            lines.append('- Divergência: ' + conflict)
        if recipe.get('sourceAssociation'):
            lines.append('- Associação de fontes: ' + recipe['sourceAssociation'])
        if entry.get('correctionPrompt'):
            lines.append(f"- [Prompt da correção]({entry['correctionPrompt']}) · [Mestre corrigido]({entry['generatedMaster']})")
        lines.append('')
    lines += ['## Fontes consultadas', '']
    for source in data['sources']:
        lines += [f"- **{source['id']}** — {source['kind']}. {source.get('url', source.get('file'))}", '  ' + source['notes']]
    lines += ['', data.get('searchNotes', 'As consultas específicas de Mandioquinha estão registradas em `lote.json`; retornaram resultados sem evidência histórica útil. A ausência nessas buscas não demonstra que o prato nunca existiu no jogo. Não foram usados resultados de receitas culinárias reais para preencher regras do Café Mania.'), '',
              '## Verificação', '', f'Conferidos recortes contra as fontes, dimensões das ampliações, transparência de {len(art)} PNGs, contas econômicas conhecidas e links da galeria. A avaliação visual se limita às capturas e à comparação lado a lado; não comprova encaixe no fogão, no balcão ou na sala. Sem build, alteração de banco ou teste de simulação neste lote.', '']
    (folder / 'LEIA-ME.md').write_text('\n'.join(lines), encoding='utf-8')
    page = ['<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
            '<title>' + html.escape(data['title']) + '</title>',
            '<style>body{background:#eee8db;color:#29231c;font:16px system-ui;margin:24px}main{max-width:1200px;margin:auto}a{color:#075a80}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{background:#fff9eb;padding:20px;margin:0}img{max-width:100%;max-height:360px;height:auto;object-fit:contain}section{margin:36px 0}li{margin:8px 0}table{border-collapse:collapse;width:100%}td,th{padding:10px;text-align:left;border-bottom:1px solid #baac96}@media(max-width:650px){.pair{grid-template-columns:1fr}}</style><main>',
            '<h1>' + html.escape(data['title']) + '</h1>',
            '<p><a href="../index.html">Todos os lotes</a> · <a href="LEIA-ME.md">Especificações e fontes</a> · <a href="cruzamento.json">Dados estruturados</a></p>',
            '<p>Originais ampliados e prévias reconstruídas ficam separados. Sem alteração de receitas do jogo. Campos não confirmados e artes de preparo permanecem pendentes.</p>']
    for recipe, entry in zip(data['recipes'], art):
        v = recipe['values']
        page += ['<section><h2>' + html.escape(recipe['name']) + '</h2>',
                 f'<p>Nível: {show(v["unlockLevel"])} · Custo: {show(v["costGold"])} · Tempo: {duration(v["durationSeconds"])} · Porções: {show(v["portions"])} · Venda: {show(v["saleGoldPerPortion"])}/porção · XP: {show(v["xp"])}</p>',
                 '<div class="pair">',
                 f'<figure><a href="{entry["conventional4x"]}"><img src="{entry["conventional4x"]}" alt="Original ampliado"></a><figcaption>Original ampliado 4× · <a href="{entry["reference"]}">nativo</a></figcaption></figure>',
                 f'<figure><a href="{entry["derivedReconstruction"]}"><img src="{entry["derivedReconstruction"]}" alt="Prévia Image Gen"></a><figcaption>Reconstrução derivada · <a href="{entry["prompt"]}">prompt</a></figcaption></figure></div><ul>']
        page += ['<li>' + html.escape(gap) + '</li>' for gap in recipe['gaps']]
        page += ['<li><strong>Divergência:</strong> ' + html.escape(conflict) + '</li>' for conflict in recipe['conflicts']]
        if recipe.get('sourceAssociation'):
            page += ['<li><strong>Associação de fontes:</strong> ' + html.escape(recipe['sourceAssociation']) + '</li>']
        page += ['</ul></section>']
    page += ['</main></html>']
    (folder / 'index.html').write_text('\n'.join(page), encoding='utf-8')
    print(f'Prepared {len(art)} image references, comparisons, source-linked specifications and gallery.')


if __name__ == '__main__':
    main()
