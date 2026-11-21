import { LoginForm } from "./LoginForm";
import { GoogleButton } from "@/components/GoogleButton";
import { googleEnabled } from "@/lib/google-auth";

const ERRORS: Record<string, string> = {
  google: "Não foi possível entrar com o Google. Tente de novo ou use e-mail e senha.",
  expirou: "O tempo para digitar o código acabou. Entre de novo.",
  tentativas: "Muitas tentativas com código errado. Entre de novo.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next, erro } = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-bold">Entrar</h1>
      {erro && ERRORS[erro] && <p className="mb-3 rounded bg-red-950/60 p-3 text-sm text-red-300">{ERRORS[erro]}</p>}
      {googleEnabled() && (
        <div className="card mb-4 space-y-3 p-6">
          <GoogleButton next={next ?? "/minha-conta"} />
          <p className="text-center text-xs text-slate-500">ou entre com e-mail e senha</p>
        </div>
      )}
      <LoginForm next={next ?? "/minha-conta"} />
    </div>
  );
}
