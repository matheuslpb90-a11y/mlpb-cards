"use server";

import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getCurrentUser, getPendingSession, profileComplete, safeNext } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { newRecoveryCodes, newTotpSecret, otpauthUrl, useRecoveryCode, verifyTotp } from "@/lib/totp";

/** Tela de código no login: confere o código do aplicativo (ou um código de recuperação). */
export async function verify2faAction(_: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const s = await getPendingSession();
  if (!s) redirect("/entrar?erro=expirou");
  const code = String(form.get("code") ?? "").trim();
  let ok = verifyTotp(s.user.totpSecret, code);
  if (!ok && code.replace(/[\s-]/g, "").length === 8) {
    const rest = useRecoveryCode(s.user.recoveryJson, code);
    if (rest) {
      ok = true;
      await db.user.update({ where: { id: s.user.id }, data: { recoveryJson: JSON.stringify(rest) } });
    }
  }
  if (!ok) {
    const attempts = s.attempts + 1;
    if (attempts >= 5) {
      await db.session.delete({ where: { id: s.id } });
      redirect("/entrar?erro=tentativas");
    }
    await db.session.update({ where: { id: s.id }, data: { attempts } });
    return { error: `Código incorreto. Tentativas restantes: ${5 - attempts}.` };
  }
  await db.session.update({ where: { id: s.id }, data: { pending2fa: false, attempts: 0, expiresAt: new Date(Date.now() + 30 * 86400_000) } });
  if (s.user.role === "ADMIN") await logActivity("login", `${s.user.name} confirmou o código de duas etapas`, { id: s.user.id, name: s.user.name });
  const next = safeNext(form.get("next"));
  if (!profileComplete(s.user)) redirect(`/completar-cadastro?next=${encodeURIComponent(next)}`);
  redirect(next);
}

/** Começa a ativação: gera a chave e devolve o QR Code para o aplicativo. */
export async function start2faAction() {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login novamente." };
  if (user.totpEnabled) return { error: "A verificação em duas etapas já está ativa." };
  const secret = newTotpSecret();
  await db.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
  const url = otpauthUrl(secret, user.email);
  return { secret, qr: await QRCode.toDataURL(url, { margin: 1, width: 240 }) };
}

/** Confirma com o primeiro código do aplicativo e liga a proteção. Devolve os códigos de recuperação (mostrados 1x). */
export async function confirm2faAction(code: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login novamente." };
  if (!user.totpSecret || !verifyTotp(user.totpSecret, code)) return { error: "Código incorreto. Confira o horário do celular e tente o código mais recente." };
  const { plain, hashes } = newRecoveryCodes();
  await db.user.update({ where: { id: user.id }, data: { totpEnabled: true, recoveryJson: JSON.stringify(hashes) } });
  // derruba as outras sessões abertas (outros aparelhos precisam entrar de novo com o código)
  await logActivity("security_2fa", `${user.name} ativou a verificação em duas etapas`, { id: user.id, name: user.name });
  return { ok: true, recovery: plain };
}

export async function disable2faAction(code: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login novamente." };
  const ok = verifyTotp(user.totpSecret, code) || Boolean(useRecoveryCode(user.recoveryJson, code));
  if (!ok) return { error: "Código incorreto." };
  await db.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecret: "", recoveryJson: "[]" } });
  await logActivity("security_2fa", `${user.name} desativou a verificação em duas etapas`, { id: user.id, name: user.name });
  return { ok: true };
}
