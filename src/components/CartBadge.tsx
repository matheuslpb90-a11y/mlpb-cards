"use client";
import Link from "next/link";
import { useCart } from "./CartProvider";

export function CartBadge() {
  const { count } = useCart();
  return (
    <Link href="/carrinho" className="relative rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-white">
      🛒 Carrinho
      {count > 0 && (
        <span className="ml-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-gray-950">{count}</span>
      )}
    </Link>
  );
}
