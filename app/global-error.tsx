"use client";

/** Last-resort error page when the root layout itself fails. Plain styles: the app CSS may not have loaded. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>DeedDraft could not load</h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "#475569" }}>Please try again. If it keeps happening, share this reference with support.</p>
            {error.digest ? <p style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>Ref: {error.digest}</p> : null}
            <button onClick={reset} style={{ marginTop: 16, height: 40, padding: "0 16px", borderRadius: 8, border: 0, background: "#0f2a4a", color: "#fff", fontWeight: 600, cursor: "pointer" }} type="button">
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
