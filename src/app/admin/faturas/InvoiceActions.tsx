"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { invoiceCommandAction } from "../leiloes/actions";

export function InvoiceActions({ id, code, status }: { id: string; code: number; status: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (cmd: "reenviar" | "pago" | "cancelar" | "juntar", ask: string) => {
    if (!confirm(ask)) return;
    start(async () => {
      const r = await invoiceCommandAction(id, cmd);
      if (r.error) alert(r.error);
      router.refresh();
    });
  };
  const b = "rounded-lg border px-2 py-1 text-xs hover:border-brand disabled:opacity-40";
  return (
    <div className="flex gap-1">
      <a href={`/fatura/${code}`} target="_blank" className={b}>Ver</a>
      {status === "PENDENTE" && <button disabled={pending} className={b} onClick={() => run("reenviar", "Reenviar a cobrança no WhatsApp?")}>📲 Reenviar</button>}
      {status === "PENDENTE" && <button disabled={pending} className={b} title="Manda ao cliente um link para pagar todos os invoices em aberto de uma vez" onClick={() => run("juntar", "Enviar ao cliente o link para pagar TODOS os invoices em aberto dele de uma vez?")}>🧾 Pagar tudo</button>}
      {status === "PENDENTE" && <button disabled={pending} className={b} onClick={() => run("pago", "Marcar como pago manualmente?")}>✔ Pago</button>}
      {status === "PENDENTE" && <button disabled={pending} className={`${b} text-red-300`} onClick={() => run("cancelar", "Cancelar este invoice?")}>Cancelar</button>}
    </div>
  );
}
