"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Scale } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { setLocale } from "@/app/actions/locale";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { GuidedTour } from "@/components/guided-tour";

export function AppShell({ children, firmName, userName, userId, locale }: {
  children: React.ReactNode; firmName: string; userName: string; userId: string; locale: Locale;
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
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-[1800px] items-center justify-between gap-4 px-4 sm:px-7 lg:px-10">
          <Link href="/app/dashboard" className="flex items-center gap-2 font-semibold tracking-tight text-primary"><Scale className="size-5" /><span>DeedDraft</span></Link>
          <nav aria-label="Main navigation" className="flex items-center gap-4 text-sm sm:gap-7">
            {[["/app/dashboard", "Home"], ["/app/deeds", "My deeds"]].map(([href, label]) => (
              <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className={cn("py-2 hover:text-primary", path === href ? "font-medium text-primary" : "text-muted-foreground")}>{label}</Link>
            ))}
            <GuidedTour key={userId} userId={userId} />
            <div className="relative" ref={menu}>
              <button aria-expanded={open} aria-controls="account-menu" onClick={() => setOpen(!open)} className="flex items-center gap-1 rounded-lg py-2 text-muted-foreground hover:text-primary" type="button"><span className="hidden sm:inline">{userName.split(" ")[0]}</span><span className="sm:hidden">Account</span><ChevronDown className="size-3.5" /></button>
              {open ? <div id="account-menu" className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-border bg-card p-2 shadow-lg">
                <p className="truncate border-b border-border px-3 py-3 text-xs text-muted-foreground">{firmName}</p>
                <Link href="/app/settings" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-secondary">Settings & AI setup</Link>
                <Link href="/app/billing" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-secondary">Plan & usage</Link>
                <form action={async () => { await setLocale(locale === "en" ? "hi" : "en"); setOpen(false); }}><button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary">{locale === "en" ? "हिंदी" : "English"}</button></form>
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
