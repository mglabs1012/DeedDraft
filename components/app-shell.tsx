"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Bell,
  BookTemplate,
  ChevronDown,
  CircleUserRound,
  CreditCard,
  FileText,
  LayoutDashboard,
  Menu,
  Scale,
  Search,
  Settings,
} from "lucide-react";

import { setLocale } from "@/app/actions/locale";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  firmName: string;
  userName: string;
  userEmail: string;
  locale: Locale;
  labels: {
    dashboard: string;
    deeds: string;
    templates: string;
    billing: string;
    settings: string;
  };
};

export function AppShell({
  children,
  firmName,
  userName,
  userEmail,
  locale,
  labels,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const nav = [
    { href: "/app/dashboard", label: labels.dashboard, icon: LayoutDashboard },
    { href: "/app/deeds", label: labels.deeds, icon: FileText },
    { href: "/app/templates", label: labels.templates, icon: BookTemplate },
    { href: "/app/billing", label: labels.billing, icon: CreditCard },
    { href: "/app/settings", label: labels.settings, icon: Settings },
  ];

  const changeLocale = (next: Locale) => {
    startTransition(() => {
      void setLocale(next).then(() => router.refresh());
    });
  };

  const logOut = () => {
    startTransition(() => {
      void signOut().then(() => {
        router.replace("/login");
        router.refresh();
      });
    });
  };

  const sidebar = (
    <aside className="flex h-full w-72 flex-col bg-primary px-4 py-5 text-sidebar-foreground">
      <div className="mb-8 flex items-center gap-3 px-2">
        <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Scale className="size-5" />
        </span>
        <div>
          <p className="font-semibold tracking-tight">DeedDraft</p>
          <p className="text-xs text-sidebar-foreground/60">Legal workspace</p>
        </div>
      </div>
      <nav className="space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/app/deeds" ? pathname.startsWith(href) : pathname === href;
          return (
            <Link
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-white/10 hover:text-sidebar-foreground",
              )}
              href={href}
              key={href}
              onClick={() => setMobileOpen(false)}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
            {firmName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{firmName}</p>
            <p className="text-xs text-sidebar-foreground/60">Firm workspace</p>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">{sidebar}</div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-primary/40" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-72 shadow-2xl">{sidebar}</div>
        </div>
      ) : null}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-7">
          <Button aria-label="Open menu" className="lg:hidden" onClick={() => setMobileOpen(true)} size="icon" variant="ghost">
            <Menu className="size-5" />
          </Button>
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-semibold text-primary">{firmName}</p>
          </div>
          <div className="relative mx-auto hidden max-w-md flex-1 sm:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Global search"
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              placeholder="Search deeds, references…"
            />
          </div>
          <Button aria-label="Notifications" size="icon-sm" variant="ghost">
            <Bell className="size-4" />
          </Button>
          <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs font-semibold">
            <button
              className={cn("rounded-md px-2 py-1.5", locale === "en" && "bg-secondary text-primary")}
              disabled={pending}
              onClick={() => changeLocale("en")}
            >
              EN
            </button>
            <button
              className={cn("rounded-md px-2 py-1.5 font-devanagari", locale === "hi" && "bg-secondary text-primary")}
              disabled={pending}
              onClick={() => changeLocale("hi")}
            >
              हिं
            </button>
          </div>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg p-1 text-sm hover:bg-secondary">
              <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {userName.slice(0, 1).toUpperCase()}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-lg">
              <div className="border-b border-border px-2 pb-2">
                <p className="truncate text-sm font-semibold">{userName}</p>
                <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
              </div>
              <button className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary" onClick={logOut}>
                <CircleUserRound className="size-4" /> Sign out
              </button>
            </div>
          </details>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-7">{children}</main>
      </div>
    </div>
  );
}
