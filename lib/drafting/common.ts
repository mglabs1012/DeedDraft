import { getDeedType, type DeedType, type DeedTypeConfig, type DraftLanguage, type PartyRole } from "@/lib/deed-types";
import { instrumentHindi, instrumentLabels, paymentModeLabels, propertyKindLabels } from "@/lib/deeds";
import type { DeedData, Party, Payment, Property, TitleEntry } from "@/lib/schemas/deed-data";

import { b, html, join, type Block, type SafeHtml } from "./blocks";
import {
  agree,
  areaTriple,
  displayName,
  figure,
  formatAadhaar,
  hindiTerm,
  kindHi,
  landUse,
  moneyEn,
  moneyHi,
  propertyEn,
  propertyHi,
  relativeEn,
  relativeHi,
  type IdOptions,
} from "./format";
import { englishLongDate, hindiLongDate, hindiWords, shortDate } from "./hindi";

export type DraftInput = {
  type: DeedType;
  title: string;
  referenceNo: string;
  data: DeedData;
  firmName: string;
  firmCity: string;
};

export type Ctx = {
  lang: DraftLanguage;
  hi: boolean;
  input: DraftInput;
  config: DeedTypeConfig;
  data: DeedData;
  parties: Record<PartyRole, Party[]>;
  place: string;
  date: string;
  ids: IdOptions;
  /** Role noun: "विक्रेती" / "Seller". */
  term: (role: PartyRole) => string;
  /** Full reference: "प्रथमपक्ष विक्रेती" / "the Seller". */
  ref: (role: PartyRole) => string;
};

export function createContext(input: DraftInput, lang: DraftLanguage): Ctx {
  const config = getDeedType(input.type);
  const byRole = (role: PartyRole) => input.data.parties.filter((party) => party.role === role);
  const parties = { first: byRole("first"), second: byRole("second"), other: byRole("other"), witness: byRole("witness") };
  const hi = lang === "hindi";
  const term = (role: PartyRole) => {
    if (hi) return hindiTerm(config.roles[role].hi, parties[role]);
    const base = config.roles[role].en.split(" (")[0];
    return parties[role].length > 1 ? base + "s" : base;
  };
  const prefix: Record<PartyRole, string> = hi
    ? { first: config.id === "will" ? "" : "प्रथमपक्ष ", second: config.id === "will" ? "" : "द्वितीयपक्ष ", other: "", witness: "" }
    : { first: "the ", second: "the ", other: "the ", witness: "the " };
  return {
    lang,
    hi,
    input,
    config,
    data: input.data,
    parties,
    place: input.data.execution.place || input.firmCity,
    date: input.data.execution.date ?? "",
    ids: { maskAadhaar: input.data.execution.maskAadhaar },
    term,
    ref: (role) => prefix[role] + term(role),
  };
}

export const longDate = (ctx: Ctx, value?: string) => (ctx.hi ? hindiLongDate(value) : englishLongDate(value));
export const money = (ctx: Ctx, value?: number) => (ctx.hi ? moneyHi(value) : moneyEn(value));
export const clause = (item: SafeHtml | string) => (typeof item === "string" ? html`${item}` : item);

export function opening(ctx: Ctx): Block[] {
  const blocks: Block[] = [];
  if (ctx.hi && ctx.data.execution.invocation) blocks.push({ t: "invocation", text: "ॐ" });
  blocks.push({ t: "title", text: ctx.config.heading[ctx.lang] });
  return blocks;
}

/* ----------------------------------------------------------- Chain of title */

const acquisitionHi: Partial<Record<TitleEntry["instrument"], string>> = {
  sale_deed: "खरीद किया था",
  gift_deed: "दान में प्राप्त किया था",
  partition_deed: "विभाजन में प्राप्त किया था",
  release_deed: "हक त्याग के आधार पर प्राप्त किया था",
  will: "वसीयत के आधार पर प्राप्त किया था",
  other: "प्राप्त किया था",
};

