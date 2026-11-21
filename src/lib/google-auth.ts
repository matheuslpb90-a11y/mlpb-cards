import "server-only";
import { siteUrl } from "./orders";

// Login com Google (OAuth 2.0). Variáveis na Vercel: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.
// No Google Cloud, o "URI de redirecionamento autorizado" deve ser: <site>/api/auth/google/callback

export const googleEnabled = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const googleRedirectUri = () => `${siteUrl()}/api/auth/google/callback`;

export function googleAuthUrl(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

type IdToken = { sub: string; email?: string; email_verified?: boolean; name?: string; aud?: string; iss?: string; exp?: number };

/** Troca o código pelo token e devolve quem é a pessoa (e-mail verificado pelo Google). */
export async function googleProfile(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google recusou o login (${res.status})`);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new Error("Google não devolveu a identificação");
  // o token veio direto do Google por HTTPS: basta ler e conferir os campos
  const payload = JSON.parse(Buffer.from(id_token.split(".")[1], "base64url").toString()) as IdToken;
  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error("Token de outro aplicativo");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(payload.iss ?? "")) throw new Error("Emissor inválido");
  if (!payload.email || !payload.email_verified) throw new Error("E-mail do Google não verificado");
  return { googleId: payload.sub, email: payload.email.toLowerCase(), name: payload.name ?? "" };
}
