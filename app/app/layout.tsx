import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { normaliseTourPreferences } from "@/lib/onboarding";
import { getCurrentWorkspace } from "@/lib/workspace";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) redirect("/onboarding");
  const { data: profile } = await workspace.supabase.from("profiles").select("full_name").eq("id", workspace.user.id).maybeSingle();
  // Guided tour state lives on the account, so it follows the user across devices.
  const tour = { initial: normaliseTourPreferences(workspace.user.user_metadata?.tour), accountCreatedAt: workspace.user.created_at };
  return <AppShell firmName={workspace.firm.name} userId={workspace.user.id} userName={profile?.full_name ?? "Account"} tour={tour}>{children}</AppShell>;
}