function registrationHi(entry: TitleEntry) {
  const book = entry.book || "1";
  const primary = [entry.volume && "जिल्द संख्या " + entry.volume, entry.serial && "क्रम संख्या " + entry.serial, entry.page && "पृष्ठ संख्या " + entry.page].filter(Boolean);
  if (!entry.office && !primary.length) return "";
  const additional = [entry.addlVolume && "जिल्द संख्या " + entry.addlVolume, entry.addlPages && "पृष्ठ संख्या " + entry.addlPages].filter(Boolean);
  return (
    " जिस " + instrumentHindi[entry.instrument] + " का नियमानुसार पंजीयन कार्यालय उप पंजीयक " + (entry.office || "..........") +
    " की पुस्तक संख्या " + book + (primary.length ? ", " + primary.join(", ") : "") + " पर पंजीबद्ध किया गया" +
    (additional.length ? " एवं अतिरिक्त पुस्तक संख्या " + book + ", " + additional.join(", ") + " पर" + (entry.pastedOn ? " दिनांक " + shortDate(entry.pastedOn) + " को" : "") + " चस्पा किया गया" : "") + "।"
  );
}

function registrationEn(entry: TitleEntry) {
  const book = entry.book || "1";
  const primary = [entry.volume && "Volume No. " + entry.volume, entry.serial && "Serial No. " + entry.serial, entry.page && "Page No. " + entry.page].filter(Boolean);
  if (!entry.office && !primary.length) return "";
  const additional = [entry.addlVolume && "Volume No. " + entry.addlVolume, entry.addlPages && "Pages " + entry.addlPages].filter(Boolean);
  return (
    " The said instrument is registered in the office of the Sub-Registrar " + (entry.office || "________") + " in Book No. " + book + (primary.length ? ", " + primary.join(", ") : "") +
    (additional.length ? " and pasted in Additional Book No. " + book + ", " + additional.join(", ") + (entry.pastedOn ? " on " + shortDate(entry.pastedOn) : "") : "") + "."
  );
}

export function titleRecital(ctx: Ctx, owner: PartyRole = "first"): SafeHtml[] {
  const ownerRef = ctx.ref(owner);
  const property = ctx.hi ? "उक्त वर्णित सम्पत्ति" : "the said property";
  return ctx.data.titleChain.map((entry, index) => {
    const dated = entry.date ? (ctx.hi ? " दिनांक " + shortDate(entry.date) : " dated " + shortDate(entry.date)) : "";
    let sentence: string;
    if (ctx.hi) {
      switch (entry.instrument) {
        case "patta":
          sentence = "यह कि " + property + " बाबत् " + (entry.from || "सक्षम प्राधिकारी") + " द्वारा एक पट्टा विलेख" + dated + " को " + ownerRef + " के हक में जारी किया गया।";
          break;
        case "allotment":
          sentence = "यह कि " + property + " " + (entry.from || "सक्षम प्राधिकारी") + " द्वारा आवंटन पत्र" + dated + " के माध्यम से " + ownerRef + " को आवंटित की गई।";
          break;
        case "rectification":
          sentence = "यह कि पूर्व विलेख में सहवन से हुई त्रुटि के शुद्धिकरण हेतु " + (entry.from ? entry.from + " एवं " : "") + ownerRef + " के मध्य एक शुद्धि पत्र विलेख" + dated + " को निष्पादित किया गया।";
          break;
        case "agreement_to_sell":
          sentence = "तत्पश्चात् " + ownerRef + " ने " + property + " को बेचान करने बाबत् एक रजिस्टर्ड विक्रय इकरारनामा" + dated + " को " + (entry.from || ctx.ref("second")) + " के हक में निष्पादित किया।";
          break;
        case "inheritance":
          sentence = "यह कि " + property + " " + ownerRef + " को " + (entry.from ? entry.from + " के देहान्त उपरान्त " : "") + "उत्तराधिकार में प्राप्त हुई है।";
          break;
        default:
          sentence =
            "यह कि " + property + " को " + ownerRef + " ने जरिये " + instrumentHindi[entry.instrument] + dated +
            (entry.amount ? " को तादादी " + moneyHi(entry.amount) + " में" : "") + (entry.from ? " " + entry.from + " से" : "") + " " + (acquisitionHi[entry.instrument] ?? "प्राप्त किया था") + "।";
      }
      sentence += registrationHi(entry);
      if (index === 0 && entry.instrument !== "inheritance") sentence += " बरोज पंजीयन " + property + " पर कब्जा व दखल " + ownerRef + " ने प्राप्त कर लिया था।";
    } else {
      const label = instrumentLabels[entry.instrument].toLowerCase();
      switch (entry.instrument) {
        case "patta":
        case "allotment":
          sentence = "That " + (entry.from || "the competent authority") + " issued a " + label + dated + " in respect of " + property + " in favour of " + ownerRef + ".";
          break;
        case "rectification":
          sentence = "That, to correct an inadvertent error in the earlier instrument, a rectification deed" + dated + " was executed between " + (entry.from ? entry.from + " and " : "") + ownerRef + ".";
          break;
        case "agreement_to_sell":
          sentence = "That thereafter " + ownerRef + " executed a registered agreement to sell" + dated + " in favour of " + (entry.from || ctx.ref("second")) + ".";
          break;
        case "inheritance":
          sentence = "That " + property + " devolved upon " + ownerRef + " by inheritance" + (entry.from ? " on the demise of " + entry.from : "") + ".";
          break;
        default:
          sentence = "That " + ownerRef + " acquired " + property + " by a " + label + dated + (entry.from ? " from " + entry.from : "") + (entry.amount ? " for a consideration of " + moneyEn(entry.amount) : "") + ".";
      }
      sentence += registrationEn(entry);
      if (index === 0 && entry.instrument !== "inheritance") sentence += " " + ownerRef[0].toUpperCase() + ownerRef.slice(1) + " took possession of " + property + " upon registration.";
    }
    if (entry.notes) sentence += " " + entry.notes;
    return html`${sentence}`;
  });
}

