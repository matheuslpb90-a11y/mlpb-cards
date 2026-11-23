"use client";

import { useTransition } from "react";
import { reportAction } from "./actions";

export function ReportButtons({ id, status, blocked }: { id: string; status: string; blocked: boolean }) {
  const [pending, start] = useTransition();
  const btn = "rounded-lg border px-2 py-1 text-xs disabled:opacity-40";
  return (
    <div className="flex flex-col gap-1">
      {!blocked && (
        <button disabled={pending} className={`${btn} text-red-300 hover:border-red-400`}
          onClick={() => confirm("Colocar este número na lista negra e remover dos grupos?") && start(async () => void (await reportAction(id, "bloquear")))}>⛔ Bloquear número</button>
      )}
      {status === "ATIVA" ? (
        <button disabled={pending} className={btn} onClick={() => confirm("Descartar esta denúncia? Ela some do !referencias.") && start(async () => void (await reportAction(id, "descartar")))}>Descartar</button>
      ) : (
        <button disabled={pending} className={btn} onClick={() => start(async () => void (await reportAction(id, "reativar")))}>Reativar</button>
      )}
    </div>
  );
}
