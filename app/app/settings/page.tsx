import { CircleUserRound, UserPlus } from "lucide-react";

import { FirmSettingsForm } from "@/components/settings/firm-settings-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { getCurrentWorkspace } from "@/lib/workspace";
import type { FirmMember } from "@/types/database";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;
  const { data: memberData } = await workspace.supabase
    .from("firm_members")
    .select("*")
    .eq("firm_id", workspace.firm.id)
    .order("created_at");
  const members = (memberData ?? []) as FirmMember[];
  const { data: profiles } = await workspace.supabase.from("profiles").select("id, full_name, phone").in("id", members.map((member) => member.user_id));
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  const me = profiles?.find((profile) => profile.id === workspace.user.id);

  return (
    <div className="max-w-4xl space-y-6 sm:space-y-7">
      <div><p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">Workspace</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">Settings</h1><p className="mt-2 text-sm text-muted-foreground">Manage your profile and the details of your firm workspace.</p></div>
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-primary">Your profile</h2><p className="mt-1 text-sm text-muted-foreground">Shown to colleagues in this firm.</p><div className="mt-6"><ProfileForm email={workspace.user.email ?? ""} fullName={me?.full_name ?? ""} phone={me?.phone ?? ""} /></div></section>
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-primary">Firm profile</h2><p className="mt-1 text-sm text-muted-foreground">These details appear in the workspace and at the foot of generated drafts.</p><div className="mt-6"><FirmSettingsForm canEdit={workspace.membership.role === "owner"} firm={workspace.firm} /></div></section>
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:px-5"><div><h2 className="font-semibold text-primary">Members</h2><p className="mt-1 text-sm text-muted-foreground">Team invitations will be available soon.</p></div><span aria-disabled="true" className="inline-flex h-9 cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-muted-foreground"><UserPlus className="size-4" /> Invite member · Coming soon</span></div>
        <div className="divide-y divide-border">{members.map((member) => <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5" key={member.id}><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-primary"><CircleUserRound className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-primary">{names.get(member.user_id) ?? "Firm member"}{member.user_id === workspace.user.id ? <span className="font-normal text-muted-foreground"> (you)</span> : null}</p><p className="font-mono text-xs text-muted-foreground">{member.user_id.slice(0, 8)}…</p></div></div><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold capitalize text-secondary-foreground">{member.role}</span></div>)}</div>
      </section>
    </div>
  );
}
