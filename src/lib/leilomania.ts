import { db } from "@/lib/db";

// Link de indicação da loja na Leilomania (público). Pode ser trocado no painel: Leilões → 🟣 Leilomania.
export const LEILOMANIA_REF_DEFAULT = "https://leilomania.com.br/r/ZjVjNDgzNGUtMjFkYS00MGI3LWFmNDItMzEwMmQxNTI5M2U2";

export async function leilomaniaLinks() {
  const rows = await db.setting.findMany({ where: { key: { in: ["leilomaniaUrl", "leilomaniaRefUrl"] } } });
  const get = (k: string) => rows.find((r) => r.key === k)?.value?.trim() ?? "";
  return { profileUrl: get("leilomaniaUrl"), refUrl: get("leilomaniaRefUrl") || LEILOMANIA_REF_DEFAULT };
}

/** Fotos de um leilão da Leilomania (a primeira é a capa). */
export function extImages(a: { imageUrl: string; imagesJson?: string | null }) {
  let list: string[] = [];
  try { list = JSON.parse(a.imagesJson || "[]"); } catch {}
  if (!list.length && a.imageUrl) list = [a.imageUrl];
  return list.filter((u) => typeof u === "string" && u);
}
