import Link from "next/link";
import { db } from "@/lib/db";
import { LEILOMANIA_REF_DEFAULT, extImages } from "@/lib/leilomania";
import { ExternalAuctionsEditor } from "./Editor";

export const dynamic = "force-dynamic";

export default async function LeilomaniaAdmin() {
  const [list, profile, refUrl] = await Promise.all([
    db.externalAuction.findMany({ orderBy: { startsAt: "desc" }, take: 100 }),
    db.setting.findUnique({ where: { key: "leilomaniaUrl" } }),
    db.setting.findUnique({ where: { key: "leilomaniaRefUrl" } }),
  ]);
  return (
    <div className="space-y-4">
      <Link href="/admin/leiloes" className="text-sm text-slate-500 hover:text-white">← Leilões</Link>
      <h1 className="text-2xl font-bold">🟣 Leilões na Leilomania</h1>
      <p className="rounded-lg bg-green-950/40 p-3 text-sm text-green-200">✅ <strong>Automático:</strong> seus leilões ativos e agendados na Leilomania (com as fotos das cartas) já aparecem sozinhos no site, puxados da Leilomania a cada 2 minutos. Não precisa cadastrar nada aqui.</p>
      <p className="text-sm text-slate-500">O formulário abaixo é só para casos especiais (ex.: um leilão privado ou de outra conta). Se cadastrar à mão um leilão que já vem automático, o site mostra só um.</p>
      <ExternalAuctionsEditor
        profileUrl={profile?.value ?? ""}
        refUrl={refUrl?.value || LEILOMANIA_REF_DEFAULT}
        items={list.map((a) => ({
          id: a.id, title: a.title, description: a.description, url: a.url, imageUrl: a.imageUrl, images: extImages(a), visible: a.visible,
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
