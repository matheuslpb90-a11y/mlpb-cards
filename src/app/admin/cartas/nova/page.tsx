import { CardForm } from "@/components/admin/CardForm";

export default function NewCardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nova carta</h1>
      <CardForm
        initial={{ name: "", game: "Pokémon", setName: "", number: "", rarity: "", condition: "NM", language: "Português", price: "", stock: 1, imageUrl: "", description: "", active: true }}
      />
    </div>
  );
}
