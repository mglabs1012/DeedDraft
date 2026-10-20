/**
 * Fast checks for the drafting engine and helpers (no test framework needed):
 *   npm test
 * Expected values come from real Rajasthan deeds, e-stamp certificates and leases.
 */
import assert from "node:assert/strict";

import { mergeExtraction } from "../lib/ai/contract";
import { normaliseClauses, normaliseExtraction, normaliseParty, normaliseProperty, normaliseReview, parseJsonResponse, toIsoDate, toNumber } from "../lib/ai/parse";
import { clausePrompt, extractionPrompt, partyDocsPrompt, propertyDocsPrompt, reviewPrompt } from "../lib/ai/prompts";
import { deedTypeOrder, deedTypes } from "../lib/deed-types";
import { buildDraft, buildDraftDocuments, draftChoices, generateEditable, getReadiness, rentSchedule } from "../lib/drafting";
import { blockTexts, coveredTopics, repeatedTopics, topics } from "../lib/drafting/boilerplate";
import { clauseChecks } from "../lib/drafting/checks";
import { clauseLibrary } from "../lib/drafting/clause-library";
import { dedupeBlocks, dedupeEditable, isSameClause } from "../lib/drafting/dedupe";
import { applyOperations, draftForAi, editableDraftSchema, markupToHtml, validOperations } from "../lib/drafting/editable";
import { areaTriple, hindiTerm, moneyHi } from "../lib/drafting/format";
import { hindiLongDate, hindiWords, termEndDate } from "../lib/drafting/hindi";
import { assessPages, assessText } from "../lib/ocr/quality";
import { parseDeedData, type DeedData, type Party } from "../lib/schemas/deed-data";
import { estimateStampDuty } from "../lib/stamp-duty";
import { krutiDevToUnicode, looksLikeKrutiDev } from "../lib/text/krutidev";

import libraryIndexJson from "../lib/templates/library-index.json";
import { categoryById, coreItems, libraryItems, popularLibraryIds, searchCatalog, type LibraryEntry } from "../lib/templates/catalog";
import { formFields, formFor, labelledAnswers } from "../lib/templates/forms";
import { customDraftHtml, textToParagraphs } from "../lib/templates/render";

import { createRedactor } from "../lib/ai/redact";
import { html, renderDraftHtml } from "../lib/drafting/blocks";
import { convertText, localizeData, needsConversion, pendingConversions } from "../lib/drafting/localize";
import { applyEdits, blockSegments, hashSegments, keepsParticulars } from "../lib/drafting/segments";
import { isValidAadhaar, verhoeffDigit } from "../lib/text/aadhaar";

import { takeSlot } from "../lib/ai/rate-window";
import { countBlanks, finalChecks, htmlToText } from "../lib/drafting/checks";
import { userMessage } from "../lib/errors";
import { safeNextPath } from "../lib/safe-path";

const libraryIndex = libraryIndexJson as LibraryEntry[];

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

test("AI: naksha fields are read and reach the drafted schedule", () => {
  const property = normaliseProperty({
    kind: "flat", landUse: "residential", flatNo: "B-204", floor: "द्वितीय तल", wardNo: "17", khataNo: "45", khatauniNo: "112", pattaNo: "P/2019/88",
    plotDimensions: "30 x 50 ft", area: "150", areaUnit: "sq yd", carpetArea: "850", superBuiltUpArea: "1,150 sq ft", east: "20 फुट रोड", eastSize: "30 ft",
  });
  assert.ok(property);
  assert.equal(property.identifier, "B-204");
  assert.equal(property.superBuiltUpArea, 1150);
  assert.equal(property.areaUnit, "sq_yd");
  const data = { ...sample, properties: [property] };
  const hi = buildDraft({ type: "sale", title: "T", referenceNo: "DD-3", data, firmName: "Firm", firmCity: "Ajmer" }, "hindi").html;
  assert.ok(hi.includes("खतौनी संख्या 112"));
  assert.ok(hi.includes("पट्टा संख्या P/2019/88"));
  assert.ok(hi.includes("का माप 30 x 50 ft है"));
  assert.ok(!hi.includes("फ्लैट नम्बर B-204"), "identifier is not repeated in record particulars");
  const en = buildDraft({ type: "sale", title: "T", referenceNo: "DD-3", data, firmName: "Firm", firmCity: "Ajmer" }, "english").html;
  assert.ok(en.includes("Ward No. 17"));
  assert.ok(en.includes("carpet area 850 sq. ft."));
  assert.ok(en.includes("super built-up area 1150 sq. ft."));
});

