import "server-only";
import { db } from "./db";
import { log } from "./zapi";
import { phoneKey } from "./phone";
import { WHATSAPP_NUMBER } from "./whatsapp";
import {
  whapiDeleteMessage,
  whapiReact,
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
  ads: { enabled: boolean; maxPerDay: number; maxPhotos: number; days: number[] }; // anúncio = foto/vídeo; days 0=dom..6=sáb; maxPhotos = fotos por anúncio (0 = sem limite)
  links: { allow: boolean; whitelist: string[]; blocked: string[]; startHour: number; endHour: number; days: number[] };
  words: string[]; // palavras proibidas
  ddi: { blockForeign: boolean; whitelist: string[] };
  whitelistV3?: boolean; // marca de ajuste já aplicado (YouTube/TikTok de volta aos liberados)
  blacklist: string[]; // números bloqueados: removidos ao entrar ou ao mandar mensagem
  warns: { max: number }; // ao atingir, remove do grupo (0 = nunca remove)
  // parceiros (donos de outros grupos/lojas): podem divulgar links nos dias/horários deles, sem aviso
  partners: { phones: string[]; days: number[]; startHour: number; endHour: number };
  // avaliar outros membros exige provas (imagens); avaliar a loja não
  reviews: { proofs: number; proofMinutes: number };
};

export const DEFAULT_MOD: ModConfig = {
  enabled: false,
  prefix: "!",
  groups: [],
  adminPhones: [],
  notify: true,
  welcome: { enabled: true, text: "Bem-vindo(a) ao grupo, {nome}! 🧡\nLeia as regras com *{prefixo}regras*." },
  rules: "1. Respeito sempre.\n2. Anúncios só nos dias e limites permitidos.\n3. Proibido links de outros grupos.",
  ads: { enabled: false, maxPerDay: 3, maxPhotos: 3, days: [0, 1, 2, 3, 4, 5, 6] },
  links: { allow: true, whitelist: ["mlpbcards.com.br", "mlpb-cards.vercel.app", "leilomania.com.br", "youtube.com", "youtu.be", "tiktok.com"], blocked: ["chat.whatsapp.com"], startHour: 0, endHour: 24, days: [0, 1, 2, 3, 4, 5, 6] },
  words: [],
  ddi: { blockForeign: true, whitelist: [] },
  blacklist: [],
  warns: { max: 3 },
  partners: { phones: [], days: [1, 3, 5], startHour: 8, endHour: 20 }, // seg, qua, sex 8h–19:59
  reviews: { proofs: 3, proofMinutes: 5 },
};

export async function getModConfig(): Promise<ModConfig> {
  const s = await db.setting.findUnique({ where: { key: "modConfig" } });
  try {
    const c = JSON.parse(s?.value ?? "{}") as Partial<ModConfig> & { whitelistV3?: boolean };
    // YouTube e TikTok ficam sempre liberados (pedido da loja). Repõe se um ajuste anterior tirou (1x).
    if (s && !c.whitelistV3) {
      const keep = ["youtube.com", "youtu.be", "tiktok.com"];
      if (c.links?.whitelist) for (const d of keep) if (!c.links.whitelist.includes(d)) c.links.whitelist.push(d);
      c.whitelistV3 = true;
      await db.setting.update({ where: { key: "modConfig" }, data: { value: JSON.stringify(c) } });
    }
    return {
      ...DEFAULT_MOD,
      ...c,
      welcome: { ...DEFAULT_MOD.welcome, ...c.welcome },
      ads: { ...DEFAULT_MOD.ads, ...c.ads },
      links: { ...DEFAULT_MOD.links, ...c.links },
      ddi: { ...DEFAULT_MOD.ddi, ...c.ddi },
      warns: { ...DEFAULT_MOD.warns, ...c.warns },
      partners: { ...DEFAULT_MOD.partners, ...c.partners },
      reviews: { ...DEFAULT_MOD.reviews, ...c.reviews },
      blacklist: Array.isArray(c.blacklist) ? c.blacklist : [],
    };
  } catch {
    return DEFAULT_MOD;
  }
}

export async function saveModConfig(c: ModConfig) {
  await db.setting.upsert({ where: { key: "modConfig" }, create: { key: "modConfig", value: JSON.stringify(c) }, update: { value: JSON.stringify(c) } });
}

