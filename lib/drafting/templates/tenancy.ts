import type { PartyRole } from "@/lib/deed-types";
import type { Terms } from "@/lib/schemas/deed-data";

import { html, type Block, type SafeHtml } from "../blocks";
import { additionalClauses, closingDate, longDate, money, opening, scheduleBlocks, signatureBlocks, type Ctx } from "../common";
import { figure, partyList } from "../format";
import { englishLongDate, hindiLongDate, parseIsoDate, shortDate, termEndDate } from "../hindi";

export type RentRow = { year: number; from?: string; to?: string; rent: number };

/** Year-wise rent with compounding escalation every N years. */
export function rentSchedule(terms: Terms): RentRow[] {
  const base = terms.monthlyRent ?? 0;
  const months = terms.termMonths ?? 0;
  if (!base || !months) return [];
  const years = Math.ceil(months / 12);
  const pct = terms.escalationPercent ?? 0;
  const every = Math.max(1, Math.round(terms.escalationEveryYears ?? 1));
  const start = parseIsoDate(terms.startDate);
  return Array.from({ length: Math.min(years, 30) }, (_, index) => {
    const rent = Math.round(base * Math.pow(1 + pct / 100, Math.floor(index / every)));
    if (!start) return { year: index + 1, rent };
    const from = new Date(Date.UTC(start.getUTCFullYear() + index, start.getUTCMonth(), start.getUTCDate())).toISOString().slice(0, 10);
    const to = termEndDate(from, Math.min(12, months - index * 12));
    return { year: index + 1, from, to, rent };
  });
}

function roles(ctx: Ctx): { owner: PartyRole; tenant: PartyRole } {
  return ctx.input.type === "rent" ? { owner: "second", tenant: "first" } : { owner: "first", tenant: "second" };
}

export function tenancyDeed(ctx: Ctx): Block[] {
  return ctx.hi ? hindi(ctx) : english(ctx);
}

