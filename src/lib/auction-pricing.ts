// Fórmulas de preço dos lotes (usado no painel e no servidor).

export type PricingRules = { initialPct: number; buyoutPct: number; defaultStepCents: number | null; oneReal: boolean };

/** Incremento automático pela faixa de valor de mercado. */
export function autoStep(marketCents: number) {
  if (marketCents <= 2000) return 100; // até R$ 20 → R$ 1
  if (marketCents <= 5000) return 200; // até R$ 50 → R$ 2
  if (marketCents <= 10000) return 500; // até R$ 100 → R$ 5
  if (marketCents <= 30000) return 1000; // até R$ 300 → R$ 10
  if (marketCents <= 100000) return 2000; // até R$ 1.000 → R$ 20
  return 5000; // acima → R$ 50
}

const NICE = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000];
const niceCeil = (c: number) => NICE.find((n) => n >= c) ?? Math.ceil(c / 50000) * 50000;
const toReais = (c: number) => Math.max(100, Math.round(c / 100) * 100);

export const MAX_POLL_OPTIONS = 12; // limite do WhatsApp

export type Overrides = { start?: number | null; buyout?: number | null; step?: number | null };

/** Calcula lance inicial, incremento, arremate e as opções da enquete de uma carta.
 *  Valores manuais da carta (overrides) prevalecem sobre as fórmulas. */
export function priceItem(marketCents: number, rules: PricingRules, lotOneReal = false, o: Overrides = {}) {
  let step = o.step && o.step > 0 ? o.step : rules.defaultStepCents && rules.defaultStepCents > 0 ? rules.defaultStepCents : autoStep(marketCents);
  const start =
    o.start && o.start > 0 ? o.start
    : rules.oneReal || lotOneReal ? 100
    : marketCents > 0 ? toReais((marketCents * (100 - rules.initialPct)) / 100) : 100;
  let buyout =
    o.buyout && o.buyout > 0 ? o.buyout
    : marketCents > 0 ? toReais((marketCents * (100 + rules.buyoutPct)) / 100) : start + step * (MAX_POLL_OPTIONS - 1);
  if (buyout <= start) buyout = start + step;
  let count = Math.floor((buyout - start) / step) + 1;
  if (count > MAX_POLL_OPTIONS) {
    step = niceCeil(Math.ceil((buyout - start) / (MAX_POLL_OPTIONS - 1)));
    count = Math.floor((buyout - start) / step) + 1;
  }
  const options: number[] = [];
  for (let i = 0; i < count && options.length < MAX_POLL_OPTIONS - 1; i++) options.push(start + i * step);
  if (options[options.length - 1] !== buyout) options.push(buyout);
  return { startCents: start, stepCents: step, buyoutCents: buyout, options: options.slice(0, MAX_POLL_OPTIONS) };
}
