import "server-only";
import { db } from "./db";

/** Valor a partir do qual o frete é grátis (padrão R$ 500). Editável em Painel → Caixas. */
export async function freeShippingCents() {
  const s = await db.setting.findUnique({ where: { key: "freeShippingCents" } }).catch(() => null);
  const v = Number(s?.value);
  return Number.isFinite(v) && v > 0 ? v : 50000;
}
