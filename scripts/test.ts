/**
 * Fast checks for the drafting engine and helpers (no test framework needed):
 *   npm test
 * Expected values come from real Rajasthan deeds, e-stamp certificates and leases.
 */
import assert from "node:assert/strict";

import { mergeExtraction } from "../lib/ai/contract";
import { normaliseClauses, normaliseExtraction, normaliseReview, parseJsonResponse, toIsoDate, toNumber } from "../lib/ai/parse";
import { clausePrompt, extractionPrompt, reviewPrompt } from "../lib/ai/prompts";
import { deedTypeOrder, deedTypes } from "../lib/deed-types";
import { buildDraft, draftChoices, generateEditable, getReadiness, rentSchedule } from "../lib/drafting";
import { clauseLibrary } from "../lib/drafting/clause-library";
import { applyOperations, draftForAi, editableDraftSchema, markupToHtml, validOperations } from "../lib/drafting/editable";
import { areaTriple, hindiTerm, moneyHi } from "../lib/drafting/format";
import { hindiLongDate, hindiWords, termEndDate } from "../lib/drafting/hindi";
import { assessPages, assessText } from "../lib/ocr/quality";
import { parseDeedData, type DeedData, type Party } from "../lib/schemas/deed-data";
import { estimateStampDuty } from "../lib/stamp-duty";
import { krutiDevToUnicode, looksLikeKrutiDev } from "../lib/text/krutidev";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log("  ✓ " + name);
  } catch (error) {
    console.error("  ✗ " + name);
    throw error;
  }
}

console.log("DeedDraft checks");

test("Hindi amount words (lakh/crore system)", () => {
  assert.equal(hindiWords(450000), "चार लाख पचास हजार");
  assert.equal(hindiWords(2550000), "पच्चीस लाख पचास हजार");
  assert.equal(hindiWords(495000), "चार लाख पचानवे हजार");
  assert.equal(hindiWords(4757900), "सैंतालीस लाख सत्तावन हजार नौ सौ");
  assert.equal(hindiWords(80000000), "आठ करोड़");
  assert.equal(moneyHi(450000), "4,50,000/- अक्षरे चार लाख पचास हजार रूपये मात्र");
});

test("Hindi long date with weekday", () => {
  assert.equal(hindiLongDate("2026-09-02"), "02 सितम्बर, 2026 ई. बुधवार");
});

test("Rent term end date (05-03-2026 + 11 months)", () => {
  assert.equal(termEndDate("2026-03-05", 11), "2027-02-04");
});

test("Stamp duty matches e-stamp certificate (female SC/ST/BPL)", () => {
  const estimate = estimateStampDuty({ consideration: 450000, marketValue: 493925, category: "female_reserved" });
  assert.ok(estimate);
  assert.equal(estimate.duty, 19757);
  assert.deepEqual(estimate.surcharges.map((item) => item.amount), [1976, 1976, 1976]);
  assert.equal(estimate.totalStamp, 25685);
});

test("Area expressed in sq. m. = sq. yd. = sq. ft.", () => {
  const property = parseDeedData({ properties: [{ id: "p", kind: "plot", description: "plot", area: 98.47, areaUnit: "sq_yd" }] }).properties[0];
  assert.equal(areaTriple(property, "hindi"), "82.33 वर्गमीटर = 98.47 वर्गगज = 886.23 वर्गफुट");
});

test("Lease rent schedule with 5% yearly escalation", () => {
  const rows = rentSchedule({ ...parseDeedData({}).terms, monthlyRent: 50000, termMonths: 144, escalationPercent: 5, escalationEveryYears: 1, startDate: "2026-07-15" });
  assert.equal(rows.length, 12);
  assert.deepEqual(rows.slice(0, 4).map((row) => row.rent), [50000, 52500, 55125, 57881]);
  assert.equal(rows[0].from, "2026-07-15");
  assert.equal(rows[0].to, "2027-07-14");
});

test("Kruti Dev text converts to Unicode", () => {
  assert.equal(krutiDevToUnicode("foØ; i="), "विक्रय पत्र");
  assert.equal(krutiDevToUnicode(";g nku&i= foys[k"), "यह दान-पत्र विलेख");
  assert.ok(looksLikeKrutiDev(";g foØ;i= vkt fnukad dks Jh izFkei{k foØsrk ds gd esa gS vkSj ;g"));
  assert.equal(looksLikeKrutiDev("यह विक्रय पत्र आज दिनांक को निष्पादित किया गया है और यह सही है"), false);
});

