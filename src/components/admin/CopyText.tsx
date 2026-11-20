"use client";
import { useState } from "react";

/** Botão que copia um texto grande (ex.: Registro do bot) para colar no chat de suporte. */
export function CopyText({ text, label = "📋 Copiar registro" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="btn-outline text-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const t = document.createElement("textarea");
          t.value = text;
          document.body.appendChild(t);
          t.select();
          document.execCommand("copy");
          t.remove();
        }
        setOk(true);
        setTimeout(() => setOk(false), 2500);
      }}
    >
      {ok ? "✔ Copiado — cole na conversa" : label}
    </button>
  );
}
