# ============================================================
#  MLPB Cards: funções comuns dos scripts do DaVinci (não precisa editar)
# ============================================================
import os
import sys

# Importa a configuração que está ao lado deste arquivo.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import CONFIG  # noqa: E402

PASTA_DAVINCI = os.path.dirname(os.path.abspath(__file__))
PASTA_VIDEO = os.path.dirname(PASTA_DAVINCI)           # .../video
RAIZ = os.path.dirname(PASTA_VIDEO)                     # raiz do repositório


def obter_resolve():
    """Pega o objeto 'resolve' tanto rodando pelo menu Scripts quanto externamente."""
    try:
        return resolve  # injetado quando roda pelo menu Workspace > Scripts  # noqa: F821
    except NameError:
        pass
    try:
        import DaVinciResolveScript as dvr
        return dvr.scriptapp("Resolve")
    except Exception as e:
        raise RuntimeError(
            "Não consegui falar com o DaVinci Resolve. Rode este script por "
            "Workspace > Scripts dentro do Resolve, com um projeto aberto.\n" + str(e)
        )


def pasta_assets():
    return CONFIG["ASSETS"] or os.path.join(PASTA_VIDEO, "assets")


def caminho_asset(nome):
    """'' => None; caminho absoluto; ou nome dentro da pasta de assets."""
    if not nome:
        return None
    if os.path.isabs(nome) and os.path.exists(nome):
        return nome.replace("\\", "/")
    p = os.path.join(pasta_assets(), nome)
    if os.path.exists(p):
        return p.replace("\\", "/")
    print("[MLPB] Asset não encontrado (pulando):", nome)
    return None


def caminho_logo():
    if CONFIG["LOGO"]:
        return caminho_asset(CONFIG["LOGO"])
    p = os.path.join(RAIZ, "marca", "logo-mlpb-cards-1235px.png")
    return p.replace("\\", "/") if os.path.exists(p) else None


def pasta_saida(sub=""):
    base = CONFIG["SAIDA"] or os.path.join(PASTA_VIDEO, "saida")
    p = os.path.join(base, sub) if sub else base
    os.makedirs(p, exist_ok=True)
    return p.replace("\\", "/")


def nome_seguro(s):
    limpo = "".join(c for c in str(s) if c not in '\\/:*?"<>|').strip()
    return (limpo.replace(" ", "_")[:60]) or "sem_nome"


def dois(n):
    return ("0" + str(n))[-2:]


def formatar_tempo(seg):
    """75.4 -> '01:15'; 3725 -> '1:02:05' (capítulos do YouTube)."""
    seg = int(seg)
    h, m, s = seg // 3600, (seg % 3600) // 60, seg % 60
    return "%d:%s:%s" % (h, dois(m), dois(s)) if h else "%s:%s" % (dois(m), dois(s))


def projeto(resolve):
    pm = resolve.GetProjectManager()
    pr = pm.GetCurrentProject()
    if not pr:
        raise RuntimeError("Abra um projeto no DaVinci Resolve antes de rodar o script.")
    return pr


def timeline_ativa(pr):
    tl = pr.GetCurrentTimeline()
    if not tl:
        raise RuntimeError("Abra (selecione) uma timeline na aba Edit antes de rodar o script.")
    return tl


def fps_da_timeline(tl, pr):
    v = tl.GetSetting("timelineFrameRate") or pr.GetSetting("timelineFrameRate") or "30"
    try:
        return float(v)
    except ValueError:
        return 30.0


def listar_videos(pasta):
    exts = tuple("." + e.lower() for e in CONFIG["EXTENSOES"])
    arquivos = [
        os.path.join(pasta, f).replace("\\", "/")
        for f in sorted(os.listdir(pasta), key=str.lower)
        if f.lower().endswith(exts)
    ]
    return arquivos


def ler_marcadores(tl, fps):
    """Lê os marcadores como lista ordenada: {nome, nota, inicio_s, fim_s, quadro, dur_quadros}."""
    brutos = tl.GetMarkers() or {}
    lista = []
    for quadro, m in brutos.items():
        dur = int(m.get("duration", 1) or 1)
        lista.append({
            "nome": m.get("name", "") or "",
            "nota": m.get("note", "") or "",
            "quadro": int(quadro),
            "dur_quadros": dur,
            "inicio_s": int(quadro) / fps,
            "fim_s": (int(quadro) + dur) / fps,
        })
    lista.sort(key=lambda x: x["quadro"])
    return lista
