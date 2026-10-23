"""Keep video observations separate from dated historical recipe claims and art provenance."""
import hashlib
import html
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'artes-referencia/receitas-cruzadas/lote-01'
VIDEO = ROOT / 'artes-referencia/video-cafe-mania-muito-tempo/receitas-0029-0046'
ARCHIVE = ROOT / 'artes-referencia/cafe-mania-acervo-documentado/cafe-mania-acervo'

SOURCES = [
    {'id': 'V01', 'type': 'gameplay-video', 'date': None, 'file': str(VIDEO.relative_to(ROOT) / 'receitas.json').replace('\\', '/'),
     'notes': '48 observed dishes; title, image and numbers may load at different times. Edition date unknown.'},
    {'id': 'B01', 'type': 'dated-player-blog', 'date': '2010-07-10',
     'url': 'https://jogandocafemania.blogspot.com/2010/07/lista-completa-de-niveis.html',
     'access': 'Read live on 2026-10-21', 'notes': 'Historical unlock levels; book position is a separate property.'},
    {'id': 'B02', 'type': 'dated-player-table-image', 'date': '2010-09-10',
     'url': 'https://dicas-cafemania.blogspot.com/2010/09/tabela-cafe-mania-alimentos-lucro-e-xp.html',
     'file': str((ARCHIVE / 'imagens/receitas/P042_01_cafemania_42e34641.jpg').relative_to(ROOT)).replace('\\', '/'),
     'access': 'Live post read; local original table image inspected',
     'notes': 'The Tacos and Vatapa labels appear swapped. Churrasco uses the older 100 portions / 110 XP. Do not silently repair or merge.'},
    {'id': 'B03', 'type': 'dated-player-blog-with-game-cards', 'date': '2010-08-13',
     'url': 'https://jogandocafemania.blogspot.com/2010/08/novos-pratos-no-cafe-mania.html',
     'access': 'Live search index accessible; direct open returned cache miss. Seven original card images inspected locally (P076_01 through P076_07).',
     'notes': 'Levels 50–56. Card times differ from the later video for Batatas Sorridentes.'},
    {'id': 'D01', 'type': 'player-spreadsheet-transcription', 'date': None,
     'url': 'https://pt.scribd.com/document/42351728/Cafe-mania',
     'access': 'Public text read on 2026-10-21; document credits Renan Salvate Campos.',
     'notes': 'Not an official configuration. Named first table corroborates Pamonha level/portions/sale and Tacos level/portions/sale. Detached numeric columns were not imported as all-recipe rows.'},
    {'id': 'D02', 'type': 'player-time-profit-list', 'date': None,
     'url': 'https://pt.scribd.com/doc/56610084/Cafe-Mania',
     'access': 'Public indexed text read on 2026-10-21',
     'notes': 'Pamonha: 12 hours and 770 net; Tacos: 4 hours and 430 net. Gross per-portion sale and net batch profit are different quantities.'},
    {'id': 'A01', 'type': 'artist-portfolio', 'date': None, 'artist': 'Marcela Rojas',
     'url': 'https://www.behance.net/gallery/4432119/CafeMania',
     'file': 'artes-referencia/cafe-mania-behance-alta-qualidade-documentado/cafe-mania-behance/artes/4432119/002.jpg',
     'notes': 'Inspected original art of Mousse and Vatapa among other items; no Pamonha/Tacos sprite identified on this board. The separate 006 recipe interface contains repeated placeholder numbers and is not a balance source.'},
]

