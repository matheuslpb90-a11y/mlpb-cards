// Telefones brasileiros chegam em formatos diferentes: com/sem 55 e com/sem o 9 extra
// (o WhatsApp mostra muitos celulares sem o 9, ex.: 556192242345 em vez de 5561992242345).

const digits = (p: string) => p.replace(/\D/g, "");

/** Chave para comparar: 55 + DDD + 8 últimos dígitos (sem o 9 extra). */
export function phoneKey(p: string) {
  let d = digits(p);
  if (!d.startsWith("55") && (d.length === 10 || d.length === 11)) d = `55${d}`;
  if (d.startsWith("55") && d.length === 13 && d[4] === "9") d = d.slice(0, 4) + d.slice(5);
  return d;
}

/** Todas as formas possíveis do mesmo número (para buscar no banco). */
export function phoneVariants(p: string) {
  const key = phoneKey(p);
  const set = new Set<string>([digits(p), key]);
  if (key.startsWith("55") && key.length === 12) {
    const with9 = key.slice(0, 4) + "9" + key.slice(4);
    set.add(with9);
    set.add(key.slice(2)); // sem 55, sem 9
    set.add(with9.slice(2)); // sem 55, com 9
  }
  return [...set].filter(Boolean);
}

export const samePhone = (a: string, b: string) => phoneKey(a) === phoneKey(b);
