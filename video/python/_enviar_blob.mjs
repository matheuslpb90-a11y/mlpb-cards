// Envia um arquivo local para o Vercel Blob (o mesmo da loja) e imprime a URL pública.
// Uso: node _enviar_blob.mjs caminho/da/foto.jpg   (precisa de BLOB_READ_WRITE_TOKEN no ambiente)
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { put } from "@vercel/blob";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("Uso: node _enviar_blob.mjs <arquivo>");
  process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Falta BLOB_READ_WRITE_TOKEN (o mesmo token do Vercel Blob da loja).");
  process.exit(1);
}
const dados = await readFile(arquivo);
const blob = await put(`broll/${Date.now()}-${basename(arquivo)}`, dados, { access: "public" });
console.log(blob.url);
