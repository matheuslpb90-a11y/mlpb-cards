export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Converte "12,50" / "12.50" / "1.234,56" em centavos. Retorna null se inválido. */
export function parseBRLToCents(input: string): number | null {
  const clean = input.trim().replace(/[R$\s]/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Desconto em % (inteiro) quando há preço original maior que o atual. */
export function discountPct(priceCents: number, compareAtCents?: number | null): number {
  if (!compareAtCents || compareAtCents <= priceCents) return 0;
  return Math.round(((compareAtCents - priceCents) / compareAtCents) * 100);
}
