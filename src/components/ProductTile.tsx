import Link from "next/link";
import type { Card } from "@prisma/client";
import { discountPct, formatBRL } from "@/lib/money";
import { conditionShort, languageFlag } from "@/lib/catalog";
import { CardImage } from "./CardImage";
import { HoloCard } from "./HoloCard";
import { AddToCartButton } from "./AddToCartButton";

export function ProductTile({ c }: { c: Card }) {
  const isCard = c.kind === "CARTA";
  const off = discountPct(c.priceCents, c.compareAtCents);
  return (
    <div className="card relative flex flex-col p-3">
      {off > 0 && <span className="absolute left-2 top-2 z-10 rounded-full bg-gradient-to-r from-brand-amber to-brand px-2 py-0.5 text-xs font-black text-gray-950">-{off}%</span>}
      <Link href={`/cartas/${c.id}`} className="group">
        <HoloCard holo={isCard && c.finish !== "Normal"}>
          <CardImage src={c.imageUrl} alt={c.name} className={isCard ? "" : "object-contain bg-panel"} />
        </HoloCard>
        <h3 className="mt-2 line-clamp-2 font-semibold leading-tight">{c.name}</h3>
      </Link>
      <p className="line-clamp-1 text-xs text-slate-500">
        {isCard ? `${c.setName}${c.number ? ` · ${c.number}` : ""}` : c.category || c.setName}
      </p>
      <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
        {isCard && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold">{conditionShort(c.condition)}</span>}
        <span className="rounded bg-slate-100 px-1.5 py-0.5">{languageFlag(c.language)} {c.language}</span>
        {isCard && c.finish !== "Normal" && <span className="rounded bg-brand/20 px-1.5 py-0.5 font-semibold text-brand">{c.finish}</span>}
        {isCard && c.rarity && <span className="rounded bg-slate-100 px-1.5 py-0.5">{c.rarity}</span>}
      </div>
      <div className="mt-auto pt-2">
        <div className="flex items-baseline justify-between">
          <span>
            {off > 0 && <span className="block text-xs text-slate-500 line-through">{formatBRL(c.compareAtCents!)}</span>}
            <span className="text-lg font-bold text-brand">{formatBRL(c.priceCents)}</span>
          </span>
          <span className="text-xs text-slate-500">{c.stock > 0 ? `${c.stock} disp.` : "Esgotado"}</span>
        </div>
        <AddToCartButton
          className="mt-2 text-sm"
          card={{ cardId: c.id, name: c.name, setName: isCard ? c.setName : c.category, priceCents: c.priceCents, imageUrl: c.imageUrl, stock: c.stock }}
        />
      </div>
    </div>
  );
}
