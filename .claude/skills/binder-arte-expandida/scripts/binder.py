#!/usr/bin/env python3
"""Ferramentas para artes expandidas de binder 3x3 (MLPB Cards).

Subcomandos:
  recortar  <print.png> <saida.png> [--box x0,y0,x1,y1]
      Recorta a arte de uma captura de tela (tira barras pretas e a interface).
  expandir  <arte.png>
      Mostra quantos pixels pedir ao preenchimento generativo (Firefly) em cada
      lado para chegar a proporção exata da página 3x3 (+ margem lateral).
  montar    <config.json> <pasta_saida>
      Gera, para cada arte: arte_completa.png, pedaco_LxCy.png, folha_A4.png,
      previa_binder.jpg; e um PDF sem perdas com todas as folhas.

config.json:
  {"artes": [
     {"nome": "04_gengar", "imagem": "exp/04_gengar.png", "cartas": [[1,1]]},
     {"nome": "08_aves",   "imagem": "exp/08_aves.png",   "cartas": [[1,0],[1,1],[1,2]]}
  ]}
  cartas = posições [linha, coluna] (0 a 2) onde entra a carta de verdade.
"""
import sys, os, json, argparse

CARD_MM = (63, 88)      # pedaço = tamanho de uma carta
GRID = 3
DPI = 300
GAP_MM = 3              # espaço entre pedaços na folha (guia de corte)
A4_MM = (210, 297)
SIDE_EXPAND = 60        # px extras de cada lado na expansão


def mm(v):
    return round(v * DPI / 25.4)


def cmd_recortar(a):
    from PIL import Image
    import numpy as np
    im = Image.open(a.entrada).convert('RGB')
    if a.box:
        box = tuple(int(v) for v in a.box.split(','))
    else:
        lum = np.asarray(im).astype(int).sum(2)
        h, w = lum.shape
        mask = lum > 15
        # linhas onde a maior parte (fora da coluna de ícones à direita) não é preta
        rows = np.where(mask[:, : int(w * 0.85)].mean(1) > 0.6)[0]
        # pega o maior bloco contínuo de linhas
        best, cur = (0, 0), [rows[0], rows[0]]
        for y in rows[1:]:
            if y == cur[1] + 1: cur[1] = y
            else:
                if cur[1] - cur[0] > best[1] - best[0]: best = tuple(cur)
                cur = [y, y]
        if cur[1] - cur[0] > best[1] - best[0]: best = tuple(cur)
        y0, y1 = best
        cols = np.where(mask[y0:y1].mean(0) > 0.6)[0]
        x0, x1 = cols.min(), cols.max()
        box = (int(x0) + 3, int(y0) + 3, int(x1) - 2, int(y1) - 2)
    im.crop(box).save(a.saida)
    print('recorte', box, '->', a.saida, im.crop(box).size,
          '(confira se não pegou ícones laterais do app; se pegou, use --box)')


