import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getSet } from "@/lib/tcgdex-sets";
import { variantsForSet } from "@/lib/stock-variants";
import { numKey } from "@/lib/catalog";
import { CollectionGrid } from "./CollectionGrid";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const s = await getSet(decodeURIComponent(setId)).catch(() => null);
  return { title: s ? `${s.namePt || s.nameEn} — Minha coleção | MLPB Cards` : "Coleção | MLPB Cards" };
}

export default async function SetCollectionPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const set = await getSet(decodeURIComponent(setId)).catch(() => null);
  if (!set) notFound();
  const user = await getCurrentUser();
  const [entries, variants] = await Promise.all([
    user ? db.collectionEntry.findMany({ where: { userId: user.id, setId: set.id } }) : Promise.resolve([]),
    variantsForSet([set.nameEn, set.namePt], set.cards).catch(() => []),
  ]);
  // cartas dessa coleção à venda na loja (menor preço por número)
  const forSale: Record<string, { id: string; priceCents: number }> = {};
  for (const v of variants) {
    if (!v.active || v.stock <= 0) continue;
    const k = numKey(v.number);
    if (!forSale[k] || v.priceCents < forSale[k].priceCents) forSale[k] = { id: v.id, priceCents: v.priceCents };
  }

  return (
    <div className="space-y-4">
      <Link href="/colecao" className="text-sm text-brand hover:underline">← Minha coleção</Link>
      <CollectionGrid
        logged={Boolean(user)}
        set={{ id: set.id, nameEn: set.nameEn, namePt: set.namePt, logo: set.logo, official: set.official, total: set.total, serie: set.serie, releaseDate: set.releaseDate }}
        cards={set.cards.map((c) => ({ cardId: c.tcgdexId, number: c.number, name: c.name, namePt: c.namePt, image: c.image, imageLarge: c.imageLarge, key: numKey(c.number) }))}
        initial={Object.fromEntries(entries.map((e) => [e.cardId, { qty: e.qty, wish: e.wish }]))}
        forSale={forSale}
      />
    </div>
  );
}