test("AI: ID papers become one party; masked Aadhaar is dropped", () => {
  const party = normaliseParty({ role: "second", fullName: "सीमा देवी", relation: "W/O", relativeName: "राम लाल", age: "42", aadhaar: "XXXX XXXX 1234", pan: "abcde1234f" });
  assert.ok(party);
  assert.equal(party.gender, "female");
  assert.equal(party.aadhaar, "");
  assert.equal(party.pan, "ABCDE1234F");
  assert.ok(partyDocsPrompt("sale", "Buyer").includes("Aadhaar"));
  assert.ok(propertyDocsPrompt("sale").includes("khatauniNo"));
});

test("Template library: built, unique, curated picks exist, no personal deeds", () => {
  const ids = new Set(libraryIndex.map((entry) => entry.id));
  assert.ok(libraryIndex.length > 900, "library has " + libraryIndex.length + " templates");
  assert.equal(ids.size, libraryIndex.length);
  for (const id of popularLibraryIds) assert.ok(ids.has(id), "popular template missing: " + id);
  assert.ok(!libraryIndex.some((entry) => /rakesh singh|vikray patra/i.test(entry.title)));
  for (const entry of libraryIndex) assert.ok(categoryById[entry.category], entry.id);
});

test("Template search: built-in deeds first, Hindi and Hinglish words match", () => {
  const items = [...coreItems(), ...libraryItems(libraryIndex)];
  assert.deepEqual(coreItems().map((item) => item.id), ["sale", "agreement_to_sell", "gift", "release", "partition", "will", "lease", "rent"]);
  assert.equal(searchCatalog(items, "rent")[0].id, "rent");
  assert.equal(searchCatalog(items, "wasiyat")[0].id, "will");
  assert.equal(searchCatalog(items, "sale deed")[0].id, "sale");
  assert.ok(searchCatalog(items, "किराया").some((item) => item.kind === "library" && item.category === "rent"));
  assert.ok(searchCatalog(items, "affidavit").length > 3);
  assert.ok(searchCatalog(items, "power attorney")[0].category === "poa");
  assert.ok(searchCatalog(items, "", "money").every((item) => item.category === "money"));
  assert.equal(searchCatalog(items, "zzzz-no-such-thing").length, 0);
});

test("Template forms: category questions, title extras, signing last", () => {
  const cheque = libraryIndex.find((entry) => entry.id === "notice-under-section-138-of-the-negotiable-instruments-act-for-dishonour-of-cheq")!;
  const sections = formFor(cheque);
  assert.ok(sections.some((section) => section.title === "Cheque details"));
  assert.deepEqual(sections.slice(-2).map((section) => section.title), ["Signing", "Anything else"]);
  for (const category of Object.keys(categoryById)) {
    const keys = formFields({ title: "X", category: category as LibraryEntry["category"] }).map((item) => item.key);
    assert.equal(new Set(keys).size, keys.length, "duplicate keys in " + category);
  }
  const text = labelledAnswers(cheque, { firstName: "Ravi Kumar", chequeAmount: "50000", unknown: "x", subject: "  " });
  assert.ok(text.includes("Full name: Ravi Kumar") && text.includes("Cheque amount: 50000") && !text.includes("unknown") && !text.includes("Subject"));
});

