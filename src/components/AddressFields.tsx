"use client";

import { useState } from "react";

type Defaults = Partial<Record<"cep" | "street" | "number" | "complement" | "neighborhood" | "city" | "state", string>>;

/** Campos de endereço com preenchimento automático pelo CEP (ViaCEP). */
export function AddressFields({ defaults = {} }: { defaults?: Defaults }) {
  const [addr, setAddr] = useState({
    street: defaults.street ?? "",
    neighborhood: defaults.neighborhood ?? "",
    city: defaults.city ?? "",
    state: defaults.state ?? "",
  });
  const [loading, setLoading] = useState(false);

  async function lookup(cep: string) {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const d = await r.json();
      if (!d.erro) setAddr({ street: d.logradouro ?? "", neighborhood: d.bairro ?? "", city: d.localidade ?? "", state: d.uf ?? "" });
    } catch {
      /* usuário preenche manualmente */
    } finally {
      setLoading(false);
    }
  }

  const set = (k: keyof typeof addr) => (e: React.ChangeEvent<HTMLInputElement>) => setAddr({ ...addr, [k]: e.target.value });

  return (
    <div className="grid grid-cols-6 gap-3">
      <div className="col-span-2">
        <label className="label">CEP {loading && <span className="text-xs text-slate-400">buscando…</span>}</label>
        <input name="cep" required defaultValue={defaults.cep} className="input" inputMode="numeric" placeholder="00000-000" onBlur={(e) => lookup(e.target.value)} />
      </div>
      <div className="col-span-4">
        <label className="label">Rua</label>
        <input name="street" required className="input" value={addr.street} onChange={set("street")} />
      </div>
      <div className="col-span-2">
        <label className="label">Número</label>
        <input name="number" required defaultValue={defaults.number} className="input" />
      </div>
      <div className="col-span-4">
        <label className="label">Complemento</label>
        <input name="complement" defaultValue={defaults.complement} className="input" />
      </div>
      <div className="col-span-6 sm:col-span-2">
        <label className="label">Bairro</label>
        <input name="neighborhood" required className="input" value={addr.neighborhood} onChange={set("neighborhood")} />
      </div>
      <div className="col-span-4 sm:col-span-3">
        <label className="label">Cidade</label>
        <input name="city" required className="input" value={addr.city} onChange={set("city")} />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="label">UF</label>
        <input name="state" required maxLength={2} className="input uppercase" value={addr.state} onChange={set("state")} />
      </div>
    </div>
  );
}
