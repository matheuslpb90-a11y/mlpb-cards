"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatBRL } from "@/lib/money";
import { archiveBoxAction, saveFreeShippingAction, sendBoxLinkAction, setBoxStatusAction, toggleBoxShippingPaidAction, updateBoxAction } from "./actions";

const STATUS: [string, string][] = [
  ["PENDENTE", "Pendente"], ["FRETE_SOLICITADO", "Frete solicitado"], ["EM_SEPARACAO", "Em separação"],
  ["ENVIADA", "Enviada"], ["PRESENCIAL", "Presencial"], ["CONCLUIDA", "Concluída"],
];
const COLOR: Record<string, string> = {
  PENDENTE: "bg-green-950/60 text-green-300 border-green-800", FRETE_SOLICITADO: "bg-amber-950/60 text-amber-300 border-amber-800",
  EM_SEPARACAO: "bg-teal-950/60 text-teal-300 border-teal-800", ENVIADA: "bg-blue-950/60 text-blue-300 border-blue-800",
  PRESENCIAL: "bg-purple-950/60 text-purple-300 border-purple-800", CONCLUIDA: "bg-slate-200 text-slate-600",
};

type Box = {
  id: string; code: number; token: string; name: string; phone: string; status: string; archived: boolean; shippingPaid: boolean;
  shippingMethod: string; trackingCode: string; created: string; closed: string; days: number; debtor: boolean; link: string;
};

export function BoxRow({ box, balance, free, parts }: { box: Box; balance: number; free: boolean; parts: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tracking, setTracking] = useState(box.trackingCode);
  const [editing, setEditing] = useState(false);
  const run = (fn: () => Promise<{ error?: string; notified?: boolean }>, after?: (r: { notified?: boolean }) => void) =>
    start(async () => {
      const r = await fn();
      if (r.error) alert(r.error);
      else after?.(r);
      router.refresh();
    });
  const phone = box.phone.replace(/^55/, "");
  const wa = `https://wa.me/${box.phone}?text=${encodeURIComponent(`Olá${box.name ? `, ${box.name.split(" ")[0]}` : ""}! Sua caixa #${box.code} na MLPB Cards: ${box.link}`)}`;

  return (
    <tr className={box.debtor ? "bg-red-950/20" : ""}>
      <td className="p-3">
        <Link href={`/admin/caixas/${box.id}`} className="font-semibold text-blue-300 hover:underline">{box.name || "Sem nome"}</Link>
        <p className="text-xs text-slate-500">({phone.slice(0, 2)}) {phone.slice(2, -4)}-{phone.slice(-4)}{box.debtor ? " · ⚠ inadimplente" : ""}</p>
      </td>
      <td className="p-3">
        <select
          disabled={pending}
          value={box.status}
          onChange={(e) => run(() => setBoxStatusAction(box.id, e.target.value), (r) => r.notified && alert("Cliente avisado no WhatsApp ✔"))}
          className={`rounded-lg border px-2 py-1 text-xs font-bold ${COLOR[box.status]}`}
        >
          {STATUS.map(([k, l]) => <option key={k} value={k} className="bg-panel text-white">{l}</option>)}
        </select>
      </td>
      <td className="p-3 font-bold text-green-300">{formatBRL(balance)}</td>
      <td className="p-3">
        {box.shippingMethod === "RETIRADA" ? (
          <span className="rounded bg-purple-950/60 px-2 py-1 text-xs font-bold text-purple-300">Retirada</span>
        ) : free ? (
          <span className="rounded bg-green-950/60 px-2 py-1 text-xs font-bold text-green-300">✓ Frete grátis</span>
        ) : (
          <button disabled={pending} onClick={() => run(() => toggleBoxShippingPaidAction(box.id))} className="flex items-center gap-2 text-xs">
            <span className={`relative inline-block h-5 w-9 rounded-full ${box.shippingPaid ? "bg-green-600" : "bg-slate-300"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${box.shippingPaid ? "left-4" : "left-0.5"}`} />
            </span>
            {box.shippingPaid ? "Pago" : "Não pago"}
          </button>
        )}
      </td>
      <td className="p-3 text-center">{parts}</td>
      <td className="p-3">
        {editing ? (
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); run(() => updateBoxAction(box.id, { trackingCode: tracking }), () => setEditing(false)); }}>
            <input autoFocus className="input w-32 py-1 text-xs" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Código" />
            <button className="rounded border px-2 text-xs">OK</button>
          </form>
        ) : box.trackingCode ? (
          <button onClick={() => setEditing(true)} className="font-mono text-xs text-blue-300">{box.trackingCode}</button>
        ) : (
          <button onClick={() => setEditing(true)} className="rounded-full border border-blue-800 px-3 py-1 text-xs text-blue-300">+ Rastreio</button>
        )}
      </td>
      <td className="p-3 text-xs">
        <p className="font-semibold">{box.days} dia(s)</p>
        <p className="text-slate-500">{box.created}{box.closed ? ` → ${box.closed}` : ""}</p>
      </td>
      <td className="p-3">
        <p className="mb-1 text-right text-[10px] text-slate-500">#{box.code}</p>
        <div className="flex justify-end gap-1">
          <button title={box.archived ? "Desarquivar" : "Arquivar"} disabled={pending} onClick={() => run(() => archiveBoxAction(box.id))} className="rounded-lg border px-2 py-1">🗄</button>
          <button title="Enviar link da caixa pelo bot" disabled={pending} onClick={() => run(() => sendBoxLinkAction(box.id), () => alert("Link enviado ✔"))} className="rounded-lg border px-2 py-1">📲</button>
          <a title="Abrir conversa no WhatsApp" href={wa} target="_blank" rel="noreferrer" className="rounded-lg border px-2 py-1">💬</a>
          <Link title="Ver caixa" href={`/admin/caixas/${box.id}`} className="rounded-lg border px-2 py-1">👁</Link>
        </div>
      </td>
    </tr>
  );
}

export function FreeShippingSetting({ current }: { current: number }) {
  const [v, setV] = useState(String(current / 100));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <form className="flex items-center gap-2 text-sm" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveFreeShippingAction(v); setMsg(r.error ?? "Salvo ✔"); }); }}>
      <span className="text-slate-500">Frete grátis a partir de R$</span>
      <input className="input w-24 py-1" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn-outline py-1" disabled={pending}>Salvar</button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </form>
  );
}
