/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Card } from "@prisma/client";
import { formatBRL } from "@/lib/money";

/** Cartas do estoque em leque (banner da tela de início). Clique abre a página da carta. */
export function CardFan({ cards }: { cards: Card[] }) {
  const n = cards.length;
  const mid = (n - 1) / 2;
  return (
    <div className="relative mx-auto flex h-64 w-full max-w-md items-center justify-center sm:h-96">
      {cards.map((c, i) => {
        const d = i - mid;
        const style = {
          "--d": d,
          "--ad": Math.abs(d),
          zIndex: 20 - Math.round(Math.abs(d) * 2),
        } as React.CSSProperties;
        return (
          <Link
            key={c.id}
            href={`/cartas/${c.id}`}
            style={style}
            title={`${c.name} — ${formatBRL(c.priceCents)}`}
            className="fan-card absolute w-32 overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/60 sm:w-48"
          >
            <img src={c.imageUrl} alt={c.name} className="aspect-[63/88] w-full object-cover" />
          </Link>
        );
      })}
    </div>
  );
}
