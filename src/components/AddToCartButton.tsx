"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={soldOut ? "esgotada" : maxed ? "max" : added ? "ok" : "add"}
          className="inline-block"
          initial={{ opacity: 0, y: 6, scale: added ? 0.85 : 1 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6 }}
          transition={added ? { type: "spring", stiffness: 500, damping: 22 } : { duration: 0.15 }}
        >
          {soldOut ? "Esgotada" : maxed ? "Máximo no carrinho" : added ? "Adicionada ✓" : "Adicionar ao carrinho"}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
