"use client";

import { useActionState, useState } from "react";
import { saveCardAction, uploadImageAction } from "@/app/admin/actions";
import { CardImage } from "@/components/CardImage";
import { CONDITIONS, LANGUAGES, PRODUCT_CATEGORIES } from "@/lib/catalog";
import { CardLookup, type LookupResult } from "./CardLookup";

export type CardFormValues = {
  id?: string;
  kind: "CARTA" | "PRODUTO";
  category: string;
  featured: boolean;
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

/** Reduz a foto no navegador (máx. 1000px, JPEG) antes de enviar. */
async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function CardForm({ initial }: { initial: CardFormValues }) {
  const [state, action, pending] = useActionState(saveCardAction, undefined);
  const [v, setV] = useState(initial);
  const [uploading, setUploading] = useState("");
  const isCard = v.kind === "CARTA";

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
      language: r.language || prev.language,
    }));
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("Enviando foto…");
    try {
      const res = await uploadImageAction(await shrinkImage(file));
      if (res.url) {
        setV((prev) => ({ ...prev, imageUrl: res.url! }));
        setUploading("Foto enviada ✓");
      } else setUploading(res.error ?? "Não foi possível enviar a foto.");
    } catch {
      setUploading("Não foi possível ler essa imagem. Tente JPG ou PNG.");
    }
    e.target.value = "";
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
      <div className="space-y-6">
        {isCard && <CardLookup onPick={applyLookup} defaultLanguage={v.language} />}
        <form action={action} className="card grid gap-3 p-5 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">{isCard ? "2. Dados da carta" : "Dados do produto"}</h2>
          {v.id && <input type="hidden" name="id" value={v.id} />}
          <input type="hidden" name="kind" value={v.kind} />
          <input type="hidden" name="game" value={v.game || "Pokémon"} />

          <div className="sm:col-span-2"><label className="label">{isCard ? "Nome da carta" : "Nome do produto"}</label><input className="input" required {...bind("name")} /></div>

          {isCard ? (
            <>
              <div><label className="label">Coleção</label><input className="input" required {...bind("setName")} /></div>
              <div><label className="label">Número</label><input className="input" placeholder="025/165" {...bind("number")} /></div>
              <div><label className="label">Raridade</label><input className="input" {...bind("rarity")} /></div>
              <div><label className="label">Estado</label>
                <select className="input" {...bind("condition")}>{CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
              </div>
            </>
          ) : (
            <>
              <div><label className="label">Categoria</label>
                <select className="input" required {...bind("category")}>
                  <option value="">Escolha…</option>
                  {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">Coleção (opcional)</label><input className="input" {...bind("setName")} /></div>
            </>
          )}

          <div><label className="label">Idioma</label>
            <select className="input" {...bind("language")}>{LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.flag} {l.value}</option>)}</select>
          </div>
          <div><label className="label">Preço (R$)</label><input className="input" required inputMode="decimal" placeholder="12,50" {...bind("price")} /></div>
          <div><label className="label">Estoque</label><input className="input" type="number" min={0} required {...bind("stock")} /></div>

          <div className="space-y-2 sm:col-span-2">
            <label className="label">Imagem</label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="btn-outline cursor-pointer text-sm">
                📷 Enviar foto
                <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
              </label>
              {uploading && <span className="text-sm text-slate-600">{uploading}</span>}
            </div>
            <input className="input" placeholder="…ou cole o link de uma imagem (https://…)" {...bind("imageUrl")} />
          </div>

          <div className="sm:col-span-2"><label className="label">Descrição / observações</label><textarea className="input min-h-20" {...bind("description")} /></div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="active" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Mostrar no site
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="featured" checked={v.featured} onChange={(e) => setV({ ...v, featured: e.target.checked })} /> ⭐ Destaque na tela de início
          </label>
          {state?.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700 sm:col-span-2">{state.error}</p>}
          <button className="btn-primary sm:col-span-2" disabled={pending || uploading === "Enviando foto…"}>
            {pending ? "Salvando…" : isCard ? "Salvar carta" : "Salvar produto"}
          </button>
        </form>
      </div>
      <aside className="order-first space-y-2 lg:order-none">
        <p className="text-sm font-semibold text-slate-500">Pré-visualização</p>
        <div className="mx-auto w-40 lg:w-full"><CardImage src={v.imageUrl} alt={v.name} className={isCard ? "" : "object-contain bg-white"} /></div>
      </aside>
    </div>
  );
}
