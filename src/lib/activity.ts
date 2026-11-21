import "server-only";
import { headers } from "next/headers";
import { db } from "./db";
import { getCurrentUser } from "./auth";

export const ACTIVITY_LABELS: Record<string, string> = {
  login: "Login",
  box_status_changed: "Caixa: status",
  box_shipping_paid_toggled: "Caixa: frete pago",
  box_updated: "Caixa: editada",
  box_archived: "Caixa: arquivada",
  auction_saved: "Leilão: salvo",
  auction_command: "Leilão: ação",
  invoice_command: "Invoice: ação",
  card_saved: "Carta/selado: salvo",
  card_deleted: "Carta/selado: excluído",
  card_toggled: "Carta/selado: catálogo",
  cards_imported: "Importação CSV",
  order_updated: "Pedido: atualizado",
  settings_updated: "Aparência e links",
  bot_group_updated: "Bot: grupo",
  mod_updated: "Moderação: configuração",
  sender_updated: "Envios: remetente",
  label_command: "Envios: etiqueta",
  review_deleted: "Avaliação removida",
  points_config: "Pontos: configuração",
  points_launch: "Pontos: lançamento",
  points_redemption: "Pontos: troca",
  points_auction: "Pontos: leilão",
  games_config: "Jogos: configuração",
  security_2fa: "Segurança: duas etapas",
};

/** Registra uma ação feita no painel. Nunca interrompe a ação principal se falhar. */
export async function logActivity(action: string, description: string, as?: { id: string; name: string }) {
  try {
    const [user, h] = await Promise.all([as ? Promise.resolve(as) : getCurrentUser(), headers()]);
    const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim();
    await db.activityLog.create({ data: { action, description, userId: user?.id ?? "", userName: user?.name ?? "Sistema", ip } });
  } catch {
    /* opcional */
  }
}
