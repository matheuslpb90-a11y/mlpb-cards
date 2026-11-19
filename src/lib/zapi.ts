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
const BASE = process.env.ZAPI_BASE_URL || "https://api.z-api.io";
// Z-API Omni: "URL da API" do canal (ex.: https://api.omni.z-api.io/v1/channels/<ID>)
const OMNI_URL = clean(process.env.ZAPI_API_URL).replace(/\/+$/, "");

export function zapiEnabled() {
  return Boolean((INSTANCE || OMNI_URL) && TOKEN);
}
export const zapiMode = () => (OMNI_URL ? "omni" : "classica");

/** Cabeçalhos de autenticação (a Omni recebe o token do canal no cabeçalho). */
function authHeaders(): Record<string, string> {
  if (!OMNI_URL) return CLIENT_TOKEN ? { "Client-Token": CLIENT_TOKEN } : {};
  return {
    Authorization: `Bearer ${TOKEN}`,
    "x-api-key": TOKEN,
    token: TOKEN,
    ...(CLIENT_TOKEN ? { "Client-Token": CLIENT_TOKEN } : {}),
  };
}
const endpoint = (path: string) => (OMNI_URL ? `${OMNI_URL}/${path}` : `${BASE}/instances/${INSTANCE}/token/${TOKEN}/${path}`);

async function call<T = unknown>(path: string, body?: unknown, method = body ? "POST" : "GET"): Promise<T> {
  if (!zapiEnabled()) throw new Error("Z-API não configurada (ZAPI_INSTANCE_ID ou ZAPI_API_URL, e ZAPI_TOKEN).");
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

export async function sendPoll(phone: string, message: string, options: string[]) {
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
      omniUrl: OMNI_URL ? `${OMNI_URL.slice(0, 48)}…` : "",
      instance: mask(INSTANCE),
      instanceFull: INSTANCE,
      instanceLength: INSTANCE.length,
      token: TOKEN ? `${TOKEN.slice(0, 4)}…${TOKEN.slice(-4)}` : "",
      tokenLength: TOKEN.length,
      clientToken: CLIENT_TOKEN ? "configurado" : "não configurado",
      rawHadSpaces: (process.env.ZAPI_INSTANCE_ID ?? "") !== INSTANCE || (process.env.ZAPI_TOKEN ?? "") !== TOKEN,
    },
    seen: [...seen].map(([id, phone]) => ({ id, phone, matches: id === INSTANCE })),
    eventsCount: logs.length,
  };
}

/** Testa a conexão Omni em vários formatos e devolve o que cada um respondeu (para diagnóstico). */
export async function probeOmni(groupId: string) {
  const out: { tentativa: string; status: number | string; resposta: string }[] = [];
  const base = OMNI_URL || `${BASE}/instances/${INSTANCE}/token/${TOKEN}`;
  const tries: { label: string; method: string; path: string; body?: unknown }[] = [
    { label: "GET (canal)", method: "GET", path: "" },
    { label: "GET status", method: "GET", path: "status" },
    { label: "GET groups", method: "GET", path: "groups?page=1&pageSize=50" },
    ...(groupId
      ? [
          { label: "POST send-text (compatível Z-API)", method: "POST", path: "send-text", body: { phone: groupId, message: "🤖 Teste 1 do bot MLPB (send-text)" } },
          { label: "POST messages/text", method: "POST", path: "messages/text", body: { to: groupId, phone: groupId, text: "🤖 Teste 2 do bot MLPB (messages/text)" } },
          { label: "POST messages", method: "POST", path: "messages", body: { to: groupId, type: "text", text: { body: "🤖 Teste 3 do bot MLPB (messages)" } } },
        ]
      : []),
  ];
  for (const t of tries) {
    try {
      const r = await fetch(t.path ? `${base}/${t.path}` : base, {
        method: t.method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: t.body ? JSON.stringify(t.body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      out.push({ tentativa: t.label, status: r.status, resposta: (await r.text()).slice(0, 400) });
      if (t.method === "POST" && r.ok) break; // já enviou uma mensagem; não precisa tentar as outras
    } catch (e) {
      out.push({ tentativa: t.label, status: "erro", resposta: e instanceof Error ? e.message : String(e) });
    }
  }
  await log("diagnostico-omni", { modo: zapiMode(), base: base.replace(TOKEN, "…token…"), out });
  return out;
}
