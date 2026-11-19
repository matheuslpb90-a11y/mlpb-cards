import { emptyLot, toBrtParts, type AuctionDraft } from "@/lib/auction-draft";
import { AuctionEditor } from "../AuctionEditor";

export default function NewAuctionPage() {
  const tomorrow = toBrtParts(new Date(Date.now() + 24 * 60 * 60 * 1000)).date;
  const initial: AuctionDraft = {
    name: "", description: "", imageUrl: "", startDate: tomorrow, startTime: "19:00", endDate: tomorrow, endTime: "22:00",
    paymentDays: 3, initialPct: 20, buyoutPct: 30, defaultStep: "", oneReal: false, infinitepayHandle: "", visible: true, lots: [emptyLot(1)],
  };
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Novo leilão</h1>
      <AuctionEditor initial={initial} blobEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)} locked={false} />
    </div>
  );
}
