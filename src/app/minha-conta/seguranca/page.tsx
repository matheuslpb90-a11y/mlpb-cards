import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { TwoFactorSetup } from "./TwoFactorSetup";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await requireUser("/minha-conta/seguranca");
  const recoveryLeft = (JSON.parse(user.recoveryJson || "[]") as string[]).length;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/minha-conta" className="text-sm text-slate-500 hover:text-white">← Minha conta</Link>
      <h1 className="text-2xl font-bold">🔐 Segurança da conta</h1>
      <div className="card space-y-3 p-6 text-sm">
        <h2 className="text-lg font-bold">Verificação em duas etapas</h2>
        <p className="text-slate-500">
          Além da senha (ou do Google), o site pede um código de 6 dígitos do aplicativo autenticador no seu celular. Mesmo que alguém descubra sua senha, não consegue entrar.
        </p>
        <TwoFactorSetup enabled={user.totpEnabled} recoveryLeft={recoveryLeft} />
      </div>
      {user.googleId && <p className="text-xs text-slate-500">Sua conta está ligada ao Google ({user.email}).</p>}
    </div>
  );
}
