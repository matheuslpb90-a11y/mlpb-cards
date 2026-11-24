// Camada de identidade visual (Remotion/HyperFrames) sobreposta ao vídeo.
// Precisa de um vídeo COM TRANSPARÊNCIA (alfa). Formas aceitas:
//  - job.graficos = null                → sem overlay
//  - job.graficos.overlay = "x.mov"     → usa esse arquivo pronto (com alfa)
//  - job.graficos.tipo = "remotion"     → renderiza o projeto Remotion em .mov (ProRes 4444, com alfa)
//  - job.graficos.tipo = "hyperframes"  → HyperFrames exporta MP4 sem alfa; use overlay pronto .mov/.webm
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { rodar } from "./ffmpeg.mjs";

export async function resolverOverlay(job, baseDir, { onInfo } = {}) {
  const g = job.graficos;
  if (!g) return null;

  if (g.overlay) {
    const p = resolve(baseDir, g.overlay);
    if (!existsSync(p)) throw new Error(`graficos.overlay não encontrado: ${p}`);
    return p;
  }

  if (g.tipo === "remotion" && g.projeto) {
    const proj = resolve(baseDir, g.projeto);
    const saida = resolve(baseDir, "graficos", "overlay.mov");
    onInfo && onInfo("Renderando camada Remotion com transparência (ProRes 4444)…");
    // Remotion com alfa: ProRes 4444. entry/comp vêm do config do job.
    await rodar("npx", [
      "remotion", "render",
      g.entry || "src/index.ts",
      g.composicao || "Main",
      saida,
      "--codec=prores", "--prores-profile=4444", "--image-format=png",
    ]).catch((e) => {
      throw new Error("Falha ao renderizar o Remotion. Rode `npx remotion render` no projeto " + proj + " para ver o erro.\n" + e.message);
    });
    return saida;
  }

  if (g.tipo === "hyperframes") {
    onInfo && onInfo("HyperFrames exporta MP4 sem transparência. Para overlay, exporte um .mov/.webm com alfa e aponte em graficos.overlay. Seguindo sem overlay.");
    return null;
  }

  return null;
}