function hindi(ctx: Ctx): Block[] {
  const terms = ctx.data.terms;
  const { owner, tenant } = roles(ctx);
  const O = (owner === "first" ? "प्रथम पक्षकार/" : "द्वितीय पक्षकार/") + ctx.term(owner);
  const T = (tenant === "first" ? "प्रथम पक्षकार/" : "द्वितीय पक्षकार/") + ctx.term(tenant);
  const by = (who: "tenant" | "owner") => (who === "tenant" ? T : O);
  const isLease = ctx.input.type === "lease";
  const deedName = isLease ? "पट्टा विलेख" : "किरायानामा";
  const end = termEndDate(terms.startDate, terms.termMonths);
  const expenses = ctx.data.execution.expensesBy;

  const items: SafeHtml[] = [
    html`यह कि ${O} ने इस ${deedName} में वर्णित परिसर, जिसका सम्पूर्ण विवरण आगे परिशिष्ट में दिया गया है, ${T} को रूपये ${money(ctx, terms.monthlyRent)} मासिक किराये पर देना एवं ${T} ने बतौर किराया लेना स्वीकार किया है।`,
    html`यह कि ${T} ${O} को उपरोक्त तयशुदा किराया प्रति अंग्रेजी माह की ${terms.rentDueDay ?? ".........."} तारीख तक ${terms.rentAccount ? O + " के बैंक खाते " + terms.rentAccount + " में" : O + " को"} नियमित रूप से जमा करा दिया करेगा।`,
    html`यह कि किरायेदारी दिनांक ${hindiLongDate(terms.startDate, false)} से विधिवत प्रारम्भ मानी जायेगी तथा यह ${deedName} कुल ${terms.termMonths ?? ".........."} माह की निश्चित अवधि के लिये निष्पादित किया जा रहा है, जो दिनांक ${hindiLongDate(end, false)} तक प्रभावी एवं बाध्यकारी रहेगा। यह स्पष्ट रूप से सहमति की जाती है कि उक्त अवधि एक निश्चित संविदात्मक अवधि होगी तथा इस अवधि के दौरान दोनों पक्षकार इस ${deedName} की शर्तों से पूर्णतः बाध्य रहेंगे।`,
  ];
  if (terms.rentFreeDays) items.push(html`यह कि कब्जा प्राप्ति की तिथि से ${terms.rentFreeDays} दिवस की अवधि फिट-आउट (किराया मुक्त) अवधि होगी, जिसमें ${T} आंतरिक साज-सज्जा का कार्य करेगा तथा इस अवधि का किराया देय नहीं होगा।`);
  if (terms.escalationPercent) items.push(html`यह कि किराये में प्रत्येक ${terms.escalationEveryYears ?? 1} वर्ष उपरान्त अंतिम देय किराये पर ${terms.escalationPercent}% की वृद्धि होगी।`);
  if (terms.lockInMonths) items.push(html`यह कि इस ${deedName} की लॉक-इन अवधि ${terms.lockInMonths} माह होगी, जिसके दौरान कोई भी पक्षकार बिना गंभीर उल्लंघन के इसे समाप्त नहीं करेगा।`);
  items.push(
    html`यह कि उक्त अवधि समाप्त होने पर, यदि दोनों पक्षकार आपसी सहमति से लिखित रूप में नवीनीकरण नहीं करते हैं, तो किरायेदारी स्वतः समाप्त मानी जायेगी और ${T} परिसर का शांतिपूर्ण, खाली एवं निर्विवाद कब्जा ${O} को सौंप देगा।`,
    html`यह कि अवधि के दौरान परिसर का उपयोग केवल ${terms.purpose || "स्वीकृत प्रयोजन"} हेतु ही किया जायेगा तथा किसी भी प्रकार का अनधिकृत उपयोग इस ${deedName} की शर्तों का उल्लंघन माना जायेगा।`,
    html`यह कि किरायेशुदा परिसर में उपभोग की जाने वाली समस्त विद्युत, जल, सीवरेज, स्वच्छता शुल्क अथवा अन्य उपयोगिता सेवाओं (Utilities) का समस्त भुगतान ${by(terms.utilitiesBy)} स्वयं वहन करेगा, जो मासिक किराये के अतिरिक्त पृथक देय होगा, तथा किसी भी बकाया, अधिभार, दण्ड या विलम्ब शुल्क की सम्पूर्ण जिम्मेदारी उसी की होगी।`,
    html`यह कि ${T} परिसर का उपयोग पूर्ण सावधानी, सुरक्षा एवं विधिक मर्यादा के साथ करेगा तथा परिसर की वर्तमान संरचना, स्वरूप, नक्शा, दीवारें, छत, फर्श, शटर, विद्युत फिटिंग, जल संयोजन एवं अन्य स्थायी संरचनात्मक तत्वों में बिना ${O} की पूर्व लिखित अनुमति के किसी भी प्रकार का परिवर्तन, तोड़फोड़, विभाजन, निर्माण, अस्थायी या स्थायी ढांचा, साइन बोर्ड अथवा भारी मशीनरी स्थापित नहीं करेगा। किसी भी आंतरिक कार्य हेतु कम से कम 30 (तीस) दिन पूर्व लिखित सूचना देनी होगी।`,
    html`यह कि परिसर के दैनिक रखरखाव (Routine Maintenance), स्वच्छता एवं छोटे-मोटे मरम्मत कार्य का व्यय ${by(terms.maintenanceBy)} वहन करेगा, तथा ${T} की लापरवाही से हुई किसी भी संरचनात्मक क्षति की सम्पूर्ण भरपाई ${T} करेगा।`,
    html`यह कि किरायेदारी समाप्ति पर ${T} परिसर को उसी मूल अवस्था में, सामान्य घिसावट (Normal Wear & Tear) को छोड़कर, खाली एवं निर्विवाद रूप में ${O} को सुपुर्द करेगा। बिना अनुमति किये गये परिवर्तन को हटवाने अथवा मूल स्थिति बहाल कराने का समस्त व्यय ${T} वहन करेगा।`,
    html`यह कि ${O} को उचित पूर्व सूचना देकर परिसर का निरीक्षण (Inspection) करने का अधिकार होगा।`,
    html`यह कि ${T} परिसर को किसी अन्य व्यक्ति, संस्था, फर्म, कम्पनी या तृतीय पक्ष को प्रत्यक्ष या अप्रत्यक्ष रूप से उप-किरायेदारी, लाइसेंस, भागीदारी, मुख्तारनामा (Power of Attorney) अथवा किसी अन्य व्यवस्था के माध्यम से हस्तांतरित नहीं करेगा। इस शर्त का उल्लंघन मूलभूत शर्त का उल्लंघन माना जायेगा तथा ${O} को तत्काल किरायेदारी समाप्त करने का अधिकार होगा।`,
    html`यह कि परिसर पर राज्य सरकार, केन्द्र सरकार, नगर निगम अथवा अन्य निकाय द्वारा निर्धारित सम्पत्ति कर ${by(terms.propertyTaxBy)} द्वारा वहन किया जायेगा तथा ${T} के व्यवसाय से सम्बन्धित समस्त कर एवं अनुज्ञाप्तियाँ ${T} की जिम्मेदारी होंगी।`,
    html`यह कि यदि ${T} अवधि पूर्ण होने से पूर्व परिसर खाली करना चाहे तो ${terms.noticeMonths ?? 1} माह पूर्व लिखित सूचना देकर परिसर का शांतिपूर्ण एवं खाली कब्जा सुपुर्द करेगा। कब्जा सुपुर्दगी के पश्चात लिखित रसीद प्राप्त की जायेगी जो भविष्य में किसी भी विवाद की स्थिति में प्रमाण के रूप में मान्य होगी।`,
    html`यह कि अग्रिम/सुरक्षा राशि (Advance/Security) के रूप में रूपये ${money(ctx, terms.securityDeposit)} ${T} द्वारा ${O} को अदा किये गये हैं, जो ब्याज रहित सुरक्षा राशि के रूप में रखी जायेगी तथा किरायेदारी समाप्ति पर किसी भी बकाया, क्षति या दायित्व के समायोजन उपरान्त ${T} को वापस की जायेगी।`,
    html`यह कि इस ${deedName} से सम्बन्धित सभी वाद, कार्यवाहियाँ अथवा अन्य विधिक प्रक्रियाएँ केवल ${terms.jurisdiction || ctx.place} स्थित सक्षम न्यायालयों के समक्ष ही प्रस्तुत की जायेंगी तथा उन पर विशिष्ट एवं अनन्य क्षेत्राधिकार (Exclusive Jurisdiction) केवल ${terms.jurisdiction || ctx.place} न्यायालयों का ही होगा।${terms.arbitration ? " किसी भी विवाद का निस्तारण प्रथमतः मध्यस्थता एवं सुलह अधिनियम, 1996 के अन्तर्गत एकल मध्यस्थ द्वारा किया जायेगा।" : ""}`,
    html`यह कि इस ${deedName} में उल्लिखित मोबाइल नम्बर एवं ई-मेल दोनों पक्षकारों के पंजीकृत सम्पर्क माने जायेंगे तथा व्हाट्सएप, ई-मेल, एस.एम.एस. या अन्य इलेक्ट्रॉनिक माध्यम से भेजा गया नोटिस विधिसम्मत सेवा माना जायेगा।`,
    html`यह कि यह ${deedName} पक्षकारों के मध्य सम्पूर्ण एवं अंतिम सहमति है; इसमें कोई संशोधन केवल लिखित सहमति से ही वैध होगा; किसी शर्त के उल्लंघन पर तत्काल कार्यवाही न करना अधिकारों का परित्याग नहीं माना जायेगा; किसी धारा के अवैध घोषित होने पर शेष धाराएँ प्रभावी रहेंगी; यह ${deedName} पक्षकारों के उत्तराधिकारियों एवं विधिक प्रतिनिधियों पर भी बाध्यकारी होगा; तथा स्टाम्प शुल्क एवं पंजीयन व्यय ${expenses === "shared" ? "दोनों पक्षकारों द्वारा समान रूप से" : (expenses === "first" ? "प्रथम पक्षकार" : "द्वितीय पक्षकार") + " द्वारा"} वहन किया जायेगा।`,
    html`यह कि प्राकृतिक आपदा, सरकारी प्रतिबंध, युद्ध, महामारी या अन्य अप्रत्याशित परिस्थिति के कारण परिसर का उपयोग अस्थायी रूप से बाधित होने पर पक्षकार आपसी सहमति से समाधान करेंगे।`,
    ...additionalClauses(ctx),
  );

  return [
    ...opening(ctx),
    { t: "para", html: html`यह ${deedName} आज दिनांक ${longDate(ctx, ctx.date)} को ${ctx.place} में ${partyList(ctx.parties.first, "hindi", { ...ctx.ids, ids: true })} (जिसे इस विलेख में प्रथम पक्षकार/${ctx.term("first")} कहा जायेगा) एवं ${partyList(ctx.parties.second, "hindi", { ...ctx.ids, ids: true })} (जिसे इस विलेख में द्वितीय पक्षकार/${ctx.term("second")} के नाम से सम्बोधित किया जायेगा) के मध्य निम्नलिखित शर्तों पर निष्पादित किया गया है।` },
    ...(ctx.data.execution.subRegistrarOffice ? [{ t: "para", html: html`यह ${deedName} उप-पंजीयक कार्यालय ${ctx.data.execution.subRegistrarOffice} में पंजीयन हेतु प्रस्तुत किया जायेगा।` } as Block] : []),
    { t: "clauses", style: "numbered", items },
    ...scheduleBlocks(ctx, { heading: "परिसर का विवरण", verb: "किराये पर दिया गया है" }),
    ...rentTable(ctx),
    { t: "para", html: html`अतः उपरोक्त तथ्यों एवं आपसी सहमति के आधार पर दोनों पक्षकारों ने आपसी विचार-विमर्श, स्वेच्छा एवं बिना किसी दबाव, प्रलोभन या अनुचित प्रभाव के यह ${deedName} पढ़, सुन व समझकर निम्न साक्षियों के समक्ष अपने हस्ताक्षर कर दिये हैं। ${closingDate(ctx)}` },
    ...signatureBlocks(ctx),
  ];
}

