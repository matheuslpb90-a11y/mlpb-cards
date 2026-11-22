# Automação de vídeos: canal MLPB Cards

Kit para editar os vídeos do canal (aberturas de booster, coleções, leilões) com o mínimo de trabalho manual.

## O fluxo completo

```
Gravações brutas
  │  1. python cortar_silencio.py <pasta> --video      corta silêncios e pausas
  ▼
Pasta "cortados"
  │  2. Premiere: 1_montar_video.jsx                    intro + vídeos + outro + logo + música
  ▼
Sequência montada
  │  3. Você revisa e aperte M nos hits e nos capítulos  (o único passo manual)
  │  4. Premiere: 2_exportar_video.jsx                  vídeo do YouTube + capitulos.txt
  │  5. Premiere: 3_exportar_hits.jsx                   um MP4 por hit
  ▼
saida/<vídeo>/hits
  │  6. python shorts.py <pasta hits>                   verticais 9:16 com logo, título e legenda
  │  7. python thumbnail.py <vídeo> --texto "..."       thumbnail do YouTube
  ▼
Pronto para postar: YouTube + Shorts + Reels + TikTok
```

## Instalação (uma vez)

1. **Python 3.10+** (python.org; no Windows marque *Add to PATH*).
2. **FFmpeg** no PATH. No Windows: `winget install Gyan.FFmpeg`.
3. Bibliotecas:
   ```bash
   cd video/python
   pip install -r requirements.txt
   ```
4. **Para rodar os scripts do Premiere**: instale o **VS Code** e a extensão **ExtendScript Debugger** (da Adobe).
   Abra o `.jsx`, clique no seletor de alvo no rodapé, escolha **Adobe Premiere Pro** e aperte **F5**.
5. Coloque `intro.mp4`, `outro.mp4` e `musica.mp3` em `video/assets/` (veja o LEIA-ME dessa pasta).
   Os que faltarem são pulados. Todas as opções ficam em `premiere/config.jsx`.

## Passo a passo

### 1. Cortar silêncios
```bash
python cortar_silencio.py "D:/Gravacoes/Abertura 151" --video
```
Isso cria `D:/Gravacoes/Abertura 151/cortados/` com os vídeos já sem as pausas.
- Sem `--video`, o script gera `.xml`. Importe no Premiere e cada um vira uma sequência cortada, sem reencodar.
- Se cortou demais (por exemplo, o barulho do pacote abrindo): `--limiar 2`. Se cortou de menos (ruído de fundo): `--limiar 6`.
- Cortes muito secos: `--margem 0.5`.

### 2. Montar no Premiere
Com um projeto aberto, rode **`1_montar_video.jsx`** e escolha a pasta `cortados`. O script cria a sequência com a intro, as gravações em ordem de nome, a outro, a logo da MLPB no canto (trilha V2) e a música em loop na trilha A2 (−22 dB).

### 3. Marcar (manual, dentro do Premiere)
Assista e aperte **M** para criar marcadores. Clique duas vezes no marcador para dar nome:
| Nome do marcador | Vira |
|---|---|
| `HIT Charizard ex` | **Short**: 15 s antes até 8 s depois do marcador |
| Marcador com duração (arraste a borda dele) | **Short** exatamente daquele trecho |
| `Booster 3`, `Resultado final`, … | **Capítulo** do YouTube |

### 4. Exportar o vídeo e os capítulos
Rode **`2_exportar_video.jsx`**. O vídeo vai para o Media Encoder e começa a renderizar. Os capítulos são salvos em `saida/<vídeo>/capitulos.txt`, prontos para colar na descrição.

### 5. Exportar os hits
Rode **`3_exportar_hits.jsx`**. É gerado um MP4 por hit em `saida/<vídeo>/hits/`.

