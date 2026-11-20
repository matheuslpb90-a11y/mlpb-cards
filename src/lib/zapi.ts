import "server-only";
import { db } from "./db";

// Integração com a Z-API (https://z-api.io) — conexão do WhatsApp da loja.
// Variáveis (na Vercel): ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN (token de segurança da conta).
// IMPORTANTE: confira os nomes dos campos com a documentação atual da Z-API no primeiro teste
// (a tela Painel → Bot WhatsApp mostra o que a Z-API enviou ao site).

// remove espaços, quebras de linha e aspas coladas por engano
const clean = (v?: string) => (v ?? "").trim().replace(/^["'`]+|["'`]+$/g, "").trim();
const INSTANCE = clean(process.env.ZAPI_INSTANCE_ID);
const TOKEN = clean(process.env.ZAPI_TOKEN);
const CLIENT_TOKEN = clean(process.env.ZAPI_CLIENT_TOKEN);
// Z-API Omni: Secret Key da conta (Authorization: Bearer)
const SECRET_KEY = clean(process.env.ZAPI_SECRET_KEY);
const BASE = process.env.ZAPI_BASE_URL || "https://api.z-api.io";
// Z-API Omni: "URL da API" do canal (ex.: https://api.omni.z-api.io/v1/channels/<ID>)
const OMNI_URL = clean(process.env.ZAPI_API_URL).replace(/\/+$/, "");

// Com Secret Key => Omni Z-API (modo compatível); senão => Z-API clássica.
const CHANNEL = INSTANCE || (OMNI_URL.match(/channels\/([^/?#]+)/)?.[1] ?? "");
const IS_OMNI = Boolean(SECRET_KEY);
const OMNI_COMPAT = clean(process.env.ZAPI_OMNI_BASE_URL) || "https://zapi.omni.z-api.io";

export function zapiEnabled() {
  return Boolean(CHANNEL && TOKEN);
}
export const zapiMode = () => (IS_OMNI ? "omni" : "classica");
/** A Omni não envia enquetes: nela o leilão é por lance em mensagem. */
export const supportsPolls = () => !IS_OMNI;

/** Cabeçalhos de autenticação (a Omni recebe o token do canal no cabeçalho). */
function authHeaders(): Record<string, string> {
  if (IS_OMNI) return { Authorization: `Bearer ${SECRET_KEY}` };
  return CLIENT_TOKEN ? { "Client-Token": CLIENT_TOKEN } : {};
}
const endpoint = (path: string) =>
  IS_OMNI ? `${OMNI_COMPAT}/channels/${CHANNEL}/token/${TOKEN}/${path}` : `${BASE}/instances/${CHANNEL}/token/${TOKEN}/${path}`;

async function call<T = unknown>(path: string, body?: unknown, method = body ? "POST" : "GET"): Promise<T> {
  if (!zapiEnabled()) throw new Error("Z-API não configurada (ZAPI_INSTANCE_ID e ZAPI_TOKEN).");
  const res = await fetch(endpoint(path), {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) {
    await log("erro-envio", { path, status: res.status, body: text.slice(0, 1000) });
    throw new Error(`Z-API ${path} respondeu ${res.status}: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

/** Id da mensagem enviada (a Z-API devolve zaapId e messageId). */
type SendResult = { zaapId?: string; messageId?: string; id?: string };
const msgId = (r: SendResult) => r?.messageId ?? r?.id ?? r?.zaapId ?? "";

export async function sendText(phone: string, message: string) {
  return msgId(await call<SendResult>("send-text", { phone, message }));
}

export async function sendImage(phone: string, image: string, caption: string) {
  return msgId(await call<SendResult>("send-image", { phone, image, caption }));
}

export async function sendVideo(phone: string, video: string, caption: string) {
  return msgId(await call<SendResult>("send-video", { phone, video, caption }));
}

export async function sendReaction(phone: string, messageId: string, reaction: string) {
  return call("send-reaction", { phone, messageId, reaction });
}

export async function sendPoll(phone: string, message: string, options: string[]) {
  if (!supportsPolls()) throw new Error("A Omni Z-API não envia enquetes — use o leilão por lance em mensagem.");
  return msgId(
    await call<SendResult>("send-poll", { phone, message, poll: options.map((name) => ({ name })), pollMaxOptions: 1 }),
  );
}

export type ZGroup = { phone: string; name: string };

function toGroups(data: unknown): ZGroup[] {
  const obj = data as Record<string, unknown>;
  const arr = Array.isArray(data) ? data : ((obj?.groups ?? obj?.chats ?? obj?.data ?? []) as unknown[]);
  return (arr as Record<string, unknown>[])
    .filter((g) => g && (g.isGroup === true || String(g.phone ?? g.id ?? "").includes("-group") || String(g.phone ?? g.id ?? "").includes("@g.us")))
    .map((g) => ({ phone: String(g.phone ?? g.id ?? ""), name: String(g.name ?? g.subject ?? g.chatName ?? "") }))
    .filter((g) => g.phone);
}

/** Lista os grupos da instância. Tenta "groups" e, se vier vazio, "chats". */
export async function listGroups(): Promise<ZGroup[]> {
  if (IS_OMNI) return []; // a Omni não lista grupos: usamos os grupos vistos nas mensagens recebidas
  const errors: string[] = [];
  for (const path of ["groups?page=1&pageSize=100", "chats?page=1&pageSize=300"]) {
    try {
      const g = toGroups(await call<unknown>(path));
      if (g.length) return g;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (errors.length) throw new Error(errors.join(" | "));
  return [];
}

/** Grupos vistos nas mensagens recebidas pelo webhook (registro do bot). */
export async function groupsFromLogs(): Promise<ZGroup[]> {
  const logs = await db.botLog.findMany({ where: { kind: "evento" }, orderBy: { createdAt: "desc" }, take: 300 });
  const map = new Map<string, string>();
  for (const l of logs) {
    try {
      const b = JSON.parse(l.payload) as Record<string, unknown>;
      const phone = String(b.phone ?? b.chatId ?? "");
      if (b.isGroup === true || phone.includes("-group") || phone.includes("@g.us"))
        if (!map.has(phone)) map.set(phone, String(b.chatName ?? b.groupName ?? b.subject ?? ""));
    } catch {}
  }
  return [...map].map(([phone, name]) => ({ phone, name }));
}

export async function connectionStatus(): Promise<{ connected: boolean; detail: string }> {
  if (IS_OMNI) return { connected: true, detail: "Omni Z-API (status no painel da Omni)" };
  try {
    const s = await call<{ connected?: boolean; error?: string; smartphoneConnected?: boolean }>("status");
    return { connected: Boolean(s?.connected), detail: s?.error ?? (s?.connected ? "Conectado" : "Desconectado") };
  } catch (e) {
    return { connected: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export async function log(kind: string, payload: unknown) {
  try {
    await db.botLog.create({ data: { kind, payload: JSON.stringify(payload).slice(0, 20000) } });
    // mantém só os 300 mais recentes
    const old = await db.botLog.findMany({ orderBy: { createdAt: "desc" }, skip: 300, select: { id: true } });
    if (old.length) await db.botLog.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  } catch {
    /* registro é opcional */
  }
}

/** Normaliza telefone para só dígitos com DDI (55...). */
export function normalizePhone(p: string) {
  const d = p.replace(/\D/g, "");
  return d.startsWith("55") || d.length > 11 ? d : `55${d}`;
}

const mask = (v: string) => (v.length > 10 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v ? "•••" : "");

/** Compara a instância configurada com a que aparece nos eventos recebidos. */
export async function diagnostics() {
  const logs = await db.botLog.findMany({ where: { kind: { in: ["evento", "voto"] } }, orderBy: { createdAt: "desc" }, take: 100 });
  const seen = new Map<string, string>();
  for (const l of logs) {
    try {
      const b = JSON.parse(l.payload) as Record<string, unknown>;
      const id = String(b.instanceId ?? b.instance_id ?? b.instance ?? "");
      if (id && !seen.has(id)) seen.set(id, String(b.connectedPhone ?? ""));
    } catch {}
  }
  return {
    configured: {
      mode: zapiMode(),
      omniUrl: IS_OMNI ? `${OMNI_COMPAT}/channels/${CHANNEL.slice(0, 6)}…` : "",
      instance: mask(INSTANCE),
      instanceFull: INSTANCE,
      instanceLength: INSTANCE.length,
      token: TOKEN ? `${TOKEN.slice(0, 4)}…${TOKEN.slice(-4)}` : "",
      tokenLength: TOKEN.length,
      clientToken: CLIENT_TOKEN ? "configurado" : "não configurado",
      secretKey: SECRET_KEY ? "configurada" : "não configurada",
      rawHadSpaces: (process.env.ZAPI_INSTANCE_ID ?? "") !== INSTANCE || (process.env.ZAPI_TOKEN ?? "") !== TOKEN,
    },
    seen: [...seen].map(([id, phone]) => ({ id, phone, matches: id === CHANNEL })),
    eventsCount: logs.length,
  };
}

/** Testa o envio (texto) e devolve a resposta (para diagnóstico). */
export async function probeOmni(groupId: string) {
  const out: { tentativa: string; status: number | string; resposta: string }[] = [];
  if (!groupId) return [{ tentativa: "envio", status: "—", resposta: "Escolha o grupo primeiro." }];
  try {
    const r = await fetch(endpoint("send-text"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ phone: groupId, message: "🤖 Teste do bot MLPB Cards — conexão funcionando!" }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    out.push({ tentativa: `POST send-text (${zapiMode()})`, status: r.status, resposta: (await r.text()).slice(0, 400) });
    if (supportsPolls()) {
      const p = await fetch(endpoint("send-poll"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ phone: groupId, message: "🤖 Teste de enquete do bot MLPB", poll: [{ name: "R$ 10,00" }, { name: "R$ 15,00" }], pollMaxOptions: 1 }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      out.push({ tentativa: "POST send-poll (enquete)", status: p.status, resposta: (await p.text()).slice(0, 400) });
    }
  } catch (e) {
    out.push({ tentativa: "POST send-text", status: "erro", resposta: e instanceof Error ? e.message : String(e) });
  }
  await log("diagnostico", { modo: zapiMode(), out });
  return out;
}
