import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getLocale } from "@/lib/i18n";
import { getCurrentWorkspace } from "@/lib/workspace";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) redirect("/onboarding");
  const [{ data: profile }, locale] = await Promise.all([
    workspace.supabase.from("profiles").select("full_name").eq("id", workspace.user.id).maybeSingle(),
    getLocale(),
  ]);
  return <AppShell firmName={workspace.firm.name} locale={locale} userName={profile?.full_name ?? "Account"}>{children}</AppShell>;
}
