"use client";
import { useState } from "react";
import { useCart, type CartItem } from "./CartProvider";

export function AddToCartButton({ card, className }: { card: Omit<CartItem, "quantity">; className?: string }) {
  const { add, items } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = items.find((i) => i.cardId === card.cardId)?.quantity ?? 0;
  const soldOut = card.stock <= 0;
  const maxed = inCart >= card.stock;

  return (
    <button
      type="button"
      className={`btn-primary w-full ${className ?? ""}`}
      disabled={soldOut || maxed}
      onClick={() => {
        add(card);
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
    >
      {soldOut ? "Esgotada" : maxed ? "Máximo no carrinho" : added ? "Adicionada ✓" : "Adicionar ao carrinho"}
    </button>
  );
}