test("Custom documents: saved in deed data and rendered safely", () => {
  const data = parseDeedData({ custom: { templateId: "general-power-of-attorney", title: "General Power of Attorney", answers: { firstName: "Asha" }, drafts: { english: { title: "GENERAL POWER OF ATTORNEY", paragraphs: ["KNOW ALL MEN BY THESE PRESENTS", "I, Asha <b>Devi</b>, appoint __________."] } } } });
  assert.equal(data.custom?.answers.firstName, "Asha");
  assert.equal(parseDeedData({ custom: { nope: true } }).custom, undefined, "bad custom data is dropped, not fatal");
  const html = customDraftHtml({ drafts: [{ language: "english", draft: data.custom!.drafts.english! }], title: "POA", referenceNo: "DD-9" });
  assert.ok(html.includes("GENERAL POWER OF ATTORNEY") && html.includes("&lt;b&gt;Devi&lt;/b&gt;") && !html.includes("<b>Devi"));
  assert.deepEqual(textToParagraphs("One\nline\n\nTwo\n\n\n"), ["One line", "Two"]);
});

test("Aadhaar check digit catches a misread digit", () => {
  const base = "53634675619";
  const valid = base + verhoeffDigit(base);
  assert.ok(isValidAadhaar(valid));
  assert.ok(isValidAadhaar(valid.slice(0, 4) + " " + valid.slice(4, 8) + " " + valid.slice(8)));
  const typo = valid.slice(0, 5) + ((Number(valid[5]) + 1) % 10) + valid.slice(6);
  assert.ok(!isValidAadhaar(typo));
  assert.ok(!isValidAadhaar("123456789012"), "Aadhaar never starts with 1");
  const warned = normaliseExtraction({ parties: [{ role: "first", fullName: "Asha", aadhaar: typo }, { role: "second", fullName: "Ravi", aadhaar: valid }] });
  assert.equal(warned.warnings.filter((item) => item.includes("check-digit")).length, 1);
});

test("Script conversion: only values in the other script, codes kept, multi-line by line", () => {
  assert.ok(needsConversion("Kesar Devi", "hindi"));
  assert.ok(!needsConversion("केसर देवी", "hindi"));
  assert.ok(needsConversion("केसर देवी", "english"));
  assert.ok(!needsConversion("B-204", "hindi") && !needsConversion("SBI", "hindi") && !needsConversion("", "hindi"));
  const data = parseDeedData({
    parties: [{ id: "a", role: "first", fullName: "Kesar Devi", relation: "W/o", relativeName: "Ramesh Kumar", address: "12, Shastri Nagar, Ajmer" }],
    terms: { additionalClauses: "Seller will pay old dues.\nयह कि कब्जा दे दिया है।" },
    execution: { place: "Ajmer" },
    localized: { hindi: { "Kesar Devi": "केसर देवी", Ajmer: "अजमेर" } },
  });
  assert.deepEqual(pendingConversions(data, "hindi").sort(), ["12, Shastri Nagar, Ajmer", "Ramesh Kumar", "Seller will pay old dues."].sort());
  assert.deepEqual(pendingConversions(data, "english"), ["यह कि कब्जा दे दिया है।"]);
  const hindi = localizeData(data, "hindi");
  assert.equal(hindi.parties[0].fullName, "केसर देवी");
  assert.equal(hindi.parties[0].relativeName, "Ramesh Kumar", "unconverted values stay as typed");
  assert.equal(hindi.execution.place, "अजमेर");
  assert.equal(localizeData(data, "english").parties[0].fullName, "Kesar Devi");
  assert.equal(convertText("Seller will pay old dues.\nAjmer", "hindi", { Ajmer: "अजमेर" }), "Seller will pay old dues.\nअजमेर");
  const html = buildDraft({ type: "sale", title: "T", referenceNo: "DD-5", data, firmName: "Firm", firmCity: "Ajmer" }, "hindi").html;
  assert.ok(html.includes("केसर देवी") && !html.includes("Kesar Devi"));
});

