import "server-only";
import { headers } from "next/headers";
import { db } from "./db";

/** IP de quem está acessando (a Vercel informa no cabeçalho x-forwarded-for). */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim() || "desconhecido";
}

/** Quantas tentativas uma chave teve nos últimos `minutes` minutos. */
export async function attempts(key: string, minutes: number) {
  return db.loginAttempt.count({ where: { key, createdAt: { gte: new Date(Date.now() - minutes * 60_000) } } });
}

export async function recordAttempt(...keys: string[]) {
  await db.loginAttempt.createMany({ data: keys.map((key) => ({ key })) });
  // limpeza: apaga registros com mais de 1 dia (de vez em quando)
  if (Math.random() < 0.05) await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86400_000) } } }).catch(() => {});
}

export async function clearAttempts(key: string) {
  await db.loginAttempt.deleteMany({ where: { key } }).catch(() => {});
}