/* ---------------------------------------------------------------- Payments */

function modeHi(payment: Payment) {
  const ref = payment.reference ? " संख्या " + payment.reference : "";
  const dated = payment.date ? " दिनांक " + shortDate(payment.date) : "";
  const bank = payment.bank ? " " + payment.bank + " का" : "";
  switch (payment.mode) {
    case "cash":
      return "जरिये नगद";
    case "cheque":
      return "जरिये चैक" + ref + dated + bank;
    case "bankers_cheque":
      return "जरिये बैंकर्स चैक" + ref + dated + bank;
    case "dd":
      return "जरिये डिमांड ड्राफ्ट" + ref + dated + bank;
    case "rtgs_neft":
      return "जरिये आर.टी.जी.एस./एन.ई.एफ.टी. यू.टी.आर. नम्बर " + (payment.reference || "..........") + dated + (payment.bank ? " " + payment.bank + " से" : "");
    case "upi":
      return "जरिये यू.पी.आई. संदर्भ संख्या " + (payment.reference || "..........") + dated;
    case "tds_challan":
      return "जरिये चालान" + ref + dated;
    default:
      return "जरिये " + (payment.notes || "अन्य माध्यम");
  }
}

function modeEn(payment: Payment) {
  const ref = payment.reference ? " No. " + payment.reference : "";
  const dated = payment.date ? " dated " + shortDate(payment.date) : "";
  const bank = payment.bank ? " drawn on " + payment.bank : "";
  switch (payment.mode) {
    case "cash":
      return "in cash";
    case "rtgs_neft":
      return "by RTGS/NEFT, UTR No. " + (payment.reference || "________") + dated + (payment.bank ? " from " + payment.bank : "");
    case "upi":
      return "by UPI, reference " + (payment.reference || "________") + dated;
    case "tds_challan":
      return "by TDS challan" + ref + dated;
    case "other":
      return "by " + (payment.notes || "other mode");
    default:
      return "by " + paymentModeLabels[payment.mode].toLowerCase() + ref + dated + bank;
  }
}

export function paymentPhrase(ctx: Ctx, payment: Payment) {
  const payer = ctx.ref("second");
  const payee = ctx.ref("first");
  if (ctx.hi) {
    const amount = "राशि " + figure(payment.amount) + " अक्षरे " + hindiWords(payment.amount) + " रूपये मात्र";
    if (payment.mode === "tds_challan") return amount + " " + payer + " ने " + payee + " के आयकर विभाग में टी.डी.एस. के रूप में " + modeHi(payment) + " जमा करा दी है";
    if (payment.nature === "loan") return amount + " जो " + payer + " के हक में उक्त सम्पत्ति पर " + (payment.lender || "बैंक") + " से स्वीकृत ऋण में से " + modeHi(payment);
    return amount + " " + modeHi(payment) + (payment.nature === "earnest" ? " बतौर साई पेटे अग्रिम" : "");
  }
  const amount = moneyEn(payment.amount);
  if (payment.mode === "tds_challan") return amount + " deposited by " + payer + " as TDS on behalf of " + payee + " " + modeEn(payment);
  if (payment.nature === "loan") return amount + " out of the loan sanctioned to " + payer + " by " + (payment.lender || "the bank") + ", " + modeEn(payment);
  return amount + " " + modeEn(payment) + (payment.nature === "earnest" ? " as earnest money" : "");
}

