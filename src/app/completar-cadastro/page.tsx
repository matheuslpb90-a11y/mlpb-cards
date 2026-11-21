import { redirect } from "next/navigation";
import { profileComplete, requireUser, safeNext } from "@/lib/auth";
import { ProfileForm } from "../minha-conta/ProfileForm";

export const dynamic = "force-dynamic";

export default async function CompleteProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await requireUser("/completar-cadastro");
  const go = safeNext(next);
  if (profileComplete(user)) redirect(go);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Complete seu cadastro</h1>
      <p className="text-sm text-slate-500">
        Olá{user.name ? `, ${user.name.split(" ")[0]}` : ""}! Para comprar e receber suas cartas, confirme seu <strong>nome completo</strong>, <strong>CPF</strong>, <strong>telefone (WhatsApp)</strong> e <strong>endereço</strong>.
      </p>
      <div className="card p-6">
        <ProfileForm user={user} next={go} submitLabel="Salvar e continuar" />
      </div>
    </div>
  );
}
