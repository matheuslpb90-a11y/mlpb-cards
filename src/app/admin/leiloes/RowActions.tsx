"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { auctionCommandAction } from "./actions";

export function AuctionRowActions({ id, status, visible }: { id: string; status: string; visible: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (cmd: Parameters<typeof auctionCommandAction>[1], ask?: string) => {
    if (ask && !confirm(ask)) return;
    start(async () => {
      const r = await auctionCommandAction(id, cmd);
      if (r.error) alert(r.error);
      router.refresh();
    });
  };
  const b = "rounded-lg border px-2 py-1 text-xs hover:border-brand disabled:opacity-40";
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Link href={`/admin/leiloes/${id}`} className={b}>{status === "AGENDADO" ? "Editar" : "Resultados"}</Link>
      {status === "AGENDADO" && <button disabled={pending} className={b} onClick={() => run("iniciar", "Postar as enquetes no grupo agora?")}>▶ Iniciar agora</button>}
      {status === "ATIVO" && <button disabled={pending} className={b} onClick={() => run("encerrar", "Encerrar agora e enviar os invoices?")}>⏹ Encerrar agora</button>}
      <button disabled={pending} className={b} onClick={() => run("visivel")}>{visible ? "👁 Visível" : "🚫 Oculto"}</button>
      <button disabled={pending} className={b} onClick={() => run("duplicar")}>⧉ Duplicar</button>
      {status === "AGENDADO" && <button disabled={pending} className={`${b} text-red-300`} onClick={() => run("excluir", "Excluir este leilão?")}>🗑</button>}
    </div>
  );
}
