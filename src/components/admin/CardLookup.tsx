"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import type { LookupCard } from "@/app/api/admin/buscar-carta/route";
import { LANGUAGES } from "@/lib/catalog";

export type LookupResult = { name: string; setName: string; number: string; rarity: string; imageUrl: string; language?: string; marketCents?: number | null; marketBasis?: string; marketLink?: string };

// imagens que não abriram (a MYP às vezes tem link sem foto): usa a reserva ou um quadro com o nome
const broken = new Set<string>();
function LookupImage({ c }: { c: LookupCard }) {
  const [src, setSrc] = useState(c.imageSmall);
  if (!src)
    return <div className="flex aspect-[63/88] w-full items-center justify-center rounded bg-slate-100 p-1 text-center text-[11px] text-slate-500">🃏<br />{c.number}</div>;
  return (
    <img
      src={src}
      alt={c.name}
      loading="lazy"
      className="aspect-[63/88] w-full rounded object-cover"
      onError={() => {
        broken.add(src);
        setSrc(src !== c.imageAlt && c.imageAlt && !broken.has(c.imageAlt) ? c.imageAlt : "");
      }}
    />
  );
}

export function CardLookup({ onPick, defaultLanguage }: { onPick: (r: LookupResult) => void; defaultLanguage: string }) {
  const [q, setQ] = useState("");
  const [num, setNum] = useState("");
  const [lang, setLang] = useState(defaultLanguage || "Português");
  const [results, setResults] = useState<LookupCard[]>([]);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [attribution, setAttribution] = useState("");

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return results;
    return results.filter((c) => `${c.name} ${c.setName} ${c.tcgdexId ?? ""} ${c.number}`.toLowerCase().includes(f));
  }, [results, filter]);

  // busca sozinha quando você para de digitar (como na Janet)
  const lastAuto = useRef("");
  useEffect(() => {
    const key = `${q.trim()}|${num.trim()}|${lang}`;
    const ready = q.trim().length >= 3 || (!q.trim() && num.trim().length >= 3);
    if (!ready || key === lastAuto.current) return;
    const t = setTimeout(() => {
      lastAuto.current = key;
      search();
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, num, lang]);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim() && !num.trim()) return setStatus("Digite o nome, o número ou os dois.");
    lastAuto.current = `${q.trim()}|${num.trim()}|${lang}`;
    setBusy(true);
    setStatus("Buscando…");
    setResults([]);
    setFilter("");
    try {
      // só o número → busca pelo código impresso na carta (ex.: 199/165, TG12/TG30, SVP053)
      const r = await fetch(
        q.trim()
          ? `/api/admin/buscar-carta?q=${encodeURIComponent(q.trim())}&num=${encodeURIComponent(num.trim())}&idioma=${encodeURIComponent(lang)}`
          : `/api/admin/buscar-carta?codigo=${encodeURIComponent(num.trim())}&idioma=${encodeURIComponent(lang)}`,
      );
      if (r.status === 401 || r.status === 403) {
        setStatus("Sua sessão expirou. Saia e entre de novo em /entrar e tente outra vez.");
        setBusy(false);
        return;
      }
      const d = (await r.json()) as { results?: LookupCard[]; source?: string; message?: string; error?: string; attribution?: string; warning?: string };
      const list = d.results ?? [];
      setResults(list);
      setAttribution(d.attribution ?? "");
      setStatus(
        (list.length ? `${list.length} resultado(s) — ${d.source}. Clique na carta certa.` : d.message ?? d.error ?? "Nada encontrado.") +
          (d.warning ? ` (${d.warning})` : ""),
      );
    } catch {
      setStatus("Erro de conexão ao buscar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function pick(c: LookupCard) {
    const img = broken.has(c.imageLarge) ? (c.imageAlt && !broken.has(c.imageAlt) ? c.imageAlt : "") : c.imageLarge;
    const base = { name: c.name, setName: c.setName, number: c.number, rarity: c.rarity, imageUrl: img, language: lang, marketCents: c.priceCents ?? undefined, marketBasis: c.priceBasis, marketLink: c.link };
    onPick(base);
    setStatus("Imagem preenchida! Confira os dados, escolha o estado, defina preço e estoque e salve.");
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
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold">1. Buscar carta Pokémon (preenche imagem e dados)</h2>
      <form onSubmit={search} className="flex flex-wrap gap-2">
        <input className="input min-w-0 flex-1" placeholder="Nome (ex.: Charizard ex)" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="input w-28" placeholder="Nº (ex.: 199/165)" value={num} onChange={(e) => setNum(e.target.value)} />
        <select className="input w-40" value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.flag} {l.value}</option>)}
        </select>
        <button className="btn-primary" disabled={busy}>{busy ? "Buscando…" : "Buscar"}</button>
      </form>
      <p className="text-xs text-slate-500">Busque pelo nome, pelo número impresso na carta (ex.: 199/165, TG12/TG30, SVP053) ou pelos dois — com os dois, aparece a impressão exata.</p>
      {status && <p className="rounded bg-slate-50 p-2 text-sm text-slate-700">{status}</p>}
      {attribution && (
        <p className="text-xs text-slate-500">
          Preços em R$ do mercado brasileiro: <a href="https://mypcards.com" target="_blank" rel="noreferrer" className="text-brand underline">MYP Cards</a>
        </p>
      )}
      {results.length > 12 && (
        <input className="input" placeholder="Filtrar resultados por coleção, código ou número…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      )}
      {shown.length > 0 && (
        <div className="grid max-h-[32rem] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">
          {shown.map((c) => (
            <button type="button" key={c.key} onClick={() => pick(c)} className="rounded-lg p-1 text-left hover:bg-brand-light">
              <LookupImage c={c} />
              <span className="block truncate text-[11px] font-medium">{c.name}</span>
              <span className="block truncate text-[10px] text-slate-500">{c.setName || c.tcgdexId} · {c.number}{c.source === "myp" || (c.lang && c.lang !== "en") ? "" : " · img EN"}</span>
              {c.source === "myp" && (
                <span className="block truncate text-[11px] font-bold text-green-300">{c.priceCents ? `R$ ${(c.priceCents / 100).toFixed(2).replace(".", ",")}` : "sem oferta"} · MYP</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
