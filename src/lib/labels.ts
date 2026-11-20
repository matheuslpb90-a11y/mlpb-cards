import "server-only";
import { db } from "./db";
import { log } from "./zapi";
import { boxItemCount } from "./boxes";

// Etiquetas de envio pela SuperFrete (https://superfrete.readme.io).
// Fluxo: 1) POST /api/v0/cart cria o envio  2) POST /api/v0/checkout paga com o saldo da conta SuperFrete
// 3) GET /api/v0/order/info/{id} traz status e rastreio  4) POST /api/v0/tag/print devolve o PDF da etiqueta.

const SF_URL =
  process.env.SUPERFRETE_API_URL ||
  (process.env.SUPERFRETE_SANDBOX === "1" ? "https://sandbox.superfrete.com" : "https://api.superfrete.com");
const SF_TOKEN = () => process.env.SUPERFRETE_TOKEN ?? "";

export const SF_SERVICES: Record<string, string> = { "1": "PAC", "2": "SEDEX", "17": "Mini Envios" };

export type Sender = { name: string; document: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string; cep: string; email: string };
export const EMPTY_SENDER: Sender = { name: "MLPB Cards", document: "", street: "", number: "", complement: "", neighborhood: "", city: "Brasília", state: "DF", cep: process.env.STORE_ORIGIN_CEP || "70675827", email: "" };

export async function getSender(): Promise<Sender> {
  const s = await db.setting.findUnique({ where: { key: "senderJson" } });
  try {
    return { ...EMPTY_SENDER, ...(JSON.parse(s?.value ?? "{}") as Partial<Sender>) };
  } catch {
    return EMPTY_SENDER;
  }
}
export const senderComplete = (s: Sender) => Boolean(s.name && s.street && s.number && s.neighborhood && s.city && s.state.length === 2 && s.cep.replace(/\D/g, "").length === 8);

async function sf<T>(path: string, body?: unknown, method = body ? "POST" : "GET"): Promise<T> {
  if (!SF_TOKEN()) throw new Error("SuperFrete não configurada (SUPERFRETE_TOKEN na Vercel).");
  const res = await fetch(`${SF_URL}/api/v0/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SF_TOKEN()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": process.env.SUPERFRETE_USER_AGENT ?? "MLPB Cards (www.mlpbcards.com.br)",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* texto */
  }
  if (!res.ok || (data && typeof data === "object" && (data as { success?: boolean }).success === false)) {
    await log("erro-superfrete", { path, status: res.status, resposta: text.slice(0, 1500) });
    const d = data as { message?: string; error?: string; errors?: Record<string, string[]> };
    const detail = d?.errors ? Object.values(d.errors).flat().join(" ") : d?.message ?? d?.error ?? text.slice(0, 200);
    throw new Error(`SuperFrete (${res.status}): ${detail}`);
  }
  return data as T;
}

type Addr = { name: string; cep: string; street: string; number: string; complement?: string; neighborhood: string; city: string; state: string };
const digits = (v: string) => (v ?? "").replace(/\D/g, "");
const sfAddr = (a: Addr & { document?: string; email?: string }) => ({
  name: a.name.slice(0, 60),
  address: a.street,
  number: a.number || "S/N",
  complement: a.complement ?? "",
  district: a.neighborhood || "Centro",
  city: a.city,
  state_abbr: a.state.toUpperCase(),
  postal_code: digits(a.cep),
  ...(a.document ? { document: digits(a.document) } : {}),
  ...(a.email ? { email: a.email } : {}),
});

export function packageFor(cards: number) {
  return {
    height: Math.max(2, Math.ceil(cards / 40) + 1),
    width: 11,
    length: 16,
    weight: Number((0.05 + 0.005 * cards).toFixed(3)),
  };
}

/** Serviço sugerido a partir do método escolhido pelo cliente. */
export function guessService(method: string) {
  const m = method.toLowerCase();
  if (m.includes("sedex")) return "2";
  if (m.includes("mini")) return "17";
  return "1";
}

type Target = { kind: "box" | "order"; id: string };

async function loadTarget(t: Target) {
  if (t.kind === "box") {
    const b = await db.box.findUnique({ where: { id: t.id } });
    if (!b) throw new Error("Caixa não encontrada.");
    if (!b.addressJson) throw new Error("A caixa não tem endereço de entrega.");
    const a = JSON.parse(b.addressJson) as Addr & { cpf?: string };
    const cards = await boxItemCount(b.id);
    return { ref: `Caixa #${b.code}`, addr: a, document: a.cpf ?? "", email: "", cards, valueCents: 0, method: b.shippingMethod, sfOrderId: b.sfOrderId };
  }
  const o = await db.order.findUnique({ where: { id: t.id }, include: { user: true, items: true } });
  if (!o) throw new Error("Pedido não encontrado.");
  const u = o.user;
  return {
    ref: `Pedido #${o.code}`,
    addr: { name: u.name, cep: u.cep, street: u.street, number: u.number, complement: u.complement, neighborhood: u.neighborhood, city: u.city, state: u.state },
    document: u.cpf,
    email: u.email,
    cards: o.items.reduce((s, i) => s + i.quantity, 0),
    valueCents: o.subtotalCents,
    method: o.shippingMethod,
    sfOrderId: o.sfOrderId,
  };
}

