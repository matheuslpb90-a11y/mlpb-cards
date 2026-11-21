"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import type { LmItem } from "@/lib/leilomania";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Cartas de um leilão da Leilomania em rolagem lateral; tocar numa carta abre os detalhes. */
export function LmItemsCarousel({ items, url }: { items: LmItem[]; url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.85, behavior: "smooth" });
  const it = open == null ? null : items[open];

  useEffect(() => {
    if (open == null) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i == null ? i : (i + 1) % items.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i == null ? i : (i - 1 + items.length) % items.length));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, items.length]);

  if (!items.length) return null;
  return (
    <div className="relative">
      <div ref={ref} className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:thin]">
        {items.map((c, i) => (
          <button key={c.id} type="button" onClick={() => setOpen(i)}
            className="card group flex w-36 shrink-0 snap-start flex-col p-2 text-left transition hover:border-purple-500 sm:w-44">
            <div className="relative aspect-[63/88] w-full overflow-hidden rounded-lg bg-black/40">
              {c.imageUrl
                ? <img src={c.imageUrl} alt={c.name} loading="lazy" className="h-full w-full object-contain transition group-hover:scale-[1.03]" />
                : <div className="flex h-full items-center justify-center text-3xl">🃏</div>}
              {c.sold && <span className="absolute left-1 top-1 rounded bg-black/80 px-1.5 text-[10px] font-bold text-slate-300">VENDIDA</span>}
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight">{c.name}</p>
            <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
              {c.condition && <span className="rounded bg-slate-100 px-1 py-0.5">{c.condition.replace(/.*\((.+)\).*/, "$1")}</span>}
              {c.language && <span className="rounded bg-slate-100 px-1 py-0.5">{c.language}</span>}
              {c.finish && <span className="rounded bg-purple-950/60 px-1 py-0.5 text-purple-300">{c.finish}</span>}
            </div>
            <div className="mt-auto pt-1 text-xs">
              {c.startCents != null && <p className="text-slate-500">Inicial <strong className="text-sm text-purple-300">{brl(c.startCents)}</strong></p>}
              {c.buyoutCents != null && <p className="text-slate-500">Arremate {brl(c.buyoutCents)}</p>}
            </div>
          </button>
        ))}
      </div>
      {items.length > 2 && (
        <>
          <button type="button" aria-label="Anterior" onClick={() => scroll(-1)} className="absolute -left-3 top-1/3 hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-black/80 text-xl sm:flex">‹</button>
          <button type="button" aria-label="Próximas" onClick={() => scroll(1)} className="absolute -right-3 top-1/3 hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-black/80 text-xl sm:flex">›</button>
        </>
      )}

      {it && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)}>
          <div className="card relative max-h-full w-full max-w-md overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="absolute right-3 top-2 text-2xl" onClick={() => setOpen(null)}>✕</button>
            {it.imageUrl && <img src={it.imageUrl} alt={it.name} className="mx-auto max-h-[55vh] w-auto rounded-lg object-contain" />}
            <h3 className="mt-3 text-lg font-bold leading-tight">{it.name}</h3>
            <p className="text-sm text-slate-500">{[it.code, it.rarity, it.finish].filter(Boolean).join(" · ")}</p>
            <p className="text-sm">{[it.condition, it.language].filter(Boolean).join(" · ")}</p>
            {it.note && <p className="mt-1 text-xs text-slate-500">{it.note}</p>}
            <div className="mt-2 flex gap-4 text-sm">
              {it.startCents != null && <p>Inicial <strong className="text-purple-300">{brl(it.startCents)}</strong></p>}
              {it.buyoutCents != null && <p>Arremate <strong>{brl(it.buyoutCents)}</strong></p>}
            </div>
            {it.sold && <p className="mt-1 text-sm font-bold text-slate-400">Esta carta já foi vendida.</p>}
            <div className="mt-3 flex items-center justify-between gap-2">
              <button type="button" className="btn-outline px-3" onClick={() => setOpen((open! - 1 + items.length) % items.length)}>‹</button>
              <a href={url} target="_blank" rel="noreferrer" className="btn flex-1 bg-purple-700 text-sm text-white hover:bg-purple-600">Dar lance na Leilomania ↗</a>
              <button type="button" className="btn-outline px-3" onClick={() => setOpen((open! + 1) % items.length)}>›</button>
            </div>
            <p className="mt-2 text-center text-xs text-slate-500">{open! + 1} de {items.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
