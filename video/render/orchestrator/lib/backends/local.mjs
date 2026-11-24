// Backend LOCAL: renderiza no próprio computador (ou dentro da GitHub Action).
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { editarFormato } from "../ffmpeg.mjs";
import { resolverFormato, tamanho } from "../formats.mjs";
import { barra } from "../progress.mjs";

export async function renderLocal({ job, dur, overlay, outDir, onEtapa }) {
  await mkdir(outDir, { recursive: true });
  const resultados = [];
  for (const nome of job.formatos) {
    const f = resolverFormato(nome);
    const { w, h } = tamanho(f, job.qualidade4k);
    const fit = f.nome === "tiktok" ? "cover" : "contain";
    const destino = join(outDir, `${job.nome}-${f.nome}.mp4`);
    onEtapa(`Renderizando ${f.nome} (${w}x${h})`);
    await editarFormato({
      cameras: job.cameras,
      principalIdx: job.principalIdx,
      cortes: job.cortes,
      dur, w, h, fit,
      fps: job.fps,
      limparVoz: job.audio?.limparVoz,
      normalizar: job.audio?.normalizar,
      overlay,
      codec: job.codec,
      destino,
      onProgresso: barra(f.nome.padEnd(8)),
    });
    resultados.push({ formato: f.nome, arquivo: destino });
  }
  return resultados;
}
