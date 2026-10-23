"""Publish a manually transcribed, source-linked recipe reference catalogue."""
import html
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'artes-referencia/video-cafe-mania-muito-tempo/receitas-0029-0046'

# Order is left-to-right, top-to-bottom within each observed category/page.
# None means this clip does not establish the value, never a zero/default.
ROWS = [
    ('basico-01', [
        ('Nachos de Queijo', '3 min', 3), ('X-Tudo', '8 min', 8),
        ('Mousse de Maracujá', '35 min', 30), ('Churrasco', '6.0 hs', 75),
        ('Pamonha', '12.0 hs', 100), ('Tacos Triplos', '4.0 hs', 55)]),
    ('basico-02', [
        ('Vatapá', '60 min', 25), ('Mandioquinha', '12 min', 50),
        ('Arroz de Carreteiro', '2.0 hs', 100), ('Quindim', '25 min', 55),
        ('Salada Caesar', '10 min', 15), ('Bolo de Cenoura', '18.0 hs', 90)]),
    ('avancado-01', [
        ('Super À La Minuta', '3.0 hs', 70), ('Carré de Carneiro', '8.0 hs', 90),
        ('Torta de Limão da Vovó', '50 min', 50), ('Lagosta Nobre', '15.0 hs', 170),
        ('Batatas Sorridentes', '30 min', 15), ('Salmão com Alcaparras', '21.0 hs', 130)]),
    ('avancado-02', [
        ('Pimentão Recheado do Chef', '25 min', 38), ('Banana Split', '13.3 hs', 190),
        ('Waffles com Mel e Frutas', '3.0 hs', 35), ('Churrasquinho', '12.0 hs', 130),
        ('Monstro de Bacon', '21.0 hs', 215), ('Salada Crispy', '44.0 hs', 420)]),
    ('avancado-03', [
        ('Kebabs de Salmão', '8 min', 160), ('Bolo Floresta Negra', '9.0 hs', 99),
        ('Exótico Curry com Lagosta', '7.0 hs', 103), ('Canapés de Caviar', '33.0 hs', 1120),
        ('Croissant de Filé e Queijo', '25 min', 40), ('Confit de Pato', '34.0 hs', 1020)]),
    ('avancado-04', [
        ('Baguette com Salmão', '2.0 hs', 180), ('Pernil Supremo', '15.0 hs', 185),
        ('Peru Real de Natal', '27.0 hs', 1230), ('Chop Suey de Frango', '30 min', 45),
        ('Polenta Frita', '12.7 hs', 373), ('Coroa de Gelatina', '4.0 hs', 260)]),
    ('avancado-05', [
        ('Strogonoff', '2.0 hs', 35), ('Arroz com Feijão e Ovo', '30.0 hs', 882),
        ('Panquecas de Carne', '12.0 hs', 309), ('Coxinha de Frango', '14.0 hs', 259),
        ('Bolo de Chocolate', '6.0 hs', 271), ('Sorvete de Morango', '20.0 hs', 328)]),
    ('avancado-06', [
        ('Bife à Parmegiana', '16.0 hs', 960), ('Suspiros Recheados', '28.0 hs', 1655),
        ('Cupcakes Monstruosos', '11.0 hs', 810), ('Bolo Zumbi', '14.0 hs', 1000),
        ('Ovos Benedict', None, None), ('Profiteroles', '12.0 hs', 900)]),
]
# Original sparse frame numbers refer to quadros.json (not the dense temporary scan).
DETAILS = {
    'Churrasco': (5, 250, 110, 7),
    'Tacos Triplos': (8, 120, 50, 11),
    'Vatapá': (13, 60, 65, 4),
    'Mandioquinha': (11, 50, 32, 4),
    'Lagosta Nobre': (15, 430, 170, 10),
    'Salmão com Alcaparras': (18, 260, 265, 5),
    'Bolo Zumbi': ('avancado-06', 900, 160, 6),
    'Profiteroles': (50, 5400, 600, 9),
    'Suspiros Recheados': (57, 4080, 750, 7),
}
LEVELS = {'Bolo Zumbi': 135, 'Ovos Benedict': 140, 'Profiteroles': 141}
VIP = {'Salada Crispy', 'Bolo Floresta Negra', 'Exótico Curry com Lagosta', 'Pernil Supremo'}


