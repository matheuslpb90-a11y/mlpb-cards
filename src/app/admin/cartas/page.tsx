import Link from "next/link";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { CardImage } from "@/components/CardImage";
import { toggleCardAction } from "../actions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminCards({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  const where: Prisma.CardWhereInput = {};
  if (q) where.OR = [{ name: { contains: q } }, { setName: { contains: q } }, { number: { contains: q } }];
  if (status === "inativas") where.active = false;
  else if (status === "esgotadas") Object.assign(where, { active: true, stock: 0 });
  else if (status !== "todas") where.active = true;

  const cards = await db.card.findMany({ where, orderBy: { updatedAt: "desc" }, take: 500 });

  return (
    <div className="space-y-4">
      <form className="card flex flex-wrap gap-2 p-3">
        <input name="q" defaultValue={q} placeholder="Buscar…" className="input max-w-xs" />
        <select name="status" defaultValue={status ?? ""} className="input max-w-[200px]">
          <option value="">No catálogo</option>
          <option value="inativas">Fora do catálogo</option>
          <option value="esgotadas">Esgotadas</option>
          <option value="todas">Todas</option>
        </select>
        <button className="btn-outline">Filtrar</button>
        <Link href="/admin/cartas/nova" className="btn-primary ml-auto">+ Nova carta</Link>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr><th className="p-2"></th><th className="p-2">Carta</th><th className="p-2">Preço</th><th className="p-2">Estoque</th><th className="p-2">Status</th><th className="p-2"></th></tr>
          </thead>
          <tbody className="divide-y">
            {cards.map((c) => (
              <tr key={c.id}>
                <td className="w-12 p-2"><CardImage src={c.imageUrl} alt={c.name} /></td>
                <td className="p-2">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.game} · {c.setName}{c.number ? ` #${c.number}` : ""} · {c.condition}</p>
                </td>
                <td className="p-2">{formatBRL(c.priceCents)}</td>
                <td className="p-2">{c.stock}</td>
                <td className="p-2">{c.active ? <span className="text-green-700">No catálogo</span> : <span className="text-slate-400">Retirada</span>}</td>
                <td className="whitespace-nowrap p-2 text-right">
                  <Link href={`/admin/cartas/${c.id}`} className="btn-outline px-3 py-1 text-xs">Editar</Link>{" "}
                  <form action={toggleCardAction} className="inline">
                    <input type="hidden" name="id" value={c.id} />
                    <button className="btn-outline px-3 py-1 text-xs">{c.active ? "Retirar do catálogo" : "Voltar ao catálogo"}</button>
                  </form>
                </td>
              </tr>
            ))}
            {cards.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Nenhuma carta.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
