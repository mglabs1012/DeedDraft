/**
 * Draft document model. Templates return Blocks; renderDraftHtml turns them into a
 * standalone HTML page used for preview, print/PDF and the Word (.doc) export.
 * All user-supplied values pass through `html` / `esc`, so templates never
 * concatenate raw input into markup.
 */

export class SafeHtml {
  constructor(readonly value: string) {}
  toString() {
    return this.value;
  }
}

export function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function part(value: unknown): string {
  if (value === null || value === undefined || value === false) return "";
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(part).join("");
  return esc(value);
}

/** Tagged template: interpolations are escaped unless already SafeHtml. */
export function html(strings: TemplateStringsArray, ...values: unknown[]) {
  let out = "";
  strings.forEach((chunk, index) => {
    out += chunk + (index < values.length ? part(values[index]) : "");
  });
  return new SafeHtml(out);
}

export const b = (value: unknown) => html`<strong>${value}</strong>`;
export const join = (items: Array<SafeHtml | string>, separator = "") => new SafeHtml(items.map(part).join(esc(separator)));

export type Block =
  | { t: "invocation"; text: string }
  | { t: "title"; text: string }
  | { t: "meta"; text: string }
  | { t: "heading"; text: string }
  | { t: "para"; html: SafeHtml; center?: boolean }
  | { t: "clauses"; items: SafeHtml[]; style?: "numbered" | "plain" }
  | { t: "list"; items: SafeHtml[] }
  | { t: "table"; head?: string[]; rows: Array<Array<string | SafeHtml>>; widths?: string[] }
  | { t: "boundaries"; head: [string, string, string]; rows: Array<[string, string, string]> }
  | { t: "signatures"; items: Array<{ label: string; lines: string[] }> }
  | { t: "pagebreak" };

export type DraftDocument = { language: "hindi" | "english"; blocks: Block[] };

export function renderBlock(block: Block): string {
  switch (block.t) {
    case "invocation":
      return `<p class="invocation">${esc(block.text)}</p>`;
    case "title":
      return `<h1>${esc(block.text)}</h1>`;
    case "meta":
      return `<p class="meta">${esc(block.text)}</p>`;
    case "heading":
      return `<h2>${esc(block.text)}</h2>`;
    case "para":
      return `<p${block.center ? ' class="center"' : ""}>${block.html.value}</p>`;
    case "clauses":
      return block.style === "numbered"
        ? `<ol class="clauses">${block.items.map((item) => `<li>${item.value}</li>`).join("")}</ol>`
        : block.items.map((item) => `<p class="clause">${item.value}</p>`).join("");
    case "list":
      return `<ol class="details">${block.items.map((item) => `<li>${item.value}</li>`).join("")}</ol>`;
    case "table":
      return (
        `<table class="grid">` +
        (block.head ? `<thead><tr>${block.head.map((cell, index) => `<th${block.widths?.[index] ? ` style="width:${esc(block.widths[index])}"` : ""}>${esc(cell)}</th>`).join("")}</tr></thead>` : "") +
        `<tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${part(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      );
    case "boundaries":
      return (
        `<table class="bounds"><thead><tr>${block.head.map((cell) => `<th>${esc(cell)}</th>`).join("")}</tr></thead><tbody>` +
        block.rows.map(([side, bound, size]) => `<tr><td class="side">${esc(side)}</td><td>${esc(bound)}</td><td class="size">${esc(size)}</td></tr>`).join("") +
        `</tbody></table>`
      );
    case "signatures":
      return `<div class="signs">${block.items
        .map((item) => `<div class="sign"><div class="line"></div><p><strong>${esc(item.label)}</strong>${item.lines.map((line) => `<br/>${esc(line)}`).join("")}</p></div>`)
        .join("")}</div>`;
    case "pagebreak":
      return `<div class="pagebreak"></div>`;
  }
}

const styles = `
@page{size:A4;margin:2cm 2cm 2cm 2.5cm}
*{box-sizing:border-box}
body{font-family:"Times New Roman",Georgia,serif;font-size:13pt;line-height:1.75;color:#111;max-width:780px;margin:0 auto;padding:28px 24px;background:#fff}
.hi{font-family:"Nirmala UI","Mangal","Kokila","Noto Serif Devanagari","Noto Sans Devanagari",serif;font-size:13.5pt;line-height:1.95}
h1{text-align:center;font-size:19pt;letter-spacing:.06em;margin:4px 0 6px;text-decoration:underline;text-underline-offset:6px}
h2{font-size:13pt;margin:26px 0 8px;text-align:center;text-decoration:underline;text-underline-offset:4px}
p{text-align:justify;margin:0 0 12px}
.clause{text-indent:3em}
.center{text-align:center}
.invocation{text-align:center;font-size:15pt;margin:0}
.meta{text-align:center;font-size:10pt;color:#555;margin-bottom:22px}
ol.clauses{padding-left:1.8em;margin:0 0 12px}ol.clauses li{text-align:justify;margin-bottom:10px;padding-left:.3em}
ol.details{padding-left:1.8em;margin:0 0 14px}ol.details li{margin-bottom:4px}
table{width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:.92em}
.grid th,.grid td,.bounds th,.bounds td{border:1px solid #999;padding:6px 9px;text-align:left;vertical-align:top}
.grid th,.bounds th{background:#f3f3f3}
.bounds .side{width:18%;font-weight:bold}.bounds .size{width:18%;white-space:nowrap}
.signs{display:flex;flex-wrap:wrap;gap:28px 56px;margin-top:36px}
.sign{flex:1 1 240px;break-inside:avoid}
.sign .line{border-bottom:1px dotted #333;height:52px;margin-bottom:6px}
.pagebreak{break-after:page;page-break-after:always;height:1px;border-top:1px dashed #ccc;margin:40px 0}
.draft{border:1px dashed #b45309;color:#92400e;background:#fffbeb;font:10pt/1.4 Arial,sans-serif;padding:6px 10px;margin-bottom:22px;text-align:center}
.footer{margin-top:44px;text-align:center;font:9pt/1.4 Arial,sans-serif;color:#666}
@media print{.draft{display:none}body{padding:0;max-width:none}.pagebreak{border:0;margin:0}}
`;

export function renderDraftHtml({ title, documents, footer }: { title: string; documents: DraftDocument[]; footer?: string }) {
  const bodies = documents
    .map((doc) => `<section class="${doc.language === "hindi" ? "hi" : "en"}" lang="${doc.language === "hindi" ? "hi" : "en"}">${doc.blocks.map(renderBlock).join("\n")}</section>`)
    .join(`<div class="pagebreak"></div>`);
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${esc(title)}</title><style>${styles}</style></head><body>
<div class="draft">DRAFT FOR ADVOCATE REVIEW — verify every particular against the original documents before execution.</div>
${bodies}
${footer ? `<p class="footer">${esc(footer)}</p>` : ""}
</body></html>`;
}
