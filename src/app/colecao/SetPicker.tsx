"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useMemo, useState } from "react";

type S = { id: string; nameEn: string; namePt: string; total: number; logo: string };

/** Busca de coleções (todas as coleções Pokémon, das mais novas para as mais antigas). */
export function SetPicker({ sets }: { sets: S[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? sets.filter((s) => `${s.nameEn} ${s.namePt} ${s.id}`.toLowerCase().includes(t)) : sets).slice(0, t ? 60 : 24);
  }, [sets, q]);
  if (!sets.length) return <p className="card p-4 text-sm text-slate-500">Não consegui carregar as coleções agora. Tente de novo em instantes.</p>;
  return (
    <div className="space-y-3">
      <input className="input" placeholder="🔎 Buscar coleção (ex.: 151, Evoluções Prismáticas, Base Set…)" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((s) => (
          <Link key={s.id} href={`/colecao/${encodeURIComponent(s.id)}`} className="card flex flex-col items-center gap-2 p-3 text-center hover:border-brand">
            <div className="flex h-12 items-center">{s.logo ? <img src={s.logo} alt="" loading="lazy" className="max-h-12 max-w-[140px] object-contain" /> : <span className="text-2xl">🃏</span>}</div>
            <p className="text-sm font-bold leading-tight">{s.namePt || s.nameEn}</p>
            {s.namePt && s.namePt !== s.nameEn && <p className="-mt-1 text-[11px] text-slate-500">{s.nameEn}</p>}
            <p className="text-[11px] text-slate-500">{s.total} cartas</p>
          </Link>
        ))}
      </div>
      {!q && <p className="text-center text-xs text-slate-500">Mostrando as mais recentes — busque pelo nome para achar qualquer coleção.</p>}
    </div>
  );
}
