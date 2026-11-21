import { redirect } from "next/navigation";
import { getPendingSession } from "@/lib/auth";
import { CodeForm } from "./CodeForm";

export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (!(await getPendingSession())) redirect("/entrar?erro=expirou");
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-2 text-2xl font-bold">🔐 Verificação em duas etapas</h1>
      <p className="mb-4 text-sm text-slate-500">Abra o aplicativo autenticador (Google Authenticator, Authy…) e digite o código de 6 dígitos da MLPB Cards.</p>
      <CodeForm next={next ?? "/minha-conta"} />
    </div>
  );
}
