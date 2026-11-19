"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { LookupCard } from "@/app/api/admin/buscar-carta/route";

export type LookupResult = { name: string; setName: string; number: string; rarity: string; imageUrl: string };

export function CardLookup({ onPick }: { onPick: (r: LookupResult) => void }) {
  const [q, setQ] = useState("");
  const [num, setNum] = useState("");
  const [results, setResults] = useState<LookupCard[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setStatus("Buscando…");
    setResults([]);
    try {
      const r = await fetch(`/api/admin/buscar-carta?q=${encodeURIComponent(q.trim())}&num=${encodeURIComponent(num.trim())}`);
      const d = (await r.json()) as { results?: LookupCard[]; source?: string; message?: string; error?: string };
      const list = d.results ?? [];
      setResults(list);
      setStatus(list.length ? `${list.length} resultado(s) — fonte: ${d.source}. Clique na carta certa.` : d.message ?? d.error ?? "Nada encontrado.");
    } catch {
      setStatus("Erro de conexão ao buscar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function pick(c: LookupCard) {
    const base = { name: c.name, setName: c.setName, number: c.number, rarity: c.rarity, imageUrl: c.imageLarge };
    onPick(base);
    setStatus("Imagem preenchida! Confira os dados, defina preço e estoque e salve.");
    if (c.source === "tcgdex" && c.tcgdexId) {
      try {
        const r = await fetch(`/api/admin/buscar-carta?tcgdex=${encodeURIComponent(c.tcgdexId)}&lang=${c.lang}`);
        if (r.ok) {
          const d = await r.json();
          onPick({ ...base, name: d.name || base.name, setName: d.setName || base.setName, number: d.number || base.number, rarity: d.rarity || base.rarity });
        }
      } catch {
        /* mantém o que já foi preenchido */
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold">1. Buscar carta Pokémon (preenche imagem e dados)</h2>
      <form onSubmit={search} className="flex flex-wrap gap-2">
        <input className="input min-w-0 flex-1" placeholder="Nome da carta (ex.: Pikachu)" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="input w-28" placeholder="Nº (opcional)" value={num} onChange={(e) => setNum(e.target.value)} />
        <button className="btn-primary" disabled={busy}>{busy ? "Buscando…" : "Buscar"}</button>
      </form>
      {status && <p className="rounded bg-slate-50 p-2 text-sm text-slate-700">{status}</p>}
      {results.length > 0 && (
        <div className="grid max-h-[28rem] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">
          {results.map((c) => (
            <button type="button" key={c.key} onClick={() => pick(c)} className="rounded-lg p-1 text-left hover:bg-brand-light">
              <img src={c.imageSmall} alt={c.name} loading="lazy" className="w-full rounded" />
              <span className="block truncate text-[11px] font-medium">{c.name}</span>
              <span className="block truncate text-[10px] text-slate-500">{c.setName || c.tcgdexId} · {c.number}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
