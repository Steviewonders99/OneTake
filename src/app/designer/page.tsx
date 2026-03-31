import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import DesignerCampaignList from "@/components/designer/DesignerCampaignList";

export default async function DesignerPortal() {
  let auth;
  try {
    auth = await requireRole(["designer", "admin"]);
  } catch {
    redirect("/sign-in");
  }

  return (
    <AppShell>
      <DesignerCampaignList />
    </AppShell>
  );
}
