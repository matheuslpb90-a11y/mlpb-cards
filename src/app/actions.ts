"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, finishLogin, getCurrentUser, hashPassword, profileComplete, safeNext, verifyPassword } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { attempts, clearAttempts, clientIp, recordAttempt } from "@/lib/rate-limit";
import { onlyDigits } from "@/lib/money";
import { cartTotals, placeOrder, type CartLine } from "@/lib/orders";
import { quoteShipping, type ShippingOption } from "@/lib/shipping";

export type FormState = { error?: string; ok?: boolean } | undefined;


const signupSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo").refine((n) => n.split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
  phone: z.string().transform(onlyDigits).pipe(z.string().min(10, "Telefone inválido")),
  cpf: z.string().transform(onlyDigits).pipe(z.string().length(11, "CPF deve ter 11 dígitos")),
  cep: z.string().transform(onlyDigits).pipe(z.string().length(8, "CEP deve ter 8 dígitos")),
  street: z.string().trim().min(2, "Informe a rua"),
  number: z.string().trim().min(1, "Informe o número"),
  complement: z.string().trim().default(""),
  neighborhood: z.string().trim().min(2, "Informe o bairro"),
  city: z.string().trim().min(2, "Informe a cidade"),
  state: z.string().trim().length(2, "UF com 2 letras").transform((s) => s.toUpperCase()),
});

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { password, ...data } = parsed.data;
  // no máximo 5 contas novas por hora do mesmo lugar (evita robôs criando contas em massa)
  const ip = await clientIp();
  if ((await attempts(`signup:${ip}`, 60)) >= 5) return { error: "Muitos cadastros seguidos deste aparelho. Tente de novo mais tarde." };
  if (await db.user.findUnique({ where: { email: data.email } }))
    return { error: "Já existe uma conta com este e-mail. Faça login." };
  const user = await db.user.create({ data: { ...data, passwordHash: await hashPassword(password) } });
  await recordAttempt(`signup:${ip}`);
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  // proteção contra quem tenta adivinhar senhas: 5 erros por e-mail ou 20 por aparelho em 15 minutos = espera
  const ip = await clientIp();
  if ((await attempts(`email:${email}`, 15)) >= 5 || (await attempts(`ip:${ip}`, 15)) >= 20)
    return { error: "Muitas tentativas erradas. Por segurança, aguarde 15 minutos e tente de novo." };
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await recordAttempt(`email:${email}`, `ip:${ip}`);
    if (user?.role === "ADMIN") await logActivity("login_fail", `Senha errada no login do painel (${email})`);
    return { error: "E-mail ou senha incorretos." };
  }
  await clearAttempts(`email:${email}`);
  if (user.role === "ADMIN") await logActivity("login", `${user.name} entrou no painel${user.totpEnabled ? " (senha ok, aguardando código)" : ""}`, { id: user.id, name: user.name });
  await finishLogin(user, safeNext(form.get("next")));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

const updateProfileSchema = signupSchema.omit({ email: true, password: true });

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login novamente." };
  const parsed = updateProfileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.user.update({ where: { id: user.id }, data: parsed.data });
  // vindo de "completar cadastro": segue para onde a pessoa ia
  if (form.get("next")) redirect(safeNext(form.get("next")));
  return { ok: true };
}

export async function quoteShippingAction(lines: CartLine[]): Promise<{ options?: ShippingOption[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login para calcular o frete." };
  try {
    const { totalCards, subtotalCents } = await cartTotals(lines);
    if (totalCards === 0) return { error: "Seu carrinho está vazio." };
    return { options: await quoteShipping(user.cep, totalCards, subtotalCents) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível calcular o frete." };
  }
}

export async function checkoutAction(lines: CartLine[], shippingId: string): Promise<{ url?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login ou crie seu cadastro para pagar pelo site." };
  if (!profileComplete(user)) return { error: "Complete seu cadastro (nome completo, CPF, telefone e endereço) em Minha conta antes de pagar." };
  if (!shippingId) return { error: "Escolha uma forma de envio." };
  try {
    const url = await placeOrder(user, lines, shippingId);
    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível criar o pedido." };
  }
}
