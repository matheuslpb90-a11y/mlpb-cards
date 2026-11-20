import "server-only";
import { db } from "./db";
import { log, sendImage, sendText } from "./zapi";
import { whapiTextEx } from "./whapi";
import { phoneKey } from "./phone";
import { siteUrl } from "./orders";
import { formatBRL } from "./money";
import NAMES from "@/data/pokemon-names.json";

// Jogos do grupo: Quem é esse Pokémon?, Adivinhe o preço e Pokébola (com Pokédex).
// O agendador (a cada minuto) abre rodadas em horários aleatórios dentro da janela configurada
// e encerra as que passaram do tempo. Pontos via MLPB Points (respeitando o limite diário de jogos).

export type GameKind = "POKEMON" | "PRECO" | "POKEBOLA";
export type GamesConfig = {
  enabled: boolean;
  startHour: number;
  endHour: number;
  minGapMinutes: number; // intervalo mínimo entre rodadas
  roundMinutes: number; // tempo para responder
  maxDex: number; // até qual Pokémon sortear (1025 = todos)
  pokemon: { enabled: boolean; perDay: number; points: number };
  preco: { enabled: boolean; perDay: number; points: number };
  pokebola: { enabled: boolean; perDay: number; points: number; shinyPoints: number; shinyChance: number };
};

export const DEFAULT_GAMES: GamesConfig = {
  enabled: false,
  startHour: 10,
  endHour: 22,
  minGapMinutes: 60,
  roundMinutes: 3,
  maxDex: 1025,
  pokemon: { enabled: true, perDay: 3, points: 10 },
  preco: { enabled: true, perDay: 2, points: 15 },
  pokebola: { enabled: true, perDay: 3, points: 5, shinyPoints: 50, shinyChance: 5 },
};

export async function getGamesConfig(): Promise<GamesConfig> {
  const s = await db.setting.findUnique({ where: { key: "gamesConfig" } });
  try {
    const c = JSON.parse(s?.value ?? "{}") as Partial<GamesConfig>;
    return {
      ...DEFAULT_GAMES,
      ...c,
      pokemon: { ...DEFAULT_GAMES.pokemon, ...c.pokemon },
      preco: { ...DEFAULT_GAMES.preco, ...c.preco },
      pokebola: { ...DEFAULT_GAMES.pokebola, ...c.pokebola },
    };
  } catch {
    return DEFAULT_GAMES;
  }
}
export async function saveGamesConfig(c: GamesConfig) {
  await db.setting.upsert({ where: { key: "gamesConfig" }, create: { key: "gamesConfig", value: JSON.stringify(c) }, update: { value: JSON.stringify(c) } });
}

