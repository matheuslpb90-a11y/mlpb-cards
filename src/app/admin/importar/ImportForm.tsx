"use client";

import { useActionState } from "react";
import { importCsvAction } from "../actions";

export function ImportForm() {
  const [state, action, pending] = useActionState(importCsvAction, undefined);
  return (
    <form action={action} className="card flex flex-wrap items-center gap-3 p-5">
      <input type="file" name="file" accept=".csv,text/csv" required className="flex-1" />
      <button className="btn-primary" disabled={pending}>{pending ? "Importando…" : "Importar"}</button>
      {state?.error && <p className="w-full rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="w-full rounded bg-green-50 p-2 text-sm text-green-700">{state.ok}</p>}
    </form>
  );
}
