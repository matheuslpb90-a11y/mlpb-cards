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

/** Calcula lance inicial, incremento, arremate e as 5 opções da enquete de uma carta.
 *  Valores manuais da carta (overrides) prevalecem sobre as fórmulas. */
export function priceItem(marketCents: number, rules: PricingRules, lotOneReal = false, o: Overrides = {}) {
  const N = POLL_OPTIONS;
  const manualStep = o.step && o.step > 0 ? o.step : rules.defaultStepCents && rules.defaultStepCents > 0 ? rules.defaultStepCents : 0;
  const start =
    o.start && o.start > 0 ? o.start
    : rules.oneReal || lotOneReal ? 100
    : marketCents > 0 ? toReais((marketCents * (100 - rules.initialPct)) / 100) : 100;

  let options: number[];
  if (manualStep && !(o.buyout && o.buyout > 0)) {
    // incremento fixo: inicial, +1x, +2x, +3x, +4x
    options = Array.from({ length: N }, (_, i) => start + i * manualStep);
  } else {
    let buyout =
      o.buyout && o.buyout > 0 ? o.buyout
      : marketCents > 0 ? toReais((marketCents * (100 + rules.buyoutPct)) / 100) : start + (N - 1) * autoStep(marketCents);
    if (buyout <= start) buyout = start + (N - 1) * 100;
    // passos iguais do inicial até o arremate, em valores redondos (R$ 1, 5, 10 ou 50, conforme o tamanho)
    const raw = (buyout - start) / (N - 1);
    const unit = manualStep ? 100 : raw < 1000 ? 100 : raw < 5000 ? 500 : raw < 20000 ? 1000 : 5000;
    const round = (c: number) => Math.max(100, Math.round(c / unit) * unit);
    const step = manualStep || Math.max(unit, round(raw));
    const first = o.start && o.start > 0 ? start : round(start);
    options = Array.from({ length: N - 1 }, (_, i) => (i === 0 ? first : round(first + i * step)));
    const last = o.buyout && o.buyout > 0 ? buyout : round(buyout);
    options.push(Math.max(last, options[N - 2] + unit));
  }
  options = [...new Set(options)].sort((a, b) => a - b);
  const stepCents = options.length > 1 ? options[1] - options[0] : 100;
  return { startCents: options[0], stepCents, buyoutCents: options[options.length - 1], options };
}
