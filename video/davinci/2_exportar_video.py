# ============================================================
#  MLPB Cards (DaVinci Resolve): 2) EXPORTAR VÍDEO + CAPÍTULOS
#  Com a timeline aberta:
#   - gera saida/<timeline>/capitulos.txt a partir dos marcadores
#     (cole na descrição do YouTube)
#   - adiciona um job na fila de Render do vídeo inteiro e começa a renderizar
#  Marcadores de HIT (e marcadores com duração) não viram capítulo.
# ============================================================
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import (CONFIG, fps_da_timeline, formatar_tempo, ler_marcadores, nome_seguro,  # noqa: E402
                  obter_resolve, pasta_saida, projeto, timeline_ativa)


def main():
    resolve = obter_resolve()
    pr = projeto(resolve)
    tl = timeline_ativa(pr)
    fps = fps_da_timeline(tl, pr)
    nome = tl.GetName()
    pasta = pasta_saida(nome_seguro(nome))

    # ---- Capítulos ----
    pref = CONFIG["PREFIXO_HIT"].upper()
    caps = []
    for m in ler_marcadores(tl, fps):
        eh_hit = m["nome"].upper().startswith(pref)
        tem_dur = m["dur_quadros"] > fps * 0.5
        if eh_hit or tem_dur:
            continue
        caps.append((m["inicio_s"], m["nome"] or m["nota"] or ("Parte %d" % (len(caps) + 1))))
    if not caps or caps[0][0] >= 1:
        caps.insert(0, (0, "Início"))

    linhas = ["%s %s" % (formatar_tempo(t), nm) for t, nm in caps]
    txt = os.path.join(pasta, "capitulos.txt")
    with open(txt, "w", encoding="utf-8") as f:
        f.write("\n".join(linhas) + "\n")

    aviso = ""
    if len(caps) < 3:
        aviso = "\n(O YouTube só mostra capítulos com 3 ou mais. Aperte M e dê nome aos marcadores.)"

    # ---- Vídeo inteiro na fila de Render ----
    pr.SetCurrentTimeline(tl)
    if CONFIG["PRESET_RENDER"]:
        pr.LoadRenderPreset(CONFIG["PRESET_RENDER"])
    pr.SetRenderSettings({
        "SelectAllFrames": True,
        "TargetDir": pasta,
        "CustomName": nome_seguro(nome),
    })
    job = pr.AddRenderJob()
    if job:
        pr.StartRendering(job)

    print("\n[MLPB] Capítulos salvos em:\n" + txt + "\n")
    print("\n".join(linhas) + aviso)
    if job:
        print("\nVídeo adicionado à fila de Render e renderizando:\n" + pasta)
    else:
        print("\n[MLPB] Não consegui criar o job de render. Veja a aba Deliver.")


main()
