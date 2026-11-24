// Armazenamento externo dos vídeos finalizados (os pesados NÃO vão para o Git).
// Destinos: 'nenhum' (só local), 'github-artifact' (a própria Action guarda),
// 'vercel-blob' (usa @vercel/blob da loja) e 's3' (S3/Cloudflare R2/Backblaze).
import { basename } from "node:path";
import { stat } from "node:fs/promises";
import { spawn } from "node:child_process";

function sh(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", rej);
    p.on("close", (c) => (c === 0 ? res(out.trim()) : rej(new Error(err.slice(-800) || `${cmd} falhou`))));
  });
}

export async function enviar(arquivo, cfg, { onInfo } = {}) {
  const destino = cfg.destino || "nenhum";
  const { size } = await stat(arquivo);
  const mb = (size / 1e6).toFixed(1);

  if (destino === "nenhum" || destino === "github-artifact") {
    // github-artifact é tratado dentro do workflow (upload-artifact); aqui nada a fazer.
    onInfo && onInfo(`${basename(arquivo)} (${mb} MB) mantido local${destino === "github-artifact" ? " (a Action guarda como artifact)" : ""}.`);
    return { destino, local: arquivo };
  }

  if (destino === "vercel-blob") {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("vercel-blob: defina BLOB_READ_WRITE_TOKEN (o mesmo da loja).");
    const { put } = await import("@vercel/blob"); // já é dependência da loja
    const { readFile } = await import("node:fs/promises");
    const blob = await put(`mlpb-render/${Date.now()}-${basename(arquivo)}`, await readFile(arquivo), { access: "public" });
    onInfo && onInfo(`${basename(arquivo)} (${mb} MB) → ${blob.url}`);
    return { destino, url: blob.url };
  }

  if (destino === "s3") {
    const s = cfg.s3 || {};
    if (!s.bucket) throw new Error("s3: defina 'bucket' (e endpoint para R2/B2) no render.config.json.");
    const key = `${s.prefixo || ""}${basename(arquivo)}`;
    const args = ["s3", "cp", arquivo, `s3://${s.bucket}/${key}`];
    if (s.endpoint) args.push("--endpoint-url", s.endpoint);
    await sh("aws", args); // usa a AWS CLI e as credenciais do ambiente
    const url = s.endpoint ? `${s.endpoint}/${s.bucket}/${key}` : `s3://${s.bucket}/${key}`;
    onInfo && onInfo(`${basename(arquivo)} (${mb} MB) → ${url}`);
    return { destino, url };
  }

  throw new Error(`Destino de armazenamento desconhecido: ${destino}`);
}
