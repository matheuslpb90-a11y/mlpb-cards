import Link from "next/link";
import type { Card } from "@prisma/client";
import { formatBRL } from "@/lib/money";
import { conditionShort, languageFlag } from "@/lib/catalog";
import { CardImage } from "./CardImage";
import { AddToCartButton } from "./AddToCartButton";

export function ProductTile({ c }: { c: Card }) {
  const isCard = c.kind === "CARTA";
  return (
    <div className="card flex flex-col p-3">
      <Link href={`/cartas/${c.id}`} className="group">
        <CardImage src={c.imageUrl} alt={c.name} className={`transition group-hover:scale-[1.02] ${isCard ? "" : "object-contain bg-panel"}`} />
        <h3 className="mt-2 line-clamp-2 font-semibold leading-tight">{c.name}</h3>
      </Link>
      <p className="line-clamp-1 text-xs text-slate-500">
        {isCard ? `${c.setName}${c.number ? ` · ${c.number}` : ""}` : c.category || c.setName}
      </p>
      <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
        {isCard && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold">{conditionShort(c.condition)}</span>}
        <span className="rounded bg-slate-100 px-1.5 py-0.5">{languageFlag(c.language)} {c.language}</span>
        {isCard && c.rarity && <span className="rounded bg-slate-100 px-1.5 py-0.5">{c.rarity}</span>}
      </div>
      <div className="mt-auto pt-2">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold text-brand">{formatBRL(c.priceCents)}</span>
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
