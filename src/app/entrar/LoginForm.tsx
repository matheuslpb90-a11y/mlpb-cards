"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="card space-y-4 p-6">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label">E-mail</label>
        <input name="email" type="email" required className="input" autoComplete="email" />
      </div>
      <div>
        <label className="label">Senha</label>
        <input name="password" type="password" required className="input" autoComplete="current-password" />
      </div>
      {state?.error && <p className="rounded bg-red-950/60 p-2 text-sm text-red-300">{state.error}</p>}
      <button className="btn-primary w-full py-3" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
      <p className="text-center text-sm">
        Ainda não tem conta? <Link href={`/cadastro?next=${encodeURIComponent(next)}`} className="text-brand hover:underline">Criar cadastro</Link>
      </p>
    </form>
  );
}
