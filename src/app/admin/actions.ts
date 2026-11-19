"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseBRLToCents } from "@/lib/money";
import { cancelOrder } from "@/lib/orders";
import { CSV_COLUMNS, parseCSV } from "@/lib/csv";

type State = { error?: string; ok?: string } | undefined;

const cardSchema = z.object({
  kind: z.enum(["CARTA", "PRODUTO"]).default("CARTA"),
  category: z.string().trim().default(""),
  featured: z.string().optional(),
  name: z.string().trim().min(1, "Informe o nome"),
  game: z.string().trim().default("Pokémon"),
  setName: z.string().trim().default(""),
  number: z.string().trim().default(""),
  rarity: z.string().trim().default(""),
  condition: z.string().trim().default("NM"),
  language: z.string().trim().default("Português"),
  price: z.string(),
  stock: z.coerce.number().int("Estoque inválido").min(0, "Estoque inválido"),
  imageUrl: z.string().trim().default(""),
  description: z.string().trim().default(""),
  active: z.string().optional(),
});

export async function saveCardAction(_: State, form: FormData): Promise<State> {
  await requireAdmin();
  const parsed = cardSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { price, active, featured, ...data } = parsed.data;
  if (data.kind === "CARTA" && !data.setName) return { error: "Informe a coleção da carta" };
  if (data.kind === "PRODUTO" && !data.category) return { error: "Escolha a categoria do produto" };
  const priceCents = parseBRLToCents(price);
  if (priceCents === null) return { error: "Preço inválido. Use o formato 12,50" };
  if (data.imageUrl && !/^(https?:\/\/|\/api\/imagens\/)/.test(data.imageUrl)) return { error: "A imagem deve ser um link http(s) ou uma foto enviada." };

  const id = String(form.get("id") ?? "");
  const payload = { ...data, priceCents, active: active === "on", featured: featured === "on" };
  if (id) await db.card.update({ where: { id }, data: payload });
  else await db.card.create({ data: payload });
  revalidatePath("/");
  redirect(`/admin/cartas?tipo=${data.kind === "PRODUTO" ? "produtos" : "cartas"}`);
}

/** Recebe uma foto já reduzida no navegador (data URL JPEG/PNG/WebP) e guarda no banco. */
export async function uploadImageAction(dataUrl: string): Promise<{ url?: string; error?: string }> {
  await requireAdmin();
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { error: "Formato de imagem inválido." };
  const data = Buffer.from(m[2], "base64");
  if (data.length > 900_000) return { error: "Imagem muito grande." };
  const img = await db.image.create({ data: { mime: m[1], data } });
  return { url: `/api/imagens/${img.id}` };
}

export async function toggleCardAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const card = await db.card.findUnique({ where: { id } });
  if (!card) return;
  await db.card.update({ where: { id }, data: { active: !card.active } });
  revalidatePath("/admin/cartas");
  revalidatePath("/");
}

export async function deleteCardAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const used = await db.orderItem.count({ where: { cardId: id } });
  // Cartas que já aparecem em pedidos são apenas retiradas do catálogo, para manter o histórico.
  if (used > 0) await db.card.update({ where: { id }, data: { active: false } });
  else await db.card.delete({ where: { id } });
  revalidatePath("/admin/cartas");
  revalidatePath("/");
  redirect("/admin/cartas");
}

export async function importCsvAction(_: State, form: FormData): Promise<State> {
  await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione um arquivo .csv" };
  const rows = parseCSV(await file.text());
  if (rows.length < 2) return { error: "O arquivo não tem linhas de cartas." };

  const header = rows[0].map((h) => h.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
  const idx = Object.fromEntries(CSV_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<(typeof CSV_COLUMNS)[number], number>;
  if (idx.nome < 0 || idx.preco < 0) return { error: "O CSV precisa ter pelo menos as colunas 'nome' e 'preco'." };

  const get = (r: string[], c: (typeof CSV_COLUMNS)[number]) => (idx[c] >= 0 ? (r[idx[c]] ?? "").trim() : "");
  const data = [];
  const errors: string[] = [];
  for (const [n, r] of rows.slice(1).entries()) {
    const priceCents = parseBRLToCents(get(r, "preco"));
    const name = get(r, "nome");
    if (!name || priceCents === null) {
      errors.push(`linha ${n + 2}`);
      continue;
    }
    const stock = Number.parseInt(get(r, "estoque") || "1", 10);
    const tipo = get(r, "tipo").toLowerCase();
    const kind = tipo.startsWith("prod") ? "PRODUTO" : "CARTA";
    const cond = get(r, "condicao").toUpperCase();
    data.push({
      kind,
      category: get(r, "categoria"),
      featured: ["sim", "s", "1", "x"].includes(get(r, "destaque").toLowerCase()),
      name,
      game: get(r, "jogo") || "Pokémon",
      setName: get(r, "colecao") || (kind === "CARTA" ? "—" : ""),
      number: get(r, "numero"),
      rarity: get(r, "raridade"),
      condition: cond === "D" ? "DMG" : cond || "NM",
      language: get(r, "idioma") || "Português",
      priceCents,
      stock: Number.isFinite(stock) && stock >= 0 ? stock : 1,
      imageUrl: get(r, "imagem"),
      description: get(r, "descricao"),
    });
  }
  if (data.length) await db.card.createMany({ data });
  revalidatePath("/");
  return {
    ok: `${data.length} carta(s) importada(s).${errors.length ? ` Ignoradas (nome/preço inválido): ${errors.slice(0, 20).join(", ")}${errors.length > 20 ? "…" : ""}` : ""}`,
  };
}

const ORDER_STATUSES = ["AGUARDANDO_PAGAMENTO", "PAGO", "ACUMULANDO", "ENVIADO", "CANCELADO"];

export async function updateOrderAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const status = String(form.get("status"));
  const trackingCode = String(form.get("trackingCode") ?? "").trim();
  if (!ORDER_STATUSES.includes(status)) return;
  if (status === "CANCELADO") await cancelOrder(id); // devolve estoque se ainda não foi pago
  await db.order.update({ where: { id }, data: { trackingCode, status } });
  revalidatePath("/admin/pedidos");
}