def expand_pixels(w, h):
    W = w + 2 * SIDE_EXPAND
    H = round(W * CARD_MM[1] / CARD_MM[0])
    d = H - h
    if d < 0:  # arte mais alta que a página: expandir mais nas laterais
        W = round(h * CARD_MM[0] / CARD_MM[1])
        dw = W - w
        return dict(left=dw // 2, right=dw - dw // 2, top=0, bottom=0)
    return dict(left=SIDE_EXPAND, right=SIDE_EXPAND, top=d // 2, bottom=d - d // 2)


def cmd_expandir(a):
    from PIL import Image
    w, h = Image.open(a.arte).size
    print(json.dumps({'expandPixels': expand_pixels(w, h)}))


def montar_uma(nome, img_path, cartas, out):
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
    TW, TH = mm(CARD_MM[0]), mm(CARD_MM[1])
    GAP = mm(GAP_MM)
    A4 = (mm(A4_MM[0]), mm(A4_MM[1]))
    slots = {tuple(c) for c in cartas}
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 40)
        small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 30)
    except Exception:
        font = small = ImageFont.load_default()
    d = os.path.join(out, nome); os.makedirs(d, exist_ok=True)
    art = Image.open(img_path).convert('RGB')
    if art.size != (GRID * TW, GRID * TH):
        art = art.resize((GRID * TW, GRID * TH), Image.LANCZOS)
        art = art.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    art.save(os.path.join(d, 'arte_completa.png'), dpi=(DPI, DPI))
    sheet = Image.new('RGB', A4, 'white'); dr = ImageDraw.Draw(sheet)
    ox = (A4[0] - (GRID * TW + (GRID - 1) * GAP)) // 2; oy = mm(12)
    titulo = nome.split('_', 1)[-1].replace('_', ' ').upper()
    dr.text((ox, mm(4)), f'{titulo}  —  {GRID*GRID-len(slots)} pedaços de cenário + {len(slots)} carta(s). '
            f'Imprimir em 100%. Corte: {CARD_MM[0]} x {CARD_MM[1]} mm.', fill='black', font=small)
    prev = art.copy(); pd = ImageDraw.Draw(prev, 'RGBA')
    for r in range(GRID):
        for c in range(GRID):
            box = (c * TW, r * TH, (c + 1) * TW, (r + 1) * TH)
            x, y = ox + c * (TW + GAP), oy + r * (TH + GAP)
            if (r, c) in slots:
                for i in range(0, TW, 30):
                    dr.line([(x + i, y), (x + min(i + 15, TW), y)], fill='gray', width=3)
                    dr.line([(x + i, y + TH), (x + min(i + 15, TW), y + TH)], fill='gray', width=3)
                for i in range(0, TH, 30):
                    dr.line([(x, y + i), (x, y + min(i + 15, TH))], fill='gray', width=3)
                    dr.line([(x + TW, y + i), (x + TW, y + min(i + 15, TH))], fill='gray', width=3)
                dr.text((x + TW // 2, y + TH // 2), 'CARTA', fill='gray', font=font, anchor='mm')
                pd.rectangle(box, fill=(0, 0, 0, 110))
                pd.text(((box[0] + box[2]) // 2, (box[1] + box[3]) // 2), 'CARTA', fill='white', font=font, anchor='mm')
            else:
                tile = art.crop(box)
                tile.save(os.path.join(d, f'pedaco_L{r+1}C{c+1}.png'), dpi=(DPI, DPI))
                sheet.paste(tile, (x, y))
    for k in range(1, GRID):
        pd.line([(k * TW, 0), (k * TW, GRID * TH)], fill=(255, 255, 255, 200), width=6)
        pd.line([(0, k * TH), (GRID * TW, k * TH)], fill=(255, 255, 255, 200), width=6)
    folha = os.path.join(d, 'folha_A4_impressao.png')
    sheet.save(folha, dpi=(DPI, DPI))
    p = prev.resize((TW * 3 // 4, TH * 3 // 4)); p.save(os.path.join(d, 'previa_binder.jpg'), quality=90)
    return folha, p


def cmd_montar(a):
    from PIL import Image
    cfg = json.load(open(a.config))
    base = os.path.dirname(os.path.abspath(a.config))
    os.makedirs(a.saida, exist_ok=True)
    folhas, prevs = [], []
    for it in cfg['artes']:
        img = it['imagem'] if os.path.isabs(it['imagem']) else os.path.join(base, it['imagem'])
        f, p = montar_uma(it['nome'], img, it.get('cartas', [[1, 1]]), a.saida)
        folhas.append(f); prevs.append(p)
    pdf = os.path.join(a.saida, 'TODAS_as_folhas_A4.pdf')
    try:
        import img2pdf  # PDF sem perdas (PNG embutido, 300 dpi, A4 exato)
    except ImportError:
        os.system(f'{sys.executable} -m pip install -q img2pdf')
        import img2pdf
    layout = img2pdf.get_layout_fun((img2pdf.mm_to_pt(A4_MM[0]), img2pdf.mm_to_pt(A4_MM[1])))
    with open(pdf, 'wb') as fh:
        fh.write(img2pdf.convert(folhas, layout_fun=layout))
    w, h = prevs[0].size; s = 0.5; w2, h2 = int(w * s), int(h * s); n = len(prevs); cols = min(5, n)
    rows = (n + cols - 1) // cols
    board = Image.new('RGB', (cols * (w2 + 10) + 10, rows * (h2 + 10) + 10), 'white')
    for i, p in enumerate(prevs):
        board.paste(p.resize((w2, h2)), (10 + (i % cols) * (w2 + 10), 10 + (i // cols) * (h2 + 10)))
    board.save(os.path.join(a.saida, 'visao_geral.jpg'), quality=88)
    print('ok ->', a.saida)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest='cmd', required=True)
    r = sp.add_parser('recortar'); r.add_argument('entrada'); r.add_argument('saida'); r.add_argument('--box')
    e = sp.add_parser('expandir'); e.add_argument('arte')
    m = sp.add_parser('montar'); m.add_argument('config'); m.add_argument('saida')
    a = ap.parse_args()
    {'recortar': cmd_recortar, 'expandir': cmd_expandir, 'montar': cmd_montar}[a.cmd](a)


if __name__ == '__main__':
    main()
