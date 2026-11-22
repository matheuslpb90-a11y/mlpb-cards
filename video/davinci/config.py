# ============================================================
#  MLPB Cards: configurações dos scripts do DaVinci Resolve
#  Este é o único arquivo que você precisa editar.
#  Use barras normais nos caminhos: "C:/Videos/intro.mp4"
# ============================================================

CONFIG = {
    # Pasta com intro, outro e música. None = pasta "video/assets" do repositório.
    "ASSETS": None,
    "INTRO": "intro.mp4",     # vinheta de abertura ("" para não usar)
    "OUTRO": "outro.mp4",     # tela final ("" para não usar)
    "MUSICA": "musica.mp3",   # música de fundo ("" para não usar)

    # Logo (marca d'água). None = marca/logo-mlpb-cards-1235px.png do repositório.
    "LOGO": None,
    "LOGO_POSICAO": [0.80, -0.78],  # posição na tela, -1 a 1 (x, y). (0,0) é o centro; aqui, canto sup. direito.
    "LOGO_ESCALA": 0.14,            # tamanho: 1.0 = tela cheia; 0.14 = pequeno no canto
    "LOGO_OPACIDADE": 85,           # 0 a 100

    # Para onde vão os vídeos exportados. None = pasta "saida" dentro de video/.
    "SAIDA": None,

    # Preset de exportação do Resolve (crie e salve um no Deliver). "" = usa o padrão atual.
    "PRESET_RENDER": "",

    # Hits (cartas raras) viram Shorts:
    #  - marcador cujo NOME começa com PREFIXO_HIT (ex.: "HIT Charizard"):
    #    de HIT_ANTES s antes até HIT_DEPOIS s depois do marcador;
    #  - marcador com duração (azul, arrastado): exatamente aquele trecho.
    "PREFIXO_HIT": "HIT",
    "HIT_ANTES": 15,
    "HIT_DEPOIS": 8,

    # Tipos de arquivo considerados vídeo ao montar.
    "EXTENSOES": ["mp4", "mov", "m4v", "mts", "mkv", "avi"],

    # Avançado: se os hits exportarem o TRECHO ERRADO (deslocado), troque para False.
    # (depende de como a sua versão do Resolve numera os quadros na exportação por marca)
    "SOMAR_INICIO_TIMELINE": True,
}
