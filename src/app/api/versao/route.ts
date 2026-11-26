import { NextResponse } from "next/server";

// Qual versão do site está no ar (para conferir se a última publicação na Vercel entrou).
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({
    versao: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
    mensagem: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? "",
  });
}
