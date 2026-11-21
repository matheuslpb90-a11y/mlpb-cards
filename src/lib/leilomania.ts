import { db } from "@/lib/db";

// Link de indicação da loja na Leilomania (público). Pode ser trocado no painel: Leilões → 🟣 Leilomania.
export const LEILOMANIA_REF_DEFAULT = "https://leilomania.com.br/r/ZjVjNDgzNGUtMjFkYS00MGI3LWFmNDItMzEwMmQxNTI5M2U2";

export async function leilomaniaLinks() {
  const rows = await db.setting.findMany({ where: { key: { in: ["leilomaniaUrl", "leilomaniaRefUrl"] } } });
  const get = (k: string) => rows.find((r) => r.key === k)?.value?.trim() ?? "";
  return { profileUrl: get("leilomaniaUrl"), refUrl: get("leilomaniaRefUrl") || LEILOMANIA_REF_DEFAULT };
}

/** Fotos de um leilão da Leilomania (a primeira é a capa). */
export function extImages(a: { imageUrl: string; imagesJson?: string | null }) {
  let list: string[] = [];
  try { list = JSON.parse(a.imagesJson || "[]"); } catch {}
  if (!list.length && a.imageUrl) list = [a.imageUrl];
  return list.filter((u) => typeof u === "string" && u);
}

// ---------- Integração automática (API pública da Leilomania) ----------
// GET https://api.leilomania.com.br/api/auctions          → leilões ativos e agendados de todos
// GET https://api.leilomania.com.br/api/auctions/{id}/items → cartas do leilão (com foto)
const API = (process.env.LEILOMANIA_API_URL || "https://api.leilomania.com.br/api").replace(/\/+$/, "");

/** O id da loja na Leilomania está dentro do link de indicação (/r/<base64 do id>). */
export function hostIdFromRef(ref: string) {
  const code = ref.match(/\/r\/([A-Za-z0-9+/=_-]+)/)?.[1];
  if (!code) return "";
  try {
    const id = Buffer.from(code.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return /^[0-9a-f-]{36}$/i.test(id) ? id : "";
  } catch {
    return "";
  }
}

type ApiAuction = { id: string; title: string; description?: string; status: string; startTime: string; endTime: string; hostId: string; isPrivate?: boolean; itemCount?: number };
type ApiItem = {
  id: string; name?: string; imageUrl?: string | null; condition?: string | null; language?: string | null; cardCode?: string | null; rarity?: string | null;
  isHolo?: boolean; isReverseHolo?: boolean; pollValues?: number[] | null; pollBuyoutValue?: number | null; startingPrice?: number | null; buyoutPrice?: number | null;
  currentPrice?: number | null; soldPrice?: number | null; status?: string; description?: string | null;
};

/** Carta de um leilão da Leilomania — só dados públicos da carta (nada do arrematante). */
export type LmItem = {
  id: string; name: string; imageUrl: string; condition: string; language: string; code: string; rarity: string; finish: string; note: string;
  startCents: number | null; buyoutCents: number | null; currentCents: number | null; sold: boolean;
};

const cents = (v: number | null | undefined) => (typeof v === "number" && v > 0 ? Math.round(v * 100) : null);
const toItem = (i: ApiItem): LmItem => ({
  id: i.id, name: i.name ?? "", imageUrl: /^https?:\/\//.test(i.imageUrl ?? "") ? i.imageUrl! : "",
  condition: i.condition ?? "", language: i.language ?? "", code: i.cardCode ?? "", rarity: i.rarity ?? "",
  finish: i.isReverseHolo ? "Reverse" : i.isHolo ? "Holo" : "", note: (i.description ?? "").slice(0, 200),
  startCents: cents(i.pollValues?.[0] ?? i.startingPrice), buyoutCents: cents(i.pollBuyoutValue ?? i.buyoutPrice),
  currentCents: cents(i.currentPrice), sold: !!i.soldPrice || /sold|vendid/i.test(i.status ?? ""),
});

export type LmAuction = {
  key: string;
  title: string;
  description: string;
  url: string;
  images: string[];
  startsAt: Date;
  endsAt: Date;
  itemCount: number | null;
  items: LmItem[];
  auto: boolean; // veio da API (true) ou foi cadastrado à mão (false)
};

async function get<T>(path: string, revalidate: number): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: { Accept: "application/json" }, next: { revalidate }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Leilomania ${r.status}`);
  return (await r.json()) as T;
}

async function fromApi(hostId: string): Promise<LmAuction[]> {
  if (!hostId) return [];
  const all = await get<ApiAuction[]>("/auctions", 120);
  const mine = all.filter((a) => a.hostId?.toLowerCase() === hostId.toLowerCase() && !a.isPrivate && new Date(a.endTime) > new Date());
  return Promise.all(
    mine.map(async (a) => {
      const items = await get<ApiItem[]>(`/auctions/${a.id}/items`, 120).catch(() => [] as ApiItem[]);
      const list = items.map(toItem);
      const images = [...new Set(list.map((i) => i.imageUrl).filter(Boolean))].slice(0, 12);
      return {
        key: a.id, title: a.title, description: a.description ?? "", url: `https://leilomania.com.br/auction/${a.id}`,
        images, startsAt: new Date(a.startTime), endsAt: new Date(a.endTime), itemCount: a.itemCount ?? items.length ?? null, items: list, auto: true,
      };
    }),
  );
}

/** Leilões ativos/agendados da loja na Leilomania: automáticos (API) + os cadastrados à mão no painel. */
export async function leilomaniaAuctions(): Promise<LmAuction[]> {
  const now = new Date();
  const [links, manual] = await Promise.all([
    leilomaniaLinks(),
    db.externalAuction.findMany({ where: { visible: true, endsAt: { gt: now } }, orderBy: { startsAt: "asc" }, take: 30 }),
  ]);
  const auto = await fromApi(hostIdFromRef(links.refUrl)).catch((e) => {
    console.error("Leilomania API:", e);
    return [] as LmAuction[];
  });
  const autoIds = new Set(auto.map((a) => a.key));
  const extra = manual
    .filter((m) => ![...autoIds].some((id) => m.url.includes(id)))
    .map((m) => ({ key: m.id, title: m.title, description: m.description, url: m.url, images: extImages(m), startsAt: m.startsAt, endsAt: m.endsAt, itemCount: null, items: [] as LmItem[], auto: false }));
  return [...auto, ...extra].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
