import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { CardImage } from "@/components/CardImage";
import { AddToCartButton } from "@/components/AddToCartButton";
import { CONDITIONS, conditionShort, languageFlag } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.card.findUnique({ where: { id } });
  if (!c || !c.active) notFound();

  const isCard = c.kind === "CARTA";
  const cond = CONDITIONS.find((x) => x.value === conditionShort(c.condition));
  const rows: [string, string][] = isCard
    ? [
        ["Jogo", c.game],
        ["Coleção", c.setName],
        ["Número", c.number],
        ["Raridade", c.rarity],
        ["Estado", cond?.label ?? c.condition],
        ["Idioma", `${languageFlag(c.language)} ${c.language}`],
        ["Estoque", c.stock > 0 ? `${c.stock} unidade(s)` : "Esgotada"],
      ]
    : [
        ["Categoria", c.category],
        ["Coleção", c.setName === "—" ? "" : c.setName],
        ["Idioma", `${languageFlag(c.language)} ${c.language}`],
        ["Estoque", c.stock > 0 ? `${c.stock} unidade(s)` : "Esgotado"],
      ];

  return (
    <div className="space-y-4">
      <Link href={`/catalogo?tipo=${isCard ? "cartas" : "selados"}`} className="text-sm text-brand hover:underline">← Voltar para {isCard ? "cartas avulsas" : "selados"}</Link>
      <div className="card grid gap-6 p-6 md:grid-cols-[320px_1fr]">
        <CardImage src={c.imageUrl} alt={c.name} className={isCard ? "" : "object-contain bg-panel"} />
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
            <AddToCartButton card={{ cardId: c.id, name: c.name, setName: isCard ? c.setName : c.category, priceCents: c.priceCents, imageUrl: c.imageUrl, stock: c.stock }} />
          </div>
        </div>
      </div>
    </div>
  );
}
