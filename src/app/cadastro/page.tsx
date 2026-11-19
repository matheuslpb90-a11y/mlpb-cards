import { SignupForm } from "./SignupForm";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Criar cadastro</h1>
      <SignupForm next={next ?? "/minha-conta"} />
    </div>
  );
}