test("AI refinement: segments, edits, stale detection and number safety", () => {
  const [doc] = buildDraftDocuments({ type: "sale", title: "T", referenceNo: "DD-1", data: sample, firmName: "Firm", firmCity: "Ajmer" }, "hindi");
  const segments = blockSegments(doc.blocks);
  assert.ok(segments.length > 10);
  const hash = hashSegments(segments);
  assert.equal(hashSegments(blockSegments(buildDraftDocuments({ type: "sale", title: "T", referenceNo: "DD-1", data: sample, firmName: "Firm", firmCity: "Ajmer" }, "hindi")[0].blocks)), hash, "same matter, same hash");
  const changed = parseDeedData({ ...sample, consideration: { ...sample.consideration, total: 999999 } });
  assert.notEqual(hashSegments(blockSegments(buildDraftDocuments({ type: "sale", title: "T", referenceNo: "DD-1", data: changed, firmName: "Firm", firmCity: "Ajmer" }, "hindi")[0].blocks)), hash, "edited matter invalidates the refinement");
  const target = segments.find((segment) => segment.item !== undefined)!;
  const out = blockSegments(applyEdits(doc.blocks, [
    { op: "replace", index: target.index, text: "नया <b>पाठ</b>" },
    { op: "insert_after", index: target.index, text: "जोड़ा गया खण्ड" },
  ]));
  assert.equal(out.length, segments.length + 1);
  assert.equal(out[target.index].text, "नया <b>पाठ</b>", "edited text is escaped, not markup");
  assert.equal(out[target.index + 1].text, "जोड़ा गया खण्ड");
  assert.equal(blockSegments(applyEdits(doc.blocks, [{ op: "delete", index: target.index }])).length, segments.length - 1);
  assert.ok(renderDraftHtml({ title: "x", documents: [{ language: "hindi", blocks: applyEdits(doc.blocks, [{ op: "replace", index: target.index, text: "<script>x</script>" }]) }] }).includes("&lt;script&gt;"));
  assert.ok(keepsParticulars("राशि 4,50,000/- दिनांक 05.10.2026", "रूपये 450000/- दिनांक 05.10.2026 को"));
  assert.ok(!keepsParticulars("राशि 4,50,000/-", "राशि 4,05,000/-"));
});