export async function moderatedGroups(c: ModConfig) {
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
export async function groupInfo(group: string, fresh = false) {
  const hit = infoCache.get(group);
  if (!fresh && hit && Date.now() - hit.at < 5 * 60_000) return hit.info;
  const info = await whapiGroupInfo(group);
  infoCache.set(group, { at: Date.now(), info });
  return info;
}
export async function isAdmin(c: ModConfig, group: string, phone: string) {
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
const isBlacklisted = (c: ModConfig, phone: string) => c.blacklist.some((b) => phoneKey(b) === phoneKey(phone));
const KEYCAPS = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
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
  // Fotos e vídeos chegam no aviso antes de a Whapi terminar de processar: se der erro, tenta de novo.
  const waits = [0, 2000, 5000, 10000];
  let last = "";
  for (const ms of waits) {
    if (ms) await new Promise((r) => setTimeout(r, ms));
    try {
      await whapiDeleteMessage(messageId);
      return true;
    } catch (e) {
      last = String(e);
    }
  }
  await log("erro-moderacao", { acao: "apagar", messageId, error: last });
  return false;
}
async function removeFromGroup(group: string, phone: string) {
  try {
    // usa o número exatamente como está no grupo (com ou sem o 9 / 55)
    const find = (i: WGroupInfo | null) => i?.participants.find((p) => phoneKey(p.phone) === phoneKey(phone))?.phone;
    let info = await groupInfo(group).catch(() => null);
    let real = find(info);
    if (!real) {
      info = await groupInfo(group, true).catch(() => null); // quem acabou de entrar pode não estar na lista guardada
      real = find(info);
    }
    if (info && !real) return true; // não está no grupo: nada a remover
    await whapiRemoveParticipants(group, [real ?? phone]);
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
  mediaId: string; // id da imagem/vídeo (Whapi), para guardar provas
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
    mediaId: String(part(t).id ?? ""),
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
  // avaliação em andamento (!avaliar): nota de 1 a 5 e comentário opcional, cada um em até 45s
  const rated = await reviewStep(c, msg, text);
  if (rated) return rated;

  // jogos (Quem é esse Pokémon?, Adivinhe o preço, Pokébola)
  const played = await import("./games").then((gm) => gm.gameMessage(msg)).catch(() => null);
  if (played) return played;

  if (text.startsWith(c.prefix || "!")) {
    // comandos são escritos com "!" no código; troca o prefixo configurado por "!"
    const r = await runCommand(c, msg, "!" + text.slice((c.prefix || "!").length));
    if (r) return r;
  }
  if (msg.fromMe || (await isAdmin(c, msg.group, msg.phone))) return null;
  const k = phoneKey(msg.phone);

  // lista negra: apaga e remove (caso tenha entrado antes de ser bloqueado)
  if (isBlacklisted(c, msg.phone)) {
    await del(msg.id);
    await removeFromGroup(msg.group, msg.phone);
    return "apagada e removido (lista negra)";
  }

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

  // convite de grupo enviado como cartão (sem link escrito)
  if (/invite/i.test(msg.type) && !(await isAdmin(c, msg.group, msg.phone))) {
    await del(msg.id);
    await addWarn(c, msg.group, msg.phone, msg.name, "convite de outro grupo");
    return "apagada (convite de grupo)";
  }

  // anúncios (foto/vídeo): cada anúncio do dia ganha a reação 1️⃣, 2️⃣, 3️⃣…
  if (c.ads.enabled && ["image", "video", "album", "gif"].includes(msg.type)) {
    const { weekday } = nowBR();
    if (!c.ads.days.includes(weekday)) {
      await del(msg.id);
      if (c.notify) await say(msg.group, `📵 ${mention(msg.phone)}, anúncios só ${c.ads.days.map((d) => DAY_NAMES[d]).join(", ")}.`, [msg.phone]);
      return "apagada (anúncio fora do dia)";
    }
    // As fotos de um álbum chegam quase juntas: a trava garante que sejam contadas uma de cada vez.
    const verdict = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ad:${msg.group}:${k}`}))`;
      const last = await tx.modEvent.findFirst({ where: { group: msg.group, phone: k, kind: "AD" }, orderBy: { createdAt: "desc" } });
      // várias fotos seguidas (álbum / fotos enviadas juntas) = um anúncio só, até o limite de fotos
      if (last && Date.now() - last.createdAt.getTime() < 2 * 60_000) {
        const photos = (Number(last.note) || 1) + 1;
        await tx.modEvent.update({ where: { id: last.id }, data: { createdAt: new Date(), note: String(photos) } });
        if (c.ads.maxPhotos > 0 && photos > c.ads.maxPhotos) return { kind: "extra" as const, first: photos === c.ads.maxPhotos + 1 };
        return { kind: "same" as const };
      }
      const today = await tx.modEvent.count({ where: { group: msg.group, phone: k, kind: "AD", createdAt: { gte: startOfDayBR() } } });
      if (today >= c.ads.maxPerDay) return { kind: "limit" as const };
      await tx.modEvent.create({ data: { group: msg.group, phone: k, name: msg.name, kind: "AD", note: "1" } });
      return { kind: "new" as const, n: today + 1 };
    });
    if (verdict.kind === "same") return null;
    if (verdict.kind === "extra") {
      await del(msg.id);
      if (verdict.first && c.notify) await say(msg.group, `📸 ${mention(msg.phone)}, cada anúncio pode ter até ${c.ads.maxPhotos} foto(s). As fotos a mais foram apagadas.`, [msg.phone]);
      return "apagada (foto a mais no anúncio)";
    }
    if (verdict.kind === "limit") {
      await del(msg.id);
      if (c.notify) await say(msg.group, `📵 ${mention(msg.phone)}, limite de ${c.ads.maxPerDay} anúncio(s) por dia atingido. Volte amanhã! 😉`, [msg.phone]);
      return "apagada (limite de anúncios)";
    }
    await whapiReact(msg.id, KEYCAPS[verdict.n] ?? "✅").catch((e) => log("whapi-react", String(e)));
    return `anúncio ${verdict.n}/${c.ads.maxPerDay}`;
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
    if (isBlacklisted(c, p)) {
      await removeFromGroup(group, p);
      await log("moderacao", { acao: "removido (lista negra)", phone: p });
      continue;
    }
    const foreign = !p.startsWith("55") && !c.ddi.whitelist.some((w) => w.replace(/\D/g, "") === p);
    if (c.ddi.blockForeign && foreign) {
      await removeFromGroup(group, p);
      await log("moderacao", { acao: "removido (DDI estrangeiro)", phone: p });
      continue;
    }
    welcome.push(p);
    await import("./referrals").then((r) => r.recordJoin(group, p)).catch(() => {});
  }
  if (c.welcome.enabled && welcome.length) {
    const pts = await import("./points").then((p) => p.getPointsConfig()).catch(() => null);
    const ref = pts?.enabled ? `\n\n🤝 Alguém te convidou? Mande *${c.prefix || "!"}indicado @pessoa* (ou responda uma mensagem dela) — quem te indicou ganha pontos!` : "";
    await say(group, c.welcome.text.replaceAll("{nome}", welcome.map(mention).join(", ")).replaceAll("{regras}", c.rules).replaceAll("{prefixo}", c.prefix || "!") + ref, welcome);
  }
}

