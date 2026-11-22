"""Gera thumbnails 1280x720 para o YouTube no padrão MLPB Cards.

Pega um quadro do vídeo, escurece a lateral, escreve o texto grande (branco com
contorno laranja), põe a logo e, se quiser, a imagem da carta em destaque.

Exemplos:
  python thumbnail.py video.mp4 --texto "PUXEI A CHARIZARD!"
  python thumbnail.py video.mp4 --tempo 12:34 --texto "ABRI 10 BOOSTERS" --carta charizard.png
  python thumbnail.py video.mp4 --texto "HIT INSANO" --carta https://assets.tcgdex.net/pt/sv/sv03.5/199/high.png
  python thumbnail.py video.mp4 --texto "QUAL VOCÊ ESCOLHE?" --opcoes 4   (4 versões, em momentos diferentes)
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

from _comum import LARANJA, LOGO_PADRAO, erro, ffmpeg, fonte_padrao, info_video, tempo_em_segundos

LARG, ALT = 1280, 720


def extrair_quadro(video: Path, segundo: float, destino: Path) -> Image.Image:
    subprocess.run([ffmpeg(), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{segundo:.2f}",
                    "-i", str(video), "-frames:v", "1", str(destino)], check=True)
    if not destino.exists():
        erro(f"não consegui pegar o quadro em {segundo:.1f}s (o vídeo é mais curto?)")
    return Image.open(destino).convert("RGB")


def preencher(img: Image.Image, w: int, h: int) -> Image.Image:
    escala = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * escala), round(img.height * escala)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def carregar_carta(origem: str, tmp: Path) -> Image.Image:
    if origem.startswith("http"):
        destino = tmp / "carta.png"
        req = urllib.request.Request(origem, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                destino.write_bytes(r.read())
        except OSError as e:
            erro(f"não consegui baixar a imagem da carta ({e}). Baixe-a e passe o arquivo em --carta.")
        origem = str(destino)
    return Image.open(origem).convert("RGBA")


def quebrar_texto(draw: ImageDraw.ImageDraw, texto: str, fonte_arq: str, larg_max: int, alt_max: int):
    """Acha o maior tamanho de fonte em que o texto cabe na caixa (quebrando linhas)."""
    palavras = texto.split()
    for tamanho in range(150, 40, -4):
        fonte = ImageFont.truetype(fonte_arq, tamanho)
        linhas, atual = [], ""
        for p in palavras:
            teste = f"{atual} {p}".strip()
            if draw.textlength(teste, font=fonte) <= larg_max or not atual:
                atual = teste
            else:
                linhas.append(atual)
                atual = p
        linhas.append(atual)
        alt_linha = tamanho * 1.08
        if len(linhas) * alt_linha <= alt_max and all(draw.textlength(l, font=fonte) <= larg_max for l in linhas):
            return fonte, linhas, alt_linha
    fonte = ImageFont.truetype(fonte_arq, 44)
    return fonte, [texto], 48


def gerar(quadro: Image.Image, texto: str, fonte_arq: str, logo: Path | None, carta: Image.Image | None) -> Image.Image:
    base = preencher(quadro, LARG, ALT)
    base = ImageEnhance.Contrast(base).enhance(1.15)
    base = ImageEnhance.Color(base).enhance(1.25).convert("RGBA")

    # Escurece a esquerda (onde fica o texto) em degradê.
    sombra = Image.new("L", (LARG, 1))
    for x in range(LARG):
        sombra.putpixel((x, 0), int(215 * max(0.0, 1 - x / (LARG * 0.75))))
    preto = Image.new("RGBA", (LARG, ALT), (0, 0, 0, 255))
    preto.putalpha(sombra.resize((LARG, ALT)))
    base = Image.alpha_composite(base, preto)

    area_texto = LARG - 80
    if carta is not None:
        alt_c = 620
        carta = carta.resize((round(carta.width * alt_c / carta.height), alt_c), Image.LANCZOS)
        carta = carta.rotate(-6, expand=True, resample=Image.BICUBIC)
        brilho = Image.new("RGBA", carta.size, LARANJA + (0,))
        brilho.putalpha(carta.getchannel("A").filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(18)))
        x = LARG - carta.width - 30
        y = (ALT - carta.height) // 2
        base.alpha_composite(brilho, (x, y))
        base.alpha_composite(brilho, (x, y))
        base.alpha_composite(carta, (x, y))
        area_texto = x - 70

    draw = ImageDraw.Draw(base)
    topo_texto = 40
    if logo:
        lg = Image.open(logo).convert("RGBA")
        lg = lg.resize((150, round(lg.height * 150 / lg.width)), Image.LANCZOS)
        base.alpha_composite(lg, (40, 30))
        topo_texto = 30 + lg.height + 10

    fonte, linhas, alt_linha = quebrar_texto(draw, texto.upper(), fonte_arq, area_texto, ALT - topo_texto - 40)
    y = topo_texto + (ALT - topo_texto - 40 - len(linhas) * alt_linha) / 2
    contorno = max(4, fonte.size // 14)
    for linha in linhas:
        draw.text((46, y + 6), linha, font=fonte, fill=(0, 0, 0, 180), stroke_width=contorno, stroke_fill=(0, 0, 0, 180))
        draw.text((40, y), linha, font=fonte, fill="white", stroke_width=contorno, stroke_fill=LARANJA)
        y += alt_linha
    return base.convert("RGB")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--texto", required=True, help="texto grande da thumbnail")
    ap.add_argument("--tempo", help="momento do quadro (ex.: 83, 1:23, 0:12:34). Padrão: meio do vídeo")
    ap.add_argument("--carta", help="imagem da carta (arquivo ou link, ex.: imagem do TCGdex)")
    ap.add_argument("--opcoes", type=int, default=1, help="gera N versões em momentos diferentes")
    ap.add_argument("--logo", default=str(LOGO_PADRAO), help="imagem da logo ('' para não usar)")
    ap.add_argument("--fonte", help="arquivo .ttf")
    ap.add_argument("--saida", help="arquivo .jpg de saída (padrão: <video>_thumb.jpg)")
    args = ap.parse_args()

    video = Path(args.video)
    if not video.exists():
        erro(f"vídeo não encontrado: {video}")
    dur = info_video(video)["duracao"]
    if args.tempo:
        tempos = [tempo_em_segundos(args.tempo)]
    else:
        n = max(1, args.opcoes)
        tempos = [dur * (k + 1) / (n + 1) for k in range(n)]

    fonte = fonte_padrao(args.fonte)
    logo = Path(args.logo) if args.logo and Path(args.logo).exists() else None
    tmp = Path(tempfile.mkdtemp(prefix="mlpb_"))
    carta = carregar_carta(args.carta, tmp) if args.carta else None

    base_saida = Path(args.saida) if args.saida else video.with_name(video.stem + "_thumb.jpg")
    for i, t in enumerate(tempos, 1):
        quadro = extrair_quadro(video, t, tmp / f"quadro_{i}.png")
        thumb = gerar(quadro, args.texto, fonte, logo, carta)
        destino = base_saida if len(tempos) == 1 else base_saida.with_name(f"{base_saida.stem}_{i}{base_saida.suffix}")
        thumb.save(destino, quality=92)
        print(f"Thumbnail ({t:.1f}s): {destino}")


if __name__ == "__main__":
    sys.exit(main())
