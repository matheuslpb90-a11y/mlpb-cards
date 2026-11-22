// ============================================================
//  MLPB Cards: configurações dos scripts do Premiere
//  Este é o único arquivo que você precisa editar.
//  Caminhos podem ser absolutos ("C:/Videos/intro.mp4") ou
//  apenas o nome do arquivo (procura na pasta ASSETS).
// ============================================================
var CONFIG = {
    // Pasta com intro, outro e música. null = pasta "video/assets" do repositório.
    ASSETS: null,
    INTRO: "intro.mp4",      // vinheta de abertura (deixe "" para não usar)
    OUTRO: "outro.mp4",      // tela final (deixe "" para não usar)
    MUSICA: "musica.mp3",    // música de fundo (deixe "" para não usar)
    MUSICA_DB: -22,          // volume da música em dB (negativo = mais baixo)

    // Logo (marca d'água). null = marca/logo-mlpb-cards-1235px.png do repositório.
    LOGO: null,
    LOGO_POSICAO: [0.92, 0.13], // posição na tela: 0 a 1 (x, y). Canto superior direito.
    LOGO_ESCALA: 12,            // tamanho em %
    LOGO_OPACIDADE: 85,         // 0 a 100

    // Preset de exportação (.epr). "" = usa o preset H.264 que vem com o Premiere;
    // se não achar, o script pede para você escolher um.
    PRESET_EPR: "",

    // Para onde vão os vídeos exportados. null = pasta "saida" ao lado do projeto (.prproj).
    SAIDA: null,

    // Hits (cartas raras) viram Shorts:
    //  - marcador com nome começando por PREFIXO_HIT (ex.: "HIT Charizard")
    //    vira um corte de HIT_ANTES segundos antes até HIT_DEPOIS segundos depois;
    //  - marcador com duração vira um corte exatamente daquele trecho.
    PREFIXO_HIT: "HIT",
    HIT_ANTES: 15,
    HIT_DEPOIS: 8,

    // Tipos de arquivo considerados vídeo ao montar.
    EXTENSOES: ["mp4", "mov", "m4v", "mts", "mkv", "avi"]
};