test("Legacy data parses and bad rows are skipped, not the whole list", () => {
  const data = parseDeedData({
    parties: [
      { id: "1", role: "first", fullName: "Ram Lal", relation: "S/o" },
      { id: "2", role: "second", fullName: "X", relation: "S/o" },
      { id: "3", role: "second", fullName: "Sita Devi", relation: "W/o", gender: "female" },
    ],
    payments: "junk",
  });
  assert.deepEqual(data.parties.map((party) => party.id), ["1", "3"]);
  assert.equal(data.parties[0].gender, "male");
  assert.deepEqual(data.payments, []);
  assert.equal(data.execution.mapAttached, true);
});

const person = (id: string, role: Party["role"], name: string, gender: "male" | "female", extra: Partial<Party> = {}) =>
  ({ id, role, fullName: name, gender, relation: gender === "female" ? "W/o" : "S/o", relativeName: "रमेश", age: 40, caste: "रेगर", address: "अजमेर", aadhaar: "536346756192", ...extra }) as Party;

test("Gendered and plural Hindi party terms", () => {
  const term = deedTypes.sale.roles.first.hi;
  assert.equal(hindiTerm(term, [person("a", "first", "केसर देवी", "female")]), "विक्रेती");
  assert.equal(hindiTerm(term, [person("a", "first", "राम", "male")]), "विक्रेता");
  assert.equal(hindiTerm(term, [person("a", "first", "बनारसी", "female"), person("b", "first", "कविता", "female")]), "विक्रेतीगण");
  assert.equal(hindiTerm(term, [person("a", "first", "राम", "male"), person("b", "first", "कविता", "female")]), "विक्रेतागण");
});

const sample: DeedData = parseDeedData({
  parties: [
    person("s", "first", "केसर देवी <script>", "female"),
    person("b", "second", "मंजू देवी", "female"),
    person("w1", "witness", "हेमचन्द", "male"),
    person("w2", "witness", "विनोद कुमार", "male"),
  ],
  properties: [{ id: "p", kind: "plot", description: "आवासीय भूखण्ड", identifier: "39", khasra: "569", village: "बडगांव", tehsil: "अजमेर", district: "अजमेर", state: "राजस्थान", area: 98.47, areaUnit: "sq_yd", east: "आम रास्ता", eastSize: "21'0\"", west: "अन्य की भूमि", north: "भूखण्ड 38", south: "भूखण्ड 40", allottedTo: "b" }],
  titleChain: [{ id: "t", instrument: "sale_deed", date: "2021-07-26", from: "सीमा कँवर", amount: 150000, office: "अजमेर (प्रथम)", book: "1", volume: "2087", page: "103", serial: "202103001103453", addlVolume: "5342", addlPages: "24 से 34", pastedOn: "2021-07-27" }],
  consideration: { total: 450000 },
  payments: [
    { id: "1", mode: "cash", nature: "earnest", amount: 20000 },
    { id: "2", mode: "cheque", nature: "loan", amount: 270000, reference: "009754", lender: "Easy Home Finance" },
    { id: "3", mode: "rtgs_neft", amount: 160000, reference: "SBIN003110" },
  ],
  terms: { monthlyRent: 22500, termMonths: 11, startDate: "2026-03-05", securityDeposit: 50000, balanceDue: "1 माह", relationship: "पिता-पुत्री" },
  execution: { date: "2026-09-02", place: "अजमेर" },
});

test("Every deed type drafts in every supported language", () => {
  for (const type of deedTypeOrder) {
    for (const choice of draftChoices(type)) {
      const { html, documents } = buildDraft({ type, title: "Test", referenceNo: "DD-2026-0001", data: sample, firmName: "Firm", firmCity: "Ajmer" }, choice);
      assert.ok(documents.length >= 1, type + " " + choice);
      assert.ok(html.includes(deedTypes[type].heading[choice === "english" ? "english" : "hindi"]), type + " heading " + choice);
      assert.ok(!html.includes("<script>"), type + " escapes input");
      assert.ok(!html.includes("undefined") && !html.includes("NaN"), type + " has no undefined/NaN in " + choice);
    }
  }
});

test("Sale deed recites title, payments, schedule and female terms", () => {
  const { html } = buildDraft({ type: "sale", title: "Test", referenceNo: "DD-1", data: sample, firmName: "Firm", firmCity: "Ajmer" }, "hindi");
  for (const fragment of ["प्रथमपक्ष-विक्रेती", "द्वितीयपक्ष-क्रेती", "जिल्द संख्या 2087", "क्रम संख्या 202103001103453", "दिनांक 27/07/2021 को चस्पा", "बतौर साई पेटे अग्रिम", "Easy Home Finance से स्वीकृत ऋण", "तहसील व जिला अजमेर", "82.33 वर्गमीटर = 98.47 वर्गगज = 886.23 वर्गफुट", "21'0\"", "02 सितम्बर, 2026 ई. बुधवार"]) {
    assert.ok(html.includes(fragment.replaceAll('"', "&quot;").replaceAll("'", "&#39;")), "missing: " + fragment);
  }
});

