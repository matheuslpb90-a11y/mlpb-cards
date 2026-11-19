import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CardForm } from "@/components/admin/CardForm";
import { deleteCardAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.card.findUnique({ where: { id } });
  if (!c) notFound();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{c.kind === "PRODUTO" ? "Editar produto" : "Editar carta"}</h1>
        <form action={deleteCardAction}>
          <input type="hidden" name="id" value={c.id} />
          <button className="btn-danger text-sm">Excluir</button>
        </form>
      </div>
      <CardForm
        initial={{
          id: c.id, kind: c.kind as "CARTA" | "PRODUTO", category: c.category, featured: c.featured, name: c.name, game: c.game, setName: c.setName, number: c.number, rarity: c.rarity, condition: c.condition === "D" ? "DMG" : c.condition, finish: c.finish,
          language: c.language, price: (c.priceCents / 100).toFixed(2).replace(".", ","),
          compareAt: c.compareAtCents ? (c.compareAtCents / 100).toFixed(2).replace(".", ",") : "", stock: c.stock, imageUrl: c.imageUrl,
          description: c.description, active: c.active,
        }}
      />
    </div>
  );
}
