import { db } from "@/lib/db";
import { getGamesConfig } from "@/lib/games";
import { GamesForm } from "./GamesForm";

export const dynamic = "force-dynamic";
const LABEL: Record<string, string> = { POKEMON: "❓ Quem é esse Pokémon?", PRECO: "💰 Adivinhe o preço", POKEBOLA: "🔴 Pokébola" };

export default async function JogosPage() {
  const config = await getGamesConfig();
  const rounds = await db.gameRound.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  const referrals = await db.referral.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  const dex = await db.capture.groupBy({ by: ["phone"], _count: true, orderBy: { _count: { phone: "desc" } }, take: 10 });
  const dt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">🎮 Jogos e indicações</h1>
      <div className="card space-y-1 p-4 text-sm text-slate-500">
        <p>Os jogos aparecem sozinhos no grupo do leilão, em horários aleatórios dentro da janela abaixo. Os pontos respeitam o limite diário de jogos do MLPB Points.</p>
        <p>Precisa da <strong>Moderação ligada</strong> (é ela que lê as respostas) e do <strong>MLPB Points ligado</strong> (para dar pontos). No grupo, um admin também pode começar na hora com <strong>!jogo pokemon</strong>, <strong>!jogo preco</strong> ou <strong>!jogo pokebola</strong>.</p>
      </div>
      <GamesForm initial={config} />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-1 p-5 text-xs">
          <h2 className="text-lg font-bold">Últimas rodadas</h2>
          {rounds.length === 0 && <p className="text-slate-500">Nenhuma ainda.</p>}
          {rounds.map((r) => (
            <p key={r.id} className="border-b py-1">
              {dt(r.createdAt)} · {LABEL[r.type]} · {r.type === "PRECO" ? (JSON.parse(r.dataJson) as { name: string }).name : r.type === "POKEBOLA" ? (JSON.parse(r.dataJson) as { name: string }).name : r.answer} ·{" "}
              {r.status === "ATIVO" ? "rolando" : r.winnerPhone ? `🏆 ${r.winnerName || `+${r.winnerPhone}`}` : "sem vencedor"}
            </p>
          ))}
        </section>
        <section className="card space-y-1 p-5 text-xs">
          <h2 className="text-lg font-bold">🤝 Indicações</h2>
          {referrals.length === 0 && <p className="text-slate-500">Nenhuma ainda. Quem entra no grupo manda <strong>!indicado @amigo</strong>.</p>}
          {referrals.map((r) => (
            <p key={r.id} className="border-b py-1">
              {dt(r.createdAt)} · {r.newName || `+${r.newPhone}`} ← indicado por +{r.referrerPhone} · {r.purchasePaid ? "✅ comprou" : r.stayPaid ? "✅ 7 dias" : "aguardando 7 dias"}
            </p>
          ))}
          <h3 className="pt-3 text-sm font-bold">📕 Maiores Pokédex</h3>
          {dex.map((d) => <p key={d.phone}>+{d.phone}: {d._count} capturas</p>)}
        </section>
      </div>
    </div>
  );
}
