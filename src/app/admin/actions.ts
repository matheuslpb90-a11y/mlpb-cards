"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseBRLToCents } from "@/lib/money";
import { cancelOrder, cancelPaidOrder } from "@/lib/orders";
import { CSV_COLUMNS, parseCSV } from "@/lib/csv";
import { SETTING_KEYS } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

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
  condition: z.enum(["M", "NM", "SP", "MP", "HP", "DMG"]).default("NM"),
  finish: z.enum(["Normal", "Foil", "Reverse Foil", "Promo"]).default("Normal"),
  language: z.string().trim().default("Português"),
  price: z.string(),
  compareAt: z.string().default(""),
  stock: z.coerce.number().int("Estoque inválido").min(0, "Estoque inválido"),
  imageUrl: z.string().trim().default(""),
  description: z.string().trim().default(""),
  active: z.string().optional(),
});

// diagnóstico de lentidão: marca se este servidor acabou de "acordar" (primeira ação depois de um tempo parado)
const g = globalThis as unknown as { __mlpbWarm?: boolean };

export async function saveCardAction(_: State, form: FormData): Promise<State> {
  const t0 = Date.now();
  const cold = !g.__mlpbWarm;
  g.__mlpbWarm = true;
  await requireAdmin();
  const tAuth = Date.now();
  const parsed = cardSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { price, compareAt, active, featured, ...data } = parsed.data;
  if (data.kind === "CARTA" && !data.setName) return { error: "Informe a coleção da carta" };
  if (data.kind === "PRODUTO" && !data.category) return { error: "Escolha a categoria do produto" };
  const priceCents = parseBRLToCents(price);
  if (priceCents === null) return { error: "Preço inválido. Use o formato 12,50" };
  const compareAtCents = compareAt.trim() ? parseBRLToCents(compareAt) : null;
  if (compareAt.trim() && compareAtCents === null) return { error: "Preço original inválido. Use o formato 15,00" };
  if (data.imageUrl && !/^(https?:\/\/|\/api\/imagens\/)/.test(data.imageUrl)) return { error: "A imagem deve ser um link http(s) ou uma foto enviada." };

  // foto da MYP não aparece no site: troca pela imagem oficial quando possível
  // (no máximo 5 segundos: se a base oficial demorar, salva assim mesmo)
  if (data.imageUrl) {
    const original = data.imageUrl;
    const { usableImage } = await import("@/lib/card-image");
    data.imageUrl = await Promise.race([
      usableImage(original, [], data.name, data.number).catch(() => original),
      new Promise<string>((ok) => setTimeout(() => ok(original), 5000)),
    ]);
  }
  const tImg = Date.now();
  const id = String(form.get("id") ?? "");
  const payload = { ...data, priceCents, compareAtCents: compareAtCents && compareAtCents > priceCents ? compareAtCents : null, active: active === "on", featured: featured === "on" };
  if (id) await db.card.update({ where: { id }, data: payload });
  else {
    // mesma carta e mesma versão (idioma + tipo + estado) já no estoque: soma a quantidade em vez de duplicar
    const { variantsForCard } = await import("@/lib/stock-variants");
    const { variantKey } = await import("@/lib/catalog");
    const same = data.kind === "CARTA" ? (await variantsForCard(data.name, data.setName, data.number)).find((e) => variantKey(e) === variantKey(data)) : undefined;
    if (same) await db.card.update({ where: { id: same.id }, data: { ...payload, stock: same.stock + payload.stock } });
    else await db.card.create({ data: payload });
  }
  const tDb = Date.now();
  const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
  await logActivity(
    "card_saved",
    `${id ? "Editou" : "Cadastrou"} ${data.kind === "PRODUTO" ? "selado" : "carta"} "${data.name}" (${price}) · ⏱ ${secs(tDb - t0)} [login ${secs(tAuth - t0)}, foto ${secs(tImg - tAuth)}, banco ${secs(tDb - tImg)}${cold ? ", servidor acordando" : ""}]`,
  );
  revalidatePath("/");
  redirect(`/admin/cartas?tipo=${data.kind === "PRODUTO" ? "selados" : "cartas"}`);
}

/** Recebe uma foto já reduzida no navegador (data URL JPEG/PNG/WebP) e guarda no banco. */
export async function uploadImageAction(dataUrl: string): Promise<{ url?: string; error?: string }> {
  await requireAdmin();
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { error: "Formato de imagem inválido." };
  const data = Buffer.from(m[2], "base64");
  if (data.length > 900_000) return { error: "Imagem muito grande (máx. ~900 KB depois de reduzida)." };
  const img = await db.image.create({ data: { mime: m[1], data } });
  return { url: `/api/imagens/${img.id}` };
}

