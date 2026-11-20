import "server-only";

// Integração com a Whapi.Cloud (https://whapi.cloud) — conexão do WhatsApp por QR Code,
// com envio de ENQUETE em grupos. Variável na Vercel: WHAPI_TOKEN (token do canal, no painel da Whapi).
// Autenticação: Authorization: Bearer <token>. Base: https://gate.whapi.cloud
// Os formatos de voto variam entre versões; o webhook do site aceita as variações conhecidas
// e registra tudo em Painel → Bot WhatsApp → Registro do bot.

const clean = (v?: string) => (v ?? "").trim().replace(/^["'`]+|["'`]+$/g, "").trim();
const TOKEN = clean(process.env.WHAPI_TOKEN);
const BASE = (clean(process.env.WHAPI_BASE_URL) || "https://gate.whapi.cloud").replace(/\/+$/, "");

export const whapiEnabled = () => TOKEN.length > 0;

/** Votante/remetente pode vir como "5561...@s.whatsapp.net", "...@lid" ou {id, phone}. Devolve o telefone. */
export function whapiPhone(v: unknown): string {
  if (v && typeof v === "object") {
    const o = v as { phone?: unknown; id?: unknown };
    return String(o.phone ?? o.id ?? "");
  }
  return String(v ?? "");
}

export async function whapiCall<T = unknown>(path: string, body?: unknown, method = body ? "POST" : "GET"): Promise<T> {
  const res = await fetch(`${BASE}/${path.replace(/^\//, "")}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Whapi ${path} respondeu ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

type Sent = { sent?: boolean; message?: { id?: string; poll?: { results?: { id?: string; name?: string }[] } }; id?: string };
const sentId = (r: Sent) => r?.message?.id ?? r?.id ?? "";

/** Destinatário: grupo "...@g.us" como está; telefone só com dígitos. */
const to = (p: string) => (p.includes("@") ? p : p.replace(/\D/g, ""));

export async function whapiText(phone: string, body: string) {
  return sentId(await whapiCall<Sent>("messages/text", { to: to(phone), body }));
}

export async function whapiMedia(kind: "image" | "video", phone: string, media: string, caption: string) {
  return sentId(await whapiCall<Sent>(`messages/${kind}`, { to: to(phone), media, caption }));
}

/** Envia enquete de escolha única. Devolve o id e o mapa id-da-opção → texto (para ler os votos). */
export async function whapiPoll(phone: string, title: string, options: string[]) {
  const r = await whapiCall<Sent>("messages/poll", { to: to(phone), title, options, count: 1 });
  const map: Record<string, string> = {};
  for (const o of r?.message?.poll?.results ?? []) if (o?.id && o?.name) map[o.id] = o.name;
  return { id: sentId(r), map };
}

export async function whapiGroups(): Promise<{ phone: string; name: string }[]> {
  const r = await whapiCall<{ groups?: { id?: string; name?: string; subject?: string }[] } | { id?: string; name?: string }[]>("groups?count=200");
  const arr = Array.isArray(r) ? r : (r.groups ?? []);
  return arr.map((g) => ({ phone: String(g.id ?? ""), name: String((g as { name?: string }).name ?? (g as { subject?: string }).subject ?? "") })).filter((g) => g.phone);
}

export async function whapiHealth(): Promise<{ connected: boolean; detail: string }> {
  try {
    const r = await whapiCall<{ status?: { text?: string; code?: number } }>("health");
    const t = r?.status?.text ?? "";
    return { connected: /auth|connected|online/i.test(t), detail: t || "ok" };
  } catch (e) {
    return { connected: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

/** Resultados atuais de uma enquete (usado ao encerrar, para conferir os votos). */
export async function whapiPollResults(messageId: string): Promise<{ name: string; voters: string[] }[]> {
  const r = await whapiCall<{ poll?: { results?: { name?: string; voters?: unknown[] }[] } }>(`messages/${encodeURIComponent(messageId)}`);
  return (r?.poll?.results ?? []).map((o) => ({ name: String(o.name ?? ""), voters: ((o.voters ?? []) as unknown[]).map(whapiPhone) }));
}
