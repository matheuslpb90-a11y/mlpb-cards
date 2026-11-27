import "server-only";

// Imagens de carta que funcionam no site e no WhatsApp.
// A MYP Cards (img.mypcards.com) bloqueia o uso das fotos dela fora do site deles:
// no seu site e no grupo elas não aparecem. Então trocamos por uma foto que funcione.

export const isBlockedImage = (url: string) => /(^|\/\/)img\.mypcards\.com\//i.test(url);

/** Imagem oficial (TCGdex) quando nome, número e total da coleção batem (ex.: "Gengar", "34/119"). */
export async function officialImage(name: string, number = "") {
  const n = (number.split("/")[0] ?? "").replace(/^0+(?=\d)/, "").trim().toLowerCase();
  const total = Number((number.split("/")[1] ?? "").replace(/\D/g, "")) || 0;
  const clean = name.replace(/\s*\(.*?\)\s*/g, " ").trim();
  if (!clean || !n || !total) return "";
  // inglês e português ao mesmo tempo; respostas guardadas por 1 dia (a mesma carta não é buscada de novo)
  const opts = { signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } };
  const tryLang = async (lang: string) => {
    try {
      const r = await fetch(`https://api.tcgdex.net/v2/${lang}/cards?name=${encodeURIComponent(clean)}`, opts);
      const list = (await r.json()) as { id: string; localId: string; image?: string }[];
      const same = Array.isArray(list) ? list.filter((c) => c.image && c.localId.replace(/^0+(?=\d)/, "").toLowerCase() === n) : [];
      const checked = await Promise.all(
        same.slice(0, 8).map(async (c) => {
          const d = (await (await fetch(`https://api.tcgdex.net/v2/${lang}/cards/${encodeURIComponent(c.id)}`, opts)).json().catch(() => null)) as { set?: { cardCount?: { official?: number } } } | null;
          return d?.set?.cardCount?.official === total ? c : null;
        }),
      );
      const hits = checked.filter((c): c is NonNullable<typeof c> => !!c);
      return hits.length === 1 ? `${hits[0].image}/high.webp` : "";
    } catch {
      return "";
    }
  };
  const [en, pt] = await Promise.all([tryLang("en"), tryLang("pt")]);
  if (en || pt) return en || pt;
  return "";
}

/** Foto que funciona para uma carta: troca a da MYP pela foto enviada (Mídias) ou pela imagem oficial. */
export async function usableImage(imageUrl: string, mediaImages: string[], name: string, number: string) {
  if (!imageUrl || !isBlockedImage(imageUrl)) return imageUrl || mediaImages[0] || "";
  if (mediaImages[0]) return mediaImages[0];
  return (await officialImage(name, number)) || imageUrl;
}
