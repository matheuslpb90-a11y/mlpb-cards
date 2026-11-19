"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { CardImage } from "@/components/CardImage";
import { formatBRL } from "@/lib/money";

export default function CartPage() {
  const { items, setQuantity, remove, subtotalCents, count, clear, loaded } = useCart();

  if (!loaded) return null;
  if (items.length === 0)
    return (
      <div className="card p-10 text-center">
        <p className="mb-4 text-slate-500">Seu carrinho está vazio.</p>
        <Link href="/" className="btn-primary">Ver catálogo</Link>
      </div>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="card divide-y">
        {items.map((i) => (
          <div key={i.cardId} className="flex items-center gap-4 p-4">
            <div className="w-16 shrink-0"><CardImage src={i.imageUrl} alt={i.name} /></div>
            <div className="min-w-0 flex-1">
              <Link href={`/cartas/${i.cardId}`} className="font-semibold hover:underline">{i.name}</Link>
              <p className="text-xs text-slate-500">{i.setName}</p>
              <p className="text-sm">{formatBRL(i.priceCents)} cada</p>
            </div>
            <div className="flex items-center gap-1">
              <button className="btn-outline px-3" onClick={() => setQuantity(i.cardId, i.quantity - 1)} aria-label="Diminuir">−</button>
              <span className="w-8 text-center font-semibold">{i.quantity}</span>
              <button className="btn-outline px-3" disabled={i.quantity >= i.stock} onClick={() => setQuantity(i.cardId, i.quantity + 1)} aria-label="Aumentar">+</button>
            </div>
            <div className="w-24 text-right font-semibold">{formatBRL(i.priceCents * i.quantity)}</div>
            <button className="text-sm text-red-600 hover:underline" onClick={() => remove(i.cardId)}>Remover</button>
          </div>
        ))}
      </div>
      <aside className="card h-fit space-y-4 p-5">
        <h2 className="text-lg font-bold">Resumo</h2>
        <div className="flex justify-between"><span>{count} item(ns)</span><span className="font-bold">{formatBRL(subtotalCents)}</span></div>
        <p className="text-xs text-slate-500">O frete é calculado no checkout.</p>
        <Link href="/checkout" className="btn-primary w-full">Ir para o checkout</Link>
        <Link href="/" className="btn-outline w-full">Continuar comprando</Link>
        <button className="w-full text-sm text-slate-500 hover:underline" onClick={() => confirm("Esvaziar o carrinho?") && clear()}>Esvaziar carrinho</button>
      </aside>
    </div>
  );
}
