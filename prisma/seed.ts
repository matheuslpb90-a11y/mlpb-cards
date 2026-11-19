import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@mlpbcards.com.br").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "troque-esta-senha";
  const existing = await db.user.findUnique({ where: { email } });
  if (!existing) {
    await db.user.create({
      data: {
        email, name: "Administrador MLPB", passwordHash: await bcrypt.hash(password, 10), role: "ADMIN",
        phone: "", cpf: "", cep: process.env.STORE_ORIGIN_CEP ?? "01001000", street: "", number: "", neighborhood: "", city: "", state: "SP",
      },
    });
    console.log(`Admin criado: ${email}`);
  } else if (existing.role !== "ADMIN") {
    await db.user.update({ where: { email }, data: { role: "ADMIN" } });
    console.log(`Usuário ${email} promovido a admin`);
  }

  if ((await db.card.count()) === 0 && process.env.SEED_SAMPLE_CARDS !== "0") {
    await db.card.createMany({
      data: [
        { name: "Pikachu", game: "Pokémon", setName: "Escarlate e Violeta 151", number: "025/165", rarity: "Comum", priceCents: 490, stock: 5 },
        { name: "Charizard ex", game: "Pokémon", setName: "Obsidiana em Chamas", number: "125/197", rarity: "Rara Dupla", priceCents: 8990, stock: 1 },
        { name: "Mewtwo", game: "Pokémon", setName: "Escarlate e Violeta 151", number: "150/165", rarity: "Rara", priceCents: 1990, stock: 2 },
      ],
    });
    console.log("Cartas de exemplo criadas (apague pelo painel).");
  }
}

main().finally(() => db.$disconnect());
