"use client";

import { useActionState, useState } from "react";
import { verify2faAction } from "@/app/security-actions";

export function CodeForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(verify2faAction, undefined);
  const [recovery, setRecovery] = useState(false);
  return (
    <form action={action} className="card space-y-4 p-6">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label">{recovery ? "Código de recuperação (ex.: ABCD-EFGH)" : "Código de 6 dígitos"}</label>
        <input
          name="code"
          required
          autoFocus
          className="input text-center text-2xl tracking-[0.4em]"
          inputMode={recovery ? "text" : "numeric"}
          autoComplete="one-time-code"
          maxLength={recovery ? 9 : 6}
          placeholder={recovery ? "XXXX-XXXX" : "000000"}
        />
      </div>
      {state?.error && <p className="rounded bg-red-950/60 p-2 text-sm text-red-300">{state.error}</p>}
      <button className="btn-primary w-full py-3" disabled={pending}>{pending ? "Conferindo…" : "Confirmar"}</button>
      <button type="button" className="w-full text-center text-xs text-slate-500 underline" onClick={() => setRecovery(!recovery)}>
        {recovery ? "Usar o código do aplicativo" : "Perdi o celular — usar um código de recuperação"}
      </button>
    </form>
  );
}
