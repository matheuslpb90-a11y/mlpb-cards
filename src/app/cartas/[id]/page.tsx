import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { CardImage } from "@/components/CardImage";
import { AddToCartButton } from "@/components/AddToCartButton";

export const dynamic = "force-dynamic";

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.card.findUnique({ where: { id } });
  if (!c || !c.active) notFound();

  const rows: [string, string][] = [
    ["Jogo", c.game],
    ["Coleção", c.setName],
    ["Número", c.number],
    ["Raridade", c.rarity],
    ["Condição", c.condition],
    ["Idioma", c.language],
    ["Estoque", c.stock > 0 ? `${c.stock} unidade(s)` : "Esgotada"],
  ];

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-brand hover:underline">← Voltar ao catálogo</Link>
      <div className="card grid gap-6 p-6 md:grid-cols-[320px_1fr]">
        <CardImage src={c.imageUrl} alt={c.name} />
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">{c.name}</h1>
          <p className="text-3xl font-extrabold text-brand">{formatBRL(c.priceCents)}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {rows.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {c.description && <p className="whitespace-pre-line text-slate-700">{c.description}</p>}
          <div className="max-w-xs">
            <AddToCartButton card={{ cardId: c.id, name: c.name, setName: c.setName, priceCents: c.priceCents, imageUrl: c.imageUrl, stock: c.stock }} />
          </div>
        </div>
      </div>
    </div>
  );
}
