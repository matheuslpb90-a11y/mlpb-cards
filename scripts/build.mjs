// Build usado na hospedagem (Vercel). Prepara o banco automaticamente:
//  1. gera o cliente do banco
//  2. cria/atualiza as tabelas (prisma db push)
//  3. cria o usuário administrador (prisma db seed)
//  4. gera o site (next build)
// Se o banco ainda não estiver conectado, o site é gerado mesmo assim e avisa no log.
import { execSync } from "node:child_process";

const env = { ...process.env };
// A integração Neon da Vercel cria DATABASE_URL (com pool) e DATABASE_URL_UNPOOLED (direta).
env.DATABASE_URL_UNPOOLED ||= env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL || "";
env.DATABASE_URL ||= env.POSTGRES_PRISMA_URL || env.POSTGRES_URL || env.DATABASE_URL_UNPOOLED || "";

const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

run("prisma generate");
if (env.DATABASE_URL) {
  run("prisma db push --skip-generate");
  run("prisma db seed");
} else {
  console.warn("\n⚠️  Banco de dados não conectado (DATABASE_URL ausente). Conecte o Neon em Storage e faça Redeploy.\n");
}
run("next build");
