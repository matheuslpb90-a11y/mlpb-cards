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

// ---------------- Grupos e moderação ----------------

/** Texto com menções (@5561...) e/ou citando (respondendo) uma mensagem. */
export async function whapiTextEx(chat: string, body: string, opts: { mentions?: string[]; quoted?: string } = {}) {
  const payload: Record<string, unknown> = { to: to(chat), body };
  if (opts.mentions?.length) payload.mentions = opts.mentions.map((m) => m.replace(/\D/g, ""));
  if (opts.quoted) payload.quoted = opts.quoted;
  return sentId(await whapiCall<Sent>("messages/text", payload));
}

/** Apaga uma mensagem para todos (no grupo, o número da loja precisa ser admin). */
export async function whapiDeleteMessage(messageId: string) {
  return whapiCall(`messages/${encodeURIComponent(messageId)}`, undefined, "DELETE");
}

/** Reage a uma mensagem com um emoji (ex.: 1️⃣ no 1º anúncio do dia). */
export async function whapiReact(messageId: string, emoji: string) {
  return whapiCall(`messages/${encodeURIComponent(messageId)}/reaction`, { emoji }, "PUT");
}

export type WGroupInfo = { id: string; name: string; participants: { phone: string; admin: boolean }[] };

export async function whapiGroupInfo(groupId: string): Promise<WGroupInfo> {
  const r = await whapiCall<{ id?: string; name?: string; subject?: string; participants?: { id?: unknown; phone?: string; rank?: string; admin?: boolean | string }[] }>(
    `groups/${encodeURIComponent(groupId)}`,
  );
  return {
    id: String(r.id ?? groupId),
    name: String(r.name ?? r.subject ?? ""),
    participants: (r.participants ?? []).map((p) => ({
      phone: String(p.phone ?? whapiPhone(p.id)).replace(/@.*/, ""),
      admin: /admin|creator|owner|superadmin/i.test(String(p.rank ?? "")) || p.admin === true || /admin/i.test(String(p.admin ?? "")),
    })),
  };
}

export async function whapiRemoveParticipants(groupId: string, phones: string[]) {
  return whapiCall(`groups/${encodeURIComponent(groupId)}/participants`, { participants: phones.map((p) => p.replace(/\D/g, "")) }, "DELETE");
}

/**
 * Fecha (só admins mandam mensagem) ou abre o grupo, como a opção "Enviar mensagens" do WhatsApp.
 * Whapi: PATCH /groups/{id} { setting: "send_messages", policy: "admins" | "anyone" }.
 * Depois confere no grupo (campo "announcements") se a trava realmente foi aplicada.
 */
export async function whapiSetAnnounce(groupId: string, onlyAdmins: boolean) {
  const g = encodeURIComponent(groupId);
  const policy = onlyAdmins ? "admins" : "anyone";
  const attempts: [string, Record<string, unknown>, "PATCH" | "PUT"][] = [
    [`groups/${g}`, { setting: "send_messages", policy }, "PATCH"],
    [`groups/${g}/setting`, { setting: "send_messages", policy }, "PATCH"],
    [`groups/${g}`, { setting: "announcement", policy }, "PATCH"],
  ];
  let lastErr: unknown = null;
  for (const [path, body, method] of attempts) {
    try {
      await whapiCall(path, body, method);
    } catch (e) {
      lastErr = e;
      continue;
    }
    // confere se aplicou de verdade
    const info = await whapiCall<{ announcements?: boolean; announce?: boolean }>(`groups/${g}`).catch(() => null);
    const now = info ? !!(info.announcements ?? info.announce) : onlyAdmins;
    if (now === onlyAdmins) return { ok: true, path };
    lastErr = new Error(`pedido aceito em ${path}, mas o grupo continuou ${now ? "fechado" : "aberto"}`);
  }
  throw lastErr ?? new Error("não foi possível mudar a configuração do grupo");
}

export async function whapiInviteLink(groupId: string) {
  const r = await whapiCall<{ invite_code?: string; code?: string; link?: string }>(`groups/${encodeURIComponent(groupId)}/invite`);
  const code = r.invite_code ?? r.code ?? "";
  return r.link ?? (code ? `https://chat.whatsapp.com/${code}` : "");
}

/** Baixa uma mídia recebida (imagem de prova etc.). */
export async function whapiDownloadMedia(mediaId: string) {
  const res = await fetch(`${BASE}/media/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Whapi media ${res.status}`);
  return { type: res.headers.get("content-type") ?? "application/octet-stream", body: await res.arrayBuffer() };
}