export function paymentsTotal(data: DeedData) {
  return data.payments.reduce((sum, payment) => sum + payment.amount, 0);
}

/* --------------------------------------------------------------- Schedule */

export function scheduleBlocks(ctx: Ctx, options: { heading: string; verb: string; expenses?: boolean }): Block[] {
  const blocks: Block[] = [{ t: "heading", text: options.heading }];
  if (!ctx.data.properties.length) {
    blocks.push({ t: "para", html: html`${ctx.hi ? "..................................................................................... (सम्पत्ति का विवरण, क्षेत्रफल व सीमायें)" : "_______________________________ (property description, area and boundaries)"}` });
    return blocks;
  }
  ctx.data.properties.forEach((property, index) => {
    if (ctx.data.properties.length > 1) blocks.push({ t: "para", html: b(ctx.hi ? "सम्पत्ति क्रमांक " + (index + 1) : "Item " + (index + 1)) });
    blocks.push({ t: "para", html: html`${ctx.hi ? scheduleLeadHi(ctx, property, options.verb) : scheduleLeadEn(ctx, property, options.verb)}` });
    blocks.push({
      t: "boundaries",
      head: ctx.hi ? ["दिशा", "सीमा", "नाप"] : ["Side", "Boundary", "Measurement"],
      rows: (["east", "west", "north", "south"] as const).map((side) => [
        ctx.hi ? { east: "पूर्व", west: "पश्चिम", north: "उत्तर", south: "दक्षिण" }[side] : side[0].toUpperCase() + side.slice(1),
        property[side] || "—",
        property[(side + "Size") as "eastSize"] || "—",
      ]),
    });
    blocks.push({ t: "list", items: detailItems(ctx, property, options.expenses && index === ctx.data.properties.length - 1) });
  });
  return blocks;
}

function scheduleLeadHi(ctx: Ctx, property: Property, verb: string) {
  return (
    propertyHi(property, true) +
    (property.construction ? ", जिसमें " + property.construction : "") +
    ", को मय थाला भूमि मय हक अन्दरूनी, बैरूनी, जैरीनी व बालाई मय जुमला हक हकूक सहित " + verb +
    (ctx.data.execution.mapAttached ? ", जिसे संलग्न नक्शे में सुर्ख लाल रंग से दर्शाया गया है," : "") + " जिसकी सीमायें एवं नाप निम्न प्रकार हैं:-"
  );
}

function scheduleLeadEn(ctx: Ctx, property: Property, verb: string) {
  return (
    "All that " + propertyEn(property, true) +
    (property.construction ? ", comprising " + property.construction : "") + ", together with the land beneath and all rights, easements and appurtenances, " + verb +
    (ctx.data.execution.mapAttached ? ", shown in red in the site plan annexed hereto," : "") + " and bounded as follows:"
  );
}