// ---- utilidades ----
const pokeName = (dex: number) => (NAMES as string[])[dex - 1] ?? `#${dex}`;
export const artwork = (dex: number, shiny = false) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${shiny ? "shiny/" : ""}${dex}.png`;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/♀/g, "f").replace(/♂/g, "m").replace(/[^a-z0-9]/g, "");
const rand = (n: number) => 1 + Math.floor(Math.random() * n);
const mention = (p: string) => `@${p.replace(/\D/g, "")}`;
const first = (name: string, phone: string) => (name ? name.split(" ")[0] : `…${phone.slice(-4)}`);

function brNow() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
  return { hour: Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24, minute: Number(parts.find((p) => p.type === "minute")?.value ?? 0) };
}
function startOfDayBR() {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return new Date(`${ymd}T00:00:00-03:00`);
}
async function gameGroup() {
  return (await db.setting.findUnique({ where: { key: "botGroupId" } }))?.value ?? "";
}
async function award(phone: string, name: string, points: number, note: string, ignoreCap = false) {
  const { creditGame, credit } = await import("./points");
  // shiny é raro: não conta no limite diário de jogos
  const r = await (ignoreCap ? credit({ phone, name, points, source: "JOGO", note }) : creditGame(phone, name, points, note)).catch(() => ({ ok: false as const, points: 0 }));
  return r.ok ? (r as { points?: number }).points ?? points : 0;
}

// ---- abrir rodadas ----
export async function startRound(kind: GameKind, group?: string) {
  const g = group || (await gameGroup());
  if (!g) throw new Error("Escolha o grupo em Painel → Bot WhatsApp.");
  const c = await getGamesConfig();
  if (await db.gameRound.findFirst({ where: { group: g, status: "ATIVO" } })) throw new Error("Já tem um jogo rolando no grupo.");
  const endsAt = new Date(Date.now() + Math.max(1, c.roundMinutes) * 60_000);
  const min = Math.max(1, c.roundMinutes);

  if (kind === "POKEMON") {
    const dex = rand(Math.min(c.maxDex, NAMES.length));
    const r = await db.gameRound.create({ data: { type: kind, group: g, answer: pokeName(dex), dataJson: JSON.stringify({ dex }), endsAt } });
    await sendImage(g, `${siteUrl()}/api/jogos/silhueta/${r.id}`, `❓ *QUEM É ESSE POKÉMON?*\nO primeiro a mandar o nome certo ganha *${c.pokemon.points} MLPB Points*! ⏰ ${min} min`);
    return r;
  }
  if (kind === "POKEBOLA") {
    const dex = rand(Math.min(c.maxDex, NAMES.length));
    const shiny = Math.random() * 100 < c.pokebola.shinyChance;
    const r = await db.gameRound.create({ data: { type: kind, group: g, answer: String(dex), dataJson: JSON.stringify({ dex, shiny, name: pokeName(dex) }), endsAt } });
    await sendImage(
      g,
      artwork(dex, shiny),
      `${shiny ? "✨ *UM POKÉMON SHINY APARECEU!* ✨\n" : ""}🌿 Um *${pokeName(dex)}*${shiny ? " shiny" : ""} selvagem apareceu!\nO primeiro a digitar *!captura* pega e ganha *${shiny ? c.pokebola.shinyPoints : c.pokebola.points} MLPB Points*! ⏰ ${min} min`,
    );
    return r;
  }
  // PRECO: carta do estoque
  const n = await db.card.count({ where: { active: true, stock: { gt: 0 }, priceCents: { gt: 0 }, imageUrl: { not: "" } } });
  if (n === 0) throw new Error("Nenhuma carta com foto e preço no estoque.");
  const card = await db.card.findFirst({ where: { active: true, stock: { gt: 0 }, priceCents: { gt: 0 }, imageUrl: { not: "" } }, skip: Math.floor(Math.random() * n) });
  if (!card) throw new Error("Carta não encontrada.");
  const r = await db.gameRound.create({ data: { type: kind, group: g, answer: String(card.priceCents), dataJson: JSON.stringify({ cardId: card.id, name: card.name }), endsAt } });
  const img = card.imageUrl.startsWith("http") ? card.imageUrl : `${siteUrl()}${card.imageUrl}`;
  await sendImage(
    g,
    img,
    `💰 *ADIVINHE O PREÇO!*\n*${card.name}*${card.setName ? ` — ${card.setName}` : ""}${card.number ? ` (${card.number})` : ""} · ${card.condition}\nQuanto ela custa na loja? Responda só com o valor (ex.: *45* ou *R$ 45,90*).\nQuem chegar mais perto ganha *${c.preco.points} MLPB Points*! Vale o 1º palpite de cada um. ⏰ ${min} min`,
  );
  return r;
}

// ---- respostas no grupo ----
/** Confere se a mensagem responde ao jogo ativo. Devolve o que aconteceu (para o registro) ou null. */
export async function gameMessage(msg: { group: string; phone: string; name: string; text: string; fromMe: boolean }): Promise<string | null> {
  const text = msg.text.trim();
  if (!text || msg.fromMe) return null;
  const round = await db.gameRound.findFirst({ where: { group: msg.group, status: "ATIVO", endsAt: { gt: new Date() } } });
  if (!round) return null;
  const c = await getGamesConfig();

  if (round.type === "POKEMON") {
    const t = norm(text);
    const a = norm(round.answer);
    if (!t || !t.includes(a) || t.length > a.length + 10) return null;
    // garante um vencedor só (corrida entre mensagens)
    const won = await db.gameRound.updateMany({ where: { id: round.id, status: "ATIVO" }, data: { status: "ENCERRADO", winnerPhone: phoneKey(msg.phone), winnerName: msg.name } });
    if (!won.count) return null;
    const dex = (JSON.parse(round.dataJson) as { dex: number }).dex;
    const pts = await award(msg.phone, msg.name, c.pokemon.points, `Quem é esse Pokémon? (${round.answer})`);
    await sendImage(msg.group, artwork(dex), `🎉 ${mention(msg.phone)} acertou! É o *${round.answer}*!${pts ? ` +${pts} MLPB Points 🪙` : ""}`).catch(() => {});
    return `jogo: acertou ${round.answer}`;
  }

  if (round.type === "PRECO") {
    const m = text.replace(/\s/g, "").match(/^(?:r\$)?(\d{1,6}(?:[.,]\d{1,2})?)$/i);
    if (!m) return null;
    const cents = Math.round(Number(m[1].replace(",", ".")) * 100);
    if (!cents) return null;
    await db.gameGuess.create({ data: { roundId: round.id, phone: phoneKey(msg.phone), name: msg.name, cents } }).catch(() => null); // só o 1º palpite vale
    return null;
  }

  if (round.type === "POKEBOLA" && /^[!/#.](captura|capturar|pokebola|pokébola)\b/i.test(text)) {
    const won = await db.gameRound.updateMany({ where: { id: round.id, status: "ATIVO" }, data: { status: "ENCERRADO", winnerPhone: phoneKey(msg.phone), winnerName: msg.name } });
    if (!won.count) return null;
    const d = JSON.parse(round.dataJson) as { dex: number; shiny: boolean; name: string };
    await db.capture.create({ data: { phone: phoneKey(msg.phone), name: msg.name, dex: d.dex, pokemon: d.name, shiny: d.shiny } });
    const total = await db.capture.groupBy({ by: ["dex"], where: { phone: phoneKey(msg.phone) } });
    const pts = await award(msg.phone, msg.name, d.shiny ? c.pokebola.shinyPoints : c.pokebola.points, `Pokébola: ${d.name}${d.shiny ? " shiny" : ""}`, d.shiny);
    await whapiTextEx(
      msg.group,
      `🔴⚪ ${mention(msg.phone)} capturou ${d.shiny ? "o ✨*" : "o *"}${d.name}${d.shiny ? " shiny*✨" : "*"}!${pts ? ` +${pts} MLPB Points 🪙` : ""}\n📕 Pokédex: ${total.length} Pokémon. Veja com *!pokedex*.`,
      { mentions: [msg.phone] },
    ).catch(() => {});
    return `jogo: capturou ${d.name}`;
  }
  return null;
}

// ---- encerrar rodadas vencidas ----
async function closeExpired() {
  const due = await db.gameRound.findMany({ where: { status: "ATIVO", endsAt: { lte: new Date() } } });
  const c = await getGamesConfig();
  for (const r of due) {
    const done = await db.gameRound.updateMany({ where: { id: r.id, status: "ATIVO" }, data: { status: "ENCERRADO" } });
    if (!done.count) continue;
    try {
      if (r.type === "POKEMON") {
        const dex = (JSON.parse(r.dataJson) as { dex: number }).dex;
        await sendImage(r.group, artwork(dex), `⏰ Tempo esgotado! Era o *${r.answer}*. Ninguém acertou dessa vez.`);
      } else if (r.type === "POKEBOLA") {
        const d = JSON.parse(r.dataJson) as { name: string; shiny: boolean };
        await sendText(r.group, `💨 O ${d.name}${d.shiny ? " shiny" : ""} fugiu! Fica para a próxima.`);
      } else {
        const d = JSON.parse(r.dataJson) as { cardId: string; name: string };
        const price = Number(r.answer);
        const guesses = await db.gameGuess.findMany({ where: { roundId: r.id }, orderBy: { createdAt: "asc" } });
        const best = [...guesses].sort((a, b) => Math.abs(a.cents - price) - Math.abs(b.cents - price) || a.createdAt.getTime() - b.createdAt.getTime())[0];
        let line = "Ninguém palpitou. 😅";
        if (best) {
          await db.gameRound.update({ where: { id: r.id }, data: { winnerPhone: best.phone, winnerName: best.name } });
          const pts = await award(best.phone, best.name, c.preco.points, `Adivinhe o preço (${d.name})`);
          line = `🏆 Mais perto: *${first(best.name, best.phone)}* com ${formatBRL(best.cents)}${pts ? ` (+${pts} MLPB Points 🪙)` : ""}`;
        }
        await sendText(r.group, `💰 *${d.name}* custa *${formatBRL(price)}*!\n${line}\n\n🛒 Está à venda: ${siteUrl()}/cartas/${d.cardId}`);
      }
    } catch (e) {
      await log("erro-jogos", { round: r.id, error: String(e) });
    }
  }
}

// ---- agendador ----
/** Roda a cada minuto: encerra rodadas vencidas e, de vez em quando, abre uma nova dentro da janela. */
export async function gamesTick() {
  await closeExpired();
  const c = await getGamesConfig();
  if (!c.enabled) return;
  const g = await gameGroup();
  if (!g) return;
  const { hour, minute } = brNow();
  if (hour < c.startHour || hour >= c.endHour) return;
  if (await db.gameRound.findFirst({ where: { group: g, status: "ATIVO" } })) return;
  const last = await db.gameRound.findFirst({ where: { group: g }, orderBy: { createdAt: "desc" } });
  if (last && Date.now() - last.createdAt.getTime() < c.minGapMinutes * 60_000) return;

  const today = startOfDayBR();
  const counts = await db.gameRound.groupBy({ by: ["type"], where: { group: g, createdAt: { gte: today } }, _count: true });
  const done = (k: GameKind) => counts.find((x) => x.type === k)?._count ?? 0;
  const left: [GameKind, number][] = (
    [
      ["POKEMON", c.pokemon.enabled ? c.pokemon.perDay - done("POKEMON") : 0],
      ["PRECO", c.preco.enabled ? c.preco.perDay - done("PRECO") : 0],
      ["POKEBOLA", c.pokebola.enabled ? c.pokebola.perDay - done("POKEBOLA") : 0],
    ] as [GameKind, number][]
  ).filter(([, n]) => n > 0);
  const remaining = left.reduce((s, [, n]) => s + n, 0);
  if (remaining === 0) return;
  // distribui as rodadas que faltam ao longo do resto da janela
  const minutesLeft = Math.max(1, (c.endHour - hour) * 60 - minute);
  if (Math.random() > Math.min(1, (1.5 * remaining) / minutesLeft)) return;
  let pick = Math.random() * remaining;
  const kind = left.find(([, n]) => (pick -= n) < 0)?.[0] ?? left[0][0];
  await startRound(kind, g).catch((e) => log("erro-jogos", { acao: "abrir", kind, error: String(e) }));
}

// ---- Pokédex ----
export async function pokedexText(phone: string, name: string) {
  const k = phoneKey(phone);
  const all = await db.capture.findMany({ where: { phone: k }, orderBy: { createdAt: "desc" } });
  if (all.length === 0) return `📕 ${mention(phone)}, sua Pokédex está vazia. Fique de olho: quando um Pokémon selvagem aparecer, digite *!captura*!`;
  const unique = new Set(all.map((c) => c.dex)).size;
  const shinies = all.filter((c) => c.shiny);
  const last = all.slice(0, 5).map((c) => `${c.shiny ? "✨" : "•"} #${c.dex} ${c.pokemon}`);
  return [
    `📕 *Pokédex de ${first(name, k)}*`,
    `${unique} Pokémon diferentes (${all.length} capturas)${shinies.length ? ` · ✨ ${shinies.length} shiny` : ""}`,
    "",
    "Últimas capturas:",
    ...last,
  ].join("\n");
}
