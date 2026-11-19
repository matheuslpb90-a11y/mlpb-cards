import { CardForm } from "@/components/admin/CardForm";

export default async function NewCardPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const kind = tipo === "produto" ? "PRODUTO" : "CARTA";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{kind === "PRODUTO" ? "Novo produto" : "Nova carta avulsa"}</h1>
      <CardForm
        key={kind}
        initial={{ kind, category: "", featured: false, name: "", game: "Pokémon", setName: "", number: "", rarity: "", condition: "NM", language: "Português", price: "", stock: 1, imageUrl: "", description: "", active: true }}
      />
    </div>
  );
}