# This table is transcribed only from the supplied local P042 image.
# Ambiguous Tacos/Vatapa names are deliberately excluded.
OLD_BASIC = {
    'Nachos de Queijo': (8, 15, 2, 3, '3 min'),
    'X-Tudo': (20, 25, 5, 8, '8 min'),
    'Mousse de Maracujá': (60, 22, 12, 30, '35 min'),
    'Churrasco': (250, 100, 7, 110, '6.0 hs'),
    'Pamonha': (230, 50, 20, 100, '12.0 hs'),
    'Salada Caesar': (40, 95, 2, 15, '10 min'),
    'Bolo de Cenoura': (200, 450, 2, 90, '18.0 hs'),
}
LEVELS = {
    'Mousse de Maracujá': 3, 'Pamonha': 3, 'Tacos Triplos': 4, 'Vatapá': 4,
    'Bolo de Cenoura': 5, 'Churrasco': 12, 'Salada Caesar': 26,
}
ADVANCED = [
    ('Super À La Minuta', 50, '01', 160, 105, 7, 70, '3.0 hs'),
    ('Carré de Carneiro', 51, '02', 210, 100, 9, 90, '8.0 hs'),
    ('Torta de Limão da Vovó', 52, '03', 130, 270, 2, 50, '50 min'),
    ('Lagosta Nobre', 53, '04', 430, 170, 10, 170, '15.0 hs'),
    ('Batatas Sorridentes', 54, '05', 50, 225, 1, 15, '10 min'),
    ('Salmão com Alcaparras', 55, '06', 260, 265, 5, 130, '21.0 hs'),
    ('Pimentão Recheado do Chef', 56, '07', 100, 135, 3, 38, '25 min'),
]


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def economy(cost, portions, sale, xp, duration):
    return {'costGold': cost, 'portions': portions, 'saleGoldPerPortion': sale,
            'xp': xp, 'durationDisplay': duration,
            'derivedBatchGrossGold': portions * sale,
            'derivedBatchNetGold': portions * sale - cost}