export async function toggleCardAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const card = await db.card.findUnique({ where: { id } });
  if (!card) return;
  await db.card.update({ where: { id }, data: { active: !card.active } });
  await logActivity("card_toggled", `"${card.name}" ${card.active ? "retirada do" : "voltou ao"} catálogo`);
  revalidatePath("/admin/cartas");
  revalidatePath("/");
}

export async function deleteCardAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const used = await db.orderItem.count({ where: { cardId: id } });
  // Cartas que já aparecem em pedidos são apenas retiradas do catálogo, para manter o histórico.
  const del = await db.card.findUnique({ where: { id }, select: { name: true } });
  if (used > 0) await db.card.update({ where: { id }, data: { active: false } });
  else await db.card.delete({ where: { id } });
  await logActivity("card_deleted", `Excluiu "${del?.name ?? id}"`);
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
      condition: cond === "D" ? "DMG" : ["M", "NM", "SP", "MP", "HP", "DMG"].includes(cond) ? cond : "NM",
      finish: (["Normal", "Foil", "Reverse Foil", "Promo"].find((f) => f.toLowerCase() === get(r, "acabamento").toLowerCase()) ?? "Normal"),
      language: get(r, "idioma") || "Português",
      priceCents,
      compareAtCents: (() => { const v = parseBRLToCents(get(r, "preco_original")); return v && v > priceCents ? v : null; })(),
      stock: Number.isFinite(stock) && stock >= 0 ? stock : 1,
      imageUrl: get(r, "imagem"),
      description: get(r, "descricao"),
    });
  }
  if (data.length) await db.card.createMany({ data });
  await logActivity("cards_imported", `Importou ${data.length} item(ns) por CSV`);
  revalidatePath("/");
  return {
    ok: `${data.length} carta(s) importada(s).${errors.length ? ` Ignoradas (nome/preço inválido): ${errors.slice(0, 20).join(", ")}${errors.length > 20 ? "…" : ""}` : ""}`,
  };
}

const ORDER_STATUSES = ["AGUARDANDO_PAGAMENTO", "PAGO", "ACUMULANDO", "ENVIADO", "CANCELADO"];

export async function updateOrderAction(id: string, status: string, trackingCode: string): Promise<{ ok?: string; error?: string }> {
  await requireAdmin();
  if (!ORDER_STATUSES.includes(status)) return { error: "Status inválido." };
  const order = await db.order.findUnique({ where: { id } });
  if (!order) return { error: "Pedido não encontrado." };
  let note = "";
  if (status === "CANCELADO" && order.status !== "CANCELADO") {
    if (order.status === "AGUARDANDO_PAGAMENTO") await cancelOrder(id); // devolve o estoque
    else {
      await cancelPaidOrder(id); // devolve estoque, tira da caixa e tira os pontos
      note = " Lembre de estornar o valor na InfinitePay, se for o caso.";
    }
  }
  await db.order.update({ where: { id }, data: { trackingCode: trackingCode.trim().toUpperCase(), status } });
  const novoRastreio = trackingCode.trim().toUpperCase();
  if (status !== order.status || (status === "ENVIADO" && novoRastreio && novoRastreio !== order.trackingCode)) {
    const { notifyOrderStatus } = await import("@/lib/notify");
    await notifyOrderStatus(id);
  }
  await logActivity("order_updated", `Pedido #${order.code}: ${status}${trackingCode ? ` · rastreio ${trackingCode}` : ""}`);
  revalidatePath("/admin/pedidos");
  revalidatePath(`/pedido/${order.code}`);
  return { ok: `Pedido #${order.code} atualizado ✔${note}` };
}

export async function saveSettingsAction(_: State, form: FormData): Promise<State> {
  await requireAdmin();
  const LABELS: Record<string, string> = {
    logoUrl: "Logo",
    heroImageUrl: "Imagem do banner",
    whatsappGroupUrl: "Grupo do WhatsApp",
    youtubeUrl: "Canal do YouTube",
    youtubeVideoUrl: "Vídeo em destaque",
    tiktokUrl: "TikTok",
  };
  // Valida tudo antes de salvar qualquer coisa.
  const values: [string, string][] = [];
  for (const key of SETTING_KEYS) {
    if (!form.has(key)) continue;
    let value = String(form.get(key) ?? "").trim();
    if (value && key.endsWith("Url")) {
      // aceita link sem "https://" (ex.: www.tiktok.com/@perfil) e imagens internas do site ("/logo.png")
      if (!/^https?:\/\//i.test(value) && !(value.startsWith("/") && !value.startsWith("//"))) value = `https://${value}`;
      if (!/^(https?:\/\/[^\s]+\.[^\s]+|\/[^/\s][^\s]*)$/i.test(value))
        return { error: `O campo "${LABELS[key] ?? key}" não parece um link válido.` };
    }
    values.push([key, value]);
  }
  for (const [key, value] of values) {
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  await logActivity("settings_updated", "Aparência e links atualizados");
  revalidatePath("/", "layout");
  return { ok: "Salvo! Abra o site para ver como ficou." };
}
