"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

/** Imagem que, se não abrir, tenta a próxima da lista; se nenhuma abrir, mostra o ícone. */
export function SafeImg({ srcs, className = "", fallback = "🔨", alt = "" }: { srcs: string[]; className?: string; fallback?: string; alt?: string }) {
  const list = srcs.filter(Boolean);
  const [i, setI] = useState(0);
  if (i >= list.length)
    return <div className={`flex items-center justify-center rounded-lg bg-slate-100 text-3xl ${className}`}>{fallback}</div>;
  return <img src={list[i]} alt={alt} className={className} onError={() => setI(i + 1)} />;
}