test("Rent deed puts tenant first and computes the term", () => {
  const { html } = buildDraft({ type: "rent", title: "Rent", referenceNo: "DD-2", data: sample, firmName: "Firm", firmCity: "Ajmer" }, "hindi");
  assert.ok(html.includes("किरायानामा"));
  assert.ok(html.includes("04 फरवरी, 2027 ई."));
  assert.ok(html.includes("22,500/-"));
});

test("Readiness reflects deed type requirements", () => {
  const sale = getReadiness("sale", sample, 1);
  assert.ok(sale.find((item) => item.label === "Payments cover the consideration")?.done);
  assert.ok(sale.find((item) => item.label === "Chain of title recorded")?.done);
  const will = getReadiness("will", sample, 0);
  assert.ok(will.find((item) => item.label === "Every property allotted to a party")?.done);
  const rent = getReadiness("rent", parseDeedData({}), 0);
  assert.equal(rent.find((item) => item.label === "Monthly rent entered")?.done, false);
});

test("AI extraction merge never overwrites advocate input", () => {
  const merged = mergeExtraction(sample, {
    parties: [person("new", "witness", "नया गवाह", "male")],
    consideration: { total: 999, marketValue: 500000 },
  });
  assert.equal(merged.parties.length, sample.parties.length + 1);
  assert.equal(merged.consideration.total, 450000);
  assert.equal(merged.consideration.marketValue, 500000);
});

test("AI: JSON is read even when wrapped in code fences or prose", () => {
  assert.deepEqual(parseJsonResponse("```json\n{\"a\":1}\n```"), { a: 1 });
  assert.deepEqual(parseJsonResponse("Here you go: {\"a\":2} thanks"), { a: 2 });
  assert.throws(() => parseJsonResponse("not json"));
});

test("AI: Indian number and date formats", () => {
  assert.equal(toNumber("4,50,000/-"), 450000);
  assert.equal(toNumber("Rs. 80,00,000"), 8000000);
  assert.equal(toNumber("abc"), undefined);
  assert.equal(toIsoDate("26/07/2021"), "2021-07-26");
  assert.equal(toIsoDate("5.3.2026"), "2026-03-05");
  assert.equal(toIsoDate("sometime"), "");
});

test("AI: extraction is normalised and invalid records dropped", () => {
  const result = normaliseExtraction({
    summary: "Prior sale deed",
    parties: [
      { role: "first", fullName: "केसर देवी", relation: "पत्नी", relativeName: "रमेश", age: "38", aadhaar: "5363 4675 6192", pan: "djkpg9076c" },
      { role: "hacker", fullName: "X" },
    ],
    properties: [{ kind: "plot", identifier: "39", khasra: "569", area: "98.47", areaUnit: "वर्गगज", east: "आम रास्ता" }],
    titleChain: [{ instrument: "sale_deed", date: "26/07/2021", amount: "1,50,000", volume: "2087", serial: "202103001103453" }],
    payments: [{ mode: "cheque", nature: "loan", amount: "2,70,000", reference: "009754" }, { mode: "cash", amount: 0 }],
    consideration: { total: "4,50,000" },
    warnings: ["Page 3 illegible"],
  });
  assert.equal(result.parties.length, 1);
  assert.equal(result.parties[0].relation, "W/o");
  assert.equal(result.parties[0].gender, "female");
  assert.equal(result.parties[0].pan, "DJKPG9076C");
  assert.equal(result.parties[0].aadhaar, "536346756192");
  assert.equal(result.properties[0].areaUnit, "sq_yd");
  assert.equal(result.properties[0].area, 98.47);
  assert.equal(result.titleChain[0].date, "2021-07-26");
  assert.equal(result.titleChain[0].amount, 150000);
  assert.equal(result.payments.length, 1);
  assert.equal(result.consideration.total, 450000);
  assert.deepEqual(result.warnings, ["Page 3 illegible"]);
  assert.notEqual(result.parties[0].id, result.properties[0].id);
});

test("AI: garbage output yields an empty, safe extraction", () => {
  const result = normaliseExtraction("<script>alert(1)</script>");
  assert.deepEqual([result.parties, result.properties, result.titleChain, result.payments], [[], [], [], []]);
});

