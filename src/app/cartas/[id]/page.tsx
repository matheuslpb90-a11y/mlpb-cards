import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CardImage } from "@/components/CardImage";
import { AddToCartButton } from "@/components/AddToCartButton";
import { languageFlag } from "@/lib/catalog";
import { formatBRL } from "@/lib/money";
import { Offers } from "./Offers";

export const dynamic = "force-dynamic";

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.card.findUnique({ where: { id } });
  if (!c || !c.active) notFound();
  const isCard = c.kind === "CARTA";

  const back = (
    <Link href={`/catalogo?tipo=${isCard ? "cartas" : "selados"}`} className="text-2xl text-slate-600 hover:text-white" aria-label="Voltar">←</Link>
  );

  if (!isCard) {
    return (
      <div className="card grid gap-8 overflow-hidden md:grid-cols-[minmax(260px,380px)_1fr]">
        <div className="space-y-4 bg-slate-100 p-6">
          {back}
          <CardImage src={c.imageUrl} alt={c.name} className="object-contain bg-white" />
        </div>
        <div className="space-y-5 p-6">
          <h1 className="text-3xl font-bold">{c.name}</h1>
          <div className="flex flex-wrap gap-2 text-sm">
            {c.category && <span className="rounded bg-slate-100 px-2 py-1">📦 {c.category}</span>}
            {c.setName && c.setName !== "—" && <span className="rounded bg-slate-100 px-2 py-1">{c.setName}</span>}
            <span className="rounded bg-slate-100 px-2 py-1">{languageFlag(c.language)} {c.language}</span>
          </div>
          <p className="text-4xl font-extrabold text-brand">{formatBRL(c.priceCents)}</p>
          <p className="text-sm text-slate-500">{c.stock > 0 ? `${c.stock} unidade(s) disponível(is)` : "Esgotado"}</p>
          {c.description && <p className="whitespace-pre-line text-slate-700">{c.description}</p>}
          <div className="max-w-xs">
            <AddToCartButton card={{ cardId: c.id, name: c.name, setName: c.category, priceCents: c.priceCents, imageUrl: c.imageUrl, stock: c.stock }} />
          </div>
        </div>
      </div>
    );
  }

  // Todas as versões em estoque da mesma carta (mesma coleção e número), em estados/idiomas diferentes
  const variants = await db.card.findMany({
    where: { active: true, kind: "CARTA", name: c.name, setName: c.setName, number: c.number },
    orderBy: [{ priceCents: "asc" }],
  });
  const available = variants.filter((v) => v.stock > 0);

  return (
    <div className="card grid overflow-hidden md:grid-cols-[minmax(260px,400px)_1fr]">
      <div className="space-y-4 bg-slate-100 p-6">
        {back}
        <CardImage src={c.imageUrl} alt={c.name} className="shadow-[0_0_50px_-12px_rgba(255,122,0,0.6)]" />
      </div>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold leading-tight">
            {c.name} {c.number && <span className="font-medium text-slate-500">({c.number})</span>}
          </h1>
          <p className="mt-1 text-slate-500">
            {c.setName}{c.rarity ? ` · ${c.rarity}` : ""}{c.game ? ` · ${c.game}` : ""}
          </p>
        </div>
        <Offers
          initialId={c.id}
          offers={variants.map((v) => ({
            id: v.id,
            name: v.name,
            setName: v.setName,
            condition: v.condition === "D" ? "DMG" : v.condition,
            finish: v.finish,
            language: v.language,
            priceCents: v.priceCents,
            compareAtCents: v.compareAtCents,
            stock: v.stock,
            imageUrl: v.imageUrl,
            description: v.description,
          }))}
        />
        {available.length === 0 && <p className="text-sm text-slate-500">Esta carta está esgotada no momento. Fale com a gente no WhatsApp para encomendar.</p>}
      </div>
    </div>
  );
}
