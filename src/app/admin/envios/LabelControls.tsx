"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Sender } from "@/lib/labels";
import { labelAction, printManyAction, saveSenderAction } from "./actions";

const SERVICES = [
  ["1", "PAC"],
  ["2", "SEDEX"],
  ["17", "Mini Envios"],
];

export function SenderForm({ initial, complete }: { initial: Sender; complete: boolean }) {
  const [s, setS] = useState(initial);
  const [open, setOpen] = useState(!complete);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const f = (k: keyof Sender, label: string, cls = "") => (
    <div className={cls}>
      <label className="label">{label}</label>
      <input className="input" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} />
    </div>
  );
  if (!open)
    return (
      <div className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
        <span>Remetente: <strong>{s.name}</strong> — {s.street}, {s.number} · {s.city}/{s.state} · CEP {s.cep}</span>
        <button className="btn-outline text-sm" onClick={() => setOpen(true)}>Editar remetente</button>
      </div>
    );
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">Remetente (sai na etiqueta)</h2>
      {!complete && <p className="text-sm text-amber-300">Preencha o endereço da loja para poder gerar etiquetas.</p>}
      <div className="grid gap-3 sm:grid-cols-6">
        {f("name", "Nome", "sm:col-span-3")}
        {f("document", "CPF ou CNPJ", "sm:col-span-3")}
        {f("cep", "CEP", "sm:col-span-2")}
        {f("street", "Rua", "sm:col-span-4")}
        {f("number", "Número", "sm:col-span-2")}
        {f("complement", "Complemento", "sm:col-span-2")}
        {f("neighborhood", "Bairro", "sm:col-span-2")}
        {f("city", "Cidade", "sm:col-span-3")}
        {f("state", "UF", "sm:col-span-1")}
        {f("email", "E-mail (opcional)", "sm:col-span-2")}
      </div>
      {msg?.error && <p className="text-sm text-red-300">{msg.error}</p>}
      {msg?.ok && <p className="text-sm text-green-300">{msg.ok}</p>}
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await saveSenderAction(s);
            setMsg(r);
            if (r.ok) setOpen(false);
          })
        }
      >
        {pending ? "Salvando…" : "Salvar remetente"}
      </button>
    </section>
  );
}

export function LabelRow({ kind, id, hasLabel, paid, defaultService, canLabel }: { kind: "box" | "order"; id: string; hasLabel: boolean; paid: boolean; defaultService: string; canLabel: boolean }) {
  const [service, setService] = useState(defaultService);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (cmd: "criar" | "pagar" | "atualizar" | "imprimir" | "cancelar", ask?: string) => {
    if (ask && !confirm(ask)) return;
    start(async () => {
      const r = await labelAction(kind, id, cmd, service);
      if (r.url) window.open(r.url, "_blank");
      setMsg(r);
      router.refresh();
    });
  };
  const b = "rounded-lg border px-2 py-1 text-xs hover:border-brand disabled:opacity-40";
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-1">
        {!hasLabel && (
          <>
            <select className="input w-auto py-1 text-xs" value={service} onChange={(e) => setService(e.target.value)}>
              {SERVICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button disabled={pending || !canLabel} className={`${b} border-brand text-brand-amber`} onClick={() => run("criar", "Gerar e pagar a etiqueta com o saldo da SuperFrete?")}>
              {pending ? "…" : "🏷️ Gerar etiqueta"}
            </button>
          </>
        )}
        {hasLabel && !paid && <button disabled={pending} className={b} onClick={() => run("pagar")}>💳 Pagar etiqueta</button>}
        {hasLabel && paid && <button disabled={pending} className={b} onClick={() => run("imprimir")}>🖨️ Imprimir</button>}
        {hasLabel && <button disabled={pending} className={b} onClick={() => run("atualizar")}>🔄 Rastreio</button>}
        {hasLabel && <button disabled={pending} className={`${b} text-red-300`} onClick={() => run("cancelar", "Cancelar a etiqueta? O valor volta para o saldo da SuperFrete.")}>Cancelar</button>}
      </div>
      {msg?.error && <p className="max-w-md text-right text-xs text-red-300">{msg.error}</p>}
      {msg?.ok && <p className="text-xs text-green-300">{msg.ok}</p>}
    </div>
  );
}

export function PrintSelected({ ids }: { ids: string[] }) {
  const [pending, start] = useTransition();
  if (ids.length < 2) return null;
  return (
    <button
      className="btn-outline text-sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await printManyAction(ids);
          if (r.url) window.open(r.url, "_blank");
          else alert(r.error);
        })
      }
    >
      🖨️ Imprimir todas ({ids.length})
    </button>
  );
}
