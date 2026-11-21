import { SignupForm } from "./SignupForm";
import { GoogleButton } from "@/components/GoogleButton";
import { googleEnabled } from "@/lib/google-auth";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Criar cadastro</h1>
      {googleEnabled() && (
        <div className="card mb-4 space-y-2 p-6">
          <GoogleButton next={next ?? "/minha-conta"} label="Cadastrar com Google" />
          <p className="text-center text-xs text-slate-500">Mais rápido: depois é só completar CPF, telefone e endereço.</p>
        </div>
      )}
      <SignupForm next={next ?? "/minha-conta"} />
    </div>
  );
}
