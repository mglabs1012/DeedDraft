import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentWorkspace } from "@/lib/workspace";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) redirect("/onboarding");
  const { data: profile } = await workspace.supabase.from("profiles").select("full_name").eq("id", workspace.user.id).maybeSingle();
  return <AppShell firmName={workspace.firm.name} userId={workspace.user.id} userName={profile?.full_name ?? "Account"}>{children}</AppShell>;
}
