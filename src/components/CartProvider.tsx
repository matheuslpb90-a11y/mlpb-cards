"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  cardId: string;
  name: string;
  setName: string;
  priceCents: number;
  imageUrl: string;
  stock: number;
  quantity: number;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQuantity: (cardId: string, qty: number) => void;
  remove: (cardId: string) => void;
  clear: () => void;
  loaded: boolean;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "mlpb_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items, loaded]);

  const value = useMemo<CartCtx>(
    () => ({
      items,
      loaded,
      count: items.reduce((s, i) => s + i.quantity, 0),
      subtotalCents: items.reduce((s, i) => s + i.quantity * i.priceCents, 0),
      add: (item, qty = 1) =>
        setItems((prev) => {
          const existing = prev.find((i) => i.cardId === item.cardId);
          if (existing)
            return prev.map((i) =>
              i.cardId === item.cardId ? { ...i, ...item, quantity: Math.min(i.quantity + qty, item.stock) } : i,
            );
          return [...prev, { ...item, quantity: Math.min(qty, item.stock) }];
        }),
      setQuantity: (cardId, qty) =>
        setItems((prev) =>
          prev
            .map((i) => (i.cardId === cardId ? { ...i, quantity: Math.max(0, Math.min(qty, i.stock)) } : i))
            .filter((i) => i.quantity > 0),
        ),
      remove: (cardId) => setItems((prev) => prev.filter((i) => i.cardId !== cardId)),
      clear: () => setItems([]),
    }),
    [items, loaded],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart fora do CartProvider");
  return ctx;
}
