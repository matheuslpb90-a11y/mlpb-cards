"use client";

import { useState, useTransition } from "react";
import { formatBRL } from "@/lib/money";
import type { ShippingOption } from "@/lib/shipping";
import { quoteBoxAction, requestBoxShippingAction, type Address } from "./actions";

const EMPTY: Address = { name: "", cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" };

export function RequestShipping({ code, token, freeUnlocked, prefill }: { code: number; token: string; freeUnlocked: boolean; prefill: Partial<Address> | null }) {
  const [a, setA] = useState<Address>({ ...EMPTY, ...(prefill ?? {}) });
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [sel, setSel] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const f = (k: keyof Address) => ({ value: a[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setA({ ...a, [k]: e.target.value }) });

  async function fillCep(cep: string) {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    try {
      const r = await (await fetch(`https://viacep.com.br/ws/${d}/json/`)).json();
      if (!r.erro) setA((p) => ({ ...p, street: r.logradouro || p.street, neighborhood: r.bairro || p.neighborhood, city: r.localidade || p.city, state: r.uf || p.state }));
    } catch {}
  }

  if (done) return <div className="card p-5 text-center font-semibold text-green-300">✅ Pedido de envio registrado! A loja vai separar sua caixa.</div>;

  const run = (fn: () => Promise<{ url?: string; done?: boolean; error?: string }>) =>
    start(async () => {
      setMsg("");
      const r = await fn();
      if (r.error) return setMsg(r.error);
      if (r.url) window.location.href = r.url;
      if (r.done) setDone(true);
    });

  return (
    <div className="card space-y-4 p-5">
      <h2 className="text-lg font-bold">Solicitar envio</h2>
      <div className="grid grid-cols-6 gap-2">
        <input className="input col-span-6" placeholder="Nome de quem recebe" {...f("name")} />
        <input className="input col-span-2" placeholder="CEP" {...f("cep")} onBlur={(e) => fillCep(e.target.value)} />
        <input className="input col-span-4" placeholder="Rua" {...f("street")} />
        <input className="input col-span-2" placeholder="Número" {...f("number")} />
        <input className="input col-span-4" placeholder="Complemento" {...f("complement")} />
        <input className="input col-span-3" placeholder="Bairro" {...f("neighborhood")} />
        <input className="input col-span-2" placeholder="Cidade" {...f("city")} />
        <input className="input col-span-1 uppercase" placeholder="UF" maxLength={2} {...f("state")} />
      </div>
      <button className="btn-outline w-full" disabled={pending} onClick={() => start(async () => {
        setMsg("Calculando…");
        const r = await quoteBoxAction(code, token, a.cep);
        setOptions(r.options ?? []);
        setSel(r.options?.[0]?.id ?? "");
        setMsg(r.error ?? "");
      })}>{freeUnlocked ? "Confirmar endereço" : "Calcular frete"}</button>

      {options.length > 0 && (
        <div className="space-y-2">
          {options.map((o) => (
            <label key={o.id} className={`flex cursor-pointer justify-between gap-3 rounded-lg border p-3 ${sel === o.id ? "border-brand bg-brand/10" : ""}`}>
              <span className="flex items-center gap-2"><input type="radio" checked={sel === o.id} onChange={() => setSel(o.id)} /> <span><strong>{o.label}</strong><span className="block text-xs text-slate-500">{o.description}</span></span></span>
              <strong>{o.priceCents === 0 ? "Grátis" : formatBRL(o.priceCents)}</strong>
            </label>
          ))}
          <button className="btn-primary w-full py-3" disabled={pending || !sel} onClick={() => run(() => requestBoxShippingAction(code, token, { kind: "envio", optionId: sel, address: a }))}>
            {options.find((o) => o.id === sel)?.priceCents ? "Pagar frete e solicitar envio" : "Solicitar envio grátis"}
          </button>
        </div>
      )}
      <button className="w-full text-sm text-slate-500 underline hover:text-white" disabled={pending} onClick={() => confirm("Retirar pessoalmente com a loja?") && run(() => requestBoxShippingAction(code, token, { kind: "retirada" }))}>
        Prefiro retirar pessoalmente
      </button>
      {msg && <p className="text-sm text-amber-300">{msg}</p>}
    </div>
  );
}