### 6. Shorts verticais
```bash
python shorts.py "D:/Projetos/saida/Abertura_151/hits" --modelo "PUXEI {nome}!"
```
O resultado vai para `hits/verticais/`: 1080×1920, fundo desfocado, logo, título tirado do nome do marcador (`HIT Charizard ex` vira **PUXEI CHARIZARD EX!**) e legenda queimada, se existir um `.srt` com o mesmo nome do vídeo.

**Legendas grátis no Premiere:** abra o corte, vá em *Janela > Texto > Transcrever* e depois *Criar legendas*. Exporte o `.srt` com o mesmo nome do MP4.

Opções: `--zoom 1.4` (aproxima mais as cartas), `--titulo "..."` (um vídeo só), `--sem-titulo`.

### 7. Thumbnail
```bash
python thumbnail.py video.mp4 --texto "PUXEI A CHARIZARD!" --carta charizard.png
python thumbnail.py video.mp4 --texto "ABRI 36 BOOSTERS" --opcoes 4     # 4 versões para escolher
python thumbnail.py video.mp4 --texto "HIT INSANO" --tempo 12:34 --carta https://assets.tcgdex.net/pt/sv/sv03.5/199/high.png
```
A imagem da carta pode ser a mesma do TCGdex usada no site (link da imagem em alta).

## B-roll com IA (Higgsfield)

O b-roll é gerado pela API oficial do Higgsfield e cada geração gasta créditos da sua conta.
1. Crie uma conta na plataforma de **API** do Higgsfield, coloque créditos e gere uma chave (`id:secret`).
2. Defina a chave no terminal: `set HIGGSFIELD_KEY=id:secret` no Windows, ou `export HIGGSFIELD_KEY=id:secret` no Mac/Linux.
3. Gere:
```bash
python higgsfield.py --listar                                         # receitas prontas
python higgsfield.py --receita booster-heroi --imagem fotos/booster.jpg  # anima uma foto sua
python higgsfield.py --receita carta-holo --imagem fotos/carta.jpg
python higgsfield.py --receita transicao-fogo                         # só texto
python higgsfield.py "orange smoke on black background" --formato 9:16
```
Os vídeos são salvos em `video/assets/broll/`.

Uma foto do computador precisa virar link público antes de ir para a API. O script envia a foto para o Vercel Blob da loja, e para isso precisa do `BLOB_READ_WRITE_TOKEN` (fica no `.env` da loja). Se preferir, passe direto um link público da imagem.
As receitas ficam em `receitas_broll.json`; dá para editar ou criar novas.

**Regras do canal:**
- **Nunca gere uma "carta puxada" falsa.** Unboxing tem que ser real. O b-roll de IA serve para ambientar e valorizar, nunca para mudar o que saiu do pacote.
- **No YouTube, marque "conteúdo alterado ou sintético"** quando o b-roll de IA parecer real.
- **Não peça personagens Pokémon ou de outras marcas.** Use fotos das suas próprias cartas e produtos, ou cenas genéricas.

## Recursos do próprio Premiere que completam o kit
- **Melhorar fala** (*Essential Sound > Diálogo > Melhorar*): limpa o áudio do microfone.
- **Atenuação automática** (*Essential Sound > Música > Atenuação*): abaixa a música quando você fala.
- **Remix** (*Essential Sound > Música*): ajusta a música para durar exatamente o vídeo.
- **Reenquadramento automático** (*Sequência > Reenquadramento automático*): alternativa ao `shorts.py` que segue o movimento.

## Problemas comuns
- **"Salve o projeto antes de exportar"**: a pasta `saida` fica ao lado do `.prproj`.
- **O script pede um preset `.epr`**: no Media Encoder, salve um preset H.264 e coloque o caminho em `PRESET_EPR` no `config.jsx`.
- **Logo fora do lugar**: ajuste `LOGO_POSICAO`, `LOGO_ESCALA` e `LOGO_OPACIDADE` no `config.jsx`.
- **Intro com tamanho diferente das gravações**: a sequência usa o formato do primeiro clipe (a intro). Exporte a intro no mesmo formato da câmera.
