import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import SeedreamEditor from "@/components/designer/SeedreamEditor";

export default async function EditorPage() {
  let auth;
  try {
    auth = await requireRole(["designer", "admin"]);
  } catch {
    redirect("/sign-in");
  }

  return (
    <AppShell>
      <SeedreamEditor />
    </AppShell>
  );
}
