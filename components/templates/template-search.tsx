"use client";

import { useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  ClipboardList,
  Cpu,
  FileCheck,
  Gavel,
  Handshake,
  House,
  IndianRupee,
  KeyRound,
  Mail,
  Scale,
  Search,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { DeedIcon } from "@/components/deeds/deed-icon";
import type { DeedType } from "@/lib/deed-types";
import { categories, categoryById, coreItems, libraryItems, popularLibraryIds, searchCatalog, type CatalogItem, type CategoryId, type LibraryEntry } from "@/lib/templates/catalog";
import { cn } from "@/lib/utils";

export const categoryIcons: Record<CategoryId, LucideIcon> = {
  property: House,
  rent: KeyRound,
  family: Users,
  money: IndianRupee,
  notices: Gavel,
  affidavit: FileCheck,
  poa: UserCheck,
  business: Handshake,
  jobs: Briefcase,
  company: Building2,
  disputes: Scale,
  tech: Cpu,
  workplace: ClipboardList,
  letters: Mail,
};

export function ItemIcon({ item, className }: { item: CatalogItem; className?: string }) {
  if (item.kind === "core") return <DeedIcon className={className} type={item.id as DeedType} />;
  const Icon = categoryIcons[item.category];
  return <Icon className={className} />;
}

/**
 * Search box, category chips and results for every template: the eight
 * built-in deeds and the template library. Plain words, Hinglish and Hindi
 * (e.g. "kiraya", "वसीयत") all match.
 */
export function TemplateSearch({
  library,
  includeCore = true,
  autoFocus = false,
  onSelect,
  action,
  placeholder = "Search: rent agreement, affidavit, will, loan, notice, वसीयत…",
}: {
  library: LibraryEntry[];
  includeCore?: boolean;
  autoFocus?: boolean;
  onSelect?: (item: CatalogItem) => void;
  /** Buttons shown on each row (template library). */
  action?: (item: CatalogItem) => React.ReactNode;
  placeholder?: string;
}) {
  const items = useMemo(() => [...(includeCore ? coreItems() : []), ...libraryItems(library)], [includeCore, library]);
  const counts = useMemo(() => items.reduce<Partial<Record<CategoryId, number>>>((all, item) => ({ ...all, [item.category]: (all[item.category] ?? 0) + 1 }), {}), [items]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [limit, setLimit] = useState(30);

  const browsing = !query.trim() && category === "all";
  const results = useMemo(() => {
    if (!browsing) return searchCatalog(items, query, category);
    const popular = new Set(popularLibraryIds);
    return [...items.filter((item) => item.kind === "core"), ...popularLibraryIds.map((id) => items.find((item) => item.id === id)).filter((item): item is CatalogItem => Boolean(item && popular.has(item.id)))];
  }, [browsing, items, query, category]);
  const shown = results.slice(0, limit);

  const reset = (next: () => void) => {
    next();
    setLimit(30);
  };

  return (
    <div className="space-y-4">
      <label className="relative block">
        <span className="sr-only">Search templates</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus={autoFocus}
          className="h-12 w-full rounded-xl border border-border bg-background pl-11 pr-11 text-base outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
          onChange={(event) => reset(() => setQuery(event.target.value))}
          placeholder={placeholder}
          type="search"
          value={query}
        />
        {query ? (
          <button aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-secondary" onClick={() => reset(() => setQuery(""))} type="button">
            <X className="size-4" />
          </button>
        ) : null}
      </label>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        <Chip active={category === "all"} label="All" onClick={() => reset(() => setCategory("all"))} />
        {categories.filter((item) => counts[item.id]).map((item) => {
          const Icon = categoryIcons[item.id];
          return (
            <Chip active={category === item.id} count={counts[item.id]} icon={<Icon className="size-3.5" />} key={item.id} label={item.label} onClick={() => reset(() => setCategory(category === item.id ? "all" : item.id))} />
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        {browsing ? "Most used documents. Type above or pick a category to see all " + items.length + " templates." : results.length ? results.length + " template" + (results.length === 1 ? "" : "s") + " found" : "No template matches. Try a simpler word, e.g. “rent”, “loan” or “affidavit”."}
      </p>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {shown.map((item) => {
          const row = (
            <>
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", item.kind === "core" ? "bg-primary text-primary-foreground" : "bg-secondary text-accent-foreground")}>
                <ItemIcon className="size-5" item={item} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium leading-5 text-primary">{item.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {item.subtitle ? <span className="font-devanagari">{item.subtitle}</span> : null}
                  <span>{categoryById[item.category].label}</span>
                  {item.kind === "core" ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">Guided form</span> : null}
                  {item.us ? <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800" title="Written in a US format. The AI adapts it to Indian practice when drafting.">US format</span> : null}
                </span>
              </span>
            </>
          );
          return (
            <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3" key={item.kind + item.id}>
              {onSelect ? (
                <button className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left hover:opacity-80" onClick={() => onSelect(item)} type="button">
                  {row}
                </button>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3">{row}</div>
              )}
              {action ? <div className="flex shrink-0 gap-2 pl-[3.25rem] sm:pl-0">{action(item)}</div> : null}
            </li>
          );
        })}
      </ul>

      {results.length > shown.length ? (
        <button className="h-11 w-full rounded-xl border border-border bg-card text-sm font-semibold text-primary hover:bg-secondary" onClick={() => setLimit((current) => current + 60)} type="button">
          Show more ({results.length - shown.length} left)
        </button>
      ) : null}
    </div>
  );
}

function Chip({ active, label, onClick, icon, count }: { active: boolean; label: string; onClick: () => void; icon?: React.ReactNode; count?: number }) {
  return (
    <button
      aria-pressed={active}
      className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition", active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-primary hover:border-primary/40")}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
      {count ? <span className="text-[11px] opacity-70">{count}</span> : null}
    </button>
  );
}
