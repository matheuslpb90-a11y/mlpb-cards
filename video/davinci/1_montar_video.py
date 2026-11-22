# ============================================================
#  MLPB Cards (DaVinci Resolve): 1) MONTAR VÍDEO
#  Com um projeto aberto, roda por Workspace > Scripts.
#  - pede a pasta das gravações (pela variável PASTA abaixo, ou um diálogo)
#  - importa os vídeos (ordem alfabética do nome do arquivo)
#  - cria a timeline: INTRO + gravações + OUTRO
#  - põe a logo da MLPB no canto (trilha V2) do começo ao fim
#  - põe a música de fundo na trilha A2 (em loop)
#  Dica: rode antes o python/cortar_silencio.py --video e use a pasta "cortados".
#
#  COMO ESCOLHER A PASTA: o Resolve não abre um seletor de pasta nos scripts.
#  Edite a linha PASTA abaixo com o caminho das gravações antes de rodar.
# ============================================================
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (CONFIG, caminho_asset, caminho_logo, fps_da_timeline, listar_videos,  # noqa: E402
                  nome_seguro, obter_resolve, projeto)

# >>> EDITE AQUI: caminho da pasta com as gravações <<<
PASTA = r"C:/Gravacoes/MinhaAbertura/cortados"
# Nome da timeline/vídeo (deixe "" para usar o nome da pasta):
NOME = ""


def main():
    resolve = obter_resolve()
    pr = projeto(resolve)
    mp = pr.GetMediaPool()

    pasta = PASTA.replace("\\", "/")
    if not os.path.isdir(pasta):
        print("[MLPB] Pasta não encontrada. Edite a linha PASTA no script:", pasta)
        return
    arquivos = listar_videos(pasta)
    if not arquivos:
        print("[MLPB] Nenhum vídeo em:", pasta)
        return

    nome = NOME or os.path.basename(pasta.rstrip("/"))
    intro = caminho_asset(CONFIG["INTRO"])
    outro = caminho_asset(CONFIG["OUTRO"])
    logo = caminho_logo()
    musica = caminho_asset(CONFIG["MUSICA"])

    # organiza o bin
    raiz_bin = mp.GetRootFolder()
    mp.SetCurrentFolder(raiz_bin)
    mp.AddSubFolder(raiz_bin, nome)
    for sub in mp.GetRootFolder().GetSubFolderList():
        if sub.GetName() == nome:
            mp.SetCurrentFolder(sub)
            break

    # importa tudo
    paths = ([intro] if intro else []) + arquivos + ([outro] if outro else [])
    importados = mp.ImportMedia(paths) or []
    if not importados:
        print("[MLPB] O Resolve não importou nenhum arquivo.")
        return
    porcaminho = {it.GetClipProperty("File Path").replace("\\", "/"): it for it in importados}

    def item_de(p):
        return porcaminho.get(p.replace("\\", "/")) if p else None

    ordem = []
    if intro and item_de(intro):
        ordem.append(item_de(intro))
    for a in arquivos:
        if item_de(a):
            ordem.append(item_de(a))
    if outro and item_de(outro):
        ordem.append(item_de(outro))

    tl = mp.CreateTimelineFromClips(nome, ordem)
    if not tl:
        print("[MLPB] Falha ao criar a timeline.")
        return
    pr.SetCurrentTimeline(tl)
    fps = fps_da_timeline(tl, pr)
    inicio = tl.GetStartFrame()
    fim = tl.GetEndFrame()
    total = fim - inicio + 1
    avisos = []

    # ---- Logo na V2 ----
    if logo:
        li = mp.ImportMedia([logo])
        li = li[0] if li else None
        if li and tl.AddTrack("video"):
            v2 = tl.GetTrackCount("video")
            ok = mp.AppendToTimeline([{
                "mediaPoolItem": li, "startFrame": 0, "endFrame": total - 1,
                "mediaType": 1, "trackIndex": v2, "recordFrame": inicio,
            }])
            if ok:
                try:
                    it = tl.GetItemListInTrack("video", v2)[-1]
                    it.SetProperty("ZoomX", CONFIG["LOGO_ESCALA"])
                    it.SetProperty("ZoomY", CONFIG["LOGO_ESCALA"])
                    it.SetProperty("Pan", CONFIG["LOGO_POSICAO"][0] * 960)
                    it.SetProperty("Tilt", CONFIG["LOGO_POSICAO"][1] * 540)
                    it.SetProperty("Opacity", CONFIG["LOGO_OPACIDADE"])
                except Exception as e:
                    avisos.append("Logo: ajuste posição/tamanho à mão (" + str(e) + ")")
            else:
                avisos.append("Logo: não consegui colocar na V2.")
    else:
        avisos.append("Logo não encontrada.")

    # ---- Música na A2, em loop ----
    if musica:
        mi = mp.ImportMedia([musica])
        mi = mi[0] if mi else None
        if mi and tl.AddTrack("audio"):
            a2 = tl.GetTrackCount("audio")
            try:
                dur = int(mi.GetClipProperty("Frames"))
            except Exception:
                dur = 0
            if dur > 0:
                pos = inicio
                voltas = 0
                while pos < fim and voltas < 200:
                    resta = min(dur, fim - pos + 1)
                    mp.AppendToTimeline([{
                        "mediaPoolItem": mi, "startFrame": 0, "endFrame": resta - 1,
                        "mediaType": 2, "trackIndex": a2, "recordFrame": pos,
                    }])
                    pos += resta
                    voltas += 1
            else:
                avisos.append("Música: não consegui ler a duração.")

    print("\n[MLPB] Pronto! Timeline '%s' com %d gravação(ões)%s%s%s." % (
        nome, len(arquivos),
        " + intro" if intro else "", " + outro" if outro else "", " + música" if musica else ""))
    print("Próximo passo: revise e aperte M nos hits (nome começando com '%s') e nos capítulos." % CONFIG["PREFIXO_HIT"])
    if avisos:
        print("Avisos:\n- " + "\n- ".join(avisos))


main()