function rentTable(ctx: Ctx): Block[] {
  const rows = rentSchedule(ctx.data.terms);
  if (rows.length < 2) return [];
  return [
    { t: "heading", text: ctx.hi ? "मासिक किराया अनुसूची" : "MONTHLY RENT SCHEDULE" },
    {
      t: "table",
      head: ctx.hi ? ["वर्ष", "से", "तक", "मासिक किराया"] : ["Year", "From", "To", "Monthly rent"],
      rows: rows.map((row) => [String(row.year), row.from ? shortDate(row.from) : "—", row.to ? shortDate(row.to) : "—", "Rs. " + figure(row.rent)]),
    },
  ];
}

function english(ctx: Ctx): Block[] {
  const terms = ctx.data.terms;
  const { owner, tenant } = roles(ctx);
  const O = ctx.ref(owner);
  const T = ctx.ref(tenant);
  const by = (who: "tenant" | "owner") => (who === "tenant" ? T : O);
  const isLease = ctx.input.type === "lease";
  const deed = isLease ? "Lease Deed" : "Rent Agreement";
  const end = termEndDate(terms.startDate, terms.termMonths);
  const place = terms.jurisdiction || ctx.place;
  const expenses = ctx.data.execution.expensesBy;
  const heading = (text: string, body: SafeHtml) => html`<strong>${text}.</strong> ${body}`;

  const items: SafeHtml[] = [
    heading("GRANT", html`In consideration of the monthly ${isLease ? "lease rent" : "rent"} and the covenants herein, ${O} hereby ${isLease ? "demise and grant a lease of" : "let out"} the premises described below to ${T} for a period of ${terms.termMonths ?? "____"} months commencing from ${englishLongDate(terms.startDate, false)} and ending on ${englishLongDate(end, false)}, for the purpose of ${terms.purpose || "________"} and for no other purpose.`),
  ];
  if (terms.rentFreeDays) items.push(heading("FIT-OUT PERIOD", html`${T[0].toUpperCase() + T.slice(1)} shall have a rent-free fit-out period of ${terms.rentFreeDays} days from the date of physical possession for interiors and installation. Rent shall commence on expiry of this period.`));
  items.push(
    heading("RENT", html`${T[0].toUpperCase() + T.slice(1)} shall pay a monthly rent of ${money(ctx, terms.monthlyRent)} on or before the ${terms.rentDueDay ?? "____"} day of each English calendar month${terms.rentAccount ? " into the bank account of " + O + ": " + terms.rentAccount : ""}.${terms.escalationPercent ? " The rent shall increase by " + terms.escalationPercent + "% on the last paid rent every " + (terms.escalationEveryYears ?? 1) + " year(s), as set out in the rent schedule." : ""}`),
    heading("SECURITY DEPOSIT", html`${T[0].toUpperCase() + T.slice(1)} has paid an interest-free refundable security deposit of ${money(ctx, terms.securityDeposit)}, which shall be refunded on handing over vacant and peaceful possession, after adjusting any lawful dues or damage.`),
    heading("LOCK-IN AND TERMINATION", html`${terms.lockInMonths ? "There shall be a lock-in period of " + terms.lockInMonths + " months, during which neither party shall terminate this " + deed + " except for material breach. " : ""}${T[0].toUpperCase() + T.slice(1)} may terminate by giving ${terms.noticeMonths ?? 1} month(s) prior written notice. If rent remains unpaid for three consecutive months after written notice, ${O} may terminate this ${deed}.`),
    heading("USE AND ALTERATIONS", html`${T[0].toUpperCase() + T.slice(1)} shall use the premises carefully and lawfully, shall not make structural alterations, partitions or install heavy machinery or hoardings without the prior written consent of ${O}, and shall give 30 days' written notice before any interior work.`),
    heading("SUB-LETTING", html`${T[0].toUpperCase() + T.slice(1)} shall not sub-let, license, assign or part with possession of the premises, wholly or partly, in any manner without the prior written consent of ${O}.`),
    heading("UTILITIES, MAINTENANCE AND TAXES", html`Electricity, water and other utility charges shall be borne by ${by(terms.utilitiesBy)}; routine maintenance by ${by(terms.maintenanceBy)}; and property tax by ${by(terms.propertyTaxBy)}. Structural repairs shall be the responsibility of ${O}, except damage caused by the negligence of ${T}.`),
    heading("INSPECTION", html`${O[0].toUpperCase() + O.slice(1)} may inspect the premises at reasonable times after prior notice.`),
    heading("REPRESENTATIONS", html`${O[0].toUpperCase() + O.slice(1)} represents that they are the absolute owners of the premises with full right to let them out, that the premises are free from encumbrances and litigation, and that ${T} shall enjoy quiet possession during the term.`),
    heading("INDEMNITY", html`Each party shall indemnify the other against losses arising from its breach of this ${deed}.`),
    heading("FORCE MAJEURE", html`Neither party shall be liable for failure to perform due to natural calamity, epidemic, war, government restriction or other events beyond reasonable control; the parties shall mutually settle the consequences.`),
    heading("HANDOVER", html`On expiry or earlier termination, ${T} shall hand over vacant and peaceful possession in the same condition, subject to normal wear and tear, against a written receipt.`),
    heading("NOTICES", html`Notices may be served at the addresses above or by e-mail, WhatsApp or SMS on the registered numbers of the parties, and shall be deemed validly served.`),
    heading("DISPUTE RESOLUTION", html`${terms.arbitration ? "Disputes shall be referred to a sole arbitrator under the Arbitration and Conciliation Act, 1996, seated at " + place + ". " : ""}Courts at ${place} alone shall have jurisdiction.`),
    heading("STAMP DUTY AND REGISTRATION", html`Stamp duty and registration charges shall be borne by ${expenses === "shared" ? "both parties equally" : ctx.ref(expenses)}.`),
    heading("MISCELLANEOUS", html`This ${deed} is the entire agreement between the parties; amendments shall be valid only in writing; failure to enforce any term is not a waiver; an invalid provision shall not affect the rest; and this ${deed} binds the parties' heirs, successors and permitted assigns.`),
    ...additionalClauses(ctx),
  );

  const scheduleA: Array<[string, string]> = [
    ["Lease term", (terms.termMonths ?? "____") + " months"],
    ["Commencement date", englishLongDate(terms.startDate, false)],
    ["Expiry date", englishLongDate(end, false)],
    ["Monthly rent", terms.monthlyRent ? "Rs. " + figure(terms.monthlyRent) : "____"],
    ["Rent due by", terms.rentDueDay ? "Day " + terms.rentDueDay + " of each month" : "____"],
    ["Escalation", terms.escalationPercent ? terms.escalationPercent + "% every " + (terms.escalationEveryYears ?? 1) + " year(s)" : "None"],
    ["Security deposit", terms.securityDeposit ? "Rs. " + figure(terms.securityDeposit) + " (interest-free, refundable)" : "____"],
    ["Rent-free fit-out", terms.rentFreeDays ? terms.rentFreeDays + " days" : "None"],
    ["Lock-in period", terms.lockInMonths ? terms.lockInMonths + " months" : "None"],
    ["Notice period", (terms.noticeMonths ?? 1) + " month(s)"],
    ["Electricity & water", "Borne by " + by(terms.utilitiesBy)],
    ["Property tax", "Borne by " + by(terms.propertyTaxBy)],
    ["Jurisdiction", place],
  ];

  return [
    ...opening(ctx),
    { t: "para", html: html`This ${deed} is made and executed at ${ctx.place} on ${longDate(ctx, ctx.date)}, by and between:` },
    { t: "para", html: html`<strong>${ctx.config.roles[owner].en.toUpperCase()}:</strong> ${partyList(ctx.parties[owner], "english", { ...ctx.ids, ids: true })} (hereinafter “${O}”, which expression shall include their heirs, successors and permitted assigns);` },
    { t: "para", center: true, html: html`<strong>AND</strong>` },
    { t: "para", html: html`<strong>${ctx.config.roles[tenant].en.toUpperCase()}:</strong> ${partyList(ctx.parties[tenant], "english", { ...ctx.ids, ids: true })} (hereinafter “${T}”, which expression shall include their successors and permitted assigns).` },
    { t: "para", html: html`All pronouns in this ${deed} include every gender, and the singular includes the plural.` },
    ...scheduleBlocks(ctx, { heading: "DESCRIPTION OF THE PREMISES", verb: isLease ? "hereby demised" : "hereby let out" }),
    { t: "para", html: html`NOW, THEREFORE, THE PARTIES AGREE AS FOLLOWS:` },
    { t: "clauses", style: "numbered", items },
    { t: "heading", text: isLease ? "SCHEDULE A – TERMS OF LEASE" : "SCHEDULE – KEY TERMS" },
    { t: "table", rows: scheduleA, widths: ["40%", "60%"] },
    ...rentTable(ctx),
    { t: "para", html: html`IN WITNESS WHEREOF the parties have signed this ${deed} on the date first written above, in the presence of the following witnesses. ${closingDate(ctx)}` },
    ...signatureBlocks(ctx),
  ];
}