def main():
    observations = json.loads((VIDEO / 'receitas.json').read_text(encoding='utf-8'))['recipes']
    recipes = []
    for observed in observations:
        name = observed['name']
        row = {'name': name, 'video': observed, 'historicalClaims': [], 'conflicts': [],
               'implementationReady': False,
               'gaps': ['Preparation-on-stove artwork is not established by this segment.',
                        'Recording edition/date is unknown; historical claims remain separate.']}
        if name in OLD_BASIC:
            row['historicalClaims'].append({'source': 'B02', 'kind': 'historical-economy',
                                             'values': economy(*OLD_BASIC[name])})
        if name in LEVELS:
            row['historicalClaims'].append({'source': 'B01', 'kind': 'unlock-level', 'values': {'unlockLevel': LEVELS[name]}})
        if name in ('Nachos de Queijo', 'X-Tudo'):
            row['historicalClaims'].append({'source': 'D01', 'kind': 'unlock-level', 'values': {'unlockLevel': 1}})
        if name in ('Pamonha', 'Tacos Triplos'):
            level, portions, sale, duration, net = (3, 50, 20, '12.0 hs', 770) if name == 'Pamonha' else (4, 50, 11, '4.0 hs', 430)
            row['historicalClaims'].append({'source': 'D01', 'kind': 'named-table-row', 'values': {'unlockLevel': level, 'portions': portions, 'saleGoldPerPortion': sale}})
            row['historicalClaims'].append({'source': 'D02', 'kind': 'time-and-net-profit', 'values': {'durationDisplay': duration, 'batchNetGold': net}})
        for dish, level, number, cost, portions, sale, xp, duration in ADVANCED:
            if name != dish:
                continue
            original = next((ARCHIVE / 'imagens/receitas').glob(f'P076_{number}_*'))
            row['historicalClaims'].append({'source': 'B03', 'kind': 'historical-card',
                                             'file': str(original.relative_to(ROOT)).replace('\\', '/'),
                                             'values': {'unlockLevel': level, **economy(cost, portions, sale, xp, duration)}})
        if name == 'Churrasco':
            row['conflicts'].append('Video: 110 portions / 75 XP. P042 and current runtime: 100 portions / 110 XP. Historical level 12 differs from the current provisional level 1. No automatic update.')
        if name == 'Batatas Sorridentes':
            row['conflicts'].append('P076 historical card: 10 minutes. Video: 30 minutes. Preserve both versions.')
        if name == 'Torta de Limão da Vovó':
            row['historicalClaims'].append({'source': 'D01', 'kind': 'named-table-row',
                                             'values': {'unlockLevel': 52, 'portions': 170, 'saleGoldPerPortion': 2}})
            row['conflicts'].append('P076 historical card shows 270 portions; D01 named table shows 170. The video does not open this detail panel.')
        if name in ('Tacos Triplos', 'Vatapá'):
            row['conflicts'].append('P042 appears to exchange the two dish names: its Tacos row carries Vatapa-like numbers and vice versa. The video panel is the direct evidence for its own edition.')
        if name == 'Bolo Zumbi':
            row['conflicts'].append('Some frames show delayed Profiteroles art under this title. Use the correctly loaded selected frame at 41.508 seconds.')
        if name == 'Pamonha':
            row['gaps'].append('Cost/portions/sale are corroborated historical claims, not visible in this video panel. No original preparation sprite found in the inspected sources.')
        if not row['historicalClaims']:
            row['gaps'].append('No additional independently matched historical specification in this batch.')
        recipes.append(row)
    art = []
    for dish, name in [('pamonha', 'Pamonha'), ('tacos_triplos', 'Tacos Triplos')]:
        generated = DEST / f'gerados/{dish}-imagegen.png'
        with Image.open(generated) as im:
            info = {'width': im.width, 'height': im.height, 'mode': im.mode,
                    'alphaExtrema': im.getchannel('A').getextrema()}
        art.append({'id': dish, 'name': name, 'reference': f'fontes/{dish}-original.png',
                    'conventional4x': f'fontes/{dish}-original-4x.png',
                    'derivedReconstruction': f'gerados/{dish}-imagegen.png',
                    'prompt': f'{dish}-prompt.txt', 'generationTool': 'built-in image_gen',
                    'sha256': sha(generated), 'image': info,
                    'status': 'Preview reconstruction; not a recovered original sprite and not calibrated or registered in the game.',
                    'fidelityReview': 'Same subject, pose, main palette and restrained original shadows; low-resolution input cannot establish every contour. New contours and colour gradients differ from original pixels. Conventional 4x is the fidelity-preserving reference.'})
        if dish == 'tacos_triplos':
            art[-1]['supplementaryFullContourReference'] = 'fontes/tacos_triplos-original-completo.png'
            art[-1]['supplementarySmallCardReference'] = 'fontes/tacos_triplos-contorno-completo.png'
            art[-1]['conventional4x'] = 'fontes/tacos_triplos-original-completo-4x.png'
    comparison = Image.new('RGB', (1000, 700), '#eee8db')
    draw = ImageDraw.Draw(comparison)
    for row, asset in enumerate(art):
        y = row * 350
        draw.text((20, y + 12), asset['name'] + ' | original ampliado', fill='black')
        draw.text((510, y + 12), 'Image Gen | reconstrucao derivada', fill='black')
        with Image.open(DEST / asset['conventional4x']) as original:
            original = original.convert('RGBA')
            original.thumbnail((440, 280))
            comparison.paste(original, (20, y + 50), original)
        with Image.open(DEST / asset['derivedReconstruction']) as generated:
            generated = generated.convert('RGBA')
            support = generated.getchannel('A').point(lambda value: 255 if value >= 96 else 0)
            generated = generated.crop(support.getbbox())
            generated.thumbnail((440, 280))
            comparison.paste(generated, (510, y + 50), generated)
    comparison.save(DEST / 'comparacao.png')
    data = {'reviewDate': '2026-10-21', 'sources': SOURCES, 'recipes': recipes, 'art': art,
            'runtimeChanges': False, 'policy': 'Keep the supplied video catalogue intact; corroboration and edition differences live here.'}
    (DEST / 'cruzamento.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    text = [
        '# Receitas: cruzamento de fontes e primeiro lote de arte', '',
        'Revisão: 21/10/2026. O catálogo inclui os 48 pratos observados no vídeo. Este lote cruza suas evidências com blogs, fichas históricas e portfólios e entrega prévias de Pamonha e Tacos Triplos. Nenhuma receita, regra, versão ou banco do jogo foi alterado.', '',
        '[Galeria e comparação](index.html) · [Dados e evidências por receita](cruzamento.json) · [Catálogo original do vídeo](../../video-cafe-mania-muito-tempo/receitas-0029-0046/LEIA-ME.md)', '',
        '## Pamonha e Tacos Triplos', '',
        '| Receita | Ordem observada no Básico | Nível histórico | Custo | Tempo | Porções | Venda/porção | XP | Lucro líquido calculado |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        '| Pamonha | 5, depois do Churrasco | 3 | 230 | 12 h | 50 | 20 | 100 | 770 |',
        '| Tacos Triplos | 6, depois da Pamonha | 4 | 120 | 4 h | 50 | 11 | 55 | 430 |', '',
        'Fontes: ordem, tempos e XP em V01; nível em B01; Pamonha em B02 e D01/D02; custo/porções/venda dos Tacos no painel de V01 e confirmação nominal em D01. A economia da Pamonha é corroborada para uma versão histórica; o painel dela não foi aberto no trecho do vídeo. Posição no livro não equivale a nível: Churrasco aparece antes, embora a lista histórica o libere no nível 12.', '',
        'O termo “Lucros” com “c/un.” nos cartões indica venda por porção. Receita bruta do lote = porções × venda; líquido = receita bruta − custo. Não usar o lucro líquido como preço por porção.', '',
        '## Comparação da arte', '',
        '![Originais e reconstruções](comparacao.png)', '',
        'Os originais recortados e suas ampliações convencionais 4× mantêm a arte e os elementos de interface capturados. São referências opacas, sem reconstrução de detalhes. As versões Image Gen removem o fundo da interface e reconstroem contornos com transparência: **não são upscales matematicamente idênticos nem sprites originais recuperados**. A Pamonha mantém tigela e volumes de folhas; os Tacos mantêm um único taco, prato, recheio e orientação. As bordas e gradações têm diferenças visíveis. Não foram solicitados brilhos, adornos ou ingredientes novos. As prévias ficam separadas para avaliação e calibração; não substituem automaticamente os PNGs em execução.', '',
        'O lote não contém arte comprovada do preparo no fogão. Não desenhar uma panela ou etapa intermediária como se tivesse sido recuperada. Antes do cadastro, obter a referência de preparo ou apresentar uma adaptação explicitamente identificada.', '',
        '## Sete pratos avançados com ficha histórica', '',
        '| Receita | Nível | Custo | Porções | Venda/porção | XP | Tempo da ficha | Tempo do vídeo |',
        '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ]
    for name, level, _, cost, portions, sale, xp, duration in ADVANCED:
        observed = next(r for r in observations if r['name'] == name)
        text.append(f'| {name} | {level} | {cost} | {portions} | {sale} | {xp} | {duration} | {observed["durationDisplay"]} |')
    text += ['', '![Fichas históricas P076](fontes/avancados-P076.jpg)', '',
             '## Diferenças e limites encontrados', '',
             '- Churrasco: 75 XP/110 porções no vídeo, 110 XP/100 porções em P042 e no catálogo atual. A lista de julho de 2010 indica nível 12; o runtime ainda usa nível 1 provisório.',
             '- Batatas Sorridentes: 10 minutos em P076, 30 minutos no vídeo. Os valores não foram fundidos em uma versão supostamente oficial.',
             '- Torta de Limão da Vovó: 270 porções na ficha P076, 170 na tabela nominal D01. O vídeo não mostra o painel econômico dela.',
             '- Tacos/Vatapá: os nomes parecem invertidos em P042. A linha nominal isolada dessa tabela não é usada para trocar os valores diretamente visíveis no vídeo.',
             '- Bolo Zumbi e Profiteroles: carregamento atrasado troca momentaneamente as artes. Usar os tempos corretos registrados no catálogo do vídeo.',
             '- Portfólio 4432119/006: vários cartões repetem números de demonstração. Referência de aparência, não fonte econômica. A prancha 002 contém arte de Mousse e Vatapá, mas não foi localizado nela um sprite original de Pamonha/Tacos.',
             '- O XML local foi modificado; não foi usado como prova de regra oficial. Cópias de uma mesma tabela entre blogs não são confirmação independente.', '',
             '## Índice dos 48 pratos', '',
             '| Receita | Referência de vídeo | Fontes históricas adicionais neste lote |', '| --- | --- | --- |']
    for row in recipes:
        seen = row['video']['cardEvidence']
        refs = ', '.join(dict.fromkeys(c['source'] for c in row['historicalClaims'])) or 'Pendente'
        text.append(f"| {row['name']} | [{seen['timecode']}](../../video-cafe-mania-muito-tempo/receitas-0029-0046/{seen['file']}) | {refs} |")
    text += ['', '## Fontes consultadas', '']
    for source in SOURCES:
        title = source.get('url', source.get('file', ''))
        text += [f"- **{source['id']}** — {source['type']}, data: {source.get('date') or 'não confirmada'}. {title}",
                 f"  {source['notes']}"]
    text += ['', 'Os prompts exatos estão em `pamonha-prompt.txt` e `tacos_triplos-prompt.txt`. As imagens foram geradas com a ferramenta integrada Image Gen; fontes e resultados foram salvos no projeto. Conferência: imagens originais e derivadas vistas lado a lado, metadados/transparência e links locais verificados. Não houve build nem testes de simulação, pois este lote altera referências e prévias de arte.', '']
    (DEST / 'LEIA-ME.md').write_text('\n'.join(text), encoding='utf-8')
    body = ['<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receitas — fontes e arte</title>',
            '<style>body{background:#eee8db;color:#29231c;font:16px system-ui;margin:24px}main{max-width:1200px;margin:auto}img{max-width:100%;height:auto}a{color:#075a80}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{background:#fff9eb;padding:20px;margin:0}figure img{max-height:350px;object-fit:contain}.note{background:white;padding:16px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:10px;border-bottom:1px solid #baac96}section{margin:36px 0}@media(max-width:650px){.pair{grid-template-columns:1fr}}</style><main>',
            '<h1>Receitas — cruzamento e lote de arte 01</h1><p>48 pratos indexados. Prévias de Pamonha e Tacos Triplos. Nenhum cadastro ou balanceamento foi alterado.</p>',
            '<p><a href="LEIA-ME.md">Relatório, especificações e fontes</a> · <a href="cruzamento.json">Dados estruturados</a> · <a href="../../video-cafe-mania-muito-tempo/receitas-0029-0046/index.html">Galeria dos 48 pratos no vídeo</a></p>',
            '<p class="note">Original ampliado: mesmos elementos, com interpolação convencional 4×. Image Gen: reconstrução transparente derivada, com diferenças nos contornos; não é o sprite original em alta resolução. A arte de preparo permanece pendente.</p>']
    for asset in art:
        body += [f'<section><h2>{asset["name"]}</h2><div class="pair">',
                 f'<figure><a href="{asset["conventional4x"]}"><img src="{asset["conventional4x"]}" alt="Original ampliado"></a><figcaption>Original ampliado 4× · <a href="{asset["reference"]}">recorte nativo</a></figcaption></figure>',
                 f'<figure><a href="{asset["derivedReconstruction"]}"><img src="{asset["derivedReconstruction"]}" alt="Prévia Image Gen"></a><figcaption>Prévia Image Gen · <a href="{asset["prompt"]}">prompt exato</a></figcaption></figure></div></section>']
    body += ['<section><h2>Fichas históricas dos avançados</h2><img src="fontes/avancados-P076.jpg" alt="Sete fichas P076"></section>',
             '<section><h2>Índice de evidências</h2><table><tr><th>Prato</th><th>Vídeo</th><th>Fontes adicionais</th></tr>']
    for row in recipes:
        refs = ', '.join(dict.fromkeys(c['source'] for c in row['historicalClaims'])) or 'Pendente'
        card = row['video']['cardEvidence']
        body += [f'<tr><td>{html.escape(row["name"])}</td><td><a href="../../video-cafe-mania-muito-tempo/receitas-0029-0046/{card["file"]}">{card["timecode"]}</a></td><td>{refs}</td></tr>']
    body += ['</table></section></main></html>']
    (DEST / 'index.html').write_text('\n'.join(body), encoding='utf-8')
    print(f'48 dishes indexed; {sum(bool(r["historicalClaims"]) for r in recipes)} with additional historical claims; 7 historical cards; 2 image previews.')


if __name__ == '__main__':
    main()
