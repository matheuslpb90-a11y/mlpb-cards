import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function AppearancePage() {
  const s = await getSettings();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Aparência e links</h1>
      <SettingsForm initial={s} />
    </div>
  );
}
