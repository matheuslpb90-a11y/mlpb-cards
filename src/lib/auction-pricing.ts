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

const toReais = (c: number) => Math.max(100, Math.round(c / 100) * 100);

export const MAX_POLL_OPTIONS = 12; // limite do WhatsApp
/** Quantos lances cada enquete tem: o inicial (20% abaixo do mercado) e mais 4 subindo até o arremate. */
export const POLL_OPTIONS = 5;

export type Overrides = { start?: number | null; buyout?: number | null; step?: number | null };

/** Calcula os 5 lances da enquete de uma carta, a partir do valor de mercado:
 *  −20%, −10%, valor de mercado, +15% e +30% (arremate) — usando os % do leilão (inicial e arremate)
 *  e a metade deles nos lances do meio. Valores manuais da carta (overrides) prevalecem. */
export function priceItem(marketCents: number, rules: PricingRules, lotOneReal = false, o: Overrides = {}) {
  const N = POLL_OPTIONS;
  const manualStep = o.step && o.step > 0 ? o.step : rules.defaultStepCents && rules.defaultStepCents > 0 ? rules.defaultStepCents : 0;
  let options: number[];
  if (manualStep || marketCents <= 0) {
    // sem valor de mercado (ou com incremento fixo): inicial e mais 4 passos iguais
    const step = manualStep || autoStep(marketCents);
    const start = o.start && o.start > 0 ? o.start : rules.oneReal || lotOneReal ? 100 : marketCents > 0 ? toReais((marketCents * (100 - rules.initialPct)) / 100) : 100;
    options = Array.from({ length: N }, (_, i) => start + i * step);
  } else {
    const pct = [-rules.initialPct, -rules.initialPct / 2, 0, rules.buyoutPct / 2, rules.buyoutPct];
    options = pct.map((p) => toReais((marketCents * (100 + p)) / 100));
    if (rules.oneReal || lotOneReal) options[0] = 100;
  }
  if (o.start && o.start > 0) options[0] = o.start;
  if (o.buyout && o.buyout > 0) options[N - 1] = o.buyout;
  // cada lance precisa ser maior que o anterior (cartas baratas podem empatar no arredondamento)
  for (let i = 1; i < options.length; i++) if (options[i] <= options[i - 1]) options[i] = options[i - 1] + 100;
  const stepCents = options[1] - options[0];
  return { startCents: options[0], stepCents, buyoutCents: options[options.length - 1], options };
}
