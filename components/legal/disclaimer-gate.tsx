"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { site } from "@/lib/legal/site";

const STORAGE_KEY = "deeddraft.disclaimer";

function accepted() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === site.version;
  } catch {
    return false;
  }
}

function remember() {
  try {
    window.localStorage.setItem(STORAGE_KEY, site.version);
  } catch {
    // Private mode or blocked storage: the disclaimer simply shows again next time.
  }
}

/**
 * Disclaimer shown before signing up or signing in (Bar Council of India rules
 * on advertising and solicitation, plus our core terms). It cannot be dismissed
 * without agreeing; acceptance is remembered per policy version on this device.
 */
export function DisclaimerGate() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [declined, setDeclined] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    // Read after mount: storage is not available during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!accepted()) setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), input:not(:disabled)"));
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  const agree = () => {
    remember();
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/55 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl outline-none sm:max-w-2xl sm:rounded-2xl"
        ref={panel}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800">
            <ShieldAlert className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-primary" id={titleId}>Disclaimer</h2>
            <p className="text-sm text-muted-foreground">Please read and accept before you sign up or sign in.</p>
          </div>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4 text-sm leading-6 text-foreground sm:px-6">
          <p>
            The Bar Council of India does not permit advocates to advertise or solicit work in any form or manner. {site.name} is a software platform. We disclaim that this website is, in any way, an advertisement or solicitation by any advocate. <strong>We are not soliciting anything.</strong>
          </p>
          <p>By accessing this website, you acknowledge and agree that:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>you accept all the Terms of Service, Privacy Policy, Data Protection Policy and other policies of {site.name};</li>
            <li>you use this website, its content and anything from it, anywhere, entirely by your own consent;</li>
            <li>every document you upload is uploaded with the consent of the person to whom the document belongs;</li>
            <li>whatever amount you pay, you pay for the services rendered on this platform — if the outcome is not what you want, or the details you fill in cannot be read by our AI system or any other machine-learning system, we are not responsible for it;</li>
            <li>before executing any document before the Sub-Registrar or any other authority, it must be checked by an advocate;</li>
            <li>we give no guarantee about any data, and we take no responsibility or liability for any consequence arising out of, or any action taken on the basis of, the services, information or content you take from us;</li>
            <li>any dispute is settled by arbitration at Ajmer, and failing that, only the courts at Ajmer, Rajasthan have jurisdiction.</li>
          </ul>
          <p className="text-muted-foreground">
            Read the full{" "}
            <Link className="font-medium text-primary underline-offset-2 hover:underline" href="/disclaimer" target="_blank">Disclaimer</Link>,{" "}
            <Link className="font-medium text-primary underline-offset-2 hover:underline" href="/terms" target="_blank">Terms of Service</Link> and{" "}
            <Link className="font-medium text-primary underline-offset-2 hover:underline" href="/privacy" target="_blank">Privacy Policy</Link>.
          </p>
        </div>

        <div className="space-y-3 border-t border-border bg-muted/40 px-5 py-4 sm:px-6">
          <label className="flex items-start gap-3 text-sm font-medium text-primary">
            <input checked={checked} className="mt-0.5 size-4 shrink-0 accent-primary" onChange={(event) => setChecked(event.target.checked)} type="checkbox" />
            I have read and understood the disclaimer and agree to the Terms of Service and Privacy Policy.
          </label>
          {declined ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
              You need to accept the disclaimer to sign up or sign in. You can still read our policies from the links above.
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="h-10" onClick={() => setDeclined(true)} type="button" variant="outline">I do not agree</Button>
            <Button className="h-10" disabled={!checked} onClick={agree} type="button">Agree &amp; continue</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
