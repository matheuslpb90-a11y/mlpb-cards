"use client";

import { useActionState, useState } from "react";
import { saveCardAction } from "@/app/admin/actions";
import { CardImage } from "@/components/CardImage";
import { CardLookup, type LookupResult } from "./CardLookup";

export type CardFormValues = {
  id?: string;
  name: string;
  game: string;
  setName: string;
  number: string;
  rarity: string;
  condition: string;
  language: string;
  price: string;
  stock: number;
  imageUrl: string;
  description: string;
  active: boolean;
};

const CONDITIONS = [
  ["NM", "NM — Near Mint"],
  ["SP", "SP — Slightly Played"],
  ["MP", "MP — Moderately Played"],
  ["HP", "HP — Heavily Played"],
  ["D", "D — Danificada"],
];

export function CardForm({ initial }: { initial: CardFormValues }) {
  const [state, action, pending] = useActionState(saveCardAction, undefined);
  const [v, setV] = useState(initial);
  const bind = (k: keyof CardFormValues) => ({
    name: k,
    value: String(v[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value }),
  });

  function applyLookup(r: LookupResult) {
    setV((prev) => ({
      ...prev,
      name: r.name || prev.name,
      game: "Pokémon",
      setName: r.setName || prev.setName,
      number: r.number || prev.number,
      rarity: r.rarity || prev.rarity,
      imageUrl: r.imageUrl || prev.imageUrl,
    }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="space-y-6">
        <CardLookup onPick={applyLookup} />
        <form action={action} className="card grid gap-3 p-5 sm:grid-cols-2">
          {v.id && <input type="hidden" name="id" value={v.id} />}
          <div className="sm:col-span-2"><label className="label">Nome da carta</label><input className="input" required {...bind("name")} /></div>
          <div><label className="label">Jogo</label>
            <input className="input" list="games" required {...bind("game")} />
            <datalist id="games"><option>Pokémon</option><option>Magic</option><option>Yu-Gi-Oh!</option><option>One Piece</option><option>Lorcana</option><option>Digimon</option></datalist>
          </div>
          <div><label className="label">Coleção</label><input className="input" required {...bind("setName")} /></div>
          <div><label className="label">Número</label><input className="input" placeholder="025/165" {...bind("number")} /></div>
          <div><label className="label">Raridade</label><input className="input" {...bind("rarity")} /></div>
          <div><label className="label">Condição</label>
            <select className="input" {...bind("condition")}>{CONDITIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
          <div><label className="label">Idioma</label>
            <input className="input" list="langs" {...bind("language")} />
            <datalist id="langs"><option>Português</option><option>Inglês</option><option>Japonês</option><option>Espanhol</option></datalist>
          </div>
          <div><label className="label">Preço (R$)</label><input className="input" required inputMode="decimal" placeholder="12,50" {...bind("price")} /></div>
          <div><label className="label">Estoque</label><input className="input" type="number" min={0} required {...bind("stock")} /></div>
          <div className="sm:col-span-2"><label className="label">Link da imagem</label><input className="input" placeholder="https://…" {...bind("imageUrl")} /></div>
          <div className="sm:col-span-2"><label className="label">Descrição / observações</label><textarea className="input min-h-20" {...bind("description")} /></div>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" name="active" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Mostrar no catálogo
          </label>
          {state?.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700 sm:col-span-2">{state.error}</p>}
          <button className="btn-primary sm:col-span-2" disabled={pending}>{pending ? "Salvando…" : "Salvar carta"}</button>
        </form>
      </div>
      <aside className="space-y-2">
        <p className="text-sm font-semibold text-slate-500">Pré-visualização</p>
        <CardImage src={v.imageUrl} alt={v.name} />
      </aside>
    </div>
  );
}
