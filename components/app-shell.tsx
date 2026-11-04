"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, FolderOpen, House, Plus, Scale, UserRound } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { GuidedTour } from "@/components/guided-tour";

const links = [
  { href: "/app/dashboard", label: "Home", icon: House, active: (path: string) => path === "/app/dashboard" },
  { href: "/app/deeds", label: "My deeds", icon: FolderOpen, active: (path: string) => path.startsWith("/app/deeds") && path !== "/app/deeds/new" },
];

export function AppShell({ children, firmName, userName, userId }: {
  children: React.ReactNode; firmName: string; userName: string; userId: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", key); };
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-4">Skip to workspace</a>
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex h-14 max-w-[1800px] items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-7 lg:px-10">
          <Link href="/app/dashboard" aria-label="DeedDraft home" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-primary"><Scale className="size-5" /><span className="hidden sm:inline">DeedDraft</span></Link>
          <nav aria-label="Main navigation" className="flex min-w-0 items-center gap-1 text-sm sm:gap-3">
            {links.map(({ href, label, icon: Icon, active }) => (
              <Link key={href} href={href} aria-current={active(path) ? "page" : undefined} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 hover:text-primary", active(path) ? "font-medium text-primary" : "text-muted-foreground")}>
                <Icon className="size-4 sm:hidden" aria-hidden="true" />{label}
              </Link>
            ))}
            <Link href="/app/deeds/new" aria-label="New deed" className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/85 sm:px-3"><Plus className="size-4" /><span className="hidden sm:inline">New deed</span></Link>
            <GuidedTour key={userId} userId={userId} />
            <div className="relative" ref={menu}>
              <button aria-expanded={open} aria-controls="account-menu" aria-label="Account menu" onClick={() => setOpen(!open)} className="flex items-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-2 text-muted-foreground hover:text-primary" type="button"><UserRound className="size-4 sm:hidden" /><span className="hidden max-w-32 truncate sm:inline">{userName.split(" ")[0]}</span><ChevronDown className="size-3.5" /></button>
              {open ? <div id="account-menu" onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }} className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-border bg-card p-2 shadow-lg">
                <p className="truncate border-b border-border px-3 py-3 text-xs text-muted-foreground">{userName} · {firmName}</p>
                <Link href="/app/settings" className="block rounded-lg px-3 py-2 text-sm hover:bg-secondary">Settings</Link>
                <Link href="/app/settings/ai" className="block rounded-lg px-3 py-2 text-sm hover:bg-secondary">AI memory & style</Link>
                <Link href="/app/billing" className="block rounded-lg px-3 py-2 text-sm hover:bg-secondary">Plan & usage</Link>
                <Link href="/help" className="block rounded-lg px-3 py-2 text-sm hover:bg-secondary">Help</Link>
                <form action={signOut}><button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary">Sign out</button></form>
              </div> : null}
            </div>
          </nav>
        </div>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-7 lg:px-10">{children}</main>
    </div>
  );
}
