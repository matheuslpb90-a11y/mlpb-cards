// Núcleo de FFmpeg: sincronização, cortes multicâmera, áudio e exportação
// nos dois formatos. Usa só o ffmpeg/ffprobe do sistema (sem dependências npm).
import { spawn } from "node:child_process";

export function parseTempo(t) {
  if (typeof t === "number") return t;
  const p = String(t).trim().split(":").map(Number);
  return p.reduce((acc, v) => acc * 60 + v, 0);
}

export function rodar(cmd, args, { onLinha } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stdout.on("data", (d) => onLinha && onLinha(String(d)));
    p.stderr.on("data", (d) => {
      err += d;
      if (onLinha) onLinha(String(d));
    });
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} saiu com código ${c}:\n${err.slice(-2000)}`))));
  });
}

export async function probe(arquivo) {
  let out = "";
  await rodar("ffprobe", [
    "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration",
    "-of", "json", arquivo,
  ], { onLinha: (l) => (out += l) });
  // ffprobe escreve o JSON no stdout; capturamos tudo
  const json = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
  const v = (json.streams || []).find((s) => s.codec_type === "video") || {};
  return {
    largura: +v.width || 0,
    altura: +v.height || 0,
    duracao: +(json.format?.duration || 0),
    temAudio: (json.streams || []).some((s) => s.codec_type === "audio"),
  };
}

// "cover" (preenche cortando) ou "contain" (cabe com barras pretas)
function escalaPad(w, h, fit) {
  return fit === "cover"
    ? `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`
    : `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;
}

/**
 * Monta e roda a edição de UM formato.
 * cameras: [{arquivo, offset}] (índice = ordem). principalIdx = câmera base do tempo/áudio.
 * cortes: [{ini,fim,camera}] na linha do tempo da principal. Vazio = principal inteira.
 * overlay: caminho de um vídeo com alfa (mesmo WxH) para sobrepor, ou null.
 */
export async function editarFormato({
  cameras, principalIdx, cortes, dur, w, h, fit, fps, limparVoz, normalizar, overlay, codec, destino, onProgresso,
}) {
  const inputs = [];
  cameras.forEach((c) => inputs.push("-i", c.arquivo));
  const over = overlay ? cameras.length : -1;
  if (overlay) inputs.push("-i", overlay);

  const segs = cortes && cortes.length ? cortes : [{ ini: 0, fim: dur, camera: principalIdx }];
  const partes = [];
  const vlabels = [];
  const alabels = [];

  segs.forEach((s, i) => {
    const ini = parseTempo(s.ini);
    const fim = parseTempo(s.fim);
    const ci = s.camera ?? principalIdx;
    const offV = cameras[ci].offset || 0;
    const offP = cameras[principalIdx].offset || 0;
    // vídeo da câmera escolhida, recortado no tempo dela
    partes.push(
      `[${ci}:v]trim=start=${(ini + offV).toFixed(3)}:end=${(fim + offV).toFixed(3)},setpts=PTS-STARTPTS,fps=${fps},${escalaPad(w, h, fit)}[v${i}]`,
    );
    vlabels.push(`[v${i}]`);
    // áudio sempre da principal, no tempo dela
    partes.push(
      `[${principalIdx}:a]atrim=start=${(ini + offP).toFixed(3)}:end=${(fim + offP).toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`,
    );
    alabels.push(`[a${i}]`);
  });

  partes.push(`${vlabels.join("")}concat=n=${segs.length}:v=1:a=0[vcat]`);
  partes.push(`${alabels.join("")}concat=n=${segs.length}:v=0:a=1[acat]`);

  // tratamento de áudio
  let aOut = "acat";
  const af = [];
  if (limparVoz) af.push("highpass=f=90", "lowpass=f=12000", "afftdn=nf=-25");
  if (normalizar) af.push("loudnorm=I=-14:TP=-1.5:LRA=11");
  if (af.length) {
    partes.push(`[acat]${af.join(",")}[aproc]`);
    aOut = "aproc";
  }

  // overlay dos gráficos (identidade visual) por cima
  let vOut = "vcat";
  if (overlay) {
    partes.push(`[${over}:v]scale=${w}:${h}[gfx]`);
    partes.push(`[vcat][gfx]overlay=0:0:format=auto[vov]`);
    vOut = "vov";
  }

  const args = [
    "-y", "-hide_banner", "-stats", "-progress", "pipe:2",
    ...inputs,
    "-filter_complex", partes.join(";"),
    "-map", `[${vOut}]`, "-map", `[${aOut}]`,
    "-r", String(fps),
    "-c:v", codec.video, "-crf", String(codec.crf), "-preset", codec.preset, "-pix_fmt", codec.pixfmt,
    "-c:a", codec.audio, "-b:a", `${codec.audioKbps}k`,
    "-movflags", "+faststart",
    destino,
  ];

  await rodar("ffmpeg", args, {
    onLinha: (l) => {
      const m = l.match(/out_time_ms=(\d+)/);
      if (m && onProgresso && dur > 0) onProgresso(Math.min(1, +m[1] / 1e6 / dur));
    },
  });
}
