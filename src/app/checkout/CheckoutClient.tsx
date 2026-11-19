"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useCart } from "@/components/CartProvider";
import { formatBRL } from "@/lib/money";
import { shippingOptions, type ShippingMethod } from "@/lib/shipping";
import { cartMessage, whatsappLink } from "@/lib/whatsapp";
import { checkoutAction } from "../actions";

type Props = {
  demoMode: boolean;
  user: { name: string; email: string; cep: string; address: string } | null;
};

export function CheckoutClient({ user, demoMode }: Props) {
  const { items, count, subtotalCents, clear, loaded } = useCart();
  const [method, setMethod] = useState<ShippingMethod | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [whatsName, setWhatsName] = useState(user?.name ?? "");

  const options = useMemo(() => (user ? shippingOptions(user.cep, count) : []), [user, count]);
  const shipping = options.find((o) => o.method === method);

  if (!loaded) return null;
  if (items.length === 0)
    return (
      <div className="card p-10 text-center">
        <p className="mb-4 text-slate-500">Seu carrinho está vazio.</p>
        <Link href="/" className="btn-primary">Ver catálogo</Link>
      </div>
    );

  function pay() {
    if (!method) return setError("Escolha uma forma de envio.");
    setError("");
    startTransition(async () => {
      const res = await checkoutAction(items.map((i) => ({ cardId: i.cardId, quantity: i.quantity })), method);
      if (res.error) return setError(res.error);
      if (res.url) {
        clear();
        window.location.href = res.url;
      }
    });
  }

  const waHref = whatsappLink(cartMessage(items, whatsName.trim() || undefined));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Finalizar compra</h1>

      <div className="card p-4">
        <h2 className="mb-2 font-semibold">Suas cartas ({count})</h2>
        <ul className="divide-y text-sm">
          {items.map((i) => (
            <li key={i.cardId} className="flex justify-between py-1">
              <span>{i.quantity}x {i.name} <span className="text-slate-500">({i.setName})</span></span>
              <span>{formatBRL(i.priceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t pt-2 font-bold">
          <span>Subtotal</span><span>{formatBRL(subtotalCents)}</span>
        </div>
        <Link href="/carrinho" className="mt-2 inline-block text-sm text-brand hover:underline">Editar carrinho</Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* OPÇÃO 1 — cadastro + pagamento + frete/acumular */}
        <section className="card flex flex-col gap-4 border-2 border-brand/30 p-5">
          <div>
            <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">Opção 1</span>
            <h2 className="mt-2 text-lg font-bold">Pagar agora pelo site</h2>
            <p className="text-sm text-slate-600">Crie seu cadastro, escolha o frete (ou acumule) e pague com a InfinitePay: Pix ou cartão.</p>
          </div>

          {!user ? (
            <div className="space-y-2">
              <Link href="/cadastro?next=/checkout" className="btn-primary w-full">Criar cadastro</Link>
              <Link href="/entrar?next=/checkout" className="btn-outline w-full">Já tenho conta — entrar</Link>
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-semibold">Entregar para {user.name}</p>
                <p className="text-slate-600">{user.address}</p>
                <Link href="/minha-conta#dados" className="text-xs text-brand hover:underline">Alterar endereço</Link>
              </div>

              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-semibold">Forma de envio</legend>
                {options.map((o) => (
                  <label key={o.method} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${method === o.method ? "border-brand bg-brand-light" : "border-slate-200"}`}>
                    <input type="radio" name="shipping" checked={method === o.method} onChange={() => setMethod(o.method)} />
                    <span className="flex-1">
                      <span className="flex justify-between font-medium">
                        <span>{o.label}</span>
                        <span>{o.priceCents === 0 ? "R$ 0,00 agora" : formatBRL(o.priceCents)}</span>
                      </span>
                      <span className="block text-xs text-slate-600">{o.description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="flex justify-between border-t pt-3 text-lg font-bold">
                <span>Total</span>
                <span>{formatBRL(subtotalCents + (shipping?.priceCents ?? 0))}</span>
              </div>

              {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
              <button className="btn-primary w-full py-3" onClick={pay} disabled={pending || !method}>
                {pending ? "Gerando pagamento…" : "Pagar com InfinitePay"}
              </button>
              {demoMode && (
                <p className="text-xs text-amber-700">Modo demonstração: a InfinitePay ainda não está configurada (INFINITEPAY_HANDLE).</p>
              )}
            </>
          )}
        </section>

        {/* OPÇÃO 2 — finalizar pelo WhatsApp */}
        <section className="card flex flex-col gap-4 border-2 border-whats/40 p-5">
          <div>
            <span className="rounded-full bg-whats px-2 py-0.5 text-xs font-bold text-white">Opção 2</span>
            <h2 className="mt-2 text-lg font-bold">Finalizar pelo WhatsApp</h2>
            <p className="text-sm text-slate-600">
              Sem cadastro. Enviamos a lista das cartas que você escolheu para o WhatsApp da MLPB Cards e você combina o pagamento e o envio direto com a loja.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="wname">Seu nome (opcional)</label>
            <input id="wname" className="input" value={whatsName} onChange={(e) => setWhatsName(e.target.value)} placeholder="Como podemos te chamar?" />
          </div>
          <a href={waHref} target="_blank" rel="noreferrer" className="btn-whats mt-auto w-full py-3">
            Finalizar compra no WhatsApp
          </a>
          <p className="text-xs text-slate-500">As cartas ficam no seu carrinho até você esvaziá-lo.</p>
        </section>
      </div>
    </div>
  );
}
