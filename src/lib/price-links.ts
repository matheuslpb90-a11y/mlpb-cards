// Links para conferir o preço atualizado em outros sites (usados no painel).

/** Busca da carta na Liga Pokémon (preços do mercado brasileiro). */
export const ligaUrl = (name: string) => `https://www.ligapokemon.com.br/?view=cards/search&card=${encodeURIComponent(name.trim())}`;

/** Busca da carta na MYP Cards. */
export const mypSearchUrl = (name: string) => `https://mypcards.com/pokemon?ProdutoSearch%5Bquery%5D=${encodeURIComponent(name.trim())}`;