// ---- comandos ----
const HELP = [
  "🤖 *Comandos do bot MLPB*",
  "*!regras* — regras do grupo",
  "*!link* — link de convite do grupo",
  "*!dolar* — cotação do dólar",
  "*!preco* nome da carta — preço no Brasil (ex.: !preco Charizard ex 199/165)",
  "*!avaliar* 61999999999 — avalia uma negociação/entrega (nota de 1 a 5)",
  "*!denunciar* 61999999999 — denuncia um número (com 3 fotos de prova)",
  "*!avisar* 1.3 2.1 — te chamo quando essas cartas entrarem no leilão · *!desavisar* 1.3",
  "*!referencias* 61999999999 — mostra as avaliações de alguém",
  "*!pontos* — seus MLPB Points · *!ranking* — top do mês",
  "*!pokedex* — seus Pokémon capturados · *!captura* — quando um Pokémon aparecer",
  "*!indicado* @pessoa — diga quem te convidou · *!indicacoes* — suas indicações",
  "*!premios* — prêmios · *!trocar* número — troca pontos por prêmio",
  "",
  "_Admins:_",
  "*!ban* @pessoa — remove do grupo (ou responda a mensagem)",
  "*!bloquear* @pessoa ou número — remove e coloca na lista negra (não volta mais)",
  "*!desbloquear* número — tira da lista negra · *!bloqueados* — lista",
  "*!escanear* — procura no grupo quem está na lista negra (remove) ou tem denúncias",
  "*!warn* @pessoa motivo — dá um aviso",
  "*!warns* @pessoa — mostra os avisos",
  "*!remove_warn* @pessoa — zera os avisos",
  "*!timeout* @pessoa 30 — silencia por 30 minutos",
  "*!del* — responda a mensagem para apagar",
  "*!fechar* / *!abrir* — só admins falam / todos falam",
  "*!all* texto — chama todos do grupo (sem mostrar os @)",
  "*!brother* @pessoa — libera os links do parceiro (nos dias/horários de parceiros)",
  "*!unbrother* @pessoa — tira da lista de parceiros",
  "*!brothers* — lista os parceiros",
  "*!leilomania* 120 — (respondendo a pessoa) lança compra de R$ 120 no Leilomania",
  "*!darpontos* 50 motivo — (respondendo a pessoa) dá ou tira pontos (use -50)",
  "*!jogo* pokemon | preco | pokebola — começa um jogo agora",
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
  if (["!pontos", "!ranking", "!premios", "!prêmios", "!trocar"].includes(cmd)) return pointsCommand(c, msg, cmd, args);
  if (cmd === "!pokedex") {
    const { pokedexText } = await import("./games");
    return say(g, await pokedexText(msg.phone, msg.name), [msg.phone], msg.id).then(() => cmd);
  }
  if (cmd === "!indicado" || cmd === "!indicada") {
    const { registerReferral } = await import("./referrals");
    const who = msg.mentions[0] || msg.quotedAuthor || (args.match(/\+?\d[\d\s().-]{9,}/)?.[0].replace(/\D/g, "") ?? "");
    const r = await registerReferral(g, msg.phone, msg.name, who);
    return say(g, r.ok ? `🤝 Anotado! ${mention(who)} te indicou. Quando você completar 7 dias no grupo, ele ganha pontos — e mais ainda na sua primeira compra. Bem-vindo(a)! 🧡` : `Não deu: ${r.reason}.`, r.ok ? [who] : [], msg.id).then(() => `${cmd}${r.ok ? "" : ` (${r.reason})`}`);
  }
  if (cmd === "!indicacoes" || cmd === "!indicações") {
    const { referralSummary } = await import("./referrals");
    const s = await referralSummary(msg.phone);
    return say(g, s.total ? `🤝 ${mention(msg.phone)}, você indicou *${s.total}* pessoa(s): ${s.stayed} completaram 7 dias e ${s.bought} já compraram.` : `🤝 ${mention(msg.phone)}, você ainda não indicou ninguém. Convide amigos para o grupo e peça para eles mandarem *${c.prefix || "!"}indicado* marcando você!`, [msg.phone], msg.id).then(() => cmd);
  }
  if (cmd === "!avaliar") return startReview(c, msg, args).then(() => cmd);
  if (cmd === "!avisar" || cmd === "!lembrete" || cmd === "!desavisar") return watchCommand(c, msg, cmd, args).then(() => cmd);
  if (cmd === "!denunciar" || cmd === "!denuncia" || cmd === "!denúncia") return startReport(c, msg, args).then(() => cmd);
  if (cmd === "!referencias" || cmd === "!referências" || cmd === "!ref") return showReviews(msg, args).then(() => cmd);
  if (cmd === "!preco" || cmd === "!preço") {
    const m = args.trim().match(/^(.*?)(?:\s+#?([A-Za-z]{0,6}\d{1,4}(?:\/[A-Za-z]{0,4}\d{1,4})?))?$/);
    const name = (m?.[1] ?? args).trim();
    const num = m?.[2] ?? "";
    if (name.length < 2) return say(g, `Use: *${c.prefix || "!"}preco nome da carta* (ex.: ${c.prefix || "!"}preco Charizard ex 199/165). O nome precisa ser exato, em português ou inglês.`, [], msg.id).then(() => cmd);
    try {
      const { mypFind, mypPrice } = await import("./myp");
      const list = (await mypFind(name, num)).filter((x) => mypPrice(x));
      if (!list.length) return say(g, `🔎 Não achei preço para *${name}*${num ? ` ${num}` : ""}. Confira o nome exato (português ou inglês).\n_Fonte: MYP Cards — mypcards.com_`, [], msg.id).then(() => cmd);
      const lines = list.slice(0, 6).map((x) => {
        const p = mypPrice(x)!;
        return `• *${x.name}* ${x.number} — ${x.setName}\n   💰 R$ ${(p.cents / 100).toFixed(2).replace(".", ",")} _(${p.basis})_`;
      });
      return say(
        g,
        `💰 *Preço no Brasil — ${name}${num ? ` ${num}` : ""}*\n\n${lines.join("\n")}${list.length > 6 ? `\n…e mais ${list.length - 6}. Informe o número da carta para filtrar.` : ""}\n\n_Fonte: MYP Cards — https://mypcards.com_`,
        [],
        msg.id,
      ).then(() => cmd);
    } catch (e) {
      return say(g, `Não consegui consultar o preço agora (${e instanceof Error ? e.message : e}).`, [], msg.id).then(() => `${cmd} (erro)`);
    }
  }
  if (cmd === "!dolar") {
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", { cache: "no-store", signal: AbortSignal.timeout(8000) })
      .then((x) => x.json() as Promise<{ USDBRL?: { bid?: string } }>)
      .catch(() => null);
    const v = Number(r?.USDBRL?.bid);
    return say(g, v ? `💵 Dólar agora: *R$ ${v.toFixed(2).replace(".", ",")}*` : "Não consegui consultar o dólar agora.", [], msg.id).then(() => cmd);
  }

  const ADMIN_CMDS = ["!ban", "!warn", "!warns", "!remove_warn", "!timeout", "!del", "!fechar", "!abrir", "!all", "!todos", "!bloquear", "!block", "!blacklist", "!desbloquear", "!unblock", "!bloqueados", "!escanear", "!varrer", "!brother", "!unbrother", "!brothers", "!leilomania", "!darpontos", "!jogo"];
  if (!ADMIN_CMDS.includes(cmd)) return null;
  if (!msg.fromMe && !(await isAdmin(c, g, msg.phone))) return say(g, "⛔ Esse comando é só para admins.", [], msg.id).then(() => `${cmd} (negado)`);

  const typed = args.match(/\+?\d[\d\s()-]{9,}/)?.[0].replace(/\D/g, "") ?? "";
  // número digitado sem o 55 (ex.: 61 99999-8888) → completa com o código do Brasil
  const target = msg.mentions[0] || msg.quotedAuthor || (typed.length === 10 || typed.length === 11 ? `55${typed}` : typed);
  const needTarget = () => say(g, `Use ${cmd.replace("!", c.prefix || "!")} marcando a pessoa (@) ou respondendo a mensagem dela.`, [], msg.id).then(() => `${cmd} (sem alvo)`);
  const reason = args.replace(/@\d+/g, "").trim();

  switch (cmd) {
    case "!ban":
      if (!target) return needTarget();
      if (msg.quotedId) await del(msg.quotedId);
      return (await removeFromGroup(g, target)) ? say(g, `🚫 ${mention(target)} foi removido(a).`, [target]).then(() => "!ban") : say(g, "Não consegui remover (o número da loja precisa ser admin).").then(() => "!ban (falhou)");
    case "!bloquear":
    case "!block":
    case "!blacklist": {
      if (!target) return needTarget();
      const t = target.replace(/\D/g, "");
      if (await isAdmin(c, g, t)) return say(g, "Não dá para bloquear um admin.", [], msg.id).then(() => `${cmd} (admin)`);
      if (!isBlacklisted(c, t)) {
        c.blacklist.push(t);
        await saveModConfig(c);
      }
      if (msg.quotedId) await del(msg.quotedId);
      // remove de todos os grupos moderados
      for (const grp of await moderatedGroups(c)) await removeFromGroup(grp, t).catch(() => false);
      return say(g, `⛔ *${fmtPhone(t)}* foi *bloqueado(a)*: removido(a) e não pode mais entrar no grupo.`).then(() => cmd);
    }
    case "!desbloquear":
    case "!unblock": {
      if (!target) return needTarget();
      const before = c.blacklist.length;
      c.blacklist = c.blacklist.filter((b) => phoneKey(b) !== phoneKey(target));
      if (c.blacklist.length === before) return say(g, `*${fmtPhone(target)}* não está na lista negra.`, [], msg.id).then(() => cmd);
      await saveModConfig(c);
      return say(g, `✅ *${fmtPhone(target)}* saiu da lista negra e pode entrar de novo.`).then(() => cmd);
    }
    case "!escanear":
    case "!varrer": {
      // procura no grupo quem está na lista negra (remove) e quem tem denúncias (só avisa)
      const info = await groupInfo(g, true).catch(() => null);
      if (!info) return say(g, "Não consegui listar os participantes agora.", [], msg.id).then(() => `${cmd} (falhou)`);
      const members = info.participants.filter((p) => !p.admin && phoneKey(p.phone) !== phoneKey(WHATSAPP_NUMBER));
      const blocked = members.filter((p) => isBlacklisted(c, p.phone));
      for (const p of blocked) await removeFromGroup(g, p.phone);
      const keys = members.map((p) => phoneKey(p.phone));
      const reported = await db.report.groupBy({ by: ["targetPhone"], where: { status: "ATIVA", targetPhone: { in: keys } }, _count: true });
      const lines = [
        `🔎 *Varredura do grupo* (${members.length} membros)`,
        blocked.length ? `\n⛔ *Na lista negra — removidos (${blocked.length}):*\n${blocked.map((p) => `• ${fmtPhone(p.phone)}`).join("\n")}` : "\n✅ Ninguém da lista negra está no grupo.",
        reported.length
          ? `\n🚨 *Com denúncias (${reported.length}):*\n${reported.map((r) => `• ${fmtPhone(r.targetPhone)} — ${r._count} denúncia(s)`).join("\n")}\nUse *${c.prefix || "!"}referencias número* para ver ou *${c.prefix || "!"}bloquear número* para remover.`
          : "✅ Nenhum membro com denúncia.",
      ];
      return say(g, lines.join("\n"), [], msg.id).then(() => `${cmd}: ${blocked.length} removido(s), ${reported.length} com denúncia`);
    }
    case "!bloqueados":
      return say(g, c.blacklist.length ? `⛔ *Lista negra* (${c.blacklist.length})\n${c.blacklist.map((b) => `• ${fmtPhone(b)}`).join("\n")}` : "A lista negra está vazia.", [], msg.id).then(() => cmd);
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
    case "!jogo": {
      const kind = /pre[cç]o/i.test(args) ? "PRECO" : /bola|captura/i.test(args) ? "POKEBOLA" : "POKEMON";
      const { startRound } = await import("./games");
      return startRound(kind, g)
        .then(() => `!jogo ${kind}`)
        .catch((e) => say(g, `Não deu para começar: ${e instanceof Error ? e.message : e}`, [], msg.id).then(() => "!jogo (falhou)"));
    }
    case "!leilomania":
    case "!darpontos": {
      const who = msg.quotedAuthor || msg.mentions[0] || "";
      if (!who) return say(g, `Responda a mensagem da pessoa com ${cmd.replace("!", c.prefix || "!")} ${cmd === "!leilomania" ? "120" : "50 motivo"}.`, [], msg.id).then(() => `${cmd} (sem alvo)`);
      const num = Number((args.replace(/@\d+/g, "").match(/-?\d+(?:[.,]\d{1,2})?/)?.[0] ?? "").replace(",", "."));
      if (!num) return say(g, "Faltou o valor.", [], msg.id).then(() => `${cmd} (sem valor)`);
      const P = await import("./points");
      const r =
        cmd === "!leilomania"
          ? await P.creditPurchase(who, "", Math.round(num * 100), "LEILOMANIA", "", `Leilomania R$ ${num}`)
          : await P.credit({ phone: who, points: Math.round(num), source: "AJUSTE", note: args.replace(/@\d+/g, "").replace(/-?\d+([.,]\d+)?/, "").trim() || "ajuste manual" });
      if (!r.ok) return say(g, `Não lancei: ${r.reason}.`, [], msg.id).then(() => `${cmd} (${r.reason})`);
      return say(g, `🪙 ${mention(who)} ${r.points! > 0 ? `ganhou *${r.points} pontos*` : `perdeu *${-r.points!} pontos*`}! Saldo: *${await P.balance(who)}*.`, [who]).then(() => cmd);
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
      // menção "escondida": todos são notificados, mas os @ não aparecem na mensagem
      await say(g, `📢 *Chamando todos os membros!*${args ? `\n\n${args}` : ""}`, people);
      return "!all";
    }
  }
  return null;
}

// ---------------- Lembretes de leilão (!avisar 1.3) ----------------

async function watchCommand(c: ModConfig, msg: InMsg, cmd: string, args: string) {
  const W = await import("./auction-watch");
  const P = c.prefix || "!";
  const a = await W.currentAuction();
  if (!a) return say(msg.group, "Não tem leilão agendado no momento. Fique de olho no grupo! 👀", [], msg.id);
  const codes = [...new Set(args.match(/\d+\.\d+/g) ?? [])].slice(0, 15);
  if (!codes.length) return say(msg.group, `Use *${P}avisar 1.3* (o código da carta, que aparece no spoiler e em ${siteLink(a.code)}). Pode mandar várias: *${P}avisar 1.3 2.1*`, [], msg.id);
  if (cmd === "!desavisar") {
    for (const code of codes) await W.removeWatch(a.id, code, msg.phone);
    return say(msg.group, `🔕 Ok, não vou mais te chamar para ${codes.join(", ")}.`, [], msg.id);
  }
  const done: string[] = [];
  const errors: string[] = [];
  for (const code of codes) {
    const r = await W.addWatch(a.id, code, msg.phone, msg.name);
    if ("error" in r) errors.push(r.error ?? code);
    else done.push(`${code} — ${r.item.name} (${r.total} ${r.total > 1 ? "interessados" : "interessado"})`);
  }
  return say(
    msg.group,
    [done.length ? `🔔 ${mention(msg.phone)}, vou te chamar quando entrarem no *${a.name}*:\n${done.map((d) => `• ${d}`).join("\n")}` : "", ...errors].filter(Boolean).join("\n"),
    [msg.phone],
    msg.id,
  );
}
const siteLink = (code: number) => `www.mlpbcards.com.br/leiloes/${code}`;

// ---------------- Avaliações (!avaliar / !referencias) ----------------

const REVIEW_SECONDS = 45;
const RATE_KINDS = ["RATE_PROOF", "RATE_PENDING", "RATE_COMMENT", "REPORT_PROOF", "REPORT_REASON"];
const REPORT_REASON_MINUTES = 3;
/** Estado da avaliação guardado no ModEvent: alvo + provas recebidas. */
function readRate(note: string): { t: string; p: { mediaId: string; messageId: string }[] } {
  try {
    const o = JSON.parse(note) as { t?: string; p?: { mediaId: string; messageId: string }[] };
    if (o && typeof o === "object" && o.t) return { t: o.t, p: o.p ?? [] };
  } catch {
    /* formato antigo: só o telefone */
  }
  return { t: note, p: [] };
}
const stars = (n: number) => "⭐".repeat(n) + "☆".repeat(5 - n);
const targetFrom = (args: string, msg: InMsg) => {
  const d = (args.match(/\+?\d[\d\s().-]{8,}/)?.[0] ?? "").replace(/\D/g, "") || msg.mentions[0] || msg.quotedAuthor || "";
  return d.length >= 10 ? d : "";
};
const fmtPhone = (p: string) => {
  let d = phoneKey(p).replace(/^55/, "");
  if (d.length === 10 && /[6-9]/.test(d[2])) d = d.slice(0, 2) + "9" + d.slice(2); // celular: mostra com o 9
  return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : p;
};

async function startReview(c: ModConfig, msg: InMsg, args: string) {
  const P = c.prefix || "!";
  const target = targetFrom(args, msg);
  if (!target) return say(msg.group, `Use: *${P}avaliar 61999999999* (o número de quem você quer avaliar).`, [], msg.id);
  const rater = phoneKey(msg.phone);
  if (phoneKey(target) === rater) return say(msg.group, "Você não pode avaliar a si mesmo. 😅", [], msg.id);
  const before = await db.review.findFirst({ where: { targetPhone: phoneKey(target), raterPhone: rater } });
  await db.modEvent.deleteMany({ where: { group: msg.group, phone: rater, kind: { in: RATE_KINDS } } });
  const replacing = before ? `\n_(Você já tinha avaliado com ${before.rating} — a nova avaliação vai substituir a anterior.)_` : "";
  // avaliar outro membro: primeiro as provas. Avaliar a loja: direto para a nota.
  const isStore = phoneKey(target) === phoneKey(WHATSAPP_NUMBER);
  const need = isStore ? 0 : Math.max(0, c.reviews.proofs);
  if (need > 0) {
    await db.modEvent.create({
      data: { group: msg.group, phone: rater, name: msg.name, kind: "RATE_PROOF", note: JSON.stringify({ t: phoneKey(target), p: [] }), until: new Date(Date.now() + c.reviews.proofMinutes * 60_000) },
    });
    return say(
      msg.group,
      `📸 ${mention(msg.phone)}, para avaliar *${fmtPhone(target)}* mande aqui *${need} imagens* que comprovem a negociação/entrega (ex.: print da conversa, comprovante de pagamento, foto do pacote ou rastreio).\nVocê tem ${c.reviews.proofMinutes} minutos. Depois disso eu peço a nota.${replacing}`,
      [msg.phone],
      msg.id,
    );
  }
  await db.modEvent.create({ data: { group: msg.group, phone: rater, name: msg.name, kind: "RATE_PENDING", note: JSON.stringify({ t: phoneKey(target), p: [] }), until: new Date(Date.now() + REVIEW_SECONDS * 1000) } });
  return say(
    msg.group,
    `⭐ ${mention(msg.phone)}, qual a sua nota para *${fmtPhone(target)}*?\nResponda só com um número de *1 a 5* em até ${REVIEW_SECONDS}s.${replacing}`,
    [msg.phone],
    msg.id,
  );
}

async function startReport(c: ModConfig, msg: InMsg, args: string) {
  const P = c.prefix || "!";
  const target = targetFrom(args, msg);
  if (!target) return say(msg.group, `Use: *${P}denunciar 61999999999* (o número de quem você quer denunciar).`, [], msg.id);
  const reporter = phoneKey(msg.phone);
  if (phoneKey(target) === reporter) return say(msg.group, "Você não pode denunciar a si mesmo. 😅", [], msg.id);
  if (phoneKey(target) === phoneKey(WHATSAPP_NUMBER)) return say(msg.group, "Problema com a loja? Fale direto com a MLPB no privado que a gente resolve. 🧡", [], msg.id);
  await db.modEvent.deleteMany({ where: { group: msg.group, phone: reporter, kind: { in: RATE_KINDS } } });
  const need = Math.max(1, c.reviews.proofs);
  await db.modEvent.create({
    data: { group: msg.group, phone: reporter, name: msg.name, kind: "REPORT_PROOF", note: JSON.stringify({ t: phoneKey(target), p: [] }), until: new Date(Date.now() + c.reviews.proofMinutes * 60_000) },
  });
  return say(
    msg.group,
    `🚨 ${mention(msg.phone)}, para denunciar *${fmtPhone(target)}* mande aqui *${need} imagens* de prova (ex.: print da conversa, comprovante de pagamento, anúncio, rastreio).\nVocê tem ${c.reviews.proofMinutes} minutos. Depois eu peço para você contar o que aconteceu.\n_Denúncia falsa dá advertência._`,
    [msg.phone],
    msg.id,
  );
}

/** Trata a resposta de quem está no meio de uma avaliação. Devolve o que fez, ou null se não era resposta. */
async function reviewStep(c: ModConfig, msg: InMsg, text: string): Promise<string | null> {
  const rater = phoneKey(msg.phone);
  const pending = await db.modEvent.findFirst({
    where: { group: msg.group, phone: rater, kind: { in: RATE_KINDS }, until: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!pending || /^[!/#.]\w/.test(text)) return null;

  // denúncia: provas e depois o relato
  if (pending.kind === "REPORT_PROOF") {
    if (!["image", "album"].includes(msg.type)) return null;
    const st = readRate(pending.note);
    st.p.push({ mediaId: msg.mediaId, messageId: msg.id });
    const need = Math.max(1, c.reviews.proofs);
    if (st.p.length < need) {
      await db.modEvent.update({ where: { id: pending.id }, data: { note: JSON.stringify(st) } });
      return `denúncia: prova ${st.p.length}/${need}`;
    }
    await db.modEvent.update({ where: { id: pending.id }, data: { kind: "REPORT_REASON", note: JSON.stringify(st), until: new Date(Date.now() + REPORT_REASON_MINUTES * 60_000) } });
    await say(msg.group, `✅ ${mention(msg.phone)}, provas recebidas! Agora conte em *uma mensagem* o que aconteceu com *${fmtPhone(st.t)}* (você tem ${REPORT_REASON_MINUTES} minutos).`, [msg.phone], msg.id);
    return "denúncia: provas completas";
  }
  if (pending.kind === "REPORT_REASON") {
    if (!text || text.length < 5) return null;
    const st = readRate(pending.note);
    await db.report.create({ data: { targetPhone: st.t, reporterPhone: rater, reporterName: msg.name, group: msg.group, reason: text.slice(0, 500), proofJson: JSON.stringify(st.p) } });
    await db.modEvent.delete({ where: { id: pending.id } });
    const total = await db.report.count({ where: { targetPhone: st.t, status: "ATIVA" } });
    await say(msg.group, `🚨 Denúncia registrada contra *${fmtPhone(st.t)}* (${total} no total). Obrigado por avisar! Os admins vão analisar.\nConsulte com *${c.prefix || "!"}referencias ${fmtPhone(st.t).replace(/\D/g, "")}*.`, [], msg.id);
    return `denúncia registrada contra ${st.t}`;
  }

  // etapa das provas: conta as imagens da pessoa
  if (pending.kind === "RATE_PROOF") {
    if (!["image", "album"].includes(msg.type)) return null;
    const st = readRate(pending.note);
    st.p.push({ mediaId: msg.mediaId, messageId: msg.id });
    const need = Math.max(1, c.reviews.proofs);
    if (st.p.length < need) {
      await db.modEvent.update({ where: { id: pending.id }, data: { note: JSON.stringify(st) } });
      return `avaliação: prova ${st.p.length}/${need}`;
    }
    await db.modEvent.update({ where: { id: pending.id }, data: { kind: "RATE_PENDING", note: JSON.stringify(st), until: new Date(Date.now() + REVIEW_SECONDS * 1000) } });
    await say(msg.group, `✅ ${mention(msg.phone)}, provas recebidas! Agora, qual a sua nota para *${fmtPhone(st.t)}*?\nResponda só com um número de *1 a 5* em até ${REVIEW_SECONDS}s.`, [msg.phone], msg.id);
    return "avaliação: provas completas";
  }

  if (pending.kind === "RATE_PENDING") {
    const st = readRate(pending.note);
    const n = Number(text.match(/^\s*([1-5])(?:\s|$|[.,!⭐])/)?.[1]);
    if (!n) return null; // não é nota: segue a vida (a janela expira sozinha)
    // uma avaliação por pessoa para cada número: reavaliar substitui nota e comentário
    const old = await db.review.findFirst({ where: { targetPhone: st.t, raterPhone: rater } });
    const proofJson = JSON.stringify(st.p);
    const r = old
      ? await db.review.update({ where: { id: old.id }, data: { rating: n, comment: "", proofJson, raterName: msg.name || old.raterName, group: msg.group, createdAt: new Date() } })
      : await db.review.create({ data: { targetPhone: st.t, raterPhone: rater, raterName: msg.name, group: msg.group, rating: n, proofJson } });
    await db.modEvent.update({ where: { id: pending.id }, data: { kind: "RATE_COMMENT", note: r.id, until: new Date(Date.now() + REVIEW_SECONDS * 1000) } });
    await say(msg.group, `✅ Nota ${stars(n)} registrada para *${fmtPhone(st.t)}*. Obrigado!\nSe quiser, mande um comentário em até ${REVIEW_SECONDS}s (opcional).`, [], msg.id);
    // MLPB Points: só quem avalia a LOJA ganha — 1ª avaliação vale reviewPoints; reavaliações valem reviewRepeatPoints (1x por dia)
    if (st.t === phoneKey(WHATSAPP_NUMBER)) {
      const { credit, getPointsConfig } = await import("./points");
      const pc = await getPointsConfig();
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
      const pts = old ? pc.reviewRepeatPoints : pc.reviewPoints;
      if (pc.enabled && pts > 0)
        await credit({ phone: msg.phone, name: msg.name, points: pts, source: "AVALIACAO", refId: old ? `REVL-${rater}-${day}` : `REVL-${rater}-first`, note: old ? "reavaliou a loja" : "avaliou a loja" }).catch(() => {});
    }
    return `avaliação: nota ${n} para ${st.t}`;
  }
  // comentário opcional
  if (!text) return null;
  await db.review.update({ where: { id: pending.note }, data: { comment: text.slice(0, 300) } });
  await db.modEvent.delete({ where: { id: pending.id } });
  await say(msg.group, "📝 Comentário registrado. Valeu! 🧡", [], msg.id);
  return "avaliação: comentário";
}

async function showReviews(msg: InMsg, args: string) {
  const target = targetFrom(args, msg);
  if (!target) return say(msg.group, "Use: *!referencias 61999999999* (o número da pessoa).", [], msg.id);
  const key = phoneKey(target);
  const [all, reports, member] = await Promise.all([
    db.review.findMany({ where: { targetPhone: key }, orderBy: { createdAt: "desc" } }),
    db.report.findMany({ where: { targetPhone: key, status: "ATIVA" }, orderBy: { createdAt: "desc" } }),
    import("./points").then((p) => p.groupMembers()).then((s) => (s ? s.has(key) : null)).catch(() => null),
  ]);
  const isStore = key === phoneKey(WHATSAPP_NUMBER);
  const memberLine = isStore ? "🏪 *Loja MLPB Cards*" : member === true ? "✅ *Membro do grupo*" : member === false ? "⚠️ *Não é membro do grupo* — cuidado ao negociar" : "";
  const blocked = (await getModConfig()).blacklist.some((b) => phoneKey(b) === key);
  const reportLines = reports.slice(0, 5).map((r) => {
    const d = r.createdAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const who = r.reporterName ? r.reporterName.split(" ")[0] : `…${r.reporterPhone.slice(-4)}`;
    const proofs = (JSON.parse(r.proofJson || "[]") as unknown[]).length;
    return `🚨 ${who} · ${d} · 📎 ${proofs} provas\n   “${r.reason.slice(0, 140)}${r.reason.length > 140 ? "…" : ""}”`;
  });
  const reportBlock = [
    blocked ? "⛔ *Este número está na lista negra do grupo.*" : "",
    reports.length ? `\n🚨 *${reports.length} ${reports.length > 1 ? "denúncias" : "denúncia"}*` : "",
    ...reportLines,
  ].filter(Boolean);
  if (all.length === 0)
    return say(msg.group, [`📋 *Referências de ${fmtPhone(target)}*`, memberLine, "Ainda não tem avaliações.", ...reportBlock].filter(Boolean).join("\n"), [], msg.id);
  const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
  const shown = all.slice(0, 20);
  const lines = shown.map((r) => {
    const d = r.createdAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const who = r.raterName ? r.raterName.split(" ")[0] : `…${r.raterPhone.slice(-4)}`;
    const proofs = (JSON.parse(r.proofJson || "[]") as unknown[]).length;
    return `${stars(r.rating)} · ${who} · ${d}${proofs ? ` · 📎 ${proofs} provas` : ""}${r.comment ? `\n   “${r.comment}”` : ""}`;
  });
  return say(
    msg.group,
    [
      `📋 *Referências de ${fmtPhone(target)}*`,
      memberLine,
      `Média: *${avg.toFixed(1).replace(".", ",")}* ${stars(Math.round(avg))} (${all.length} ${all.length > 1 ? "avaliações" : "avaliação"})`,
      "",
      ...lines,
      all.length > shown.length ? `\n…e mais ${all.length - shown.length} avaliações antigas.` : "",
      ...reportBlock,
    ].filter((l) => l !== "").join("\n").trim(),
    [],
    msg.id,
  );
}

// ---------------- MLPB Points (!pontos / !ranking / !premios / !trocar) ----------------

async function pointsCommand(c: ModConfig, msg: InMsg, cmd: string, args: string): Promise<string> {
  const P = await import("./points");
  const pc = await P.getPointsConfig();
  const g = msg.group;
  if (!pc.enabled) return say(g, "🪙 O MLPB Points ainda não está ativo.", [], msg.id).then(() => `${cmd} (desligado)`);
  const pre = c.prefix || "!";
  if (cmd === "!pontos") {
    const w = await P.wallet(msg.phone);
    const bal = w.balance;
    const exp = w.nextExpiry
      ? `\n⏳ ${w.nextExpiry.points} pts vencem em ${w.nextExpiry.date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}.`
      : "";
    const rank = await P.monthRanking(100);
    const pos = rank.findIndex((r) => r.phone === phoneKey(msg.phone));
    const next = pc.rewards.filter((r) => r.points > bal).sort((a, b) => a.points - b.points)[0];
    return say(
      g,
      `🪙 ${mention(msg.phone)}, você tem *${bal} MLPB Points*.${exp}${pos >= 0 ? `\n🏆 ${pos + 1}º no ranking do mês.` : ""}${next ? `\nFaltam ${next.points - bal} para: ${next.name}.` : ""}\nVeja os prêmios com *${pre}premios*.`,
      [msg.phone],
      msg.id,
    ).then(() => cmd);
  }
  if (cmd === "!ranking") {
    const top = await P.monthRanking(10);
    const medal = ["🥇", "🥈", "🥉"];
    return say(
      g,
      top.length
        ? `🏆 *Ranking MLPB do mês*\n${top.map((t, i) => `${medal[i] ?? `${i + 1}.`} ${t.name ? t.name.split(" ")[0] : mention(t.phone)} — ${t.points} pts`).join("\n")}\n\nO top 3 ganha bônus no início do mês: ${pc.ranking.map((v) => `+${v}`).join(" / ")} pontos.`
        : "🏆 Ninguém pontuou este mês ainda. Seja o primeiro!",
      top.filter((t) => !t.name).map((t) => t.phone),
      msg.id,
    ).then(() => cmd);
  }
  if (cmd === "!premios" || cmd === "!prêmios") {
    return say(
      g,
      `🎁 *Prêmios MLPB Points*\n${pc.rewards.map((r, i) => `${i + 1}. ${r.name} — *${r.points} pts*${r.minSpend ? ` _(exige R$ ${r.minSpend} em compras nos últimos ${pc.spendWindowDays} dias)_` : ""}`).join("\n")}\n\nPara trocar: *${pre}trocar número* (ex.: ${pre}trocar 1).\nGanhe pontos comprando (${pc.perReal} por R$ 1), em jogos e indicando amigos.`,
      [],
      msg.id,
    ).then(() => cmd);
  }
  // !trocar
  const n = Number(args.match(/\d+/)?.[0]);
  const reward = pc.rewards[n - 1] ?? pc.rewards.find((r) => r.key === args.trim().toLowerCase());
  if (!reward) return say(g, `Use *${pre}trocar número* — veja os números em *${pre}premios*.`, [], msg.id).then(() => `${cmd} (sem prêmio)`);
  const r = await P.requestRedemption(msg.phone, msg.name, reward.key);
  if (!r.ok) return say(g, `🪙 ${mention(msg.phone)}, não deu: ${r.reason}.`, [msg.phone], msg.id).then(() => `${cmd} (${r.reason})`);
  await say(g, `🎉 ${mention(msg.phone)} trocou *${reward.points} pontos* por *${reward.name}*! A loja vai falar com você para entregar. Saldo: ${r.balance} pts.`, [msg.phone], msg.id);
  return `${cmd}: ${reward.name}`;
}
