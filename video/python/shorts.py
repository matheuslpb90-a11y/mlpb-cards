"""Transforma cortes horizontais em vídeos verticais 9:16 (Shorts, Reels, TikTok).

Layout: fundo desfocado do próprio vídeo, vídeo no meio (com zoom), logo da MLPB
no topo, título acima do vídeo e legenda (se houver) abaixo.

Exemplos:
  python shorts.py "D:/Projeto/saida/Abertura_151/hits"
      -> um vertical por hit em hits/verticais/. O título vem do nome do arquivo
         ("03_Charizard_ex.mp4" -> "CHARIZARD EX").

  python shorts.py hit.mp4 --titulo "PUXEI A CHARIZARD!!" --legenda hit.srt
  python shorts.py pasta --modelo "PUXEI {nome}!" --zoom 1.4
  python shorts.py pasta --sem-titulo

Legendas: se existir um .srt com o mesmo nome do vídeo, ele é queimado no vídeo
automaticamente (no Premiere: Texto > Transcrever > Legendas > Exportar para .srt).
"""
from __future__ import annotations

import argparse
import re
import sys
import tempfile
import textwrap
from pathlib import Path

from _comum import (LARANJA_HEX, LOGO_PADRAO, escapar_filtro, ffmpeg, fonte_padrao, info_video,
                    listar_videos, rodar)

LARG, ALT = 1080, 1920


def titulo_do_arquivo(arquivo: Path, modelo: str) -> str:
    nome = re.sub(r"^\d+[_\-\s]*", "", arquivo.stem)  # tira o "03_" do começo
    nome = re.sub(r"^HIT[_\-\s]*", "", nome, flags=re.I)
    nome = nome.replace("_", " ").strip()
    return modelo.replace("{nome}", nome) if nome else ""


def par(n: float) -> int:
    return int(round(n / 2)) * 2


def montar_filtro(info: dict, zoom: float, logo: bool, titulo_txt: Path | None, fonte: str,
                  legenda: Path | None) -> str:
    w, h = info["largura"], info["altura"]
    partes = [
        "[0:v]split[a][b]",
        f"[a]scale={LARG}:{ALT}:force_original_aspect_ratio=increase,crop={LARG}:{ALT},"
        "gblur=sigma=40,eq=brightness=-0.12[bg]",
    ]
    if h >= w:  # já é vertical: só preenche a tela
        partes.append(f"[b]scale={LARG}:{ALT}:force_original_aspect_ratio=increase,crop={LARG}:{ALT}[fg]")
        topo, base = 0, ALT
    else:
        larg_zoom = par(LARG * zoom)
        alt_fg = min(par(larg_zoom * h / w), ALT)
        partes.append(f"[b]scale={larg_zoom}:{alt_fg},crop={LARG}:{alt_fg}[fg]")
        topo = (ALT - alt_fg) // 2
        base = topo + alt_fg
    partes.append("[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[v0]")
    atual = "v0"

    if logo:
        partes.append("[1:v]scale=200:-1[lg]")
        partes.append(f"[{atual}][lg]overlay=(W-w)/2:70[v1]")
        atual = "v1"

    if titulo_txt:
        y = f"{topo}-text_h-40" if topo > 420 else "330"
        partes.append(
            f"[{atual}]drawtext=fontfile='{escapar_filtro(fonte)}':textfile='{escapar_filtro(titulo_txt)}':"
            f"fontsize=74:fontcolor=white:borderw=8:bordercolor=0x{LARANJA_HEX}:line_spacing=14:"
            f"x=(w-text_w)/2:y={y}[v2]"
        )
        atual = "v2"

    if legenda:
        # As medidas do estilo da legenda são numa tela de 288 de altura (padrão do libass).
        dist_baixo = max(ALT - base - 170, 120) if base < ALT else 380
        margem_v = int(dist_baixo * 288 / ALT)
        estilo = (f"FontName=Arial Black,FontSize=13,PrimaryColour=&H00FFFFFF,"
                  f"OutlineColour=&H00{LARANJA_HEX[4:6]}{LARANJA_HEX[2:4]}{LARANJA_HEX[0:2]},"
                  f"BorderStyle=1,Outline=2.5,Shadow=0,Alignment=2,MarginV={margem_v}")
        partes.append(f"[{atual}]subtitles='{escapar_filtro(legenda)}':force_style='{estilo}'[v3]")
        atual = "v3"

    partes.append(f"[{atual}]format=yuv420p[vout]")
    return ";\n".join(partes)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("entradas", nargs="+", help="vídeos ou pastas com vídeos")
    ap.add_argument("--titulo", help="texto do título (para um vídeo só)")
    ap.add_argument("--modelo", default="{nome}", help='modelo do título a partir do nome do arquivo, ex.: "PUXEI {nome}!"')
    ap.add_argument("--sem-titulo", action="store_true", help="não escreve título")
    ap.add_argument("--legenda", help="arquivo .srt para queimar (para um vídeo só)")
    ap.add_argument("--zoom", type=float, default=1.25, help="zoom do vídeo central (padrão 1.25)")
    ap.add_argument("--logo", default=str(LOGO_PADRAO), help="imagem da logo ('' para não usar)")
    ap.add_argument("--fonte", help="arquivo .ttf da fonte do título")
    ap.add_argument("--saida", help="pasta de saída (padrão: 'verticais' ao lado dos vídeos)")
    args = ap.parse_args()

    videos = listar_videos(args.entradas)
    fonte = fonte_padrao(args.fonte)
    logo = Path(args.logo) if args.logo and Path(args.logo).exists() else None
    tmp = Path(tempfile.mkdtemp(prefix="mlpb_"))

    for i, v in enumerate(videos, 1):
        info = info_video(v)
        pasta = Path(args.saida) if args.saida else v.parent / "verticais"
        pasta.mkdir(parents=True, exist_ok=True)
        destino = pasta / f"{v.stem}_vertical.mp4"

        texto = "" if args.sem_titulo else (args.titulo if args.titulo and len(videos) == 1
                                             else titulo_do_arquivo(v, args.modelo))
        titulo_txt = None
        if texto:
            titulo_txt = tmp / f"titulo_{i}.txt"
            titulo_txt.write_text("\n".join(textwrap.wrap(texto.upper(), 20)), encoding="utf-8")

        legenda = Path(args.legenda) if args.legenda and len(videos) == 1 else v.with_suffix(".srt")
        legenda = legenda if legenda.exists() else None

        filtro = montar_filtro(info, args.zoom, bool(logo), titulo_txt, fonte, legenda)
        arq_filtro = tmp / f"filtro_{i}.txt"
        arq_filtro.write_text(filtro, encoding="utf-8")

        cmd = [ffmpeg(), "-hide_banner", "-y", "-i", str(v)]
        if logo:
            cmd += ["-i", str(logo)]
        cmd += ["-filter_complex_script", str(arq_filtro), "-map", "[vout]"]
        if info["tem_audio"]:
            cmd += ["-map", "0:a:0", "-c:a", "aac", "-b:a", "192k"]
        cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-movflags", "+faststart", str(destino)]

        print(f"[{i}/{len(videos)}] {v.name} -> {destino.name}"
              + (f'  título: "{texto}"' if texto else "") + ("  + legenda" if legenda else ""))
        rodar(cmd)

    print(f"\nPronto! {len(videos)} vídeo(s) vertical(is) em: {pasta}")


if __name__ == "__main__":
    sys.exit(main())
