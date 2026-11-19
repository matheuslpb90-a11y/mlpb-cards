"use client";

import { useActionState } from "react";
import { updateProfileAction } from "../actions";
import { AddressFields } from "@/components/AddressFields";

type U = Record<"name" | "phone" | "cpf" | "cep" | "street" | "number" | "complement" | "neighborhood" | "city" | "state", string>;

export function ProfileForm({ user }: { user: U }) {
  const [state, action, pending] = useActionState(updateProfileAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label">Nome</label><input name="name" defaultValue={user.name} className="input" required /></div>
        <div><label className="label">Telefone</label><input name="phone" defaultValue={user.phone} className="input" required /></div>
        <div><label className="label">CPF</label><input name="cpf" defaultValue={user.cpf} className="input" required /></div>
      </div>
      <AddressFields defaults={user} />
      {state?.error && <p className="rounded bg-red-950/60 p-2 text-sm text-red-300">{state.error}</p>}
      {state?.ok && <p className="rounded bg-green-950/60 p-2 text-sm text-green-300">Dados atualizados!</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button>
    </form>
  );
}
