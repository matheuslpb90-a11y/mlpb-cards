import "server-only";
import { db } from "./db";
import { log } from "./zapi";
import { phoneKey } from "./phone";
import { WHATSAPP_NUMBER } from "./whatsapp";
import {
  whapiDeleteMessage,
  whapiEnabled,
  whapiGroupInfo,
  whapiInviteLink,
  whapiPhone,
  whapiRemoveParticipants,
  whapiSetAnnounce,
  whapiTextEx,
  type WGroupInfo,
} from "./whapi";

// Moderação dos grupos do WhatsApp (estilo "Janet"), via Whapi.Cloud.
// Configuração salva em Setting "modConfig" (JSON) e editada em Painel → Moderação.

export type ModConfig = {
  enabled: boolean;
  prefix: string; // "!" (padrão) — use outro (ex.: "/") enquanto a Janet ainda estiver no grupo
  groups: string[]; // ids "...@g.us" moderados (vazio = grupo do leilão)
  adminPhones: string[]; // números com poder de admin no bot, além dos admins do grupo
  notify: boolean; // avisar no grupo quando apagar algo
  welcome: { enabled: boolean; text: string };
  rules: string;
  ads: { enabled: boolean; maxPerDay: number; days: number[] }; // anúncio = foto/vídeo; days 0=dom..6=sáb
  links: { allow: boolean; whitelist: string[]; blocked: string[]; startHour: number; endHour: number; days: number[] };
  words: string[]; // palavras proibidas
  ddi: { blockForeign: boolean; whitelist: string[] };
  warns: { max: number }; // ao atingir, remove do grupo (0 = nunca remove)
  // parceiros (donos de outros grupos/lojas): podem divulgar links nos dias/horários deles, sem aviso
  partners: { phones: string[]; days: number[]; startHour: number; endHour: number };
};

export const DEFAULT_MOD: ModConfig = {
  enabled: false,
  prefix: "!",
  groups: [],
  adminPhones: [],
  notify: true,
  welcome: { enabled: true, text: "Bem-vindo(a) ao grupo, {nome}! 🧡\nLeia as regras com *{prefixo}regras*." },
  rules: "1. Respeito sempre.\n2. Anúncios só nos dias e limites permitidos.\n3. Proibido links de outros grupos.",
  ads: { enabled: false, maxPerDay: 3, days: [0, 1, 2, 3, 4, 5, 6] },
  links: { allow: true, whitelist: ["mlpbcards.com.br", "mlpb-cards.vercel.app", "youtube.com", "youtu.be", "tiktok.com"], blocked: ["chat.whatsapp.com"], startHour: 0, endHour: 24, days: [0, 1, 2, 3, 4, 5, 6] },
  words: [],
  ddi: { blockForeign: true, whitelist: [] },
  warns: { max: 3 },
  partners: { phones: [], days: [1, 3, 5], startHour: 8, endHour: 20 }, // seg, qua, sex 8h–19:59
};

export async function getModConfig(): Promise<ModConfig> {
  const s = await db.setting.findUnique({ where: { key: "modConfig" } });
  try {
    const c = JSON.parse(s?.value ?? "{}") as Partial<ModConfig>;
    return {
      ...DEFAULT_MOD,
      ...c,
      welcome: { ...DEFAULT_MOD.welcome, ...c.welcome },
      ads: { ...DEFAULT_MOD.ads, ...c.ads },
      links: { ...DEFAULT_MOD.links, ...c.links },
      ddi: { ...DEFAULT_MOD.ddi, ...c.ddi },
      warns: { ...DEFAULT_MOD.warns, ...c.warns },
      partners: { ...DEFAULT_MOD.partners, ...c.partners },
    };
  } catch {
    return DEFAULT_MOD;
  }
}

export async function saveModConfig(c: ModConfig) {
  await db.setting.upsert({ where: { key: "modConfig" }, create: { key: "modConfig", value: JSON.stringify(c) }, update: { value: JSON.stringify(c) } });
}

async function moderatedGroups(c: ModConfig) {
  if (c.groups.length) return c.groups;
  const g = (await db.setting.findUnique({ where: { key: "botGroupId" } }))?.value;
  return g ? [g] : [];
}

// ---- horário de Brasília ----
function nowBR() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "numeric", hour12: false }).formatToParts(new Date());
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")?.value ?? "Sun");
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  return { weekday: wd, hour };
}
function startOfDayBR() {
  const d = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d); // AAAA-MM-DD
  return new Date(`${ymd}T00:00:00-03:00`);
}
const DAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const partnerWindow = (c: ModConfig) =>
  `${c.partners.days.map((d) => DAY_NAMES[d]).join(", ")}, das ${c.partners.startHour}h às ${c.partners.endHour - 1}h59`;

