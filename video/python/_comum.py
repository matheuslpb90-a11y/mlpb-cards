"""Funções compartilhadas pelos scripts de vídeo da MLPB Cards."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

PASTA_VIDEO = Path(__file__).resolve().parent.parent
LOGO_PADRAO = PASTA_VIDEO.parent / "marca" / "logo-mlpb-cards-1235px.png"
EXTENSOES = {".mp4", ".mov", ".m4v", ".mts", ".mkv", ".avi"}

LARANJA = (242, 107, 15)  # laranja da marca
LARANJA_HEX = "F26B0F"

FONTES = [
    "C:/Windows/Fonts/ariblk.ttf",        # Arial Black (Windows)
    "C:/Windows/Fonts/impact.ttf",
    "/System/Library/Fonts/Supplemental/Arial Black.ttf",  # macOS
    "/Library/Fonts/Arial Black.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux
]


def erro(msg: str) -> None:
    print(f"ERRO: {msg}", file=sys.stderr)
    sys.exit(1)


def exigir(programa: str, dica: str) -> str:
    caminho = shutil.which(programa)
    if not caminho:
        erro(f"'{programa}' não encontrado. {dica}")
    return caminho


def ffmpeg() -> str:
    return exigir("ffmpeg", "Instale o FFmpeg (https://ffmpeg.org) e coloque-o no PATH.")


def ffprobe() -> str:
    return exigir("ffprobe", "Ele vem junto com o FFmpeg.")


def fonte_padrao(escolhida: str | None = None) -> str:
    for f in ([escolhida] if escolhida else []) + FONTES:
        if f and Path(f).exists():
            return f
    erro("Nenhuma fonte encontrada. Use --fonte C:/caminho/da/fonte.ttf")
    return ""


def listar_videos(entradas: list[str]) -> list[Path]:
    """Aceita arquivos e/ou pastas; devolve os vídeos em ordem de nome."""
    videos: list[Path] = []
    for e in entradas:
        p = Path(e)
        if p.is_dir():
            videos += sorted(f for f in p.iterdir() if f.suffix.lower() in EXTENSOES)
        elif p.is_file():
            videos.append(p)
        else:
            print(f"Aviso: não encontrado: {e}", file=sys.stderr)
    if not videos:
        erro("Nenhum vídeo encontrado.")
    return videos


def info_video(arquivo: Path) -> dict:
    """Largura, altura, duração e se tem áudio."""
    saida = subprocess.run(
        [ffprobe(), "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration",
         "-of", "json", str(arquivo)],
        capture_output=True, text=True, check=True,
    ).stdout
    dados = json.loads(saida)
    video = next(s for s in dados["streams"] if s.get("codec_type") == "video")
    return {
        "largura": int(video["width"]),
        "altura": int(video["height"]),
        "duracao": float(dados.get("format", {}).get("duration", 0) or 0),
        "tem_audio": any(s.get("codec_type") == "audio" for s in dados["streams"]),
    }


def escapar_filtro(caminho: str | Path) -> str:
    """Escapa um caminho para usar dentro de um filtro do FFmpeg (ex.: C:/x -> C\\:/x)."""
    return str(caminho).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")


def tempo_em_segundos(t: str) -> float:
    """'83', '1:23' ou '0:01:23.5' -> segundos."""
    partes = [float(x) for x in str(t).split(":")]
    seg = 0.0
    for p in partes:
        seg = seg * 60 + p
    return seg


def rodar(cmd: list[str]) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-3000:], file=sys.stderr)
        erro("o FFmpeg falhou (detalhes acima).")
