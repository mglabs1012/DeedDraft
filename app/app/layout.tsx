import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getCurrentWorkspace } from "@/lib/workspace";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) redirect("/onboarding");

  const { supabase, user, firm } = workspace;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  return (
    <AppShell
      firmName={firm.name}
      labels={dictionary.nav}
      locale={locale}
      userEmail={user.email ?? ""}
      userName={profile?.full_name ?? user.email?.split("@")[0] ?? "User"}
    >
      {children}
    </AppShell>
  );
}
