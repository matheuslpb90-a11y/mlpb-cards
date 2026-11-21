"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";

/** Foto principal + miniaturas; tocar na foto abre em tela cheia com setas. */
export function PhotoGallery({ images, className = "" }: { images: string[]; className?: string }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const n = images.length;
  const go = (d: number) => setI((x) => (x + d + n) % n);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => (e.key === "Escape" ? setOpen(false) : e.key === "ArrowRight" ? go(1) : e.key === "ArrowLeft" ? go(-1) : null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  if (!n) return null;
  return (
    <div className={className}>
      <button type="button" onClick={() => setOpen(true)} className="relative block w-full overflow-hidden rounded-lg bg-black/40">
        <img src={images[i]} alt="" className="aspect-square w-full object-contain" />
        {n > 1 && <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 text-xs">{i + 1}/{n}</span>}
      </button>
      {n > 1 && (
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {images.map((u, j) => (
            <button key={u + j} type="button" onClick={() => setI(j)} className={`shrink-0 overflow-hidden rounded ${j === i ? "ring-2 ring-purple-400" : "opacity-60 hover:opacity-100"}`}>
              <img src={u} alt="" className="h-10 w-10 object-cover" />
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(false)}>
          <img src={images[i]} alt="" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="absolute right-4 top-4 text-3xl" onClick={() => setOpen(false)}>✕</button>
          {n > 1 && (
            <>
              <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-2 text-3xl" onClick={(e) => { e.stopPropagation(); go(-1); }}>‹</button>
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-2 text-3xl" onClick={(e) => { e.stopPropagation(); go(1); }}>›</button>
              <span className="absolute bottom-4 text-sm">{i + 1} / {n}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
