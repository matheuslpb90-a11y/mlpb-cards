import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { finishLogin, hashPassword } from "@/lib/auth";
import { googleProfile } from "@/lib/google-auth";
import { logActivity } from "@/lib/activity";

// Volta do Google: confere o state, identifica a pessoa, liga ou cria a conta e conclui o login.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const [state, next = "/minha-conta"] = (jar.get("g_state")?.value ?? "").split("|");
  jar.delete("g_state");
  if (!state || url.searchParams.get("state") !== state || !url.searchParams.get("code")) redirect("/entrar?erro=google");

  let profile: Awaited<ReturnType<typeof googleProfile>>;
  try {
    profile = await googleProfile(url.searchParams.get("code")!);
  } catch {
    redirect("/entrar?erro=google");
  }

  let user = await db.user.findFirst({ where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] } });
  if (user && !user.googleId) user = await db.user.update({ where: { id: user.id }, data: { googleId: profile.googleId } });
  if (!user) {
    user = await db.user.create({
      data: {
        name: profile.name,
        email: profile.email,
        googleId: profile.googleId,
        passwordHash: await hashPassword(randomBytes(24).toString("hex")), // entra só pelo Google (pode criar senha depois)
        phone: "", cpf: "", cep: "", street: "", number: "", neighborhood: "", city: "", state: "",
      },
    });
  }
  if (user.role === "ADMIN") await logActivity("login", `${user.name} entrou com Google`, { id: user.id, name: user.name });
  await finishLogin(user, next);
}
