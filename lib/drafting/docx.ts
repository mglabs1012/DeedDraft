import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
} from "docx";

import type { Block, DraftDocument } from "./blocks";

/**
 * A real Word (.docx) file for a draft: A4 with registry margins, justified
 * text, centred headings, numbered clauses, bordered boundary and rent tables,
 * side-by-side signature blocks and page numbers. Hindi text uses a Devanagari
 * font (Nirmala UI / Mangal) through Word's complex-script setting, so it
 * renders the same on any Windows or Mac copy of Word.
 */

const PAGE = { width: 11906, height: 16838 }; // A4 in twentieths of a point
const MARGIN = { top: 1134, bottom: 1134, left: 1418, right: 1134 }; // 2 cm, 2.5 cm binding side
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;
const LINE = { line: 360, after: 120 }; // 1.5 lines, 6 pt after

type Lang = "hindi" | "english";
const fontFor = (lang: Lang) => (lang === "hindi"
  ? { ascii: "Times New Roman", hAnsi: "Times New Roman", cs: "Nirmala UI", eastAsia: "Nirmala UI" }
  : { ascii: "Times New Roman", hAnsi: "Times New Roman", cs: "Mangal", eastAsia: "Times New Roman" });
// Complex-script (Devanagari) text is tagged Hindi in both drafts, so Word shapes, proofs and picks fonts correctly.
const languageFor = (lang: Lang) => ({ value: lang === "hindi" ? "hi-IN" : "en-IN", bidirectional: "hi-IN" });
const sizeFor = (lang: Lang, points: number) => ({ size: points * 2, sizeComplexScript: (lang === "hindi" ? points + 1 : points) * 2 });

const entities: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
const decode = (text: string) => text.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (match) => entities[match] ?? match);

type RunStyle = { bold?: boolean; underline?: boolean; points?: number; color?: string };

/** Our safe HTML fragments only contain text, <strong> and <br/>: turn them into Word runs. */
function runs(html: string, lang: Lang, style: RunStyle = {}): TextRun[] {
  const out: TextRun[] = [];
  let bold = false;
  for (const part of html.split(/(<strong>|<\/strong>|<br\s*\/?>|<[^>]+>)/)) {
    if (!part) continue;
    if (part === "<strong>") { bold = true; continue; }
    if (part === "</strong>") { bold = false; continue; }
    if (/^<br/.test(part)) { out.push(new TextRun({ break: 1 })); continue; }
    if (part.startsWith("<")) continue;
    out.push(new TextRun({ text: decode(part), bold: bold || style.bold, boldComplexScript: bold || style.bold, underline: style.underline ? {} : undefined, font: fontFor(lang), language: languageFor(lang), color: style.color, ...sizeFor(lang, style.points ?? (lang === "hindi" ? 12.5 : 12)) }));
  }
  return out;
}

const text = (value: string, lang: Lang, style: RunStyle = {}) => runs(value.replace(/&/g, "&amp;").replace(/</g, "&lt;"), lang, style);

const thin = { style: BorderStyle.SINGLE, size: 4, color: "8C8C8C" };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const cellBorders = { top: thin, bottom: thin, left: thin, right: thin };
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };

function widths(count: number, given?: string[]) {
  const percents = given?.length === count ? given.map((value) => Number.parseFloat(value) || 0) : [];
  const total = percents.reduce((sum, value) => sum + value, 0);
  return Array.from({ length: count }, (_, index) => Math.round(CONTENT_WIDTH * (total ? percents[index] / total : 1 / count)));
}

function cell(content: string, lang: Lang, width: number, options: { header?: boolean; bold?: boolean; html?: boolean } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    shading: options.header ? { fill: "F2F2F2" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ spacing: { after: 0, line: 300 }, children: options.html ? runs(content, lang, { bold: options.header || options.bold, points: 11 }) : text(content, lang, { bold: options.header || options.bold, points: 11 }) })],
  });
}

function table(head: string[] | undefined, rows: string[][], lang: Lang, given?: string[], firstBold = false, htmlCells = false) {
  const count = Math.max(head?.length ?? 0, ...rows.map((row) => row.length));
  const columns = widths(count, given);
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: columns,
    rows: [
      ...(head ? [new TableRow({ tableHeader: true, children: head.map((value, index) => cell(value, lang, columns[index], { header: true })) })] : []),
      ...rows.map((row) => new TableRow({ cantSplit: true, children: Array.from({ length: count }, (_, index) => cell(row[index] ?? "", lang, columns[index], { bold: firstBold && index === 0, html: htmlCells })) })),
    ],
  });
}

