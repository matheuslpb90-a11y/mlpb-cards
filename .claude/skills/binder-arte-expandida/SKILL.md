---
name: binder-arte-expandida
description: Transforma artes (prints do TikTok/Instagram, fan art, wallpapers) em páginas de binder 3x3 — expande a arte com IA até a proporção da página, corta em 9 pedaços do tamanho de carta (63x88 mm) e deixa espaço para a(s) carta(s) de verdade onde o Pokémon aparece. Gera PNGs 300 dpi e um PDF A4 sem perdas para gráfica. Use quando o usuário pedir "arte expandida", "arte para binder", "cenário para o binder/pasta", "fundo para as cartas", "página 3x3 com a carta no meio".
---

# Arte expandida para binder 3x3

Usada pela primeira vez em 28/11/2026 com 9 artes (Gengar, Mew/Jirachi, Sylveon, aves lendárias, Meowth etc.). Resultado aprovado pelo usuário.

## O que entregar
Para cada arte, uma página do binder de 9 compartimentos: **8 pedaços de cenário + 1 carta** (padrão), com a carta no compartimento onde o Pokémon aparece na arte (normalmente o centro). Quando a arte tem vários Pokémon que viram cartas (ex.: Zapdos/Moltres/Articuno = 3 cartas; Meowth + Meowth de Alola = 2), sobram menos pedaços de cenário — a carta vai na posição de cada Pokémon.

## Medidas (não mudar sem motivo)
- Pedaço = **63 x 88 mm** (tamanho de carta, entra no compartimento como uma carta).
- Página inteira = 189 x 264 mm, **300 dpi** (2232 x 3117 px).
- Folha de impressão **A4**, pedaços separados por 3 mm (guia de corte), espaço das cartas em branco com tracejado "CARTA".

## Passo a passo
Script: `.claude/skills/binder-arte-expandida/scripts/binder.py` (Pillow + numpy; instala `img2pdf` sozinho se faltar). Trabalhe no scratchpad.

1. **Identificar** as imagens únicas (o usuário costuma mandar repetidas) e quais Pokémon/cartas cada uma tem. Se não der para saber quantas cartas vão numa arte ou em que posição, escolha pelo que aparece na arte e diga a escolha no final (não precisa perguntar antes).
2. **Recortar** a arte do print:
   `python3 binder.py recortar print.png crops/NN_nome.png`
   Confira o resultado (monte uma folha de contato e olhe). Prints do TikTok com curtidas/ícones à direita podem invadir a borda da arte — nesse caso use `--box x0,y0,x1,y1` cortando antes dos ícones.
3. **Expandir** com IA (Adobe Firefly via MCP Adobe — funcionou muito bem, emendas invisíveis):
   - `python3 binder.py expandir crops/NN_nome.png` → imprime o `expandPixels` (60 px de cada lado + topo/base para fechar a proporção 63:88 x 3).
   - Chamar `adobe_mandatory_init` uma vez; subir o PNG com `asset_initialize_file_upload` → `curl -L -X PUT <href> -H "Content-Type: image/png" --data-binary @arquivo` → `asset_finalize_file_upload`; depois `image_generative_expand` com a `presignedAssetUrl` e o `expandPixels`, `sessionId: "-1"`. Dá para fazer todas em paralelo.
   - Baixar cada `outputUrl` com `curl -sL -o exp/NN_nome.png`.
   - Olhar o resultado com a grade 3x3 por cima e conferir se o Pokémon caiu no compartimento da carta.
4. **Montar** (config igual a `exemplo_config.json`; `cartas` = lista de `[linha, coluna]` de 0 a 2):
   `python3 binder.py montar config.json /home/user/mlpb-cards/binder-artes`
   Gera por arte: `arte_completa.png`, `pedaco_LxCy.png`, `folha_A4_impressao.png`, `previa_binder.jpg`; e na raiz `TODAS_as_folhas_A4.pdf` (sem perdas, A4 exato) + `visao_geral.jpg`.
5. **Entregar** com SendUserFile: `visao_geral.jpg` e o PDF. Explicar onde ficou cada carta.
6. **Não** commitar as imagens geradas (são centenas de MB e fan art de terceiros) — `binder-artes/` está no `.gitignore`.

## Variante: a arte já vem dividida em 3x3 (com a carta no meio)
Prints de posts que já mostram a página pronta (9 pedaços separados por linhas brancas, ou foto de um binder com sleeves). Aí **não precisa expandir**:
1. Achar as caixas de cada pedaço. Em montagens com linhas brancas, detectar as linhas (colunas/linhas de pixels com `min(RGB) > 215` em boa parte da altura/largura). Em foto de binder, desenhar uma régua sobre o print e anotar as caixas à mão.
2. Para cada pedaço: recortar com uma margem (4 px em montagem digital; ~34 px em foto de binder, para tirar o brilho do plástico), aparar bordas uniformes (brancas, pretas ou sem textura), aparar mais 10–12 px, cortar no centro para a proporção 63:88, redimensionar para 744 x 1039 px (LANCZOS + nitidez leve).
3. Colar os 9 pedaços lado a lado numa imagem 2232 x 3117 (o pedaço da carta pode ficar como está, ele não é impresso) e passar essa imagem no `montar`.
4. Em foto de binder com sleeves, avisar que pode sobrar um leve reflexo nas bordas.
Usado em 28/11/2026: Magikarp (cachoeira), Zorua de Hisui (lago), Kyogre + Groudon (2 cartas: linha do meio, esquerda e direita).

## Qualidade
- PDF sempre sem perdas (img2pdf com PNG). Não usar o `save(...pdf)` do Pillow — ele recomprime em JPEG.
- Prints de tela têm ~1100 px de largura; a ampliação para 300 dpi (~1,8x) é feita com LANCZOS + leve nitidez. Se o usuário tiver a arte original, use-a (melhor qualidade).

## Orientação de impressão (o usuário perguntou)
Gráfica rápida, impressão digital colorida, **couché 300 g** (brilho ou fosco), A4, **escala 100%**, corte na guilhotina em 63 x 88 mm. Com laminação, usar 250 g. Testar 1 folha antes. Cantos arredondados opcionais (furador de canto 3 mm).
