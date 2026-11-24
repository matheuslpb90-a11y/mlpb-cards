// Backend GITHUB ACTIONS: renderização remota de baixo custo.
// Fluxo: empacota o job + brutos, envia para o armazenamento externo,
// dispara o workflow mlpb-render.yml, acompanha e baixa o resultado.
// Precisa do `gh` (GitHub CLI) autenticado e do workflow publicado no repositório.
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { enviar } from "../storage.mjs";

function gh(args, { onLinha } = {}) {
  return new Promise((res, rej) => {
    const p = spawn("gh", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => { out += d; onLinha && onLinha(String(d)); });
    p.stderr.on("data", (d) => { err += d; onLinha && onLinha(String(d)); });
    p.on("error", (e) => rej(new Error("Não achei o `gh` (GitHub CLI). Instale e rode `gh auth login`. " + e.message)));
    p.on("close", (c) => (c === 0 ? res(out.trim()) : rej(new Error(err.slice(-1200) || "gh falhou"))));
  });
}

function zip(pasta, destino) {
  return new Promise((res, rej) => {
    const p = spawn("bash", ["-c", `cd "${dirname(pasta)}" && zip -r -q "${destino}" "$(basename "${pasta}")"`]);
    p.on("error", rej);
    p.on("close", (c) => (c === 0 ? res() : rej(new Error("falha ao compactar o job (precisa do `zip`)"))));
  });
}

export async function renderGithub({ job, jobDir, outDir, storageCfg, onEtapa }) {
  if (!["vercel-blob", "s3"].includes(storageCfg.destino)) {
    throw new Error(
      "Para renderizar no GitHub Actions, o armazenamento precisa ser 'vercel-blob' ou 's3' " +
      "(o runner baixa os brutos de lá). Ajuste 'armazenamento.destino' no render.config.json.",
    );
  }
  await mkdir(outDir, { recursive: true });

  onEtapa("Compactando o job e os brutos…");
  const pacote = join(outDir, `${job.nome}-pacote.zip`);
  await zip(jobDir, pacote);

  onEtapa("Enviando o pacote para o armazenamento externo…");
  const env = await enviar(pacote, storageCfg, { onInfo: (m) => onEtapa(m) });
  const url = env.url;
  if (!url) throw new Error("O armazenamento não devolveu uma URL para o pacote.");

  onEtapa("Disparando o workflow de renderização no GitHub…");
  await gh(["workflow", "run", "mlpb-render.yml",
    "-f", `pacote_url=${url}`,
    "-f", `nome=${job.nome}`,
    "-f", `destino=${storageCfg.destino}`,
  ]);

  onEtapa("Aguardando a Action começar…");
  await new Promise((r) => setTimeout(r, 6000));
  const idLinha = await gh(["run", "list", "--workflow=mlpb-render.yml", "--limit=1", "--json", "databaseId,status", "-q", ".[0].databaseId"]);
  const runId = idLinha.trim();

  onEtapa(`Acompanhando a renderização (run ${runId})… isso pode levar vários minutos.`);
  await gh(["run", "watch", runId, "--exit-status"], { onLinha: (l) => process.stdout.write(l) });

  onEtapa("Baixando os vídeos finalizados…");
  await gh(["run", "download", runId, "-D", outDir]);

  return { runId, baixadoEm: outDir };
}
