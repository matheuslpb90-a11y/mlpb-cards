import "server-only";

// Cálculo de frete.
//  • Com SUPERFRETE_TOKEN configurado: cotação em tempo real na SuperFrete
//    (PAC, SEDEX e Mini Envios), usando o CEP de origem da loja.
//  • Sem token: tabela regional simples (para testes/desenvolvimento).
// Em ambos os casos é oferecida a opção "Acumular pedido" (frete zero agora).
//
// IMPORTANTE: confira os campos com a documentação atual da SuperFrete
// (https://superfrete.readme.io) antes de ir para produção.

export type ShippingOption = {
  id: string; // ex.: "SF-1", "SF-2", "SF-17", "TAB-PAC", "ACUMULAR"
  label: string;
  description: string;
  priceCents: number;
};

export const ACCUMULATE = "ACUMULAR";

const SF_URL =
  process.env.SUPERFRETE_API_URL ||
  (process.env.SUPERFRETE_SANDBOX === "1" ? "https://sandbox.superfrete.com" : "https://api.superfrete.com");
const SF_TOKEN = process.env.SUPERFRETE_TOKEN ?? "";
// 1 = PAC, 2 = SEDEX, 17 = Mini Envios (ótimo para cartas avulsas)
const SF_SERVICES = process.env.SUPERFRETE_SERVICES ?? "1,2,17";

// Embalagem padrão de cartas (ajuste à sua realidade).
const PACKAGE_BASE_KG = 0.05; // envelope + proteção
const KG_PER_CARD = 0.005; // carta com sleeve/toploader
const PACKAGE_WIDTH_CM = 11;
const PACKAGE_LENGTH_CM = 16;
const CARDS_PER_CM_HEIGHT = 40;

export function superFreteEnabled() {
  return SF_TOKEN.length > 0;
}

function accumulateOption(): ShippingOption {
  return {
    id: ACCUMULATE,
    label: "Acumular pedido",
    description: "Pague só as cartas agora. Elas ficam guardadas na loja e você paga um único frete quando pedir o envio.",
    priceCents: 0,
  };
}

export async function quoteShipping(destCep: string, totalCards: number, subtotalCents: number): Promise<ShippingOption[]> {
  const cep = destCep.replace(/\D/g, "");
  const paid = superFreteEnabled() ? await superFreteQuote(cep, totalCards, subtotalCents) : tableQuote(cep, totalCards);
  return [...paid.sort((a, b) => a.priceCents - b.priceCents), accumulateOption()];
}

async function superFreteQuote(cep: string, totalCards: number, subtotalCents: number): Promise<ShippingOption[]> {
  const origin = (process.env.STORE_ORIGIN_CEP ?? "").replace(/\D/g, "");
  if (origin.length !== 8) throw new Error("CEP de origem da loja (STORE_ORIGIN_CEP) não configurado.");

  const res = await fetch(`${SF_URL}/api/v0/calculator`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SF_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": process.env.SUPERFRETE_USER_AGENT ?? "MLPB Cards (www.mlpbcards.com.br)",
    },
    body: JSON.stringify({
      from: { postal_code: origin },
      to: { postal_code: cep },
      services: SF_SERVICES,
      options: {
        own_hand: false,
        receipt: false,
        insurance_value: subtotalCents / 100,
        use_insurance_value: false,
      },
      package: {
        height: Math.max(2, Math.ceil(totalCards / CARDS_PER_CM_HEIGHT) + 1),
        width: PACKAGE_WIDTH_CM,
        length: PACKAGE_LENGTH_CM,
        weight: Number((PACKAGE_BASE_KG + KG_PER_CARD * totalCards).toFixed(3)),
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("SuperFrete erro", res.status, text.slice(0, 300));
    throw new Error("Não foi possível calcular o frete agora. Tente novamente em instantes ou finalize pelo WhatsApp.");
  }

  type SFService = {
    id: number;
    name: string;
    price?: number | string;
    custom_price?: number | string;
    delivery_time?: number;
    custom_delivery_time?: number;
    error?: string;
    has_error?: boolean;
  };
  const data = (await res.json()) as SFService[] | { data?: SFService[] };
  const list = Array.isArray(data) ? data : data.data ?? [];

  const options = list
    .filter((s) => !s.error && !s.has_error && Number(s.price ?? s.custom_price) > 0)
    .map((s) => {
      const price = Number(s.price ?? s.custom_price);
      const days = s.delivery_time ?? s.custom_delivery_time;
      return {
        id: `SF-${s.id}`,
        label: s.name,
        description: days ? `Entrega em até ${days} dia(s) útil(eis)` : "Prazo informado no envio",
        priceCents: Math.round(price * 100),
      };
    });
  if (options.length === 0)
    throw new Error("Nenhuma forma de envio disponível para este CEP. Confira o CEP ou finalize pelo WhatsApp.");
  return options;
}

// ---- Tabela regional (usada só quando a SuperFrete não está configurada) ----
const PAC_CENTS = [1800, 1800, 2200, 2200, 2800, 3200, 3800, 3000, 2400, 2600];
const SEDEX_CENTS = [2500, 2500, 3500, 3500, 4800, 5500, 6500, 5000, 3800, 4200];

function tableQuote(cep: string, totalCards: number): ShippingOption[] {
  const region = cep.length === 8 ? Number(cep[0]) : 9;
  const extra = Math.max(0, totalCards - 20) * 10;
  return [
    { id: "TAB-PAC", label: "PAC", description: "Valor estimado (tabela)", priceCents: PAC_CENTS[region] + extra },
    { id: "TAB-SEDEX", label: "SEDEX", description: "Valor estimado (tabela)", priceCents: SEDEX_CENTS[region] + extra },
  ];
}