test("Redaction: identity numbers become tokens and come back unchanged", () => {
  const redactor = createRedactor();
  const text = "आधार 5363 4675 6192, PAN DJKPG9076C, मो. 9876543210, राशि 450000";
  const hidden = redactor.redact(text);
  assert.ok(!hidden.includes("5363") && !hidden.includes("DJKPG9076C") && !hidden.includes("9876543210"));
  assert.ok(hidden.includes("450000"), "amounts are not identity numbers");
  assert.equal(redactor.restore(hidden), text);
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

test("Final check: minors, PAN, TDS, Will witnesses, payments and dates", () => {
  const today = new Date("2026-10-12T10:00:00");
  const adult = (id: string, role: Party["role"], extra: Partial<Party> = {}) => ({ id, role, fullName: "Person " + id, relation: "S/o", relativeName: "R " + id, age: 40, ...extra });
  const base = { parties: [adult("s", "first", { pan: "ABCDE1234F" }), adult("b", "second", { pan: "BCDEA2345G" }), adult("w1", "witness"), adult("w2", "witness")], properties: [{ id: "p", kind: "plot", description: "plot", identifier: "39", areaUnit: "sq_yd", area: 100, east: "road", west: "plot 38", north: "plot 40", south: "lane" }], consideration: { total: 450000 }, payments: [{ id: "x", mode: "cash", amount: 450000 }], execution: { date: "2026-10-10" } };
  assert.deepEqual(finalChecks("sale", parseDeedData(base), "", today), [], "a clean sale has no findings");

  const ids = (type: Parameters<typeof finalChecks>[0], patch: object, text = "") => finalChecks(type, parseDeedData({ ...base, ...patch }), text, today).map((check) => check.severity + ":" + check.id);
  const has = (list: string[], prefix: string) => list.some((item) => item.startsWith(prefix));
  assert.ok(has(ids("sale", { parties: [adult("s", "first", { age: 16 }), ...base.parties.slice(1)] }), "error:minor-first"));
  assert.ok(has(ids("sale", { consideration: { total: 1500000 }, payments: [{ id: "x", mode: "cash", amount: 1500000 }], parties: [adult("s", "first"), ...base.parties.slice(1)] }), "warning:pan-required"));
  assert.ok(has(ids("sale", { consideration: { total: 6000000 }, payments: [{ id: "x", mode: "rtgs_neft", amount: 6000000 }] }), "warning:tds"));
  assert.ok(!has(ids("sale", { consideration: { total: 6000000 }, payments: [{ id: "x", mode: "rtgs_neft", amount: 5940000 }, { id: "t", mode: "tds_challan", amount: 60000 }] }), "warning:tds"));
  assert.ok(has(ids("will", { parties: [adult("t", "first"), adult("b", "second"), adult("w1", "witness")] }), "error:will-witnesses"));
  assert.ok(has(ids("sale", { payments: [{ id: "x", mode: "cash", amount: 500000 }] }), "error:overpaid"));
  assert.ok(has(ids("sale", { execution: { date: "2026-03-01" } }), "warning:date-old"));
  assert.ok(has(ids("rent", { terms: { termMonths: 24 } }), "warning:rent-registration"));
  assert.ok(!has(ids("rent", { terms: { termMonths: 12 } }), "warning:rent-registration"), "exactly one year does not need registration");
  assert.ok(has(ids("sale", { parties: [adult("s", "first", { aadhaar: "536346756192" }), adult("b", "second", { aadhaar: "536346756192" }), ...base.parties.slice(2)] }), "error:dup"));
  assert.ok(has(ids("sale", {}, "यह विक्रय पत्र दिनांक ............ को"), "warning:blanks"));
  assert.ok(has(ids("sale", {}, "amount NaN"), "error:broken-text"));
  const sorted = finalChecks("will", parseDeedData({ ...base, parties: [adult("t", "first", { age: 15 })] }), "", today);
  assert.equal(sorted[0].severity, "error", "errors are listed first");
});

test("Blank detection and draft text extraction", () => {
  assert.equal(countBlanks("दिनांक ............ को ____ और [विक्रेता का नाम]"), 3);
  assert.equal(countBlanks("Rs. 4,50,000/- dated 5.10.2026"), 0);
  assert.equal(htmlToText("<style>p{}</style><p>A &amp; B</p><p>C&nbsp;D</p>"), "A & B C D");
  for (const type of deedTypeOrder) {
    for (const language of deedTypes[type].languages) {
      const text = htmlToText(buildDraft({ type, title: "T", referenceNo: "DD-1", data: sample, firmName: "Firm", firmCity: "Ajmer" }, language).html);
      assert.ok(!/(undefined|NaN|null)/.test(text), type + " " + language + " renders a broken value");
    }
  }
});

test("Production safety: rate window, safe redirects, friendly database errors", () => {
  const store = new Map<string, number[]>();
  for (let i = 0; i < 3; i += 1) assert.ok(takeSlot(store, "u", 3, 1000 + i));
  assert.ok(!takeSlot(store, "u", 3, 1500), "fourth call inside the minute is refused");
  assert.ok(takeSlot(store, "u", 3, 62_000), "allowed again after the window");
  assert.ok(takeSlot(store, "other", 3, 1500), "limits are per user");
  assert.ok(takeSlot(store, "u", 0, 1500), "0 disables the limit");

  assert.equal(safeNextPath("/app/deeds/123?tab=documents"), "/app/deeds/123?tab=documents");
  for (const bad of ["//evil.com", "https://evil.com", "/app//evil.com", "/login", "/\\evil.com", "", null, undefined]) assert.equal(safeNextPath(bad), "/app/dashboard", String(bad));

  const quiet = console.error;
  console.error = () => {};
  try {
    assert.equal(userMessage({ code: "23505", message: "duplicate key value violates unique constraint \"deeds_firm_id_reference_no_key\"" }), "This already exists. Refresh the page and try again.");
    assert.ok(userMessage({ code: "42P01", message: "relation \"public.ai_memory\" does not exist" }).includes("database update"));
    assert.equal(userMessage({ statusCode: "413", message: "Payload too large" }), "The file is too large.");
    assert.equal(userMessage({ code: "XX000", message: "internal: table secret_x" }, "Could not save."), "Could not save.", "unknown errors never leak details");
    assert.equal(userMessage(null, "Fallback"), "Fallback");
  } finally {
    console.error = quiet;
  }
});

test("Boilerplate: every applicable standard clause is present exactly once", () => {
  const expected: Record<string, string[]> = {
    sale: ["competency", "encumbrances", "possession", "dues", "originals", "indemnity", "further_assurance", "costs", "dispute", "jurisdiction", "waiver", "entire_agreement", "binding", "severability"],
    agreement_to_sell: ["competency", "encumbrances", "dues", "originals", "indemnity", "further_assurance", "costs", "notice", "force_majeure", "dispute", "jurisdiction", "waiver", "entire_agreement", "binding", "severability"],
    gift: ["competency", "encumbrances", "possession", "consideration", "dues", "originals", "indemnity", "further_assurance", "costs", "dispute", "jurisdiction", "waiver", "entire_agreement", "binding", "severability"],
    release: ["competency", "encumbrances", "possession", "dues", "originals", "indemnity", "further_assurance", "costs", "dispute", "jurisdiction", "waiver", "entire_agreement", "binding", "severability"],
    partition: ["competency", "encumbrances", "possession", "dues", "originals", "indemnity", "further_assurance", "costs", "dispute", "jurisdiction", "waiver", "entire_agreement", "binding", "severability"],
    will: ["severability"],
    lease: ["competency", "encumbrances", "possession", "dues", "indemnity", "costs", "notice", "force_majeure", "dispute", "jurisdiction", "waiver", "entire_agreement", "binding", "severability"],
    rent: ["competency", "encumbrances", "possession", "dues", "indemnity", "costs", "notice", "force_majeure", "dispute", "jurisdiction", "waiver", "entire_agreement", "binding", "severability"],
    other: ["competency", "encumbrances", "consideration", "dues", "indemnity", "further_assurance", "costs", "notice", "force_majeure", "dispute", "jurisdiction", "waiver", "entire_agreement", "binding", "severability"],
  };
  for (const type of deedTypeOrder) {
    for (const language of deedTypes[type].languages) {
      const [doc] = buildDraft({ type, title: "T", referenceNo: "R", data: sample, firmName: "F", firmCity: "Ajmer" }, language).documents;
      const texts = blockTexts(doc.blocks);
      const covered = coveredTopics(texts);
      for (const id of expected[type]) assert.ok(covered.has(id as never), type + " " + language + " covers " + id);
      assert.deepEqual(repeatedTopics(texts), [], type + " " + language + " states each topic once");
      assert.equal(dedupeBlocks(doc.blocks).removed.length, 0, type + " " + language + " has no repeated clause");
    }
  }
});

test("Boilerplate: user's own clause on a topic is not duplicated", () => {
  const input = (clauses: string) => ({ type: "sale" as const, title: "T", referenceNo: "R", data: { ...sample, terms: { ...sample.terms, additionalClauses: clauses } }, firmName: "F", firmCity: "Ajmer" });
  const own = "यह कि इस विक्रय पत्र से सम्बन्धित विवादों पर केवल जयपुर न्यायालयों का क्षेत्राधिकार होगा।";
  const texts = blockTexts(buildDraft(input(own), "hindi").documents[0].blocks);
  assert.equal(texts.filter((text) => /क्षेत्राधिकार/.test(text)).length, 1, "only the user's jurisdiction clause");
  assert.ok(texts.includes(own));
  // The same clause typed twice is printed once.
  const twice = blockTexts(buildDraft(input("यह कि क्रेता बिजली कनेक्शन अपने नाम करवा लेगा।\nयह कि क्रेता बिजली कनेक्शन अपने नाम करवा लेगा।"), "hindi").documents[0].blocks);
  assert.equal(twice.filter((text) => text.includes("बिजली कनेक्शन")).length, 1);
  // English drafts numbered by hand keep a continuous sequence.
  const english = blockTexts(buildDraft(input("That the Buyer may fence the plot."), "english").documents[0].blocks).filter((text) => /^\d+\. /.test(text)).map((text) => Number(text.split(".")[0]));
  assert.deepEqual(english, english.map((_, index) => index + 1));
});

test("Boilerplate: symbolic possession attorns the tenant and drops 'vacant'", () => {
  const data = { ...sample, terms: { ...sample.terms, possession: "symbolic" as const } };
  for (const language of ["hindi", "english"] as const) {
    const texts = blockTexts(buildDraft({ type: "sale", title: "T", referenceNo: "R", data, firmName: "F", firmCity: "Ajmer" }, language).documents[0].blocks).join("\n");
    assert.ok(language === "hindi" ? texts.includes("सांकेतिक") && !texts.includes("खाली कब्जा") : texts.includes("symbolic possession") && !texts.includes("vacant"), language);
    assert.ok(coveredTopics([texts]).has("attornment"), language + " attornment");
  }
});

test("Repetition check: near-duplicates, numbers and editable drafts", () => {
  assert.ok(isSameClause("7. That the Seller shall pay all dues up to today.", "That the **Seller** shall pay all dues up to today"));
  assert.ok(!isSameClause("That plot No. 39 is bounded by the road on the east side of the colony.", "That plot No. 40 is bounded by the road on the east side of the colony."));
  const draft = { language: "hindi" as const, blocks: [
    { id: "a", kind: "clause" as const, text: "यह कि किरायेदार प्रत्येक माह की 7 तारीख तक किराया अदा करेगा।" },
    { id: "b", kind: "clause" as const, text: "यह कि किरायेदार प्रत्येक माह की 7 तारीख तक किराया अदा करेगा।" },
    { id: "c", kind: "detail" as const, text: "उक्त वर्णित भूखण्ड कार्नर नहीं है।" },
    { id: "d", kind: "detail" as const, text: "उक्त वर्णित भूखण्ड कार्नर नहीं है।" },
  ] };
  const result = dedupeEditable(draft);
  assert.deepEqual(result.draft.blocks.map((block) => block.id), ["a", "c", "d"], "schedule details may repeat per property");
  const doc = { language: "english" as const, blocks: [{ t: "clauses" as const, items: [html`That courts at Ajmer alone shall have jurisdiction.`, html`That courts at Jaipur shall have exclusive jurisdiction over disputes.`] }] };
  assert.equal(clauseChecks([doc]).filter((check) => check.id.startsWith("repeat-")).length, 1, "two jurisdiction clauses are flagged");
});

test("Clause library never offers a standard clause the draft adds itself", () => {
  const automatic = new Set(topics.map((topic) => topic.id));
  for (const type of deedTypeOrder) {
    for (const clause of clauseLibrary(type)) {
      const overlap = [...coveredTopics([clause.hindi, clause.english])].filter((id) => automatic.has(id) && !["dues", "possession", "encumbrances", "consideration"].includes(id));
      assert.deepEqual(overlap, [], clause.id);
    }
  }
});

console.log("\n" + passed + " checks passed.");
