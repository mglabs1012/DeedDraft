import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { activityLabel } from "@/lib/deeds";
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
  const { data: activityData } = await supabase
    .from("activity_log")
    .select("id, action, created_at, deed_id")
    .eq("firm_id", firm.id)
    .order("created_at", { ascending: false })
    .limit(8);
  const activity = activityData ?? [];
  const deedIds = [...new Set(activity.map((item) => item.deed_id).filter((id): id is string => Boolean(id)))];
  const { data: deedTitles } = deedIds.length
    ? await supabase.from("deeds").select("id, title").in("id", deedIds)
    : { data: [] as Array<{ id: string; title: string }> };
  const titles = new Map((deedTitles ?? []).map((deed) => [deed.id, deed.title]));
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  return (
    <AppShell
      firmName={firm.name}
      notifications={activity.map((item) => ({
        id: item.id,
        label: activityLabel(item.action),
        createdAt: item.created_at,
        href: item.deed_id && titles.has(item.deed_id) ? "/app/deeds/" + item.deed_id : null,
        deedTitle: item.deed_id ? titles.get(item.deed_id) ?? null : null,
      }))}
      labels={dictionary.nav}
      locale={locale}
      userEmail={user.email ?? ""}
      userName={profile?.full_name ?? user.email?.split("@")[0] ?? "User"}
    >
      {children}
    </AppShell>
  );
}