async function saveTarget(t: Target, data: { sfOrderId?: string; sfStatus?: string; trackingCode?: string }) {
  if (t.kind === "box") await db.box.update({ where: { id: t.id }, data });
  else await db.order.update({ where: { id: t.id }, data });
}

type SFOrder = { id?: string; status?: string; tracking?: string; tracking_code?: string; self_tracking?: string; print?: { url?: string } };

/** Cria a etiqueta e paga com o saldo da SuperFrete. */
export async function createLabel(t: Target, opts: { service: string; insuranceCents?: number }) {
  const sender = await getSender();
  if (!senderComplete(sender)) throw new Error("Preencha os dados do remetente (endereço da loja) em Envios.");
  const x = await loadTarget(t);
  if (x.sfOrderId) throw new Error("Já existe uma etiqueta para este envio. Cancele antes de gerar outra.");
  const cart = await sf<SFOrder>("cart", {
    from: sfAddr({ ...sender, document: sender.document, email: sender.email }),
    to: sfAddr({ ...x.addr, document: x.document, email: x.email }),
    service: Number(opts.service),
    products: [{ name: `Cartas colecionáveis (${x.ref})`, quantity: Math.max(1, x.cards), unitary_value: Math.max(1, (opts.insuranceCents ?? x.valueCents) / 100 / Math.max(1, x.cards)) }],
    volumes: packageFor(Math.max(1, x.cards)),
    options: {
      insurance_value: (opts.insuranceCents ?? 0) / 100,
      receipt: false,
      own_hand: false,
      non_commercial: true,
      tags: [{ tag: x.ref }],
    },
    platform: "MLPB Cards",
  });
  const id = String(cart.id ?? "");
  if (!id) throw new Error("A SuperFrete não devolveu o número da etiqueta.");
  await saveTarget(t, { sfOrderId: id, sfStatus: "pending" });
  try {
    await sf("checkout", { orders: [id] });
  } catch (e) {
    // etiqueta criada, mas não paga (ex.: sem saldo) — fica salva para pagar depois no site da SuperFrete
    throw new Error(`Etiqueta criada, mas não foi paga: ${e instanceof Error ? e.message : e}. Coloque saldo na SuperFrete e clique em “Pagar etiqueta”.`);
  }
  return refreshLabel(t);
}

/** Paga uma etiqueta já criada (ex.: depois de colocar saldo). */
export async function payLabel(t: Target) {
  const x = await loadTarget(t);
  if (!x.sfOrderId) throw new Error("Sem etiqueta.");
  await sf("checkout", { orders: [x.sfOrderId] });
  return refreshLabel(t);
}

/** Atualiza status e rastreio. */
export async function refreshLabel(t: Target) {
  const x = await loadTarget(t);
  if (!x.sfOrderId) throw new Error("Sem etiqueta.");
  const info = await sf<SFOrder>(`order/info/${encodeURIComponent(x.sfOrderId)}`);
  const tracking = String(info.tracking ?? info.tracking_code ?? info.self_tracking ?? "").trim().toUpperCase();
  await saveTarget(t, { sfStatus: String(info.status ?? ""), ...(tracking ? { trackingCode: tracking } : {}) });
  return { status: String(info.status ?? ""), tracking };
}

/** Link do PDF das etiquetas (uma ou várias). */
export async function printLabels(sfOrderIds: string[]) {
  const r = await sf<{ url?: string; link?: string }>("tag/print", { orders: sfOrderIds });
  const url = r.url ?? r.link ?? "";
  if (!url) throw new Error("A SuperFrete não devolveu o link de impressão.");
  return url;
}

export async function cancelLabel(t: Target, reason = "Cancelado pela loja") {
  const x = await loadTarget(t);
  if (!x.sfOrderId) return;
  await sf("order/cancel", { order: { id: x.sfOrderId, description: reason } });
  await saveTarget(t, { sfOrderId: "", sfStatus: "" });
}

export const SF_STATUS: Record<string, string> = {
  pending: "Criada, não paga",
  released: "Paga — pronta para imprimir",
  posted: "Postada",
  delivered: "Entregue",
  canceled: "Cancelada",
  cancelled: "Cancelada",
};
