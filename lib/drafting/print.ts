/**
 * Prints a standalone HTML page (the draft) without a pop-up window: it is
 * loaded into a hidden frame, printed once its fonts are ready, then removed.
 * iPhone and iPad print the parent page from a frame, so they get a new tab.
 * Returns false when the browser blocked the new tab.
 */
export function printHtml(markup: string, title: string): boolean {
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) {
    const win = window.open("", "_blank");
    if (!win) return false;
    win.document.write(markup);
    win.document.close();
    void win.document.fonts.ready.then(() => { win.focus(); win.print(); });
    return true;
  }

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
  const previousTitle = document.title;
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    document.title = previousTitle;
    window.setTimeout(() => frame.remove(), 500);
  };
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) return cleanup();
    win.addEventListener("afterprint", cleanup, { once: true });
    void win.document.fonts.ready.then(() => {
      // Browsers name the saved PDF after the page title.
      document.title = title;
      win.focus();
      win.print();
      // Fallback for browsers that do not fire afterprint.
      window.setTimeout(cleanup, 60_000);
    });
  };
  frame.srcdoc = markup;
  document.body.append(frame);
  return true;
}
