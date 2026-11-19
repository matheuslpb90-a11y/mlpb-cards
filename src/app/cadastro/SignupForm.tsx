"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction } from "../actions";
import { AddressFields } from "@/components/AddressFields";

export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signupAction, undefined);
  return (
    <form action={action} className="card space-y-4 p-6">
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Nome completo</label>
          <input name="name" required className="input" autoComplete="name" />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label">Senha</label>
          <input name="password" type="password" required minLength={6} className="input" autoComplete="new-password" />
        </div>
        <div>
          <label className="label">WhatsApp / Telefone</label>
          <input name="phone" required className="input" inputMode="tel" placeholder="(11) 99999-9999" />
        </div>
        <div>
          <label className="label">CPF</label>
          <input name="cpf" required className="input" inputMode="numeric" placeholder="000.000.000-00" />
        </div>
      </div>
      <h2 className="pt-2 font-semibold">Endereço de entrega</h2>
      <AddressFields />
      {state?.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full py-3" disabled={pending}>{pending ? "Criando…" : "Criar cadastro"}</button>
      <p className="text-center text-sm">
        Já tem conta? <Link href={`/entrar?next=${encodeURIComponent(next)}`} className="text-brand hover:underline">Entrar</Link>
      </p>
    </form>
  );
}
