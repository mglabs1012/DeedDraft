"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CircleHelp, Compass, X } from "lucide-react";
import { tours, parseTourPreferences, type TourPreferences, type TourStep } from "@/lib/onboarding";

/** Keyboard/touch help as well as hover; no hover-only essential instructions. */
export function HelpTip({ text }: { text: string }) {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  return <span className="group relative inline-flex align-middle" onPointerEnter={() => setDismissed(false)}>
    <button type="button" aria-label="More help" aria-describedby={id} aria-expanded={pinned}
      onClick={() => { setDismissed(pinned); setPinned(!pinned); }} onFocus={() => setDismissed(false)} onBlur={() => setPinned(false)} onKeyDown={(event) => { if (event.key === "Escape") { setPinned(false); setDismissed(true); } }}
      className="ml-1 rounded-full p-1 text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"><CircleHelp className="size-3.5" /></button>
    <span id={id} role="tooltip" className={(dismissed ? "hidden " : pinned ? "block " : "hidden group-hover:block group-focus-within:block ") + "absolute bottom-full left-1/2 z-40 mb-2 w-56 -translate-x-1/2 rounded-xl border border-border bg-card p-3 text-left text-xs font-normal leading-5 text-foreground shadow-lg"}>{text}</span>
  </span>;
}

function currentScope() {
  if (document.querySelector('[data-tour="draft-review"]')) return "draft";
  if (document.querySelector('[data-tour="paper-upload"]')) return "workspace";
  if (document.querySelector('[data-tour="templates"]')) return "templates";
  if (document.querySelector('[data-tour="standard-mode"]')) return "home";
  return null;
}

export function GuidedTour({ userId }: { userId: string }) {
  const key = "deeddraft:guided-tour:v1:" + userId;
  const prefs = useRef<TourPreferences>({ skipped: false, completed: [] });
  const lastScope = useRef<string | null>(null);
  const [active, setActive] = useState<{ scope: string; index: number } | null>(null);
  useEffect(() => {
    try { prefs.current = parseTourPreferences(localStorage.getItem(key)); } catch { /* In-memory help still works if storage is unavailable. */ }
    let frame = 0;
    const inspect = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const scope = currentScope();
        if (scope === lastScope.current) return;
        lastScope.current = scope;
        setActive(scope && !prefs.current.skipped && !prefs.current.completed.includes(scope) ? { scope, index: 0 } : null);
      });
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document.getElementById("main-content") ?? document.body, { childList: true, subtree: true });
    inspect();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [key]);
  const close = (skip: boolean) => {
    if (!active) return;
    prefs.current = {
      skipped: skip,
      completed: [...new Set([...prefs.current.completed, active.scope])],
    };
    try { localStorage.setItem(key, JSON.stringify(prefs.current)); } catch { /* Never block drafting on tutorial storage. */ }
    setActive(null);
  };
  const tour = active ? tours[active.scope] : null;
  return <>
    <button data-tour="quick-tour" type="button" onClick={() => {
      const scope = currentScope();
      lastScope.current = scope;
      setActive({ scope: scope ?? "home", index: 0 });
    }}
      title="Replay the guide for this screen" className="flex items-center gap-1.5 whitespace-nowrap rounded-lg py-2 text-xs text-muted-foreground hover:text-primary sm:text-sm">
      <Compass className="size-4" /><span className="hidden sm:inline">Quick tour</span><span className="sr-only sm:hidden">Quick tour</span>
    </button>
    {active && tour ? <TourCard key={active.scope} step={tour.steps[active.index]} index={active.index} total={tour.steps.length} label={tour.label}
      onSkip={() => close(true)} onBack={() => setActive({ ...active, index: active.index - 1 })}
      onNext={() => active.index === tour.steps.length - 1 ? close(false) : setActive({ ...active, index: active.index + 1 })} /> : null}
  </>;
}

function TourCard({ step, index, total, label, onSkip, onBack, onNext }: {
  step: TourStep; index: number; total: number; label: string; onSkip: () => void; onBack: () => void; onNext: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [cardTop, setCardTop] = useState<number | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => { element.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    target?.scrollIntoView({ block: "center", behavior: "instant" });
    next.current?.focus({ preventScroll: true });
    const measure = () => {
      const bounds = target?.getBoundingClientRect();
      const cardHeight = card.current?.offsetHeight ?? 320;
      if (bounds && bounds.width && bounds.height) {
        setRect({ top: Math.max(8, bounds.top - 6), left: Math.max(8, bounds.left - 6), width: Math.min(bounds.width + 12, window.innerWidth - 16), height: Math.min(bounds.height + 12, window.innerHeight - 16) });
        const below = bounds.bottom + 18;
        setCardTop(below + cardHeight < window.innerHeight - 12 ? below : bounds.top - cardHeight - 18 > 12 ? bounds.top - cardHeight - 18 : Math.max(12, window.innerHeight - cardHeight - 16));
      } else { setRect(null); setCardTop(Math.max(12, (window.innerHeight - cardHeight) / 2)); }
    };
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    if (target) observer.observe(target);
    if (card.current) observer.observe(card.current);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [step]);
  return <dialog ref={dialog} aria-labelledby={id + "-title"} aria-describedby={id + "-text"} onCancel={(event) => { event.preventDefault(); onSkip(); }}
    className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-transparent p-0 text-foreground backdrop:bg-transparent">
    {rect ? <div aria-hidden="true" className="pointer-events-none fixed rounded-xl border-2 border-white ring-2 ring-primary" style={{ ...rect, boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)" }} /> : <div aria-hidden="true" className="fixed inset-0 bg-black/55" />}
    <div ref={card} className="fixed left-1/2 max-h-[calc(100dvh_-_24px)] w-[calc(100%_-_24px)] max-w-sm -translate-x-1/2 overflow-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6" style={{ top: cardTop ?? 16 }}>
      <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><button type="button" onClick={onSkip} aria-label="Skip tutorial" className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X className="size-4" /></button></div>
      <p className="mt-3 text-xs font-medium text-primary" aria-live="polite">Step {index + 1} of {total}</p>
      <h2 id={id + "-title"} className="mt-2 text-xl font-semibold tracking-tight">{step.title}</h2>
      <p id={id + "-text"} className="mt-3 text-sm leading-6 text-muted-foreground">{step.text}</p>
      <div className="mt-5 flex gap-1" aria-hidden="true">{Array.from({ length: total }, (_, i) => <span key={i} className={"h-1 flex-1 rounded-full " + (i <= index ? "bg-primary" : "bg-secondary")} />)}</div>
      <div className="mt-5 flex items-center gap-3">
        <button type="button" onClick={onSkip} className="mr-auto text-xs text-muted-foreground hover:underline">Skip tutorial</button>
        <button type="button" onClick={onBack} disabled={!index} className="rounded-lg px-2 py-2 text-sm disabled:opacity-30">Back</button>
        <button ref={next} type="button" onClick={onNext} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{index === total - 1 ? "Got it" : "Next"}</button>
      </div>
      <p className="mt-4 text-[10px] leading-4 text-muted-foreground">This guide never changes your deed. Your tutorial preference is remembered on this browser.</p>
    </div>
  </dialog>;
}
