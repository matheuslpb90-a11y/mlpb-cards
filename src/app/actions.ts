"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { onlyDigits } from "@/lib/money";
import { placeOrder, type CartLine } from "@/lib/orders";
import type { ShippingMethod } from "@/lib/shipping";

export type FormState = { error?: string; ok?: boolean } | undefined;

function safeNext(next: unknown) {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/minha-conta";
}

const signupSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo"),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
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
  if (await db.user.findUnique({ where: { email: data.email } }))
    return { error: "Já existe uma conta com este e-mail. Faça login." };
  const user = await db.user.create({ data: { ...data, passwordHash: await hashPassword(password) } });
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: "E-mail ou senha incorretos." };
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
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
  return { ok: true };
}

export async function checkoutAction(
  lines: CartLine[],
  method: ShippingMethod,
): Promise<{ url?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login ou crie seu cadastro para pagar pelo site." };
  if (!["PAC", "SEDEX", "ACUMULAR"].includes(method)) return { error: "Escolha uma forma de envio." };
  try {
    const url = await placeOrder(user, lines, method);
    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível criar o pedido." };
  }
}