function detailItems(ctx: Ctx, property: Property, expenses?: boolean): SafeHtml[] {
  const items: string[] = [];
  const openLand = property.kind === "plot" || property.kind === "agricultural" || property.kind === "industrial";
  const built = property.construction || property.constructionType || property.builtUpArea;
  if (ctx.hi) {
    const name = "उक्त वर्णित " + kindHi(property);
    items.push(name + " " + landUse(property, "hindi") + " प्रयोजनार्थ है।");
    if (property.area) items.push(name + " का कुल क्षेत्रफल " + areaTriple(property, "hindi") + " है।");
    if (built) {
      items.push(
        name + " पर निर्माण विद्यमान है" + (property.constructionType ? " जो " + property.constructionType + " का निर्मित है" : "") +
        (property.builtUpArea ? ", निर्मित क्षेत्रफल " + property.builtUpArea + " वर्गफुट है" : "") + (property.constructionYear ? ", निर्माण वर्ष " + property.constructionYear : "") + "।",
      );
    } else if (openLand) items.push(name + " पर किसी प्रकार का निर्माण नहीं किया हुआ है।");
    if (property.road) items.push(name + " " + property.road + " पर स्थित है।");
    if (openLand || property.kind === "house") items.push(name + (property.corner ? " कार्नर है।" : " कार्नर नहीं है।"));
    if (property.marketValue) items.push(name + " का डी.एल.सी. दर अनुसार बाजार मूल्य " + moneyHi(property.marketValue) + " है।");
    if (expenses) {
      const by = ctx.data.execution.expensesBy;
      items.push("उक्त दस्तावेज के पंजीयन का समस्त खर्चा " + (by === "shared" ? "दोनों पक्षकारों द्वारा समान रूप से" : ctx.ref(by) + " द्वारा") + " वहन किया गया है।");
    }
  } else {
    const name = "The said " + propertyKindLabels[property.kind].toLowerCase();
    items.push(name + " is for " + landUse(property, "english") + " use.");
    if (property.area) items.push("Total area: " + areaTriple(property, "english") + ".");
    if (built) {
      items.push(
        "Construction exists" + (property.constructionType ? " (" + property.constructionType + ")" : "") + (property.builtUpArea ? ", built-up area " + property.builtUpArea + " sq. ft." : "") +
        (property.constructionYear ? ", constructed in " + property.constructionYear : "") + ".",
      );
    } else if (openLand) items.push("No construction exists on the said property.");
    if (property.road) items.push(name + " abuts " + property.road + ".");
    if (openLand || property.kind === "house") items.push(name + (property.corner ? " is a corner property." : " is not a corner property."));
    if (property.marketValue) items.push("Market value as per DLC rates: " + moneyEn(property.marketValue) + ".");
    if (expenses) {
      const by = ctx.data.execution.expensesBy;
      items.push("Stamp duty and registration expenses have been borne by " + (by === "shared" ? "both parties equally" : ctx.ref(by)) + ".");
    }
  }
  return items.map((item) => html`${item}`);
}

/* ------------------------------------------------------------- Signatures */

export function signatureBlocks(ctx: Ctx, roles: PartyRole[] = ["first", "second"], options: { witnessLabel?: string } = {}): Block[] {
  const items = roles.flatMap((role) => {
    const parties = ctx.parties[role].length ? ctx.parties[role] : [undefined];
    return parties.map((party) => ({
      label: (ctx.hi ? "ह. " : "Signature of ") + ctx.term(role),
      lines: party
        ? [
            "(" + displayName(party, ctx.lang) + ")",
            formatAadhaar(party.aadhaar, ctx.ids.maskAadhaar) ? (ctx.hi ? "आधार नम्बर : " : "Aadhaar No.: ") + formatAadhaar(party.aadhaar, ctx.ids.maskAadhaar) : "",
            party.pan ? (ctx.hi ? "पैन नम्बर : " : "PAN: ") + party.pan : "",
          ].filter(Boolean)
        : [""],
    }));
  });
  const witnesses = ctx.parties.witness.length ? ctx.parties.witness : [undefined, undefined];
  const witnessLabel = options.witnessLabel ?? (ctx.hi ? "गवाह नं. " : "Witness ");
  return [
    { t: "signatures", items },
    { t: "heading", text: ctx.hi ? "गवाहान" : "WITNESSES" },
    {
      t: "signatures",
      items: witnesses.map((party, index) => ({
        label: witnessLabel + (index + 1),
        lines: party
          ? [
              [displayName(party, ctx.lang), ctx.hi ? relativeHi(party) : relativeEn(party)].filter(Boolean).join(" "),
              [party.age ? (ctx.hi ? "आयु " + party.age + " वर्ष" : "Age " + party.age) : "", ctx.hi && party.caste ? "जाति " + party.caste : ""].filter(Boolean).join(", "),
              party.address ? (ctx.hi ? "निवासी " : "R/o ") + party.address : "",
              formatAadhaar(party.aadhaar, ctx.ids.maskAadhaar) ? (ctx.hi ? "आधार नम्बर : " : "Aadhaar No.: ") + formatAadhaar(party.aadhaar, ctx.ids.maskAadhaar) : "",
            ].filter(Boolean)
          : [ctx.hi ? "नाम, पिता का नाम व पता" : "Name & address"],
      })),
    },
  ];
}

/** User-entered extra clauses, one per line. */
export function additionalClauses(ctx: Ctx): SafeHtml[] {
  return (ctx.data.terms.additionalClauses ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => html`${line}`);
}

export function closingDate(ctx: Ctx) {
  return ctx.hi ? "इति आज दिनांक " + hindiLongDate(ctx.date, false) : "Executed on " + englishLongDate(ctx.date, false) + ".";
}

export { agree, b, join, moneyEn, moneyHi };
