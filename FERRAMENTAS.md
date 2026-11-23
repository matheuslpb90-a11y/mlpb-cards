# Ferramentas úteis — MLPB Cards

Lista das ferramentas que avaliamos, para pegar quando um projeto precisar.
Guardada aqui no repositório para não se perder.

> Importante: clonar um repositório na sessão do Claude **não** salva nada (o ambiente é apagado).
> Só persiste o que está **comitado** aqui. As *skills* abaixo já estão comitadas em `.claude/skills/`.

## Já instaladas como skills (funcionam em qualquer sessão futura)

Animação e vídeo (feitos em código, sem After Effects):
- **hyperframes** (+ cli, registry, media-use) — animações HTML→MP4. Fez a vinheta da MLPB.
- **claude-motion**, **howseen (motion-design-html)**, **product-launch-motion**, **animate** — estilos e métodos de vídeo animado.
- **motion-graphics-skills** (15 skills: milestone-reveal, animated-chart, vox-explainer, reel-export…).
- **klik** (klik-anim, klik-cam, klik-remotion-method) e **remotion** (skills oficiais) — motion em Remotion.
- **motion-dev-animations**, **motion-design-lottie**, **awesome-motion** (5 skills), **barty motion-graphics** (b-roll, efeitos sonoros, recorte).
- Motor de som procedural em `video/motion/` (põe som sem direitos autorais).
- **herk-edit-kit** em `video/herk-edit-kit/` — edição de vídeo com IA (cortar silêncio, Shorts, legendas).

Negócio e pesquisa:
- **replica** (11 skills) — mapear e recriar funções de um app/site concorrente.
- **last30days** — o que as pessoas falam nos últimos 30 dias (Reddit, YouTube, TikTok…). Melhor no PC.
- **firecrawl-build** (5) — ler/buscar sites dentro de um app.
- **voicestudio** — controlar o VoiceStudio (voz, legendas, dublagem) rodando no PC.

## Kits próprios (neste repositório)
- `video/premiere/` — automação do Adobe Premiere.
- `video/davinci/` — automação do DaVinci Resolve (gratuito, Windows).
- `video/python/` — cortar silêncio, Shorts verticais, thumbnails, b-roll via API do Higgsfield.

## Programas para instalar no PC quando precisar (não são skills)
- **DaVinci Resolve** — editor de vídeo profissional gratuito. (blackmagicdesign.com)
- **VoiceStudio** — voz, legendas e dublagem locais, grátis. (github.com/debpalash/VoiceStudio)
- **LocalSend** — enviar arquivos entre celular e PC na mesma Wi-Fi, sem perder qualidade. (localsend.org)
- **Ollama** — rodar IA grátis no próprio PC (precisa de PC razoável). (ollama.com)
- **ArtCraft** — estúdio de imagem/vídeo com IA. (getartcraft.com)
- **OpenCut** / **CapCut** — editores de vídeo (OpenCut ainda em reescrita; use opencut.app clássico).

## Serviços de IA pagos por uso (só com conta e crédito)
- **Higgsfield API** — b-roll cinematográfico (o `higgsfield.py` do kit já usa).
- **MuAPI** — Kling, Veo, Seedance etc. por geração (sem assinatura).
- **Scrydex** / **pokemontcg.io** — preços de cartas (Brasil/mundo, graduadas). Pagos.

## Não usar
- **GenP** — pirataria da Adobe. Risco de vírus e jurídico. Fora.
- **Graft** — motor de banco (SQLite edge). Não serve para a loja nem reduz tokens.

## Como economizar tokens de verdade
Começar **uma conversa nova** quando trocar de assunto. Cada mensagem relê todo o
histórico; conversas longas custam caro. O trabalho fica salvo nos commits, não se perde.
