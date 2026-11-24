#!/usr/bin/env node
// ============================================================
//  MLPB Cards — Renderização de vídeo (local / GitHub / Lambda)
//  Uso:
//    node render.mjs <job.json> [opções]
//  Opções:
//    --backend local|github|lambda   onde renderizar (padrão: do config)
//    --formatos youtube,tiktok        quais saídas (padrão: do config/job)
//    --4k                             renderiza em 4K
//    --sincronizar                    alinha as câmeras pelo áudio
//    --estimar                        só mostra o custo estimado e sai
//    --sim                            não pergunta, já renderiza
//  Exemplos:
//    node render.mjs jobs/abertura-151.json --estimar
//    node render.mjs jobs/abertura-151.json --backend local --sincronizar
//    node render.mjs jobs/abertura-151.json --backend github --sim
// ============================================================
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

import { probe, parseTempo } from "./lib/ffmpeg.mjs";
import { sincronizarPorAudio } from "./lib/sync.mjs";
import { estimar } from "./lib/cost.mjs";
import { resolverFormato } from "./lib/formats.mjs";
import { resolverOverlay } from "./lib/graphics.mjs";
import { renderLocal } from "./lib/backends/local.mjs";
import { renderGithub } from "./lib/backends/github.mjs";
import { renderLambda } from "./lib/backends/lambda.mjs";
import { enviar } from "./lib/storage.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function args() {
  const a = process.argv.slice(2);
  const o = { flags: new Set(), opts: {} };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--backend") o.opts.backend = a[++i];
    else if (a[i] === "--formatos") o.opts.formatos = a[++i].split(",").map((s) => s.trim());
    else if (a[i].startsWith("--")) o.flags.add(a[i].slice(2));
    else o.job = a[i];
  }
  return o;
}

function erro(m) { console.error("\nERRO:", m); process.exit(1); }

async function perguntar(q) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r = await new Promise((res) => rl.question(q, res));
  rl.close();
  return r.trim().toLowerCase();
}

async function main() {
  const o = args();
  if (!o.job) erro("informe o arquivo do job. Ex.: node render.mjs job.example.json --estimar");

  const cfg = JSON.parse(await readFile(join(RAIZ, "render.config.json"), "utf8"));
  const jobPath = resolve(o.job);
  const jobDir = dirname(jobPath);
  const job = JSON.parse(await readFile(jobPath, "utf8"));

  // mescla config + job + flags
  job.nome = job.nome || "video";
  job.fps = job.fps || cfg.fps;
  job.codec = { ...cfg.codec, ...(job.codec || {}) };
  job.qualidade4k = o.flags.has("4k") || job.qualidade4k || cfg.qualidade4k;
  job.formatos = (o.opts.formatos || job.formatos || cfg.formatos).map((f) => resolverFormato(f).nome);
  const backend = o.opts.backend || cfg.backend;
  const storageCfg = cfg.armazenamento;

  // câmeras: resolve caminhos e checa
  if (!job.cameras?.length) erro("o job precisa de pelo menos uma câmera em 'cameras'.");
  job.cameras = job.cameras.map((c) => ({ ...c, arquivo: resolve(jobDir, c.arquivo) }));
  for (const c of job.cameras) if (!existsSync(c.arquivo)) erro(`câmera não encontrada: ${c.arquivo}`);
  job.principalIdx = Math.max(0, job.cameras.findIndex((c) => c.principal));

  // sondagem
  const infos = [];
  for (const c of job.cameras) infos.push(await probe(c.arquivo));
  if (!infos[job.principalIdx].temAudio) erro("a câmera principal precisa ter áudio (é a base do tempo e do som).");

  // sincronização pelo áudio
  if (o.flags.has("sincronizar") && job.cameras.length > 1) {
    console.log("Sincronizando as câmeras pelo áudio…");
    const offs = await sincronizarPorAudio(job.cameras, job.principalIdx, { onInfo: (m) => console.log("  " + m) });
    job.cameras.forEach((c, i) => (c.offset = offs[i]));
  }

  // duração do vídeo final
  const fimCortes = (job.cortes || []).reduce((m, s) => Math.max(m, parseTempo(s.fim)), 0);
  const dur = fimCortes || infos[job.principalIdx].duracao;

  // estimativa de custo (sempre mostra)
  const est = estimar({ duracaoSeg: dur, formatos: job.formatos, quatroK: job.qualidade4k, backend, custoCfg: cfg.custo });
  console.log("\n── Estimativa ─────────────────────────────");
  console.log(`Vídeo: ${job.nome}  ·  ${Math.round(dur)}s  ·  ${job.qualidade4k ? "4K" : "1080p"}  ·  formatos: ${est.formatos.join(", ")}`);
  console.log(`Backend: ${backend}  ·  ~${est.minutosMaquina.toFixed(0)} min de máquina  ·  custo estimado: US$ ${est.usd.toFixed(2)}`);
  est.linhas.forEach((l) => console.log("  " + l));
  if (est.aviso) console.log("  ⚠ " + est.aviso);
  console.log("───────────────────────────────────────────");
  if (o.flags.has("estimar")) return;

  if (!o.flags.has("sim")) {
    const r = await perguntar("Renderizar agora? [s/N] ");
    if (r !== "s" && r !== "sim") { console.log("Cancelado."); return; }
  }

  const outDir = resolve(jobDir, cfg.pastas.saida);
  const onEtapa = (m) => console.log("• " + m);

  let resultados;
  if (backend === "local") {
    const overlay = await resolverOverlay(job, jobDir, { onInfo: onEtapa });
    resultados = await renderLocal({ job, dur, overlay, outDir, onEtapa });
    // envia os finalizados ao armazenamento externo (os brutos ficam intactos)
    for (const r of resultados) {
      const env = await enviar(r.arquivo, storageCfg, { onInfo: onEtapa });
      r.url = env.url;
    }
  } else if (backend === "github") {
    const r = await renderGithub({ job, jobDir, outDir, storageCfg, onEtapa });
    resultados = [{ formato: "todos", arquivo: r.baixadoEm }];
  } else if (backend === "lambda") {
    await renderLambda();
    return;
  } else {
    erro(`backend desconhecido: ${backend}`);
  }

  console.log("\n✓ Pronto! Brutos preservados. Finalizados:");
  for (const r of resultados) console.log(`  ${r.formato}: ${r.url || r.arquivo}`);
}

main().catch((e) => erro(e.message));
