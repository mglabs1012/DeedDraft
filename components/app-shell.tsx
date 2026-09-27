"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  BookTemplate,
  ChevronDown,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Scale,
  Search,
  Settings,
  X,
} from "lucide-react";

import { setLocale } from "@/app/actions/locale";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  label: string;
  createdAt: string;
  href: string | null;
  deedTitle: string | null;
};

type AppShellProps = {
  children: React.ReactNode;
  firmName: string;
  userName: string;
  userEmail: string;
  locale: Locale;
  notifications: Notification[];
  labels: {
    dashboard: string;
    deeds: string;
    templates: string;
    billing: string;
    settings: string;
  };
};

/** Closes a popover when the user clicks outside it or presses Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

export function AppShell({
  children,
  firmName,
  userName,
  userEmail,
  locale,
  notifications,
  labels,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menu, setMenu] = useState<"user" | "alerts" | null>(null);
  const [pending, startTransition] = useTransition();
  const closeMenu = () => setMenu(null);
  const userRef = useDismiss(menu === "user", closeMenu);
  const alertsRef = useDismiss(menu === "alerts", closeMenu);
  const nav = [
    { href: "/app/dashboard", label: labels.dashboard, icon: LayoutDashboard },
    { href: "/app/deeds", label: labels.deeds, icon: FileText },
    { href: "/app/templates", label: labels.templates, icon: BookTemplate },
    { href: "/app/billing", label: labels.billing, icon: CreditCard },
    { href: "/app/settings", label: labels.settings, icon: Settings },
  ];

  // Close any open menus after navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
    setMenu(null);
    setSearchOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

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

  const search = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("q")?.toString().trim() ?? "";
    router.push(value ? "/app/deeds?q=" + encodeURIComponent(value) : "/app/deeds");
  };

  const searchInput = (
    <form className="relative w-full" onSubmit={search} role="search">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        aria-label="Search deeds"
        className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        name="q"
        placeholder="Search deeds, references…"
        type="search"
      />
    </form>
  );

  const sidebar = (
    <aside className="flex h-full w-72 flex-col bg-primary px-4 py-5 text-sidebar-foreground">
      <div className="mb-8 flex items-center gap-3 px-2">
        <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Scale className="size-5" />
        </span>
        <div className="flex-1">
          <p className="font-semibold tracking-tight">DeedDraft</p>
          <p className="text-xs text-sidebar-foreground/60">Legal workspace</p>
        </div>
        <button aria-label="Close menu" className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-white/10 lg:hidden" onClick={() => setMobileOpen(false)} type="button">
          <X className="size-4" />
        </button>
      </div>
      <Link className="mb-5 flex h-10 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-foreground hover:bg-accent/90" href="/app/deeds/new">
        <Plus className="size-4" /> New deed
      </Link>
      <nav className="space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/app/dashboard" && pathname.startsWith(href) && pathname !== "/app/deeds/new");
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
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
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
          <button aria-label="Close menu" className="absolute inset-0 bg-primary/40" onClick={() => setMobileOpen(false)} type="button" />
          <div className="relative h-full w-72 max-w-[85vw] shadow-2xl animate-in slide-in-from-left duration-200">{sidebar}</div>
        </div>
      ) : null}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex h-14 items-center gap-1.5 px-3 sm:h-16 sm:gap-3 sm:px-7">
            <Button aria-label="Open menu" className="lg:hidden" onClick={() => setMobileOpen(true)} size="icon" variant="ghost">
              <Menu className="size-5" />
            </Button>
            <Link className="flex min-w-0 items-center gap-2 lg:hidden" href="/app/dashboard">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Scale className="size-3.5" /></span>
              <span className="truncate text-sm font-semibold text-primary">DeedDraft</span>
            </Link>
            <p className="hidden min-w-0 max-w-56 truncate text-sm font-semibold text-primary lg:block">{firmName}</p>
            <div className="mx-auto hidden max-w-md flex-1 md:block">{searchInput}</div>
            <div className="ml-auto flex items-center gap-1 sm:gap-2 md:ml-0">
              <Button aria-label="Search" className="md:hidden" onClick={() => setSearchOpen((open) => !open)} size="icon" variant="ghost">
                <Search className="size-4" />
              </Button>
              <div className="relative" ref={alertsRef}>
                <Button aria-expanded={menu === "alerts"} aria-label="Recent activity" onClick={() => setMenu(menu === "alerts" ? null : "alerts")} size="icon" variant="ghost">
                  <Bell className="size-4" />
                  {notifications.length ? <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent ring-2 ring-card" /> : null}
                </Button>
                {menu === "alerts" ? (
                  <div className="fixed inset-x-3 top-16 z-30 rounded-xl border border-border bg-card shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
                    <p className="border-b border-border px-4 py-3 text-sm font-semibold text-primary">Recent activity</p>
                    {notifications.length ? (
                      <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                        {notifications.map((item) => {
                          const content = (
                            <>
                              <p className="text-sm font-medium text-primary">{item.label}</p>
                              {item.deedTitle ? <p className="truncate text-xs text-foreground/80">{item.deedTitle}</p> : null}
                              <p className="mt-0.5 text-xs text-muted-foreground">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</p>
                            </>
                          );
                          return (
                            <li key={item.id}>
                              {item.href ? <Link className="block px-4 py-2.5 hover:bg-secondary" href={item.href}>{content}</Link> : <div className="px-4 py-2.5">{content}</div>}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs font-semibold">
                <button
                  className={cn("rounded-md px-1.5 py-1.5 sm:px-2", locale === "en" && "bg-secondary text-primary")}
                  disabled={pending}
                  onClick={() => changeLocale("en")}
                  type="button"
                >
                  EN
                </button>
                <button
                  className={cn("rounded-md px-1.5 py-1.5 font-devanagari sm:px-2", locale === "hi" && "bg-secondary text-primary")}
                  disabled={pending}
                  onClick={() => changeLocale("hi")}
                  type="button"
                >
                  हिं
                </button>
              </div>
              <div className="relative" ref={userRef}>
                <button
                  aria-expanded={menu === "user"}
                  aria-label="Account menu"
                  className="flex items-center gap-1.5 rounded-lg p-1 text-sm hover:bg-secondary"
                  onClick={() => setMenu(menu === "user" ? null : "user")}
                  type="button"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {userName.slice(0, 1).toUpperCase()}
                  </span>
                  <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
                </button>
                {menu === "user" ? (
                  <div className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-border bg-card p-2 shadow-lg">
                    <div className="border-b border-border px-2 pb-2">
                      <p className="truncate text-sm font-semibold">{userName}</p>
                      <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                    </div>
                    <Link className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-secondary" href="/app/settings">
                      <Settings className="size-4" /> Settings
                    </Link>
                    <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary" disabled={pending} onClick={logOut} type="button">
                      <LogOut className="size-4" /> Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          {searchOpen ? <div className="border-t border-border px-3 py-2 md:hidden">{searchInput}</div> : null}
        </header>
        <main className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:p-7">{children}</main>
      </div>
    </div>
  );
}
