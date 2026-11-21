import Link from "next/link";
import { db } from "@/lib/db";
import { ExternalAuctionsEditor } from "./Editor";

export const dynamic = "force-dynamic";

export default async function LeilomaniaAdmin() {
  const [list, profile] = await Promise.all([
    db.externalAuction.findMany({ orderBy: { startsAt: "desc" }, take: 100 }),
    db.setting.findUnique({ where: { key: "leilomaniaUrl" } }),
  ]);
  return (
    <div className="space-y-4">
      <Link href="/admin/leiloes" className="text-sm text-slate-500 hover:text-white">← Leilões</Link>
      <h1 className="text-2xl font-bold">🟣 Leilões na Leilomania</h1>
      <p className="text-sm text-slate-500">Cadastre aqui os leilões que você faz na Leilomania. Eles aparecem na aba <strong>Leilões</strong> do site, junto com os do WhatsApp, com o botão para participar lá.</p>
      <ExternalAuctionsEditor
        profileUrl={profile?.value ?? ""}
        items={list.map((a) => ({
          id: a.id, title: a.title, description: a.description, url: a.url, imageUrl: a.imageUrl, visible: a.visible,
          startsAt: toLocal(a.startsAt), endsAt: toLocal(a.endsAt),
        }))}
      />
    </div>
  );
}

/** Data para o campo datetime-local, no horário de Brasília. */
function toLocal(d: Date) {
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
  return p.replace(" ", "T");
}
