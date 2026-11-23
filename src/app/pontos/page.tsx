import { CoinIcon } from "@/components/SocialIcons";
import Link from "next/link";
import { getPointsConfig } from "@/lib/points";
import { getGamesConfig } from "@/lib/games";
import { getModConfig } from "@/lib/moderation";
import { getSettings } from "@/lib/settings";
import { WhatsIcon } from "@/components/SocialIcons";
import { freeShippingCents } from "@/lib/free-shipping";

export const dynamic = "force-dynamic";
export const metadata = { title: "MLPB Points — MLPB Cards", description: "Como ganhar e trocar pontos no grupo da MLPB Cards." };

const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;

export default async function PointsPage() {
  const [p, g, mod, s, free] = await Promise.all([getPointsConfig(), getGamesConfig(), getModConfig(), getSettings(), freeShippingCents()]);
  const P = mod.prefix || "!";
  const earn: [string, string][] = [
    ["🛒 Compras no site, nos leilões do grupo e na Leilomania", `${p.perReal} ponto${p.perReal === 1 ? "" : "s"} a cada R$ 1`],
    ...(p.boxBonus ? ([[`📦 Sua caixa chegou no frete grátis (${brl(free / 100)})`, `+${p.boxBonus} pontos`]] as [string, string][]) : []),
    ...(p.reviewPoints ? ([["⭐ Avaliar a MLPB (1ª vez)", `+${p.reviewPoints} pontos${p.reviewRepeatPoints ? ` · reavaliações +${p.reviewRepeatPoints} (1x por dia)` : ""}`]] as [string, string][]) : []),
    ...(p.referralStay ? ([["🤝 Indicou um amigo que ficou 7 dias no grupo", `+${p.referralStay} pontos`]] as [string, string][]) : []),
    ...(p.referralPurchase ? ([["💸 Seu indicado fez a 1ª compra", `+${p.referralPurchase} pontos`]] as [string, string][]) : []),
    ...(g.enabled
      ? ([
          ["❓ Quem é esse Pokémon? (acertar primeiro)", `+${g.pokemon.points}`],
          ["💰 Adivinhe o preço (chute mais perto)", `+${g.preco.points}`],
          ["🔴 Pokébola (capturar primeiro)", `+${g.pokebola.points} · shiny ✨ +${g.pokebola.shinyPoints}`],
        ] as [string, string][])
      : []),
    ...(p.ranking.some(Boolean) ? ([["🏆 Top 3 do ranking do mês", p.ranking.map((v) => `+${v}`).join(" / ")]] as [string, string][]) : []),
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-black"><CoinIcon className="h-8 w-8 text-brand-amber" /> MLPB Points</h1>
        <p className="text-slate-600">Quem participa do nosso grupo do WhatsApp acumula pontos e troca por prêmios na loja.</p>
        {!p.enabled && <p className="mt-2 rounded bg-amber-950/50 p-2 text-sm text-amber-300">O programa ainda vai começar — em breve!</p>}
      </div>

      <section className="card space-y-2 p-5">
        <h2 className="text-xl font-bold">Como ganhar pontos</h2>
        {earn.map(([a, b]) => (
          <div key={a} className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm last:border-0">
            <span>{a}</span>
            <strong className="text-brand-amber">{b}</strong>
          </div>
        ))}
        <p className="text-xs text-slate-500">Jogos: no máximo {p.gameDailyCap} pontos por dia por pessoa (o shiny não entra nesse limite).</p>
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="text-xl font-bold">🎁 Prêmios</h2>
        {p.rewards.map((r, i) => (
          <div key={r.key} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0">
            <span>{i + 1}. {r.name}</span>
            <span className="text-right">
              <strong className="text-brand-amber">{r.points.toLocaleString("pt-BR")} pts</strong>
              {r.minSpend ? <span className="block text-xs text-slate-500">exige {brl(r.minSpend)} em compras nos últimos {p.spendWindowDays} dias</span> : null}
            </span>
          </div>
        ))}
        <p className="text-xs text-slate-500">Os prêmios em cartas vão para a sua caixa na loja e seguem junto no seu próximo envio. Toda troca é conferida pela loja.</p>
        <p className="text-sm">🔨 De vez em quando rola o <strong>Leilão de Pontos</strong>: um leilão por enquete no grupo onde o lance é em pontos{p.auctionMinSpend ? ` (para levar, é preciso ter comprado ${brl(p.auctionMinSpend)} nos últimos ${p.spendWindowDays} dias)` : ""}.</p>
      </section>

      <section className="card space-y-2 p-5 text-sm">
        <h2 className="text-xl font-bold">Regras importantes</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Só <strong>membros do grupo</strong> ganham e trocam pontos. Quem sair do grupo fica com os pontos congelados.</li>
          {p.expiryDays > 0 && <li>Os pontos valem <strong>{p.expiryDays} dias</strong> a partir do dia em que foram ganhos. O bot avisa no privado 7 dias antes de vencer.</li>}
          <li>Pontos de compra entram quando o pagamento é confirmado.</li>
          <li>A loja pode recusar trocas fora das regras (os pontos voltam para você).</li>
        </ul>
      </section>

      <section className="card space-y-1 p-5 text-sm">
        <h2 className="text-xl font-bold">Comandos no grupo</h2>
        {[
          [`${P}pontos`, "seu saldo e quando seus pontos vencem"],
          [`${P}ranking`, "ranking do mês"],
          [`${P}premios`, "lista de prêmios"],
          [`${P}trocar 1`, "troca pelo prêmio 1 (e assim por diante)"],
          [`${P}pokedex`, "seus Pokémon capturados"],
          [`${P}indicado @pessoa`, "diga quem te convidou (até 7 dias depois de entrar)"],
          [`${P}indicacoes`, "quantas pessoas você trouxe"],
        ].map(([c, d]) => (
          <p key={c}><code className="rounded bg-slate-100 px-1 font-bold text-brand-amber">{c}</code> — {d}</p>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        {s.whatsappGroupUrl && <a href={s.whatsappGroupUrl} target="_blank" rel="noreferrer" className="btn-primary"><WhatsIcon /> Entrar no grupo</a>}
        <Link href="/grupo" className="btn-outline">Como funciona o grupo</Link>
      </div>
    </div>
  );
}
