"""Som da vinheta MLPB (video/animacoes): mesma linha do tempo da animação."""
from sfx.synth import whoosh, riser, impact, pop, blip, chime, pad, envelope

TIMELINE = "intro_timeline.json"
OUT = "intro_sfx.wav"
TARGET_LUFS = -14.0

# Tom: Ré menor (D, F, A)
D3, F3, A3, D4, F4, A4, D5 = 146.83, 174.61, 220.0, 293.66, 349.23, 440.0, 587.33


def score(mix, tl):
    # cama grave de fundo, entra e sai com a vinheta
    left, right = pad(tl["duration"], [(0.0, [D3, A3, F4])], volume=envelope([(0, 0), (0.6, 0.55), (4.3, 0.55), (5.0, 0)]))
    mix.put_stereo(0.0, left, right, 0.35)

    # faixas de luz cruzando
    mix.put(tl["faixa1"], whoosh(1.0, 300, 3200, peak=0.55), 0.35, pan=-0.5)
    mix.put(tl["faixa2"], whoosh(1.1, 2800, 400, peak=0.5), 0.3, pan=0.5)
    mix.put(tl["faixa3"], whoosh(0.9, 400, 2600, peak=0.5), 0.2, pan=-0.3)

    # cartas chegando (esquerda, direita, centro)
    for i, (t, p) in enumerate(zip(tl["cartas"], [-0.6, 0.6, 0.0])):
        mix.put(t + 0.35, pop(600 + i * 180, 300 + i * 120, dur=0.18), 0.35, pan=p)

    # subida até a logo e impacto no flash
    mix.put(tl["flash"] - 0.9, riser(0.9, 220, 4200), 0.3)
    mix.put(tl["flash"], impact(1.4), 0.9)
    mix.put(tl["flash"], chime([D4, F4, A4, D5], dur=2.2), 0.35)

    # textos
    mix.put(tl["slogan"], whoosh(0.35, 900, 3000, peak=0.4), 0.25)
    mix.put(tl["slogan"] + 0.3, blip(A4, 0.3), 0.25)
    mix.put(tl["site"] + 0.2, blip(D5, 0.3), 0.2)

    # saída
    mix.put(tl["fade"] - 0.1, whoosh(0.6, 2400, 300, peak=0.3), 0.25)
