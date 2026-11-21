import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { googleAuthUrl, googleEnabled } from "@/lib/google-auth";
import { safeNext } from "@/lib/auth";

// Início do "Entrar com Google": guarda um código anti-fraude (state) e manda para o Google.
export async function GET(req: Request) {
  if (!googleEnabled()) return NextResponse.redirect(new URL("/entrar?erro=google", req.url));
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("g_state", `${state}|${next}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return NextResponse.redirect(googleAuthUrl(state));
}
