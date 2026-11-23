# ============================================================
#  MLPB Cards (DaVinci Resolve): 3) EXPORTAR HITS (Shorts/Reels/TikTok)
#  Com a timeline aberta, adiciona um job de Render por hit:
#   - marcador cujo NOME começa com "HIT" (ex.: "HIT Charizard ex"):
#     de HIT_ANTES s antes até HIT_DEPOIS s depois do marcador
#   - marcador com duração (azul, arrastado): exatamente aquele trecho
#  Os MP4 vão para saida/<timeline>/hits/. Depois rode
#  python/shorts.py nessa pasta para deixar tudo em 9:16 com a logo.
# ============================================================
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (CONFIG, dois, fps_da_timeline, formatar_tempo, ler_marcadores,  # noqa: E402
                  nome_seguro, obter_resolve, pasta_saida, projeto, timeline_ativa)


def main():
    resolve = obter_resolve()
    pr = projeto(resolve)
    tl = timeline_ativa(pr)
    fps = fps_da_timeline(tl, pr)
    inicio = tl.GetStartFrame()
    fim = tl.GetEndFrame()
    nome = tl.GetName()
    pref = CONFIG["PREFIXO_HIT"].upper()

    # junta os hits (em quadros, relativos ao início da timeline)
    hits = []
    for m in ler_marcadores(tl, fps):
        tem_dur = m["dur_quadros"] > fps * 0.5
        if tem_dur:
            ini_q = m["quadro"]
            fim_q = m["quadro"] + m["dur_quadros"]
            nm = m["nome"] or "hit"
        elif m["nome"].upper().startswith(pref):
            ini_q = int(max(0, m["quadro"] - CONFIG["HIT_ANTES"] * fps))
            fim_q = int(m["quadro"] + CONFIG["HIT_DEPOIS"] * fps)
            nm = m["nome"]
        else:
            continue
        hits.append({"nome": nm, "ini_q": ini_q, "fim_q": fim_q})

    if not hits:
        print("[MLPB] Nenhum hit encontrado.")
        print("Aperte M quando a carta aparecer e dê ao marcador um nome começando com '%s' "
              "(ex.: '%s Pikachu ex'), ou crie marcadores com duração." % (pref, pref))
        return

    pasta = pasta_saida(nome_seguro(nome) + "/hits")
    off = inicio if CONFIG["SOMAR_INICIO_TIMELINE"] else 0
    total_f = fim - inicio + 1
    pr.SetCurrentTimeline(tl)
    if CONFIG["PRESET_RENDER"]:
        pr.LoadRenderPreset(CONFIG["PRESET_RENDER"])

    feitos = []
    for i, h in enumerate(hits, 1):
        ini_q = max(0, min(h["ini_q"], total_f - 1))
        fim_q = max(ini_q + 1, min(h["fim_q"], total_f - 1))
        base = nome_seguro(h["nome"].replace(CONFIG["PREFIXO_HIT"], "").strip() or "hit")
        cn = "%s_%s" % (dois(i), base)
        pr.SetRenderSettings({
            "SelectAllFrames": False,
            "MarkIn": off + ini_q,
            "MarkOut": off + fim_q,
            "TargetDir": pasta,
            "CustomName": cn,
        })
        job = pr.AddRenderJob()
        if job:
            feitos.append("%s (%s - %s)" % (cn, formatar_tempo(ini_q / fps), formatar_tempo(fim_q / fps)))

    if feitos:
        pr.StartRendering()

    print("\n[MLPB] %d hit(s) na fila de Render em:\n%s\n" % (len(feitos), pasta))
    print("\n".join(feitos))
    print("\nQuando terminar, rode:\npython shorts.py \"%s\"" % pasta)
    print("(Se um hit exportar o trecho errado, troque SOMAR_INICIO_TIMELINE no config.py)")


main()
