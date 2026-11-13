"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Deleting or discarding: the confirm button is red and Cancel has the focus. */
  destructive?: boolean;
};

let ask: ((options: ConfirmOptions) => Promise<boolean>) | null = null;

/**
 * Asks the user to confirm, in the app's own dialog (keyboard and screen-reader
 * friendly, readable on phones). Resolves true when confirmed. Falls back to
 * the browser's prompt on pages that do not mount <ConfirmHost />.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (ask) return ask(options);
  return Promise.resolve(window.confirm(options.title + (options.description ? "\n\n" + options.description : "")));
}

/** Mounted once in the root layout; renders the dialog for confirmDialog(). */
export function ConfirmHost() {
  const [request, setRequest] = useState<{ options: ConfirmOptions; resolve: (value: boolean) => void } | null>(null);

  useEffect(() => {
    ask = (options) => new Promise<boolean>((resolve) => {
      // A second question replaces the first, which counts as cancelled.
      setRequest((current) => { current?.resolve(false); return { options, resolve }; });
    });
    return () => { ask = null; };
  }, []);

  const settle = (value: boolean) => {
    request?.resolve(value);
    setRequest(null);
  };

  if (!request) return null;
  const { options } = request;
  return (
    <Modal
      className="sm:max-w-md"
      onClose={() => settle(false)}
      open
      title={options.title}
      footer={<>
        <Button className="h-10" data-autofocus={options.destructive ? "" : undefined} onClick={() => settle(false)} type="button" variant="outline">{options.cancelLabel ?? "Cancel"}</Button>
        <Button className="h-10" data-autofocus={options.destructive ? undefined : ""} onClick={() => settle(true)} type="button" variant={options.destructive ? "destructive" : "default"}>{options.confirmLabel ?? "Continue"}</Button>
      </>}
    >
      {options.description ? <p className="text-sm leading-6 text-muted-foreground">{options.description}</p> : null}
    </Modal>
  );
}