def main():
    pages = json.loads((DEST / 'paginas.json').read_text(encoding='utf-8'))['pages']
    frame_manifest = json.loads((DEST / 'quadros.json').read_text(encoding='utf-8'))
    panel_dir = DEST / 'paineis'
    panel_dir.mkdir(exist_ok=True)
    recipes = []
    for page_id, rows in ROWS:
        page = next(p for p in pages if p['page'] == page_id)
        for slot, (name, duration, xp) in enumerate(rows, 1):
            card = page['cards'][slot - 1]
            record = {
                'name': name, 'category': 'Básico' if page_id.startswith('basico') else 'Avançado',
                'observedPage': int(page_id[-2:]), 'slotInPage': slot,
                'readingOrder': 'left-to-right, top-to-bottom; observed pages only',
                'durationDisplay': duration, 'xp': xp,
                'costGold': None, 'portions': None, 'saleGoldPerPortion': None,
                'unlockLevel': LEVELS.get(name), 'earlyUnlockGrana': 18 if name in LEVELS else None,
                'vipBadgeVisible': name in VIP,
                'cardEvidence': card,
                'fieldEvidence': {'name': 'cardEvidence', 'durationDisplay': 'cardEvidence', 'xp': 'cardEvidence'},
                'artStatus': 'captured-card-reference; opaque background, not a runtime sprite',
                'preparationArt': None, 'notes': [],
            }
            if name in LEVELS:
                record['fieldEvidence']['unlockLevel'] = 'cardEvidence'
                record['fieldEvidence']['earlyUnlockGrana'] = 'cardEvidence'
                record['artStatus'] = 'locked-card-silhouette-reference'
            if name in DETAILS:
                frame, cost, portions, sale = DETAILS[name]
                if isinstance(frame, str):
                    source_page = next(p for p in pages if p['page'] == frame)
                    evidence = {k: source_page[k] for k in ('file', 'timestampSeconds', 'timecode')}
                else:
                    evidence = frame_manifest['frames'][frame - 1]
                record.update(costGold=cost, portions=portions, saleGoldPerPortion=sale)
                file = f'paineis/{page_id}-slot-{slot:02d}.png'
                with Image.open(DEST / evidence['file']) as image:
                    image.crop((790, 145, 1060, 630)).save(DEST / file)
                record['detailEvidence'] = {**evidence, 'panelCrop': file}
                for key in ('costGold', 'portions', 'saleGoldPerPortion'):
                    record['fieldEvidence'][key] = 'detailEvidence'
                if name in ('Bolo Zumbi', 'Profiteroles'):
                    record['fieldEvidence']['durationDisplay'] = 'detailEvidence'
                    record['fieldEvidence']['xp'] = 'detailEvidence'
            if name == 'Bolo Zumbi':
                record['artStatus'] = 'coloured-detail-reference-and-locked-card'
                record['notes'].append('The selected detail frame shows the matching zombie cake. Nearby frames show stale profiteroles art under this title; those are not valid art references.')
            if name == 'Profiteroles':
                record['artStatus'] = 'coloured-detail-reference-and-locked-card'
                record['notes'].append('At 41.575 the panel still shows Bolo Zumbi art; the later cited detail frame shows the matching profiteroles image.')
            if name == 'Ovos Benedict':
                record['notes'].append('No readable duration/XP or detail panel in this segment.')
            if duration and duration.startswith(('13.3', '12.7')):
                record['notes'].append('Displayed decimal hours may be rounded; exact duration in seconds is unconfirmed.')
            if name == 'Ovos Benedict':
                record['fieldEvidence']['durationDisplay'] = None
                record['fieldEvidence']['xp'] = None
            recipes.append(record)
    payload = {'source': frame_manifest['source'], 'sha256': frame_manifest['sha256'],
               'capturedVersionDate': None, 'reviewDate': '2026-10-21',
               'scope': 'Video reference only. No runtime catalogue changes. Unknown values remain null.',
               'recipes': recipes}
    (DEST / 'receitas.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    lines = [
        '# Livro de receitas — referência do vídeo', '',
        'Fonte: `cafe mania muito tempo de jogo.mp4`, fornecido pelo responsável. Revisão: 21/10/2026. Data e edição da gravação não confirmadas.', '',
        '**48 pratos identificados em oito páginas observadas: 12 básicos e 36 avançados.** Há duração e XP para 47; nove têm custo, porções e venda legíveis no painel lateral. Não é uma transcrição do livro inteiro.', '',
        '[Abrir galeria visual](index.html) · [Dados das receitas](receitas.json) · [Tempos dos 64 quadros](quadros.json) · [Seleção das páginas](paginas.json)', '',
        '## Captura e carregamento', '',
        'O vídeo tem 1280×720, aproximadamente 29,97 quadros/s e 2min14s. Foram preservados 64 PNGs amostrados de 29 a 46 segundos; uma segunda passagem analisou todos os 509 quadros do intervalo para selecionar oito páginas e 48 cartões com as imagens carregadas. A varredura densa fica no cache `.runtime/recipe-video/todos/`; as melhores capturas e seus tempos ficam nesta pasta.', '',
        'Os PNGs completos mantêm a resolução nativa. Os cartões e painéis são recortes retangulares, sem alteração de pixels, reconstrução ou aumento artificial de resolução. As folhas de contato são apenas miniaturas para navegação. A seleção usa comparação dos títulos e detalhes na região da arte, seguida de inspeção visual; não é reconhecimento automático confiável das regras.', '',
        'Ao mudar de página, o painel lateral pode continuar mostrando Salmão com Alcaparras; os números desse painel pertencem somente ao título lateral. Há também troca atrasada da própria imagem: Bolo Zumbi aparece momentaneamente com arte de Profiteroles e vice-versa. Essas imagens não foram tratadas como referência válida do prato errado.', '',
        '## Ordem e lacunas', '',
        'A primeira página mostra Nachos → X-Tudo → Mousse → Churrasco → Pamonha → Tacos Triplos, lendo por linhas. A página seguinte começa com Vatapá e Mandioquinha. Depois o jogador muda para Avançado, sem percorrer todo o Básico. A ordem abaixo registra somente as páginas vistas, sem provar níveis individuais ou completar lacunas com o XML modificado.', '',
        'O vídeo mostra Churrasco com **75 XP e 110 porções**, diferente dos 110 XP e 100 porções atualmente escolhidos no jogo. É uma divergência de versão documentada, sem atualização automática do balanceamento. Os valores dos demais pratos ficam vinculados exclusivamente a esta gravação.', '',
        'Campos ausentes aparecem como “—”, não zero. Horas decimais são transcritas como exibidas; 13.3 e 12.7 não comprovam segundos exatos. Os níveis 135, 140 e 141 e o desbloqueio antecipado por 18 granas são legíveis nos três cartões bloqueados. Um prato disponível para este jogador não comprova seu nível mínimo.', '',
        '## Especificações transcritas', '',
        '| Página / posição | Receita | Tempo exibido | XP | Custo (ouro) | Porções | Ouro/porção | Nível confirmado | Evidência |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ]
    def show(value):
        return '—' if value is None else str(value)
    for r in recipes:
        evidence = r.get('detailEvidence', r['cardEvidence'])
        lines.append(f"| {r['category']} {r['observedPage']}/{r['slotInPage']} | {r['name']} | {show(r['durationDisplay'])} | {show(r['xp'])} | {show(r['costGold'])} | {show(r['portions'])} | {show(r['saleGoldPerPortion'])} | {show(r['unlockLevel'])} | [{evidence['timecode']}]({evidence['file']}) |")
    lines += ['', '## Páginas selecionadas', '']
    for page in pages:
        lines += [f"### {page['page']} — {page['timecode']}", '', f"![{page['page']}]({page['file']})", '']
    lines += ['## Uso futuro da arte', '',
              'As capturas e cartões são referências comprimidas com fundo e interface. Não são PNGs transparentes prontos para o jogo. O trecho não fornece as etapas de preparo no fogão. Antes de cadastrar qualquer prato, localizar arte original aproveitável no acervo ou reconstruir com Image Gen a partir da referência; registrar a reconstrução e calibrar os assets. Nenhuma arte foi gerada e nenhuma receita foi implementada nesta catalogação.', '',
              'Para reproduzir: executar `tools/video-reference/extract_recipe_reference.py` com o vídeo e esta pasta; repetir com `--interval 0.001` para `.runtime/recipe-video/todos`; executar `select_recipe_pages.py` e `catalogue_recipe_video.py`. A extração usa FFmpeg/FFprobe; a seleção exige Pillow e NumPy. As transcrições ficam declaradas no script de catálogo e exigem revisão humana.', '']
    (DEST / 'LEIA-ME.md').write_text('\n'.join(lines), encoding='utf-8')
    body = ['<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
            '<title>Café Mania — referências do vídeo</title><style>body{font:16px system-ui;margin:24px;background:#f4f0e7;color:#29231c}main{max-width:1280px;margin:auto}a{color:#075a80}img{max-width:100%;height:auto}section{margin:36px 0}article{background:white;padding:12px;border-radius:8px}article img{width:248px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px}small{display:block;color:#555}figure{margin:12px 0}.page{width:100%;max-width:960px}input{padding:10px;width:min(450px,90%)}[hidden]{display:none!important}</style><main>',
            '<h1>Livro de receitas — capturas do vídeo</h1><p>48 pratos · 8 páginas · 9 fichas com economia visível · 29–46 segundos</p>',
            '<p>Referência histórica: a data da gravação é desconhecida. Valores ausentes não foram estimados. Capturas com fundo e compressão, sem arte de preparo e sem cadastro no jogo.</p>',
            '<p><a href="LEIA-ME.md">Relatório e tabela</a> · <a href="receitas.json">Dados com fontes</a> · <a href="quadros.json">Quadros e tempos</a> · <a href="cartoes-01.jpg">Cartões 1–24</a> · <a href="cartoes-02.jpg">Cartões 25–48</a></p>',
            '<label>Filtrar pratos <input id="filter" type="search" placeholder="Nome ou categoria"></label>']
    for page in pages:
        body += [f'<section><h2>{page["page"]} · {page["timecode"]}</h2>',
                 f'<a href="{page["file"]}"><img class="page" loading="lazy" src="{page["file"]}" alt="Página completa {page["page"]}"></a><div class="cards">']
        for r in recipes:
            if f"{'basico' if r['category'] == 'Básico' else 'avancado'}-{r['observedPage']:02d}" != page['page']:
                continue
            card = r['cardEvidence']
            body += [f'<article data-search="{html.escape(r["name"] + " " + r["category"], quote=True)}"><h3>{html.escape(r["name"])}</h3>',
                     f'<a href="{card["file"]}"><img loading="lazy" src="{card["file"]}" alt="Cartão original"></a>',
                     f'<p>Tempo: {show(r["durationDisplay"])} · XP: {show(r["xp"])}</p>',
                     f'<p>Custo: {show(r["costGold"])} · Porções: {show(r["portions"])} · Ouro/porção: {show(r["saleGoldPerPortion"])}</p>',
                     f'<small>Cartão: {card["timecode"]} · Nível confirmado: {show(r["unlockLevel"])}</small>']
            if 'detailEvidence' in r:
                d = r['detailEvidence']
                body += [f'<p><a href="{d["panelCrop"]}">Painel de especificações · {d["timecode"]}</a></p>']
            if r['name'] == 'Bolo Zumbi':
                body += ['<p>A arte correta foi recuperada no painel selecionado; outros instantes mostram Profiteroles sob este título devido ao atraso de carregamento.</p>']
            body += ['</article>']
        body += ['</div></section>']
    body += ["<script>const normalize=s=>s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();document.querySelector('#filter').addEventListener('input',e=>{for(const card of document.querySelectorAll('article'))card.hidden=!normalize(card.dataset.search).includes(normalize(e.target.value))});</script></main></html>"]
    (DEST / 'index.html').write_text('\n'.join(body), encoding='utf-8')
    for offset in (0, 24):
        sheet = Image.new('RGB', (1024, 930), '#eee8db')
        draw = ImageDraw.Draw(sheet)
        for i, record in enumerate(recipes[offset:offset + 24]):
            x, y = i % 4 * 256, i // 4 * 155
            card = record['cardEvidence']
            with Image.open(DEST / card['file']) as image:
                sheet.paste(image, (x, y + 25))
            draw.text((x + 5, y + 5), card['timecode'], fill='black')
        sheet.save(DEST / f'cartoes-{offset // 24 + 1:02d}.jpg', quality=96)
    assert len(recipes) == 48
    print(f'{len(recipes)} recipes; {len(DETAILS)} detail panels; gallery and source-linked report saved.')


if __name__ == '__main__':
    main()
