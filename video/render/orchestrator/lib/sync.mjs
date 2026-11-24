// Sincronização de câmeras pelo áudio (alinha as câmeras à principal).
// Extrai o áudio em baixa taxa (mono, 1 kHz) e acha o deslocamento que melhor
// casa cada câmera com a principal, por correlação cruzada. Precisão ~1 ms.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TAXA = 1000; // Hz
const JANELA_S = 6; // procura o offset dentro de ±6 s

function extrairPcm(arquivo, destino, segundos) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", [
      "-v", "error", "-y", "-t", String(segundos), "-i", arquivo,
      "-ac", "1", "-ar", String(TAXA), "-f", "s16le", destino,
    ]);
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error("ffmpeg (sync) falhou em " + arquivo))));
  });
}

async function amostras(arquivo, dir, nome, segundos) {
  const f = join(dir, nome + ".pcm");
  await extrairPcm(arquivo, f, segundos);
  const buf = await readFile(f);
  const n = buf.length / 2;
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = buf.readInt16LE(i * 2) / 32768;
  return a;
}

/** Offset (em segundos) que alinha b à a. Positivo = b está atrasado. */
function melhorOffset(a, b) {
  const maxLag = JANELA_S * TAXA;
  let melhor = 0, melhorScore = -Infinity;
  const n = Math.min(a.length, b.length);
  for (let lag = -maxLag; lag <= maxLag; lag += 2) {
    let s = 0;
    const passo = 4; // amostra 1 em 4 para ir rápido
    for (let i = Math.max(0, -lag); i < n - Math.max(0, lag); i += passo) {
      s += a[i] * b[i + lag];
    }
    if (s > melhorScore) { melhorScore = s; melhor = lag; }
  }
  return melhor / TAXA;
}

/**
 * Recebe cameras [{arquivo}] e o índice da principal; devolve offsets em segundos.
 * offset_c: tempo da principal T corresponde ao tempo real da câmera c = T + offset_c.
 */
export async function sincronizarPorAudio(cameras, principalIdx, { onInfo } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "mlpb-sync-"));
  try {
    const seg = 40; // compara os primeiros 40 s
    const base = await amostras(cameras[principalIdx].arquivo, dir, "p", seg);
    const offsets = [];
    for (let i = 0; i < cameras.length; i++) {
      if (i === principalIdx) { offsets[i] = 0; continue; }
      const outra = await amostras(cameras[i].arquivo, dir, "c" + i, seg);
      const off = melhorOffset(base, outra);
      offsets[i] = off;
      onInfo && onInfo(`câmera ${i}: offset ${off.toFixed(3)} s`);
    }
    return offsets;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
