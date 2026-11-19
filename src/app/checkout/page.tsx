import { getCurrentUser } from "@/lib/auth";
import { infinitePayEnabled } from "@/lib/infinitepay";
import { CheckoutClient } from "./CheckoutClient";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  return (
    <CheckoutClient
      demoMode={!infinitePayEnabled()}
      user={
        user && {
          name: user.name,
          email: user.email,
          cep: user.cep,
          address: `${user.street}, ${user.number}${user.complement ? ` - ${user.complement}` : ""} · ${user.neighborhood} · ${user.city}/${user.state}`,
        }
      }
    />
  );
}
