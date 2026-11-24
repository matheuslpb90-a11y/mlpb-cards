# Renderização de vídeo — MLPB Cards

Sistema modular para finalizar os vídeos do canal **localmente ou na nuvem**, à sua escolha.
Não substitui nada do que já existe (`video/premiere`, `video/davinci`, `video/python`,
`video/herk-edit-kit`, HyperFrames/Remotion). Ele **junta** tudo numa etapa final de render.

> Segue as diretrizes de `video/herk-edit-kit/AGENTS.md` e dos arquivos de edição: a
> montagem, os cortes e a identidade visual continuam saindo das ferramentas atuais.
> Aqui é só a **renderização final**: multicâmera + FFmpeg + camada Remotion, nos dois formatos.

## O que ele faz

- **Local ou remoto, você escolhe** (`--backend local | github | lambda`).
- **GitHub Actions** como opção remota de **baixo custo** (grátis em repositório público).
- **AWS Lambda** opcional (para 4K pesado, quando você tiver conta AWS).
- **Multicâmera em 4K**: junta vários ângulos escolhendo qual aparece em cada trecho.
- **FFmpeg** para sincronizar as câmeras pelo áudio, cortar e tratar o som (limpar voz, normalizar a −14 LUFS).
- **Remotion** (ou um `.mov` com transparência) para a camada de animação/identidade visual por cima.
- **YouTube (16:9) e TikTok/Shorts (9:16) ao mesmo tempo**, numa só rodada.
- **Monitoramento** do progresso (barra por formato) e, no GitHub, acompanhamento da Action.
- **Download automático** dos arquivos prontos.
- **Estimativa de custo** antes de começar (mostra sempre; `--estimar` só mostra e sai).
- **Brutos preservados**: nada nos seus arquivos originais é alterado.
- **Arquivos pesados fora do Git**: finalizados vão para armazenamento externo (artifact do GitHub, Vercel Blob ou S3/R2), nunca para o repositório.

## Instalação

Não precisa de `npm install` para o modo local — só **Node 22+** e **FFmpeg** no PATH.
- Remoto no GitHub: o **GitHub CLI** (`gh auth login`) e o `zip`.
- Armazenamento Vercel Blob: a variável `BLOB_READ_WRITE_TOKEN` (a mesma da loja).
- Armazenamento S3/R2: a **AWS CLI** e as credenciais no ambiente.

## Como usar

1. Copie `job.example.json` para `jobs/meu-video.json` e ajuste: as câmeras (brutos),
   os cortes (quem aparece em cada trecho) e os formatos. Ponha os brutos em `jobs/meu-video/brutos/`.
2. Estime o custo:
   ```bash
   node video/render/orchestrator/render.mjs jobs/meu-video.json --estimar
   ```
3. Renderize:
   ```bash
   # no seu PC (grátis)
   node video/render/orchestrator/render.mjs jobs/meu-video.json --backend local --sincronizar

   # na nuvem (GitHub Actions)
   node video/render/orchestrator/render.mjs jobs/meu-video.json --backend github --sim
   ```

Opções: `--backend`, `--formatos youtube,tiktok`, `--4k`, `--sincronizar` (alinha câmeras pelo áudio),
`--estimar` (só o custo), `--sim` (não pergunta).

## Como escolher o backend

| Backend | Custo | Quando usar |
|---|---|---|
| **local** | Grátis (seu PC) | O padrão. Rápido se o PC aguenta. 4K multicâmera pede um PC bom. |
| **github** | Grátis em repo público; repo privado tem 2000 min/mês grátis | Quando o PC é fraco ou você quer deixar renderizando na nuvem. 4K é lento no runner grátis (sem GPU). |
| **lambda** | Pago por uso (conta AWS) | 4K pesado com muita animação Remotion. Opcional, ligado sob demanda. |

## Onde ficam os arquivos

- **Brutos**: onde você colocou (`jobs/<video>/brutos/`). **Nunca** são alterados nem commitados.
- **Finalizados**: `jobs/<video>/out/` no modo local; no GitHub, baixados da Action. Também enviados ao
  armazenamento externo conforme `render.config.json` → `armazenamento.destino`.
- Tudo isso está no `.gitignore` — vídeo pesado não entra no repositório.

## Arquitetura (modular)

```
video/render/
  render.config.json      padrões (backend, formatos, codec, custo, armazenamento)
  job.example.json        modelo de um job
  orchestrator/
    render.mjs            CLI: estima → confirma → renderiza → baixa → envia
    lib/
      ffmpeg.mjs          cortes multicâmera, áudio e exportação (núcleo)
      sync.mjs            sincroniza câmeras pelo áudio
      formats.mjs         YouTube 16:9 e TikTok 9:16 (1080p/4K)
      graphics.mjs        camada Remotion/overlay com transparência
      cost.mjs            estimativa de custo por backend
      storage.mjs         envio externo (artifact / Vercel Blob / S3-R2)
      progress.mjs        barra de progresso
      backends/{local,github,lambda}.mjs
.github/workflows/mlpb-render.yml   a renderização remota (só manual)
```

## Estado / o que testar no primeiro uso

- **Testado aqui**: estimativa de custo, multicâmera com troca de câmera por corte, os dois
  formatos (1920×1080 e 1080×1920), tratamento de áudio e preservação dos brutos.
- **A validar no seu ambiente** (não dá para testar neste servidor): a rodada no **GitHub Actions**
  (precisa do workflow publicado, do `gh` logado e do armazenamento externo com os brutos), a
  renderização da **camada Remotion** (precisa de um projeto Remotion) e o backend **Lambda**.
  Rode uma vez com um vídeo curto e me diga o que aparecer que eu ajusto.
