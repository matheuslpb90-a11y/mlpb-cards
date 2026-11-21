"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateOrderAction } from "../actions";

export function OrderControls({ id, status, tracking, labels, receiptUrl }: { id: string; status: string; tracking: string; labels: Record<string, string>; receiptUrl: string }) {
  const [s, setS] = useState(status);
  const [t, setT] = useState(tracking);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = () => {
    if (s === "CANCELADO" && status !== "CANCELADO") {
      const paid = status !== "AGUARDANDO_PAGAMENTO";
      if (!confirm(paid ? "Cancelar este pedido JÁ PAGO? As cartas voltam ao estoque, saem da caixa do cliente e os pontos são retirados. O estorno do dinheiro é feito na InfinitePay." : "Cancelar este pedido? As cartas voltam ao estoque.")) return;
    }
    start(async () => {
      const r = await updateOrderAction(id, s, t);
      setMsg(r);
      router.refresh();
    });
  };
  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={s} onChange={(e) => setS(e.target.value)} className="input max-w-[240px] py-1 text-sm">
          {Object.entries(labels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Código de rastreio" className="input max-w-[220px] py-1 text-sm" />
        <button onClick={save} disabled={pending} className="btn-outline py-1 text-sm">{pending ? "Salvando…" : "Atualizar"}</button>
        {receiptUrl && <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">Comprovante</a>}
      </div>
      {msg?.ok && <p className="text-sm text-green-300">{msg.ok}</p>}
      {msg?.error && <p className="text-sm text-red-300">{msg.error}</p>}
    </div>
  );
}