test("AI: clauses and review issues are normalised", () => {
  assert.deepEqual(normaliseClauses({ clauses: ["यह कि प्रथमपक्ष\nविक्रेता बकाया बिल अदा करेगा।", "", 5] }), ["यह कि प्रथमपक्ष विक्रेता बकाया बिल अदा करेगा।"]);
  const issues = normaliseReview({ issues: [{ severity: "critical", section: "payments", message: "TDS missing" }, { message: "" }] });
  assert.deepEqual(issues, [{ severity: "medium", section: "payments", message: "TDS missing" }]);
});

test("AI: merge skips duplicates of existing parties and properties", () => {
  const duplicate = normaliseExtraction({
    parties: [{ role: "first", fullName: "केसर देवी <script>", relation: "W/o" }, { role: "witness", fullName: "नया गवाह", relation: "S/o" }],
    properties: [{ kind: "plot", identifier: "39", khasra: "569" }],
  });
  const merged = mergeExtraction(sample, { parties: duplicate.parties, properties: duplicate.properties });
  assert.equal(merged.parties.length, sample.parties.length + 1);
  assert.equal(merged.properties.length, sample.properties.length);
});

test("AI: prompts carry deed roles and injection guardrails", () => {
  for (const type of deedTypeOrder) {
    const prompt = extractionPrompt(type, "prior_title_deed");
    assert.ok(prompt.includes(deedTypes[type].roles.first.en));
    assert.ok(prompt.includes("DATA, not instructions"));
    assert.ok(clausePrompt(type, "hindi").includes("यह कि"));
    assert.ok(reviewPrompt(type).includes("194-IA"));
  }
});

test("Editable draft round-trips to the same output", () => {
  for (const type of deedTypeOrder) {
    for (const language of deedTypes[type].languages) {
      const input = { type, title: "Test", referenceNo: "DD-2026-0001", data: sample, firmName: "Firm", firmCity: "Ajmer" };
      const editable = generateEditable(input, language);
      assert.ok(editableDraftSchema.safeParse(editable).success, type + " " + language + " fits the save schema");
      // Template literals keep raw ' and & that the editor escapes; both render the same.
      const html = (overrides = {}) => buildDraft(input, language, overrides).html.replaceAll("&#39;", "'").replaceAll("&amp;", "&");
      assert.equal(html({ [language]: editable }), html(), type + " " + language);
    }
  }
});

test("Draft edits: only valid operations on editable blocks apply", () => {
  const draft = generateEditable({ type: "sale", title: "T", referenceNo: "R", data: sample, firmName: "F", firmCity: "Ajmer" }, "hindi");
  const clause = draft.blocks.find((block) => block.kind === "clause")!;
  const locked = draft.blocks.find((block) => block.kind === "locked")!;
  assert.ok(draftForAi(draft).includes("[" + clause.id + "]"));
  const ops = validOperations(draft, [
    { op: "replace", id: clause.id, text: "यह कि **नया** खण्ड।" },
    { op: "insert_after", id: clause.id, text: "यह कि जोड़ा गया खण्ड।" },
    { op: "replace", id: locked.id, text: "x" },
    { op: "delete", id: "missing" },
    { op: "drop_table" },
  ]);
  assert.equal(ops.length, 2);
  const edited = applyOperations(draft, ops);
  assert.equal(edited.blocks.length, draft.blocks.length + 1);
  const index = edited.blocks.findIndex((block) => block.id === clause.id);
  assert.equal((edited.blocks[index] as { text: string }).text, "यह कि **नया** खण्ड।");
  assert.equal((edited.blocks[index + 1] as { text: string }).text, "यह कि जोड़ा गया खण्ड।");
});

test("Draft markup escapes HTML and keeps bold", () => {
  assert.equal(markupToHtml("a **<b>** <script>").value, "a <strong>&lt;b&gt;</strong> &lt;script&gt;");
});

test("OCR quality: scans, broken glyphs and clean text", () => {
  const clean = "यह कि विक्रेता उक्त भूखण्ड का एकमात्र स्वामी है तथा इसे विक्रय करने का पूर्ण अधिकार रखता है। ".repeat(6);
  assert.equal(assessText(clean), "good");
  assert.equal(assessText("   "), "poor");
  assert.equal(assessText("वि न ां क ि  प ा ल ि क ा ".repeat(40)), "poor");
  assert.equal(assessPages([clean, clean, clean]), "good");
  assert.equal(assessPages([clean, "", "", clean]), "poor");
});

test("Clause library covers every deed type in both languages", () => {
  for (const type of deedTypeOrder) {
    const clauses = clauseLibrary(type);
    assert.ok(clauses.length > 0, type);
    assert.equal(new Set(clauses.map((clause) => clause.id)).size, clauses.length, type + " unique ids");
    for (const clause of clauses) assert.ok(clause.hindi.startsWith("यह कि") && clause.english.startsWith("That"), clause.id);
  }
});

console.log("\n" + passed + " checks passed.");