function signatures(items: Array<{ label: string; lines: string[] }>, lang: Lang) {
  const half = Math.round(CONTENT_WIDTH / 2);
  const block = (item?: { label: string; lines: string[] }) => new TableCell({
    width: { size: half, type: WidthType.DXA },
    borders: { top: none, bottom: none, left: none, right: none },
    margins: { top: 0, bottom: 240, left: 0, right: 360 },
    children: item ? [
      // Space to sign, then a dotted line.
      new Paragraph({ spacing: { before: 720, after: 60 }, border: { bottom: { style: BorderStyle.DOTTED, size: 6, color: "333333", space: 1 } }, children: [] }),
      new Paragraph({ spacing: { after: 0, line: 300 }, children: text(item.label, lang, { bold: true, points: 11.5 }) }),
      ...item.lines.map((line) => new Paragraph({ spacing: { after: 0, line: 300 }, children: text(line, lang, { points: 11 }) })),
    ] : [new Paragraph({ children: [] })],
  });
  const rows: TableRow[] = [];
  for (let index = 0; index < items.length; index += 2) rows.push(new TableRow({ cantSplit: true, children: [block(items[index]), block(items[index + 1])] }));
  return new Table({ layout: TableLayoutType.FIXED, width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: [half, half], borders: noBorders, rows });
}

function children(doc: DraftDocument, numbering: { next: () => number }) {
  const lang = doc.language;
  const out: Array<Paragraph | Table> = [];
  const justified = { alignment: AlignmentType.JUSTIFIED, spacing: LINE };
  for (const block of doc.blocks as Block[]) {
    switch (block.t) {
      case "invocation":
        out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: text(block.text, lang, { points: 14 }) }));
        break;
      case "title":
        out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 240 }, children: text(block.text, lang, { bold: true, underline: true, points: 16 }) }));
        break;
      case "meta":
        out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: text(block.text, lang, { points: 10, color: "555555" }) }));
        break;
      case "heading":
        out.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 280, after: 140 }, children: text(block.text, lang, { bold: true, underline: true, points: 12.5 }) }));
        break;
      case "para":
        out.push(new Paragraph({ ...justified, alignment: block.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED, children: runs(block.html.value, lang) }));
        break;
      case "clauses":
        if (block.style === "numbered") {
          const instance = numbering.next();
          for (const item of block.items) out.push(new Paragraph({ ...justified, numbering: { reference: "clauses", level: 0, instance }, children: runs(item.value, lang) }));
        } else {
          for (const item of block.items) out.push(new Paragraph({ ...justified, indent: { firstLine: 720 }, children: runs(item.value, lang) }));
        }
        break;
      case "list": {
        const instance = numbering.next();
        for (const item of block.items) out.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: 320, after: 60 }, numbering: { reference: "details", level: 0, instance }, children: runs(item.value, lang, { points: 11.5 }) }));
        out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
        break;
      }
      case "table":
        // A two-column table without headings is a key–value schedule: labels in bold.
        out.push(table(block.head, block.rows.map((row) => row.map((value) => (typeof value === "string" ? value.replace(/&/g, "&amp;").replace(/</g, "&lt;") : value.value))), lang, block.widths, !block.head && block.rows.every((row) => row.length === 2), true));
        out.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
        break;
      case "boundaries":
        out.push(table(block.head, block.rows, lang, ["18%", "64%", "18%"], true));
        out.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
        break;
      case "signatures":
        out.push(signatures(block.items, lang));
        break;
      case "pagebreak":
        out.push(new Paragraph({ pageBreakBefore: true, children: [] }));
        break;
    }
  }
  return out;
}

function footer(lang: Lang, note?: string) {
  const runOptions = { font: fontFor(lang), language: languageFor(lang), ...sizeFor(lang, 9), color: "666666" };
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: lang === "hindi"
          ? [new TextRun({ text: "पृष्ठ ", ...runOptions }), new TextRun({ children: [PageNumber.CURRENT], ...runOptions }), new TextRun({ text: " / ", ...runOptions }), new TextRun({ children: [PageNumber.TOTAL_PAGES], ...runOptions })]
          : [new TextRun({ text: "Page ", ...runOptions }), new TextRun({ children: [PageNumber.CURRENT], ...runOptions }), new TextRun({ text: " of ", ...runOptions }), new TextRun({ children: [PageNumber.TOTAL_PAGES], ...runOptions })],
      }),
      ...(note ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: note, ...runOptions, ...sizeFor(lang, 8) })] })] : []),
    ],
  });
}

/** Builds the .docx; each language starts on a new page with its own font settings. */
export function buildDocx(documents: DraftDocument[], options: { title: string; footer?: string }) {
  let instance = 0;
  const numbering = { next: () => ++instance };
  const sections: ISectionOptions[] = documents.map((doc) => ({
    properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: MARGIN } },
    footers: { default: footer(doc.language, options.footer) },
    children: children(doc, numbering),
  }));
  const level = (format: (typeof LevelFormat)[keyof typeof LevelFormat], textFormat: string) => [{ level: 0, format, text: textFormat, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 567 } } } }];
  return new Document({
    title: options.title,
    creator: "DeedDraft",
    description: "Draft for advocate review",
    styles: { default: { document: { run: { font: "Times New Roman", size: 24 }, paragraph: { spacing: LINE } } } },
    numbering: { config: [{ reference: "clauses", levels: level(LevelFormat.DECIMAL, "%1.") }, { reference: "details", levels: level(LevelFormat.DECIMAL, "%1.") }] },
    sections,
  });
}

export async function draftToDocxBlob(documents: DraftDocument[], options: { title: string; footer?: string }) {
  return Packer.toBlob(buildDocx(documents, options));
}

