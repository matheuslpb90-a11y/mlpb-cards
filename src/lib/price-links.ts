// Links para conferir o preço atualizado da carta em outros sites.
// Usados no painel e, para o cliente, abaixo do preço na página da carta.

const q = (s: string) => encodeURIComponent(s.trim());

// ---- Brasil ----

/** Busca da carta na Liga Pokémon (mercado brasileiro).
 *  A Liga nomeia as cartas como "Charizard ex (199/165)": com o número, a busca cai na impressão certa. */
export const ligaUrl = (name: string, number = "") => {
  const n = number.trim();
  return `https://www.ligapokemon.com.br/?view=cards/search&card=${q(`${name.trim()}${n ? ` (${n})` : ""}`)}`;
};

/** Busca da carta na MYP Cards (mercado brasileiro). Com o número, cai na impressão certa. */
export const mypSearchUrl = (name: string, number = "") =>
  `https://mypcards.com/pokemon?ProdutoSearch%5Bquery%5D=${q(`${name}${number ? ` ${number}` : ""}`)}`;

// ---- Mundo ----

/** TCGplayer: maior mercado dos EUA (preços em dólar). */
export const tcgplayerUrl = (name: string, number = "") =>
  `https://www.tcgplayer.com/search/pokemon/product?q=${q(`${name}${number ? ` ${number}` : ""}`)}&productLineName=pokemon`;

/** Cardmarket: maior mercado da Europa (preços em euro). */
export const cardmarketUrl = (name: string, number = "") =>
  `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${q(`${name}${number ? ` ${number}` : ""}`)}`;

export type PriceLink = { nome: string; url: string; regiao: "BR" | "US" | "EU"; moeda: string };

/** Lista pronta de onde conferir o preço de uma carta, para montar os botões. */
export function priceLinks(name: string, number = ""): PriceLink[] {
  return [
    { nome: "MYP", url: mypSearchUrl(name, number), regiao: "BR", moeda: "R$" },
    { nome: "Liga Pokémon", url: ligaUrl(name, number), regiao: "BR", moeda: "R$" },
    { nome: "TCGplayer", url: tcgplayerUrl(name, number), regiao: "US", moeda: "US$" },
    { nome: "Cardmarket", url: cardmarketUrl(name, number), regiao: "EU", moeda: "€" },
  ];
}
