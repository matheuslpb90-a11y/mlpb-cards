"use client";

import { useEffect, useState, useTransition } from "react";
import { unwatchAction, watchAction } from "./actions";

const KEY = "mlpb_watch_phone";

/** "🔔 Me avise": o bot chama a pessoa no grupo quando a carta entrar no leilão. */
export function WatchButton({ auctionCode, code, count, defaultPhone, defaultName }: { auctionCode: number; code: string; count: number; defaultPhone: string; defaultName: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(defaultPhone);
  const [name, setName] = useState(defaultName);
  const [total, setTotal] = useState(count);
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}") as { phone?: string; name?: string; codes?: Record<string, boolean> };
      if (!defaultPhone && saved.phone) setPhone(saved.phone);
      if (!defaultName && saved.name) setName(saved.name);
      if (saved.codes?.[`${auctionCode}:${code}`]) setOn(true);
    } catch {}
  }, [auctionCode, code, defaultPhone, defaultName]);

  const remember = (value: boolean) => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}") as { codes?: Record<string, boolean> };
      const codes = { ...(saved.codes ?? {}), [`${auctionCode}:${code}`]: value };
      localStorage.setItem(KEY, JSON.stringify({ ...saved, phone, name, codes }));
    } catch {}
  };

  const submit = () =>
    start(async () => {
      const r = await watchAction(auctionCode, code, phone, name);
      if (r.error) return setMsg(r.error);
      setOn(true);
      setOpen(false);
      setTotal(r.total ?? total + 1);
      setMsg("✔ Combinado! Vou te chamar no grupo.");
      remember(true);
    });

  const cancel = () =>
    start(async () => {
      await unwatchAction(auctionCode, code, phone);
      setOn(false);
      setTotal((t) => Math.max(0, t - 1));
      setMsg("Lembrete removido.");
      remember(false);
    });

  return (
    <div className="space-y-1">
      {on ? (
        <button type="button" disabled={pending} onClick={cancel} className="w-full rounded-lg border border-green-700 bg-green-950/40 px-2 py-1.5 text-xs font-bold text-green-300">
          🔔 Você será avisado{total > 1 ? ` · ${total} interessados` : ""}
        </button>
      ) : (
        <button type="button" disabled={pending} onClick={() => (phone ? submit() : setOpen(!open))} className="w-full rounded-lg border border-brand/60 px-2 py-1.5 text-xs font-bold text-brand hover:bg-brand/10">
          🔔 Me avise no grupo{total > 0 ? ` · ${total} ${total > 1 ? "interessados" : "interessado"}` : ""}
        </button>
      )}
      {open && !on && (
        <div className="space-y-1 rounded-lg border border-slate-200 p-2">
          <input className="input !py-1 text-xs" placeholder="Seu WhatsApp (DDD + número)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="input !py-1 text-xs" placeholder="Seu nome (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" disabled={pending} onClick={submit} className="btn-primary w-full !py-1 text-xs">Avisar quando a {code} entrar</button>
          <p className="text-[10px] text-slate-500">Você precisa estar no grupo do WhatsApp para ser chamado.</p>
        </div>
      )}
      {msg && <p className="text-[11px] text-slate-400">{msg}</p>}
    </div>
  );
}
