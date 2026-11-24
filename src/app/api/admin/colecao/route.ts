import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSet, listSets } from "@/lib/tcgdex-sets";
import { variantsForCard, variantsForSet } from "@/lib/stock-variants";

// GET                         → lista de coleções
// GET ?id=me02.5&nome=...      → cartas da coleção + versões já em estoque
// GET ?estoque=1&name=&set=&num= → versões em estoque de uma carta (tela de cadastro avulso)
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão" }, { status: 401 });
  const u = new URL(req.url);
  try {
    if (u.searchParams.get("estoque")) {
      const variants = await variantsForCard(u.searchParams.get("name") ?? "", u.searchParams.get("set") ?? "", u.searchParams.get("num") ?? "");
      return NextResponse.json({ variants });
    }
    const id = u.searchParams.get("id");
    if (!id) return NextResponse.json({ sets: await listSets() });
    const set = await getSet(id);
    const variants = await variantsForSet([set.nameEn, set.namePt, u.searchParams.get("nome") ?? ""]);
    return NextResponse.json({ set, variants });
  } catch (e) {
    return NextResponse.json({ error: `Não consegui consultar a base de cartas agora (${String(e)}). Tente de novo em instantes.` }, { status: 502 });
  }
}
