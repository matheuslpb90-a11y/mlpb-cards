# Automação de vídeos no DaVinci Resolve (Windows) — MLPB Cards

Mesma ideia do kit do Premiere, mas para o **DaVinci Resolve**, que é gratuito. Os scripts Python (`cortar_silencio.py`, `shorts.py`, `thumbnail.py`, `higgsfield.py`) continuam valendo — só muda a parte que roda **dentro** do editor.

## O fluxo

```
Gravações brutas
  │  1. python ../python/cortar_silencio.py <pasta> --video    corta silêncios
  ▼
Pasta "cortados"
  │  2. DaVinci: 1_montar_video.py        intro + vídeos + outro + logo + música
  ▼
Timeline montada
  │  3. Você revisa e aperta M nos hits e nos capítulos  (único passo manual)
  │  4. DaVinci: 2_exportar_video.py      vídeo do YouTube + capitulos.txt
  │  5. DaVinci: 3_exportar_hits.py       um MP4 por hit
  ▼
saida/<vídeo>/hits
  │  6. python ../python/shorts.py <pasta hits>   verticais 9:16 com logo e legenda
  │  7. python ../python/thumbnail.py <vídeo> --texto "..."   thumbnail
  ▼
Pronto para postar
```

## Instalação (uma vez, no Windows)

1. Instale o **DaVinci Resolve** (gratuito) em blackmagicdesign.com.
2. Copie os arquivos desta pasta (`.py` e o `config.py`) para a pasta de scripts do Resolve:
   ```
   %APPDATA%\Blackmagic Design\DaVinci Resolve\Support\Fusion\Scripts\Utility\
   ```
   Cole o caminho acima no Explorer (Win+R → cole → Enter). Crie a pasta `Utility` se não existir.
   Mantenha `config.py` e `_lib.py` **na mesma pasta** dos três scripts numerados.
3. Coloque `intro.mp4`, `outro.mp4` e `musica.mp3` em `video/assets/` (ou ajuste os caminhos no `config.py`).
4. O Python já vem junto com o kit do canal; para os scripts do Resolve, o próprio Resolve usa o Python dele, não precisa instalar nada a mais.

## Passo a passo

### 2. Montar (dentro do Resolve)
Abra `config.py`… não: primeiro abra **`1_montar_video.py`** num editor de texto e mude a linha:
```python
PASTA = r"C:/Gravacoes/MinhaAbertura/cortados"
```
para a pasta das suas gravações. Salve. No Resolve, com um projeto aberto, vá em **Workspace → Scripts → 1_montar_video**. (O Resolve não abre um seletor de pasta em script, por isso o caminho vai no arquivo.)

A timeline é criada com a intro, as gravações em ordem de nome, a outro, a logo da MLPB no canto (V2) e a música em loop (A2).

### 3. Marcar (manual)
Assista na aba **Edit** e aperte **M** para criar um marcador. Dê dois cliques no marcador para abrir e escrever o nome:
| Nome do marcador | Vira |
|---|---|
| `HIT Charizard ex` | **Short**: 15 s antes até 8 s depois |
| Marcador com duração (arraste a borda dele na régua) | **Short** exatamente daquele trecho |
| `Booster 3`, `Resultado final`, … | **Capítulo** do YouTube |

### 4. Exportar o vídeo e os capítulos
**Workspace → Scripts → 2_exportar_video**. O vídeo entra na fila de Render e começa; os capítulos vão para `saida/<vídeo>/capitulos.txt`.

### 5. Exportar os hits
**Workspace → Scripts → 3_exportar_hits**. Um MP4 por hit em `saida/<vídeo>/hits/`.

### 6 e 7. Shorts e thumbnail
Iguais ao kit do Premiere, com os scripts da pasta `video/python/`.

## Ajustes (`config.py`)
- Logo fora do lugar: `LOGO_POSICAO`, `LOGO_ESCALA`, `LOGO_OPACIDADE`.
- Preset de exportação: crie um no **Deliver**, salve com um nome e coloque em `PRESET_RENDER`.
- Segundos antes/depois do hit: `HIT_ANTES`, `HIT_DEPOIS`.

## Recursos do próprio Resolve que completam o kit
- **Voice Isolation** (Fairlight): limpa o áudio do microfone.
- **Auto ducking**: abaixa a música quando você fala.
- **Smart Reframe** (Studio pago) ou o `shorts.py` (grátis): versão vertical.

## Problemas comuns
- **O script não aparece no menu**: confirme que os `.py` estão na pasta `Scripts\Utility` e reinicie o Resolve.
- **"Não consegui falar com o Resolve"**: rode pelo menu Scripts, não por fora, e tenha um projeto aberto.
- **Hit exporta o trecho errado** (deslocado): no `config.py`, troque `SOMAR_INICIO_TIMELINE` para `False`.
- **A logo não posiciona sozinha**: o script avisa; ajuste uma vez à mão (Inspector → Transform) e as próximas ficam no mesmo lugar se você salvar como padrão.

> Nota: os scripts foram escritos para a API de scripting do DaVinci Resolve e testados quanto a sintaxe, mas o primeiro uso de verdade é no seu PC. Me diga o que der diferente que eu ajusto.
