"""Corta os silêncios e as partes paradas das gravações (usa o auto-editor).

Exemplos:
  python cortar_silencio.py "D:/Gravacoes/Abertura 151"
      -> cria um .xml por vídeo; importe no Premiere (Arquivo > Importar)
         e cada um vira uma sequência já cortada, sem perder qualidade.

  python cortar_silencio.py "D:/Gravacoes/Abertura 151" --video
      -> cria "cortados/" com MP4s já cortados; depois use essa pasta no
         script 1_montar_video.jsx do Premiere.

Ajustes:
  --limiar 4     volume (%) abaixo do qual conta como silêncio (suba se há ruído de fundo)
  --margem 0.3   segundos mantidos antes/depois de cada fala (evita cortes secos)
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from _comum import erro, exigir, listar_videos


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("entradas", nargs="+", help="vídeos ou pastas com vídeos")
    ap.add_argument("--limiar", type=float, default=4, help="limiar de silêncio em %% (padrão 4)")
    ap.add_argument("--margem", type=float, default=0.3, help="margem em segundos (padrão 0.3)")
    ap.add_argument("--video", action="store_true", help="gera MP4 cortado em vez de XML do Premiere")
    ap.add_argument("--saida", help="pasta de saída (padrão: 'cortados' ao lado dos vídeos)")
    args = ap.parse_args()

    auto_editor = exigir("auto-editor", "Instale com: pip install auto-editor")
    videos = listar_videos(args.entradas)

    for i, v in enumerate(videos, 1):
        pasta = Path(args.saida) if args.saida else v.parent / "cortados"
        pasta.mkdir(parents=True, exist_ok=True)
        destino = pasta / (v.stem + (".mp4" if args.video else ".xml"))
        print(f"[{i}/{len(videos)}] {v.name} -> {destino}")
        cmd = [auto_editor, str(v), "--edit", f"audio:threshold={args.limiar}%",
               "--margin", f"{args.margem}s", "-o", str(destino), "--no-open"]
        if not args.video:
            cmd += ["--export", "premiere"]
        r = subprocess.run(cmd)
        if r.returncode != 0:
            erro(f"o auto-editor falhou em {v.name}")

    print("\nPronto!", "Use a pasta 'cortados' no 1_montar_video.jsx." if args.video
          else "Importe os .xml no Premiere (Arquivo > Importar).")


if __name__ == "__main__":
    sys.exit(main())
