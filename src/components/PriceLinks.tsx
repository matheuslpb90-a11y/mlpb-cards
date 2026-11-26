import { priceLinks } from "@/lib/price-links";

const BANDEIRA: Record<string, string> = { BR: "🇧🇷", US: "🇺🇸", EU: "🇪🇺" };

// Links para o cliente conferir o preço da carta em outros mercados (Brasil e mundo).
// Só âncoras e CSS — nenhum JavaScript, nenhuma chamada externa: não pesa no site.
export function PriceLinks({ name, number, promo = false }: { name: string; number?: string; promo?: boolean }) {
  if (!name) return null;
  const links = priceLinks(name, number, promo);
  return (
    <div className="rounded-xl border border-slate-800 bg-panel/60 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Conferir preço de mercado</p>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.nome}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="group inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-brand hover:text-white"
          >
            <span aria-hidden>{BANDEIRA[l.regiao]}</span>
            {l.nome}
            <span className="text-slate-500 group-hover:text-brand">{l.moeda}</span>
            <span aria-hidden className="text-slate-600 group-hover:text-brand">↗</span>
          </a>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-600">Preços de referência de outros sites, abrem em nova aba. O valor da MLPB é o acima.</p>
    </div>
  );
}
