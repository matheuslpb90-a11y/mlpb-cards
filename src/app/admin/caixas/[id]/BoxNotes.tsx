"use client";

import { useState, useTransition } from "react";
import { updateBoxAction } from "../actions";

export function BoxNotes({ id, notes }: { id: string; notes: string }) {
  const [v, setV] = useState(notes);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="card space-y-2 p-4">
      <p className="font-bold">Observações internas</p>
      <textarea className="input min-h-24" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn-outline" disabled={pending} onClick={() => start(async () => { const r = await updateBoxAction(id, { notes: v }); setMsg(r.error ?? "Salvo ✔"); })}>Salvar</button>
      {msg && <span className="ml-2 text-sm text-slate-500">{msg}</span>}
    </div>
  );
}
