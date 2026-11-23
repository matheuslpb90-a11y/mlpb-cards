import { CoinIcon } from "@/components/SocialIcons";
import Link from "next/link";
import { getModConfig } from "@/lib/moderation";
import { getPointsConfig } from "@/lib/points";
import { getGamesConfig } from "@/lib/games";
import { getSettings } from "@/lib/settings";
import { freeShippingCents } from "@/lib/free-shipping";
import { leilomaniaLinks } from "@/lib/leilomania";
import { WhatsIcon } from "@/components/SocialIcons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nosso grupo — MLPB Cards", description: "Regras e funcionamento do grupo de WhatsApp da MLPB Cards: leilões por enquete, avaliações, jogos e MLPB Points." };

const DAY = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export default async function GroupPage() {
  const [mod, pts, games, s, free, lm] = await Promise.all([
    getModConfig(),
    getPointsConfig(),
    getGamesConfig(),
    getSettings(),
    freeShippingCents(),
    leilomaniaLinks(),
  ]);
  const P = mod.prefix || "!";
  const cmd = (c: string) => <code className="rounded bg-slate-100 px-1 font-bold text-brand-amber">{P}{c}</code>;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-black">Nosso grupo no WhatsApp</h1>
        <p className="text-slate-600">Leilões por enquete, ofertas, avaliações entre colecionadores, jogos e o programa de pontos MLPB Points.</p>
        {s.whatsappGroupUrl && (
          <a href={s.whatsappGroupUrl} target="_blank" rel="noreferrer" className="btn-primary mt-3"><WhatsIcon /> Entrar no grupo</a>
        )}
      </div>

      <section className="card space-y-2 p-5 text-sm">
        <h2 className="text-xl font-bold">🔨 Como funcionam os leilões</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Cada carta é postada no grupo com foto, valor inicial e arremate, e logo depois vem uma <strong>enquete</strong> com os valores.</li>
          <li>Você vota no valor que quer pagar. Pode mudar o voto até o fim do leilão.</li>
          <li><strong>Vence o maior valor</strong>; em caso de empate, quem votou primeiro.</li>
          <li>Ao encerrar, o vencedor recebe o <strong>invoice no privado</strong> com o link para pagar por Pix ou cartão. Vários invoices em aberto podem ser pagos de uma vez só.</li>
          <li>As cartas pagas ficam na sua <strong>caixa</strong> na loja. Junte compras e arremates e peça o envio quando quiser — frete grátis a partir de R$ {(free / 100).toLocaleString("pt-BR")}.</li>
        </ol>
        <p>Também fazemos leilões na Leilomania — veja em <Link href="/leiloes" className="text-brand underline">Leilões</Link>.
          {lm.refUrl && <> Para participar lá é preciso um cadastro prévio — <a href={lm.refUrl} target="_blank" rel="noreferrer" className="text-purple-300 underline">cadastre-se pelo nosso link ↗</a></>}
        </p>
      </section>

      {mod.rules && (
        <section className="card space-y-2 p-5 text-sm">
          <h2 className="text-xl font-bold">📜 Regras do grupo</h2>
          <p className="whitespace-pre-line">{mod.rules}</p>
          {mod.links.allow ? (
            <p className="text-slate-500">Links de membros: {mod.links.days.length === 7 ? "todos os dias" : mod.links.days.map((d) => DAY[d]).join(", ")}{mod.links.startHour > 0 || mod.links.endHour < 24 ? `, das ${mod.links.startHour}h às ${mod.links.endHour - 1}h59` : ""}. Convites de outros grupos não são permitidos.</p>
          ) : (
            <p className="text-slate-500">Links de membros não são permitidos no grupo.</p>
          )}
          {mod.ads.enabled && <p className="text-slate-500">Anúncios (fotos/vídeos): até {mod.ads.maxPerDay} por dia{mod.ads.maxPhotos ? `, com até ${mod.ads.maxPhotos} fotos cada` : ""}, {mod.ads.days.length === 7 ? "todos os dias" : mod.ads.days.map((d) => DAY[d]).join(", ")}.</p>}
          {mod.warns.max > 0 && <p className="text-slate-500">Quem desrespeitar as regras recebe advertências; com {mod.warns.max}, é removido do grupo.</p>}
        </section>
      )}

      <section className="card space-y-2 p-5 text-sm">
        <h2 className="text-xl font-bold">🤝 Parceiros</h2>
        <p>Donos de outros grupos e lojas parceiras podem divulgar seus links {mod.partners.days.map((d) => DAY[d]).join(", ")}, das {mod.partners.startHour}h às {mod.partners.endHour - 1}h59. Quer ser parceiro? Fale com a loja.</p>
      </section>

      <section className="card space-y-2 p-5 text-sm">
        <h2 className="text-xl font-bold">⭐ Avaliações e referências</h2>
        <p>Antes de negociar com alguém do grupo, consulte a reputação com {cmd("referencias 61999999999")}.</p>
        <p>Para avaliar outro membro por uma venda ou troca, mande {cmd("avaliar 61999999999")}. <strong>Só vale com prova:</strong> o bot pede {mod.reviews.proofs} fotos (print da conversa, comprovante, foto do pacote ou rastreio) antes da nota de 1 a 5. Avaliações falsas são removidas.</p>
        <p>Para avaliar a MLPB não precisa de fotos — e você ainda ganha pontos.</p>
      </section>

      {games.enabled && (
        <section className="card space-y-2 p-5 text-sm">
          <h2 className="text-xl font-bold">🎮 Jogos</h2>
          <p>Ao longo do dia aparecem no grupo: <strong>Quem é esse Pokémon?</strong> (mande o nome), <strong>Adivinhe o preço</strong> (mande o valor) e <strong>Pokébola</strong> (o primeiro a digitar {cmd("captura")} leva). Quem ganha leva MLPB Points, e os Pokémon capturados vão para a sua Pokédex ({cmd("pokedex")}).</p>
        </section>
      )}

      {pts.enabled && (
        <section className="card space-y-2 p-5 text-sm">
          <h2 className="flex items-center gap-2 text-xl font-bold"><CoinIcon className="h-6 w-6 text-brand-amber" /> MLPB Points</h2>
          <p>Compras, indicações, avaliações e jogos dão pontos, que você troca por prêmios na loja. <Link href="/pontos" className="text-brand underline">Veja as regras completas →</Link></p>
        </section>
      )}

      <section className="card space-y-1 p-5 text-sm">
        <h2 className="text-xl font-bold">Comandos do bot</h2>
        <p>{cmd("regras")} regras · {cmd("link")} convite do grupo · {cmd("preco Charizard ex")} preço no Brasil · {cmd("dolar")} cotação</p>
        <p>{cmd("avaliar número")} · {cmd("referencias número")} · {cmd("pontos")} · {cmd("premios")} · {cmd("ranking")} · {cmd("indicado @pessoa")}</p>
        <p>{cmd("help")} lista tudo no próprio grupo.</p>
      </section>
    </div>
  );
}
