import { db } from "@/lib/db";
import { getPointsConfig, monthRanking } from "@/lib/points";
import { LaunchForm, PointAuctionForm, PointsConfigForm, RedemptionButtons } from "./PointsForms";

export const dynamic = "force-dynamic";

const SOURCE: Record<string, string> = {
  COMPRA: "Compra no site", LEILAO: "Leilão (bot)", LEILOMANIA: "Leilomania", JOGO: "Jogo", AVALIACAO: "Avaliação",
  INDICACAO: "Indicação", BONUS: "Bônus caixa R$ 500", RANKING: "Ranking", RESGATE: "Troca", AJUSTE: "Ajuste",
};

export default async function PontosPage() {
  const config = await getPointsConfig();
  const ranking = await monthRanking(10);
  const pending = await db.redemption.findMany({ where: { status: "PENDENTE" }, orderBy: { createdAt: "asc" } });
  const entries = await db.pointEntry.findMany({ orderBy: { createdAt: "desc" }, take: 60 });
  const pAuctions = await db.pointAuction.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { _count: { select: { bids: true } } } });
  const dt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">🪙 MLPB Points</h1>
      <div className="card space-y-1 p-4 text-sm text-slate-500">
        <p>Só <strong>membros do grupo</strong> ganham e trocam pontos. Compras no site e arremates pagos pontuam sozinhos; Leilomania você lança aqui ou no grupo, respondendo a pessoa com <strong>!leilomania 120</strong>.</p>
        <p>No grupo: <strong>!pontos</strong>, <strong>!ranking</strong>, <strong>!premios</strong>, <strong>!trocar 1</strong>.</p>
      </div>

      {pending.length > 0 && (
        <section className="card space-y-2 border-brand p-5">
          <h2 className="text-lg font-bold">🎁 Trocas para entregar ({pending.length})</h2>
          {pending.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded border p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.rewardName} · {r.points} pts</p>
                <p className="text-xs text-slate-500">{r.name || "?"} · +{r.phone} · {dt(r.createdAt)}</p>
              </div>
              <RedemptionButtons id={r.id} />
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-2 p-5 text-sm">
          <h2 className="text-lg font-bold">🏆 Ranking do mês</h2>
          {ranking.length === 0 && <p className="text-slate-500">Ninguém pontuou ainda.</p>}
          {ranking.map((r, i) => (
            <p key={r.phone} className="flex justify-between"><span>{i + 1}. {r.name || `+${r.phone}`}</span><strong>{r.points}</strong></p>
          ))}
        </section>
        <LaunchForm />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PointAuctionForm />
        <section className="card space-y-2 p-5 text-sm">
          <h2 className="text-lg font-bold">Leilões de Pontos recentes</h2>
          {pAuctions.length === 0 && <p className="text-slate-500">Nenhum ainda.</p>}
          {pAuctions.map((a) => (
            <div key={a.id} className="rounded border p-2 text-xs">
              <p className="font-semibold">{a.title}</p>
              <p className="text-slate-500">
                {a.status === "ATIVO" ? `Em andamento · encerra ${dt(a.endsAt)}` : a.winnerPhone ? `Vencedor: ${a.winnerName || `+${a.winnerPhone}`} · ${a.winnerPoints} pts` : "Encerrado sem lances válidos"} · {a._count.bids} lance(s)
              </p>
            </div>
          ))}
        </section>
      </div>

      <PointsConfigForm initial={config} />

      <section className="card space-y-1 p-5 text-xs">
        <h2 className="text-lg font-bold">Extrato (últimos lançamentos)</h2>
        {entries.length === 0 && <p className="text-slate-500">Nada ainda.</p>}
        {entries.map((e) => (
          <p key={e.id} className="flex flex-wrap justify-between gap-2 border-b py-1">
            <span>{dt(e.createdAt)} · {e.name || `+${e.phone}`} · {SOURCE[e.source] ?? e.source}{e.note ? ` · ${e.note}` : ""}</span>
            <strong className={e.points < 0 ? "text-red-300" : "text-green-300"}>{e.points > 0 ? `+${e.points}` : e.points}</strong>
          </p>
        ))}
      </section>
    </div>
  );
}