// ---- admins do grupo (cache curto) ----
const infoCache = new Map<string, { at: number; info: WGroupInfo }>();
async function groupInfo(group: string, fresh = false) {
  const hit = infoCache.get(group);
  if (!fresh && hit && Date.now() - hit.at < 5 * 60_000) return hit.info;
  const info = await whapiGroupInfo(group);
  infoCache.set(group, { at: Date.now(), info });
  return info;
}
async function isAdmin(c: ModConfig, group: string, phone: string) {
  const k = phoneKey(phone);
  if (k === phoneKey(WHATSAPP_NUMBER)) return true;
  if (c.adminPhones.some((p) => phoneKey(p) === k)) return true;
  try {
    return (await groupInfo(group)).participants.some((p) => p.admin && phoneKey(p.phone) === k);
  } catch {
    return false;
  }
}

// ---- utilidades ----
const URL_RE = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/gi;
function domainsIn(text: string) {
  return [...text.matchAll(URL_RE)]
    .map((m) => m[1].replace(/^https?:\/\//i, "").split(/[/?#]/)[0].toLowerCase().replace(/^www\./, ""))
    .filter((d) => /[a-z]/.test(d.split(".").pop() ?? "") && !/^\d+(\.\d+)*$/.test(d));
}
const matchesDomain = (d: string, list: string[]) => list.some((x) => { const y = x.trim().toLowerCase().replace(/^www\./, ""); return y && (d === y || d.endsWith(`.${y}`) || (y.includes("/") && d.startsWith(y.split("/")[0]))); });
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const mention = (phone: string) => `@${phone.replace(/\D/g, "")}`;

async function say(group: string, text: string, mentions: string[] = [], quoted?: string) {
  try {
    await whapiTextEx(group, text, { mentions, quoted });
  } catch (e) {
    await log("erro-moderacao", { acao: "mensagem", error: String(e) });
  }
}
async function del(messageId: string) {
  try {
    await whapiDeleteMessage(messageId);
    return true;
  } catch (e) {
    await log("erro-moderacao", { acao: "apagar", messageId, error: String(e) });
    return false;
  }
}
async function removeFromGroup(group: string, phone: string) {
  try {
    await whapiRemoveParticipants(group, [phone]);
    infoCache.delete(group);
    return true;
  } catch (e) {
    await log("erro-moderacao", { acao: "remover", phone, error: String(e) });
    return false;
  }
}

async function addWarn(c: ModConfig, group: string, phone: string, name: string, reason: string) {
  const k = phoneKey(phone);
  await db.modEvent.create({ data: { group, phone: k, name, kind: "WARN", note: reason } });
  const total = await db.modEvent.count({ where: { group, phone: k, kind: "WARN" } });
  if (c.warns.max > 0 && total >= c.warns.max) {
    await say(group, `🚫 ${mention(phone)} atingiu ${total} avisos e foi removido(a).`, [phone]);
    await removeFromGroup(group, phone);
    await db.modEvent.deleteMany({ where: { group, phone: k, kind: "WARN" } });
  } else if (c.notify) {
    await say(group, `⚠️ ${mention(phone)} recebeu um aviso (${total}/${c.warns.max || "∞"}): ${reason}`, [phone]);
  }
  return total;
}

// ---- mensagem recebida ----
export type InMsg = {
  id: string;
  group: string;
  phone: string;
  name: string;
  fromMe: boolean;
  type: string;
  text: string;
  quotedId: string;
  quotedAuthor: string;
  mentions: string[];
};

/** Lê a mensagem no formato da Whapi. */
export function parseWhapiMessage(m: Record<string, unknown>): InMsg {
  const t = m.type as string;
  const part = (k: string) => (m[k] as Record<string, unknown> | undefined) ?? {};
  const text = String(part("text").body ?? part(t).caption ?? part(t).body ?? part("link_preview").body ?? "");
  const ctx = part("context");
  return {
    id: String(m.id ?? ""),
    group: String(m.chat_id ?? ""),
    phone: String(m.phone ?? "") || whapiPhone(m.from),
    name: String(m.from_name ?? ""),
    fromMe: m.from_me === true,
    type: t,
    text,
    quotedId: String(ctx.quoted_id ?? ""),
    quotedAuthor: whapiPhone(ctx.quoted_author ?? ""),
    mentions: ((ctx.mentions ?? []) as unknown[]).map(whapiPhone).map((p) => p.replace(/@.*/, "")),
  };
}

/** Modera uma mensagem de grupo. Devolve o que fez (para o registro). */
export async function moderateMessage(msg: InMsg): Promise<string | null> {
  if (!whapiEnabled() || !msg.group.endsWith("@g.us")) return null;
  const c = await getModConfig();
  const text = msg.text.trim();
  const looksCommand = /^[!/#.]\w/.test(text);
  // Para conferir no painel por que um comando não foi respondido
  if (!c.enabled) return looksCommand ? `ignorado: moderação desligada (${text.slice(0, 20)})` : null;
  if (!(await moderatedGroups(c)).includes(msg.group)) return looksCommand ? `ignorado: grupo não está na lista de moderados (${text.slice(0, 20)})` : null;
  if (text.startsWith(c.prefix || "!")) {
    // comandos são escritos com "!" no código; troca o prefixo configurado por "!"
    const r = await runCommand(c, msg, "!" + text.slice((c.prefix || "!").length));
    if (r) return r;
  }
  if (msg.fromMe || (await isAdmin(c, msg.group, msg.phone))) return null;
  const k = phoneKey(msg.phone);

  // silenciado
  const to = await db.modEvent.findFirst({ where: { group: msg.group, phone: k, kind: "TIMEOUT", until: { gt: new Date() } } });
  if (to) {
    await del(msg.id);
    return "apagada (silenciado)";
  }

  // palavras proibidas
  const nt = norm(text);
  const bad = c.words.map((w) => w.trim()).filter(Boolean).find((w) => nt.includes(norm(w)));
  if (bad) {
    await del(msg.id);
    await addWarn(c, msg.group, msg.phone, msg.name, "palavra proibida");
    return `apagada (palavra proibida: ${bad})`;
  }

  // links
  const domains = domainsIn(text);

  // parceiro (!brother): link liberado nos dias/horários de parceiros, sem aviso; fora disso só apaga e explica
  if (domains.length && c.partners.phones.some((p) => phoneKey(p) === k)) {
    const { weekday, hour } = nowBR();
    if (c.partners.days.includes(weekday) && hour >= c.partners.startHour && hour < c.partners.endHour) return null;
    await del(msg.id);
    await say(msg.group, `🤝 ${mention(msg.phone)}, links de parceiros são liberados ${partnerWindow(c)}. Poste de novo nesse horário. 😉`, [msg.phone]);
    return "apagada (parceiro fora do horário)";
  }
  if (domains.length) {
    const blocked = domains.find((d) => matchesDomain(d, c.links.blocked));
    if (blocked) {
      await del(msg.id);
      await addWarn(c, msg.group, msg.phone, msg.name, `link proibido (${blocked})`);
      return `apagada (domínio bloqueado: ${blocked})`;
    }
    const outside = domains.filter((d) => !matchesDomain(d, c.links.whitelist));
    if (outside.length) {
      const { weekday, hour } = nowBR();
      const okTime = c.links.days.includes(weekday) && hour >= c.links.startHour && hour < c.links.endHour;
      if (!c.links.allow || !okTime) {
        await del(msg.id);
        if (c.notify) await say(msg.group, `🔗 ${mention(msg.phone)}, links ${c.links.allow ? `só são permitidos ${c.links.days.map((d) => DAY_NAMES[d]).join(", ")}, das ${c.links.startHour}h às ${c.links.endHour}h` : "não são permitidos aqui"}.`, [msg.phone]);
        return `apagada (link fora da regra: ${outside[0]})`;
      }
    }
  }

  // anúncios (foto/vídeo)
  if (c.ads.enabled && ["image", "video", "album", "gif"].includes(msg.type)) {
    const { weekday } = nowBR();
    if (!c.ads.days.includes(weekday)) {
      await del(msg.id);
      if (c.notify) await say(msg.group, `📵 ${mention(msg.phone)}, anúncios só ${c.ads.days.map((d) => DAY_NAMES[d]).join(", ")}.`, [msg.phone]);
      return "apagada (anúncio fora do dia)";
    }
    const today = await db.modEvent.count({ where: { group: msg.group, phone: k, kind: "AD", createdAt: { gte: startOfDayBR() } } });
    if (today >= c.ads.maxPerDay) {
      await del(msg.id);
      if (c.notify) await say(msg.group, `📵 ${mention(msg.phone)}, limite de ${c.ads.maxPerDay} anúncio(s) por dia atingido.`, [msg.phone]);
      return "apagada (limite de anúncios)";
    }
    await db.modEvent.create({ data: { group: msg.group, phone: k, name: msg.name, kind: "AD" } });
  }
  return null;
}

// ---- entrada de participantes ----
export async function onParticipantsAdded(group: string, phones: string[]) {
  if (!whapiEnabled()) return;
  const c = await getModConfig();
  if (!c.enabled || !(await moderatedGroups(c)).includes(group)) return;
  const welcome: string[] = [];
  for (const p of phones.map((x) => x.replace(/@.*/, "").replace(/\D/g, "")).filter(Boolean)) {
    const foreign = !p.startsWith("55") && !c.ddi.whitelist.some((w) => w.replace(/\D/g, "") === p);
    if (c.ddi.blockForeign && foreign) {
      await removeFromGroup(group, p);
      await log("moderacao", { acao: "removido (DDI estrangeiro)", phone: p });
      continue;
    }
    welcome.push(p);
  }
  if (c.welcome.enabled && welcome.length) {
    await say(group, c.welcome.text.replaceAll("{nome}", welcome.map(mention).join(", ")).replaceAll("{regras}", c.rules).replaceAll("{prefixo}", c.prefix || "!"), welcome);
  }
}

// ---- comandos ----
const HELP = [
  "🤖 *Comandos do bot MLPB*",
  "*!regras* — regras do grupo",
  "*!link* — link de convite do grupo",
  "*!dolar* — cotação do dólar",
  "",
  "_Admins:_",
  "*!ban* @pessoa — remove do grupo (ou responda a mensagem)",
  "*!warn* @pessoa motivo — dá um aviso",
  "*!warns* @pessoa — mostra os avisos",
  "*!remove_warn* @pessoa — zera os avisos",
  "*!timeout* @pessoa 30 — silencia por 30 minutos",
  "*!del* — responda a mensagem para apagar",
  "*!fechar* / *!abrir* — só admins falam / todos falam",
  "*!all* texto — marca todos do grupo",
  "*!brother* @pessoa — libera os links do parceiro (nos dias/horários de parceiros)",
  "*!unbrother* @pessoa — tira da lista de parceiros",
  "*!brothers* — lista os parceiros",
].join("\n");

async function runCommand(c: ModConfig, msg: InMsg, text: string): Promise<string | null> {
  const [raw, ...rest] = text.split(/\s+/);
  const cmd = raw.toLowerCase();
  const args = rest.join(" ");
  const g = msg.group;

  // comandos de todos
  const P = c.prefix || "!";
  if (cmd === "!help" || cmd === "!ajuda" || cmd === "!comandos") return say(g, HELP.replaceAll("*!", `*${P}`), [], msg.id).then(() => cmd);
  if (cmd === "!regras") return say(g, `📜 *Regras do grupo*\n\n${c.rules}`, [], msg.id).then(() => cmd);
  if (cmd === "!link") {
    const link = await whapiInviteLink(g).catch(async (e) => { await log("erro-moderacao", { acao: "link", error: String(e) }); return ""; });
    return say(g, link ? `🔗 Link do grupo: ${link}` : "Não consegui pegar o link agora (o número da loja precisa ser admin).", [], msg.id).then(() => cmd);
  }
  if (cmd === "!dolar") {
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", { cache: "no-store", signal: AbortSignal.timeout(8000) })
      .then((x) => x.json() as Promise<{ USDBRL?: { bid?: string } }>)
      .catch(() => null);
    const v = Number(r?.USDBRL?.bid);
    return say(g, v ? `💵 Dólar agora: *R$ ${v.toFixed(2).replace(".", ",")}*` : "Não consegui consultar o dólar agora.", [], msg.id).then(() => cmd);
  }

  const ADMIN_CMDS = ["!ban", "!warn", "!warns", "!remove_warn", "!timeout", "!del", "!fechar", "!abrir", "!all", "!todos", "!brother", "!unbrother", "!brothers"];
  if (!ADMIN_CMDS.includes(cmd)) return null;
  if (!msg.fromMe && !(await isAdmin(c, g, msg.phone))) return say(g, "⛔ Esse comando é só para admins.", [], msg.id).then(() => `${cmd} (negado)`);

  const target = msg.mentions[0] || msg.quotedAuthor || (args.match(/\+?\d[\d\s()-]{9,}/)?.[0].replace(/\D/g, "") ?? "");
  const needTarget = () => say(g, `Use ${cmd.replace("!", c.prefix || "!")} marcando a pessoa (@) ou respondendo a mensagem dela.`, [], msg.id).then(() => `${cmd} (sem alvo)`);
  const reason = args.replace(/@\d+/g, "").trim();

  switch (cmd) {
    case "!ban":
      if (!target) return needTarget();
      if (msg.quotedId) await del(msg.quotedId);
      return (await removeFromGroup(g, target)) ? say(g, `🚫 ${mention(target)} foi removido(a).`, [target]).then(() => "!ban") : say(g, "Não consegui remover (o número da loja precisa ser admin).").then(() => "!ban (falhou)");
    case "!warn":
      if (!target) return needTarget();
      await addWarn({ ...c, notify: true }, g, target, "", reason || "sem motivo informado");
      return "!warn";
    case "!warns": {
      if (!target) {
        const rows = await db.modEvent.groupBy({ by: ["phone"], where: { group: g, kind: "WARN" }, _count: true, orderBy: { _count: { phone: "desc" } }, take: 15 });
        return say(g, rows.length ? `⚠️ *Avisos*\n${rows.map((r) => `${mention(r.phone)}: ${r._count}`).join("\n")}` : "Ninguém tem avisos. 👏", rows.map((r) => r.phone)).then(() => "!warns");
      }
      const list = await db.modEvent.findMany({ where: { group: g, phone: phoneKey(target), kind: "WARN" }, orderBy: { createdAt: "asc" } });
      return say(g, list.length ? `⚠️ ${mention(target)} tem ${list.length} aviso(s):\n${list.map((w, i) => `${i + 1}. ${w.note}`).join("\n")}` : `${mention(target)} não tem avisos.`, [target]).then(() => "!warns");
    }
    case "!brother": {
      if (!target) return needTarget();
      const k2 = phoneKey(target);
      if (!c.partners.phones.some((p) => phoneKey(p) === k2)) {
        c.partners.phones.push(target.replace(/\D/g, ""));
        await saveModConfig(c);
      }
      await db.modEvent.deleteMany({ where: { group: g, phone: k2, kind: "WARN" } });
      return say(g, `🤝 ${mention(target)} agora é *parceiro* da MLPB! Links liberados ${partnerWindow(c)}.`, [target]).then(() => "!brother");
    }
    case "!unbrother": {
      if (!target) return needTarget();
      const k2 = phoneKey(target);
      c.partners.phones = c.partners.phones.filter((p) => phoneKey(p) !== k2);
      await saveModConfig(c);
      return say(g, `${mention(target)} saiu da lista de parceiros.`, [target]).then(() => "!unbrother");
    }
    case "!brothers":
      return say(
        g,
        c.partners.phones.length ? `🤝 *Parceiros* (links ${partnerWindow(c)}):\n${c.partners.phones.map(mention).join("\n")}` : "Nenhum parceiro cadastrado. Use !brother @pessoa.",
        c.partners.phones,
      ).then(() => "!brothers");
    case "!remove_warn":
      if (!target) return needTarget();
      await db.modEvent.deleteMany({ where: { group: g, phone: phoneKey(target), kind: "WARN" } });
      return say(g, `✅ Avisos de ${mention(target)} zerados.`, [target]).then(() => "!remove_warn");
    case "!timeout": {
      if (!target) return needTarget();
      const min = Math.min(Math.max(Number(reason.match(/\d+/)?.[0] ?? 30), 1), 7 * 24 * 60);
      await db.modEvent.create({ data: { group: g, phone: phoneKey(target), kind: "TIMEOUT", until: new Date(Date.now() + min * 60_000) } });
      return say(g, `🔇 ${mention(target)} silenciado(a) por ${min} min. As mensagens serão apagadas.`, [target]).then(() => "!timeout");
    }
    case "!del":
      if (!msg.quotedId) return say(g, `Responda a mensagem que quer apagar com ${c.prefix || "!"}del.`, [], msg.id).then(() => "!del (sem alvo)");
      await del(msg.quotedId);
      await del(msg.id);
      return "!del";
    case "!fechar":
    case "!abrir": {
      const close = cmd === "!fechar";
      try {
        await whapiSetAnnounce(g, close);
        await say(g, close ? "🔒 Grupo fechado: só admins podem mandar mensagens." : "🔓 Grupo aberto: todos podem mandar mensagens.");
        return cmd;
      } catch (e) {
        await log("erro-moderacao", { acao: cmd, error: String(e) });
        return say(g, "Não consegui mudar a configuração do grupo (o número da loja precisa ser admin).").then(() => `${cmd} (falhou)`);
      }
    }
    case "!all":
    case "!todos": {
      const info = await groupInfo(g, true).catch(() => null);
      if (!info) return say(g, "Não consegui listar os participantes.").then(() => "!all (falhou)");
      const people = info.participants.map((p) => p.phone).filter((p) => phoneKey(p) !== phoneKey(WHATSAPP_NUMBER));
      await say(g, `📢 ${args || "Atenção, pessoal!"}\n\n${people.map(mention).join(" ")}`, people);
      return "!all";
    }
  }
  return null;
}
