"""Gera b-roll com a API oficial do Higgsfield e salva em video/assets/broll/.

Precisa de uma chave da plataforma de API do Higgsfield (formato id:secret)
na variável de ambiente HIGGSFIELD_KEY. Cada geração gasta créditos da sua conta.

Exemplos:
  # anima uma FOTO SUA (booster, carta, mesa) com movimento de câmera de cinema
  python higgsfield.py --receita booster-heroi --imagem fotos/booster.jpg
  python higgsfield.py --receita carta-holo --imagem https://...minha-carta.jpg

  # b-roll a partir só de texto (transições, ambientes)
  python higgsfield.py --receita transicao-fogo
  python higgsfield.py "orange smoke swirling on black background" --modelo kling --formato 9:16

  python higgsfield.py --listar        # mostra as receitas prontas

Fotos locais são enviadas antes para o Vercel Blob da loja (precisa de
BLOB_READ_WRITE_TOKEN), porque a API só aceita imagens por link público.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from _comum import PASTA_VIDEO, erro

RECEITAS = Path(__file__).with_name("receitas_broll.json")
SAIDA_PADRAO = PASTA_VIDEO / "assets" / "broll"
BASE_PADRAO = "https://platform.higgsfield.ai"
FINAIS = {"completed", "failed", "nsfw", "canceled"}


def caminho_modelo(modelo: str, com_imagem: bool) -> str:
    if modelo == "dop":
        if not com_imagem:
            erro("o modelo DoP precisa de uma foto (--imagem).")
        return "higgsfield-ai/dop/lite"
    if modelo == "kling":
        return "kling-video/v3.0/std/" + ("image-to-video" if com_imagem else "text-to-video")
    if modelo == "kling-pro":
        return "kling-video/v3.0/pro/" + ("image-to-video" if com_imagem else "text-to-video")
    if modelo == "soul":
        return "higgsfield-ai/soul/v2/standard"
    return modelo  # caminho completo de outro modelo da plataforma


def chamar(metodo: str, url: str, chave: str, corpo: dict | None = None) -> dict:
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(url, data=dados, method=metodo)
    req.add_header("Authorization", f"Key {chave}")
    if dados:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        detalhe = e.read().decode(errors="replace")[:500]
        if e.code in (401, 403):
            erro(f"chave recusada ({e.code}). Confira HIGGSFIELD_KEY (id:secret). {detalhe}")
        if e.code == 402:
            erro(f"sem créditos na conta do Higgsfield. {detalhe}")
        erro(f"a API respondeu {e.code}: {detalhe}")
    except urllib.error.URLError as e:
        erro(f"não consegui falar com a API ({e.reason}).")
    return {}


def link_publico(imagem: str) -> str:
    if imagem.startswith("http"):
        return imagem
    if not Path(imagem).exists():
        erro(f"foto não encontrada: {imagem}")
    print("Enviando a foto para o Vercel Blob...")
    raiz = PASTA_VIDEO.parent
    r = subprocess.run(["node", str(Path(__file__).with_name("_enviar_blob.mjs")), str(Path(imagem).resolve())],
                       capture_output=True, text=True, cwd=raiz)
    if r.returncode != 0:
        erro("falha ao enviar a foto: " + (r.stderr.strip() or r.stdout.strip()) +
             "\nAlternativa: passe um link público da imagem em --imagem.")
    return r.stdout.strip().splitlines()[-1]


def baixar(url: str, destino: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
        destino.write_bytes(r.read())


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("prompt", nargs="?", help="descrição da cena (em inglês funciona melhor)")
    ap.add_argument("--receita", help="usa uma receita pronta de receitas_broll.json")
    ap.add_argument("--imagem", help="foto (arquivo ou link) para animar")
    ap.add_argument("--modelo", help="dop | kling | kling-pro | soul | caminho completo (padrão: da receita ou kling)")
    ap.add_argument("--formato", help="16:9 | 9:16 | 1:1 (padrão 16:9)")
    ap.add_argument("--duracao", type=int, default=5, help="segundos (padrão 5)")
    ap.add_argument("--nome", help="nome do arquivo de saída (sem extensão)")
    ap.add_argument("--saida", default=str(SAIDA_PADRAO), help="pasta de saída")
    ap.add_argument("--listar", action="store_true", help="lista as receitas")
    args = ap.parse_args()

    receitas = json.loads(RECEITAS.read_text(encoding="utf-8"))
    if args.listar:
        for nome, r in receitas.items():
            if not nome.startswith("_"):
                print(f"{nome:22} {'[foto] ' if r.get('imagem') else '[texto]'} {r['prompt'][:70]}...")
        return

    receita = {}
    if args.receita:
        receita = receitas.get(args.receita) or erro(f"receita '{args.receita}' não existe (use --listar).") or {}
        if receita.get("imagem") and not args.imagem:
            erro(f"a receita '{args.receita}' anima uma foto sua: passe --imagem.")
    prompt = args.prompt or receita.get("prompt")
    if not prompt:
        erro("descreva a cena ou use --receita.")

    chave = os.environ.get("HIGGSFIELD_KEY", "").strip()
    if ":" not in chave:
        erro("defina HIGGSFIELD_KEY com a sua chave da API do Higgsfield no formato id:secret.")
    base = os.environ.get("HF_API_BASE_URL", BASE_PADRAO).rstrip("/")

    modelo = args.modelo or receita.get("modelo") or "kling"
    formato = args.formato or receita.get("formato") or "16:9"
    imagem = link_publico(args.imagem) if args.imagem else None
    caminho = caminho_modelo(modelo, bool(imagem))

    corpo: dict = {"prompt": prompt}
    if modelo == "soul":
        corpo.update({"aspect_ratio": formato, "batch_size": 1})
    else:
        corpo["duration"] = args.duracao
        if imagem:
            corpo["image_url"] = imagem
        else:
            corpo["aspect_ratio"] = formato
        if modelo.startswith("kling"):
            corpo["sound"] = "off"

    print(f"Gerando com {caminho} ...")
    fila = chamar("POST", f"{base}/{caminho}", chave, corpo)
    pedido = fila.get("request_id") or erro(f"resposta inesperada: {fila}")

    inicio = time.time()
    while True:
        st = chamar("GET", f"{base}/requests/{pedido}/status", chave)
        estado = st.get("status", "?")
        print(f"  {int(time.time() - inicio):>3}s  {estado}")
        if estado in FINAIS:
            break
        if time.time() - inicio > 900:
            erro(f"demorou demais. Pedido {pedido} ainda em '{estado}'.")
        time.sleep(5)

    if estado != "completed":
        erro(f"a geração terminou como '{estado}': {st.get('error', '')}")

    urls = [st["video"]["url"]] if isinstance(st.get("video"), dict) else [i["url"] for i in st.get("images", [])]
    if not urls:
        erro(f"concluído, mas sem arquivo na resposta: {st}")

    pasta = Path(args.saida)
    pasta.mkdir(parents=True, exist_ok=True)
    nome = args.nome or (args.receita or "broll") + time.strftime("_%Y%m%d_%H%M%S")
    for i, u in enumerate(urls, 1):
        ext = Path(u.split("?")[0]).suffix or (".mp4" if "video" in st else ".png")
        destino = pasta / (f"{nome}{'' if len(urls) == 1 else f'_{i}'}{ext}")
        baixar(u, destino)
        print(f"Salvo: {destino}")


if __name__ == "__main__":
    sys.exit(main())
