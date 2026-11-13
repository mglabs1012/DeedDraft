import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { normaliseTourPreferences } from "@/lib/onboarding";
import { getCurrentWorkspace, requireUser } from "@/lib/workspace";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  // The profile name loads alongside the firm instead of after it.
  const [workspace, { data: profile }] = await Promise.all([
    getCurrentWorkspace(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!workspace) redirect("/onboarding");
  // Guided tour state lives on the account, so it follows the user across devices.
  const tour = { initial: normaliseTourPreferences(workspace.user.user_metadata?.tour), accountCreatedAt: workspace.user.created_at };
  return <AppShell firmName={workspace.firm.name} userId={workspace.user.id} userName={profile?.full_name ?? "Account"} tour={tour}>{children}</AppShell>;
}
