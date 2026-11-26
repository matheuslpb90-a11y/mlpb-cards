import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { listSets } from "@/lib/tcgdex-sets";
import { SetPicker } from "./SetPicker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Minha coleção Pokémon — MLPB Cards", description: "Catalogue grátis sua coleção de cartas Pokémon: todas as coleções, progresso e lista de desejos." };

export default async function CollectionHome() {
  const user = await getCurrentUser();
  const sets = await listSets().catch(() => []);
  let mine: { set: (typeof sets)[number]; have: number; wish: number }[] = [];
  if (user) {
    const grouped = await db.collectionEntry.groupBy({ by: ["setId"], where: { userId: user.id, qty: { gt: 0 } }, _count: true });
    const wishes = await db.collectionEntry.groupBy({ by: ["setId"], where: { userId: user.id, wish: true }, _count: true });
    const ids = new Set([...grouped.map((g) => g.setId), ...wishes.map((g) => g.setId)]);
    mine = sets
      .filter((s) => ids.has(s.id))
      .map((s) => ({ set: s, have: grouped.find((g) => g.setId === s.id)?._count ?? 0, wish: wishes.find((g) => g.setId === s.id)?._count ?? 0 }))
      .sort((a, b) => b.have / (b.set.total || 1) - a.have / (a.set.total || 1));
  }
  const totalCards = mine.reduce((s, m) => s + m.have, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">📚 Minha coleção</h1>
        <p className="text-slate-600">Catalogue suas cartas Pokémon de <strong>todas as coleções</strong>, veja quanto falta para completar e monte sua lista de desejos. Grátis.</p>
      </div>

      {!user && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-brand/50 p-5">
          <p>Para salvar sua coleção, entre ou crie sua conta (é grátis). Você pode navegar pelas coleções mesmo sem conta.</p>
          <div className="flex gap-2">
            <Link href="/entrar?next=/colecao" className="btn-primary">Entrar</Link>
            <Link href="/cadastro?next=/colecao" className="btn-outline">Criar conta</Link>
          </div>
        </div>
      )}

      {user && mine.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Suas coleções <span className="text-sm font-normal text-slate-500">· {totalCards} cartas diferentes</span></h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map(({ set, have, wish }) => {
              const pct = Math.min(100, Math.round((have / (set.official || set.total || 1)) * 100));
              return (
                <Link key={set.id} href={`/colecao/${encodeURIComponent(set.id)}`} className="card space-y-2 p-4 hover:border-brand">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold leading-tight">{set.namePt || set.nameEn}</p>
                    <span className="text-sm font-black text-brand">{pct}%</span>
                  </div>
                  {set.namePt && set.namePt !== set.nameEn && <p className="text-xs text-slate-500">{set.nameEn}</p>}
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-gradient-to-r from-brand-amber to-brand" style={{ width: `${pct}%` }} /></div>
                  <p className="text-xs text-slate-500">{have} de {set.official || set.total}{set.total > set.official ? ` (+${set.total - set.official} secretas)` : ""}{wish ? ` · ❤️ ${wish} desejadas` : ""}</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">{user && mine.length ? "Adicionar outra coleção" : "Escolha uma coleção"}</h2>
        <SetPicker sets={sets.map((s) => ({ id: s.id, nameEn: s.nameEn, namePt: s.namePt, total: s.total, logo: s.logo }))} />
      </section>
    </div>
  );
}
