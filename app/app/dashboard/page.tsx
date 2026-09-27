import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  FileHeart,
  FileSignature,
  Files,
  Gift,
  Landmark,
  MapPinned,
  Plus,
  ScrollText,
} from "lucide-react";

import { StatusBadge, TypeBadge } from "@/components/deeds/badges";
import { deedTypeDescriptions, deedTypeLabels, type DeedType } from "@/lib/deeds";
import { getCurrentWorkspace } from "@/lib/workspace";
import type { Deed } from "@/types/database";

const deedIcons: Record<Exclude<DeedType, "other">, typeof FileSignature> = {
  sale: FileSignature,
  release: FileHeart,
  gift: Gift,
  partition: MapPinned,
  will: ScrollText,
};

export default async function DashboardPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [profileResult, totalResult, progressResult, reviewResult, generatedResult, usageResult, recentResult] =
    await Promise.all([
      workspace.supabase.from("profiles").select("full_name").eq("id", workspace.user.id).maybeSingle(),
      workspace.supabase.from("deeds").select("id", { count: "exact", head: true }).eq("firm_id", workspace.firm.id),
      workspace.supabase.from("deeds").select("id", { count: "exact", head: true }).eq("firm_id", workspace.firm.id).in("status", ["draft", "data_collection"]),
      workspace.supabase.from("deeds").select("id", { count: "exact", head: true }).eq("firm_id", workspace.firm.id).eq("status", "under_review"),
      workspace.supabase.from("deeds").select("id", { count: "exact", head: true }).eq("firm_id", workspace.firm.id).eq("status", "generated").gte("created_at", monthStart.toISOString()),
      workspace.supabase.from("deeds").select("id", { count: "exact", head: true }).eq("firm_id", workspace.firm.id).gte("created_at", monthStart.toISOString()),
      workspace.supabase.from("deeds").select("*").eq("firm_id", workspace.firm.id).order("updated_at", { ascending: false }).limit(8),
    ]);

  const name = profileResult.data?.full_name?.split(" ")[0] ?? "there";
  const cards = [
    { label: "Total deeds", value: totalResult.count ?? 0, icon: Files, tone: "bg-primary text-primary-foreground", href: "/app/deeds" },
    { label: "In progress", value: progressResult.count ?? 0, icon: FileSignature, tone: "bg-blue-50 text-blue-700", href: "/app/deeds?status=data_collection" },
    { label: "Under review", value: reviewResult.count ?? 0, icon: Landmark, tone: "bg-amber-50 text-amber-700", href: "/app/deeds?status=under_review" },
    { label: "Generated this month", value: generatedResult.count ?? 0, icon: ScrollText, tone: "bg-emerald-50 text-emerald-700", href: "/app/deeds?status=generated" },
  ];
  const recent = (recentResult.data ?? []) as Deed[];

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl tracking-tight text-primary">Good day, {name}.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Here is the current picture across {workspace.firm.name}.</p>
        </div>
        <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90" href="/app/deeds/new">
          <Plus className="size-4" /> Start a new deed
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone, href }) => (
          <Link className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md sm:p-5" href={href} key={label}>
            <div className={"grid size-9 place-items-center rounded-lg sm:size-10 " + tone}><Icon className="size-5" /></div>
            <p className="mt-4 text-2xl font-semibold tracking-tight text-primary sm:mt-5 sm:text-3xl">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-primary">Start a new deed</p>
            <p className="mt-1 text-sm text-muted-foreground">Choose a document type to begin collecting the matter details.</p>
          </div>
          <Link className="hidden items-center gap-1 text-sm font-semibold text-primary hover:underline sm:inline-flex" href="/app/deeds/new">
            See all <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {(Object.keys(deedIcons) as Array<Exclude<DeedType, "other">>).map((type) => {
            const Icon = deedIcons[type];
            return (
              <Link
                className="group rounded-xl border border-border p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary"
                href={"/app/deeds/new?type=" + type}
                key={type}
              >
                <Icon className="size-5 text-accent-foreground" />
                <p className="mt-5 text-sm font-semibold text-primary">{deedTypeLabels[type]}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{deedTypeDescriptions[type]}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-semibold text-primary">Recent deeds</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Your last eight updated matters.</p>
            </div>
            <Link className="text-sm font-semibold text-primary hover:underline" href="/app/deeds">View all</Link>
          </div>
          {recent.length ? (
            <>
            <ul className="divide-y divide-border md:hidden">
              {recent.map((deed) => (
                <li key={deed.id}>
                  <Link className="block px-4 py-3 hover:bg-secondary/40" href={"/app/deeds/" + deed.id}>
                    <p className="font-mono text-xs font-semibold text-muted-foreground">{deed.reference_no}</p>
                    <p className="mt-0.5 font-semibold leading-5 text-primary">{deed.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5"><TypeBadge type={deed.deed_type} /><StatusBadge status={deed.status} /><span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(deed.updated_at), { addSuffix: true })}</span></div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-5 py-3 font-semibold">Reference</th><th className="px-5 py-3 font-semibold">Title</th><th className="px-5 py-3 font-semibold">Type</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Updated</th><th className="px-5 py-3" /></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recent.map((deed) => (
                    <tr className="hover:bg-secondary/40" key={deed.id}>
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-primary">{deed.reference_no}</td>
                      <td className="px-5 py-3 font-medium text-foreground">{deed.title}</td>
                      <td className="px-5 py-3"><TypeBadge type={deed.deed_type} /></td>
                      <td className="px-5 py-3"><StatusBadge status={deed.status} /></td>
                      <td className="px-5 py-3 text-muted-foreground">{formatDistanceToNow(new Date(deed.updated_at), { addSuffix: true })}</td>
                      <td className="px-5 py-3"><Link className="font-semibold text-primary hover:underline" href={"/app/deeds/" + deed.id}>Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <div className="px-5 py-14 text-center">
              <Files className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-semibold text-primary">No deeds yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Start your first matter to see it here.</p>
              <Link className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline" href="/app/deeds/new">Create a deed</Link>
            </div>
          )}
        </div>
        <aside className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <p className="text-sm font-semibold text-primary">Plan usage</p>
          <p className="mt-2 text-2xl font-semibold text-primary">Free plan</p>
          <p className="mt-1 text-sm text-muted-foreground">{usageResult.count ?? 0} of 10 deeds used this month</p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-accent" style={{ width: Math.min(((usageResult.count ?? 0) / 10) * 100, 100) + "%" }} />
          </div>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">Add parties, property and payments inside a deed, then export a ready-to-review Word draft from its Generate tab.</p>
          <Link className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline" href="/app/billing">View plan details</Link>
        </aside>
      </section>
    </div>
  );
}
