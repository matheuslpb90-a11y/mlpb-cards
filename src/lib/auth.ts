import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";

const COOKIE = "mlpb_session";
const SESSION_DAYS = 30;

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

/** O login vale em mlpbcards.com.br e www.mlpbcards.com.br (mesmo cookie para os dois). */
export async function cookieDomain() {
  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
  return host === "mlpbcards.com.br" || host.endsWith(".mlpbcards.com.br") ? ".mlpbcards.com.br" : undefined;
}

export async function createSession(userId: string, opts: { pending2fa?: boolean } = {}) {
  const id = randomBytes(32).toString("hex");
  // sessão "pendente" (falta o código do aplicativo) vale só 10 minutos
  const expiresAt = new Date(Date.now() + (opts.pending2fa ? 10 * 60 * 1000 : SESSION_DAYS * 24 * 60 * 60 * 1000));
  await db.session.create({ data: { id, userId, expiresAt, pending2fa: Boolean(opts.pending2fa) } });
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    domain: await cookieDomain(),
  });
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) await db.session.deleteMany({ where: { id } });
  jar.delete(COOKIE);
  const domain = await cookieDomain();
  if (domain) jar.set(COOKIE, "", { path: "/", domain, maxAge: 0 });
}

export async function getCurrentUser() {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const session = await db.session.findUnique({ where: { id }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || session.pending2fa) return null;
  // sessão "deslizante": quem usa o site continua logado (renova no banco 1x por dia)
  if (session.expiresAt.getTime() - Date.now() < (SESSION_DAYS - 1) * 86400_000)
    await db.session.update({ where: { id }, data: { expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) } }).catch(() => {});
  return session.user;
}

/** Sessão que passou pela senha/Google mas ainda precisa do código de duas etapas. */
export async function getPendingSession() {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const session = await db.session.findUnique({ where: { id }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || !session.pending2fa) return null;
  return session;
}

/** Cadastro completo = pode comprar (nome, telefone, CPF e endereço). */
export function profileComplete(u: { name: string; phone: string; cpf: string; cep: string; street: string; number: string; neighborhood: string; city: string; state: string }) {
  return u.name.trim().split(/\s+/).length >= 2 && u.phone.length >= 10 && u.cpf.length === 11 && u.cep.length === 8 && !!u.street && !!u.number && !!u.neighborhood && !!u.city && u.state.length === 2;
}

export function safeNext(next: unknown) {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/minha-conta";
}

/**
 * Depois de conferir senha ou Google: se a conta tem duas etapas, pede o código;
 * se o cadastro está incompleto, manda completar; senão, segue para a página pedida.
 */
export async function finishLogin(user: { id: string; totpEnabled: boolean; name: string; phone: string; cpf: string; cep: string; street: string; number: string; neighborhood: string; city: string; state: string }, next: string): Promise<never> {
  if (user.totpEnabled) {
    await createSession(user.id, { pending2fa: true });
    redirect(`/entrar/verificacao?next=${encodeURIComponent(next)}`);
  }
  await createSession(user.id);
  if (!profileComplete(user)) redirect(`/completar-cadastro?next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function requireUser(next = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/admin");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
