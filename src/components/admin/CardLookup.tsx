"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

// Busca de cartas Pokémon na TCGdex (https://tcgdex.dev) — API aberta e gratuita,
// com nomes em português. A consulta é feita direto do navegador do administrador.
const API = "https://api.tcgdex.net/v2";
const LANGS = ["pt-br", "pt", "en"];

export type LookupResult = { name: string; setName: string; number: string; rarity: string; imageUrl: string };

type Brief = { id: string; localId: string; name: string; image?: string; lang: string };

export function CardLookup({ onPick }: { onPick: (r: LookupResult) => void }) {
  const [q, setQ] = useState("");
  const [num, setNum] = useState("");
  const [results, setResults] = useState<Brief[]>([]);
  const [status, setStatus] = useState("");

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setStatus("Buscando…");
    setResults([]);
    for (const lang of LANGS) {
      try {
        const r = await fetch(`${API}/${lang}/cards?name=${encodeURIComponent(q.trim())}`);
        if (!r.ok) continue;
        const data = (await r.json()) as Omit<Brief, "lang">[];
        let list = Array.isArray(data) ? data.filter((c) => c.image) : [];
        if (num.trim()) list = list.filter((c) => c.localId.replace(/^0+/, "") === num.trim().split("/")[0].replace(/^0+/, ""));
        if (list.length) {
          setResults(list.slice(0, 60).map((c) => ({ ...c, lang })));
          setStatus(`${list.length} resultado(s)${lang === "en" ? " (em inglês)" : ""}. Clique na carta certa.`);
          return;
        }
      } catch {
        /* tenta o próximo idioma */
      }
    }
    setStatus("Nada encontrado. Confira o nome ou preencha manualmente.");
  }

  async function pick(c: Brief) {
    setStatus("Carregando detalhes…");
    try {
      const r = await fetch(`${API}/${c.lang}/cards/${encodeURIComponent(c.id)}`);
      const d = await r.json();
      const total = d?.set?.cardCount?.official;
      onPick({
        name: d.name ?? c.name,
        setName: d?.set?.name ?? "",
        number: total ? `${c.localId}/${total}` : c.localId,
        rarity: d.rarity ?? "",
        imageUrl: `${c.image}/high.webp`,
      });
      setStatus("Dados preenchidos! Confira, defina preço/estoque e salve.");
    } catch {
      onPick({ name: c.name, setName: "", number: c.localId, rarity: "", imageUrl: `${c.image}/high.webp` });
      setStatus("Imagem preenchida. Complete os outros dados.");
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold">Buscar carta Pokémon (preenche imagem e dados)</h2>
      <form onSubmit={search} className="flex flex-wrap gap-2">
        <input className="input flex-1" placeholder="Nome da carta (ex.: Charizard ex)" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="input w-28" placeholder="Nº (opcional)" value={num} onChange={(e) => setNum(e.target.value)} />
        <button className="btn-outline">Buscar</button>
      </form>
      {status && <p className="text-sm text-slate-500">{status}</p>}
      {results.length > 0 && (
        <div className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5 lg:grid-cols-6">
          {results.map((c) => (
            <button type="button" key={`${c.lang}-${c.id}`} onClick={() => pick(c)} className="rounded-lg p-1 text-left hover:bg-brand-light" title={c.id}>
              <img src={`${c.image}/low.webp`} alt={c.name} loading="lazy" className="w-full rounded" />
              <span className="block truncate text-[11px]">{c.name} · {c.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
