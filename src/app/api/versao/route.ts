import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Qual versão do site está no ar (para conferir se a última publicação na Vercel entrou).
// ?db=1 também mede quanto tempo o banco de dados leva para responder (diagnóstico de lentidão).
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const out: Record<string, unknown> = {
    versao: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
    mensagem: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? "",
    regiao: process.env.VERCEL_REGION ?? "",
  };
  if (new URL(req.url).searchParams.get("db")) {
    const ms: number[] = [];
    for (let i = 0; i < 4; i++) {
      const t = performance.now();
      await db.$queryRaw`SELECT 1`;
      ms.push(Math.round(performance.now() - t));
    }
    out.bancoMs = ms;
  }
  return NextResponse.json(out);
}
