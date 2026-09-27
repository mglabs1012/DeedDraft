import { CircleUserRound, UserPlus } from "lucide-react";

import { FirmSettingsForm } from "@/components/settings/firm-settings-form";
import { getCurrentWorkspace } from "@/lib/workspace";
import type { FirmMember } from "@/types/database";

export default async function SettingsPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;
  const { data: memberData } = await workspace.supabase
    .from("firm_members")
    .select("*")
    .eq("firm_id", workspace.firm.id)
    .order("created_at");
  const members = (memberData ?? []) as FirmMember[];
  const { data: profiles } = await workspace.supabase.from("profiles").select("id, full_name").in("id", members.map((member) => member.user_id));
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));

  return (
    <div className="max-w-4xl space-y-7">
      <div><p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">Workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Firm settings</h1><p className="mt-2 text-sm text-muted-foreground">Manage the visible details for your current firm workspace.</p></div>
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-primary">Firm profile</h2><p className="mt-1 text-sm text-muted-foreground">These details appear in the workspace navigation and future document headers.</p><div className="mt-6"><FirmSettingsForm canEdit={workspace.membership.role === "owner"} firm={workspace.firm} /></div></section>
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center"><div><h2 className="font-semibold text-primary">Members</h2><p className="mt-1 text-sm text-muted-foreground">Team invitations will be available soon.</p></div><button className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-muted-foreground" onClick={() => {}}><UserPlus className="size-4" /> Invite member · Coming soon</button></div>
        <div className="divide-y divide-border">{members.map((member) => <div className="flex items-center justify-between gap-4 px-5 py-4" key={member.id}><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-secondary text-primary"><CircleUserRound className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-primary">{names.get(member.user_id) ?? "Firm member"}</p><p className="font-mono text-xs text-muted-foreground">{member.user_id.slice(0, 8)}…</p></div></div><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold capitalize text-secondary-foreground">{member.role}</span></div>)}</div>
      </section>
    </div>
  );
}
