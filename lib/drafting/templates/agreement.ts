import { html, type Block, type SafeHtml } from "../blocks";
import {
  additionalClauses,
  agree,
  closingDate,
  longDate,
  money,
  opening,
  paymentPhrase,
  paymentsTotal,
  scheduleBlocks,
  signatureBlocks,
  titleRecital,
  type Ctx,
} from "../common";
import { partyList, propertiesRef, propertyEn, propertyHi } from "../format";
import { hindiLongDate, englishLongDate } from "../hindi";

export function agreementToSell(ctx: Ctx): Block[] {
  return ctx.hi ? hindi(ctx) : english(ctx);
}

function dueText(ctx: Ctx) {
  const terms = ctx.data.terms;
  if (ctx.hi) {
    if (terms.balanceDueDate) return "दिनांक " + hindiLongDate(terms.balanceDueDate, false) + " तक";
    return "आज दिनांक से " + (terms.balanceDue || "..........") + " की अवधि में";
  }
  if (terms.balanceDueDate) return "on or before " + englishLongDate(terms.balanceDueDate, false);
  return "within " + (terms.balanceDue || "________") + " from the date of this agreement";
}

function hindi(ctx: Ctx): Block[] {
  const { first, second } = ctx.parties;
  const terms = ctx.data.terms;
  const S = "प्रथम पक्षकार/" + ctx.term("first");
  const B = "द्वितीय पक्षकार/" + ctx.term("second");
  const total = ctx.data.consideration.total ?? 0;
  const paid = paymentsTotal(ctx.data);
  const property = propertiesRef(ctx.data.properties, "hindi");
  const single = ctx.data.properties.length === 1;
  const expenses = ctx.data.execution.expensesBy;

  const items: SafeHtml[] = [
    html`यह कि ${single ? propertyHi(ctx.data.properties[0]) : "निम्न अनुसूची में वर्णित सम्पत्तियाँ"}, जिसका सम्पूर्ण विवरण इस विलेख के अंत में दिया जा रहा है, पर ${S} का मालिकाना हक व कब्जा है।`,
    ...titleRecital(ctx),
    html`यह कि ${property} पर एकल रूप से ${S} का मालिकाना हक, अधिकार व कब्जा दखल चला आ रहा है, जिस पर ${S} के अतिरिक्त अन्य किसी भी दीगर व्यक्ति का कोई हक, साझा, हित व सरोकार नहीं है और ना ही ${S} द्वारा आज दिवस से पूर्व कहीं अन्यत्र रहन, बय, हिबा, बख्शीश, मुन्तकिल-गिरांबार, विक्रय व अन्तरण आदि किया गया है और ना ही ${property} किसी मुकदमा, इब्तदायी, इजराय, डिक्री, कुर्की, नीलाम आदि में सम्मिलित है${terms.existingLoanBank ? " तथा " + property + " पर वर्तमान में " + terms.existingLoanBank + " से ऋण बकाया चला आ रहा है" : ""}।`,
    html`यह कि ${S} को ${property} का उचित विक्रय प्रतिफल प्राप्त हो रहा है, इसलिये आज दिवस ${S} द्वारा ${property} को मय जुमला तमाम हक हकूक मालिकाना सहित बिल एवज तादादी मुबलिग ${money(ctx, total)} में कतई तौर पर बदस्त व बहक ${B} ‘‘${partyList(second, "hindi", ctx.ids)}’’ को विक्रय करना तय पाया है${ctx.data.payments.length ? html`, जिसमें से ${S} ने ${B} से राशि ${money(ctx, paid)} निम्नानुसार प्राप्त कर ली है:- ${ctx.data.payments.map((payment, index) => "(" + (index + 1) + ") " + paymentPhrase(ctx, payment)).join("; ")}। इस प्रकार अग्रिम साई पेटे के रूप में कुल प्रतिफल राशि में से उक्त राशि ${S} ने प्राप्त कर ली है, जिस राशि की प्राप्ति हेतु अलग से रसीद की आवश्यकता नहीं है, इस विलेख का निष्पादन ही उचित व पर्याप्त है` : ""}।`,
    html`यह कि शेष राशि ${money(ctx, Math.max(total - paid, 0))} ${B} द्वारा ${dueText(ctx)} ${S} को अदा कर विक्रय पत्र का पंजीयन अपने पक्ष में अथवा अपने द्वारा निर्धारित व्यक्ति के पक्ष में करवाया जायेगा।${terms.forfeitOnBuyerDefault ? " अगर उक्त मियाद अवधि में " + B + " शेष राशि अदा करने में " + agree(second, "कासिर रहता है या असमर्थ रहता है", "कासिर रहती है या असमर्थ रहती है", "कासिर रहते हैं या असमर्थ रहते हैं") + " तो " + S + " को यह हक एवं अधिकार होगा कि वह " + B + " द्वारा दी गई साई राशि जब्त (फोरफिट) कर लेवे, जिस सम्बन्ध में " + B + " द्वारा किसी भी प्रकार की कोई कार्यवाही नहीं की जायेगी।" : ""}`,
    html`यह कि शेष राशि प्राप्त कर ${S} विक्रय पत्र का पंजीयन ${B} के पक्ष में करवाने में आनाकानी ${agree(first, "करता है या असमर्थ रहता है", "करती है या असमर्थ रहती है", "करते हैं या असमर्थ रहते हैं")} तो ${B} को हक एवं अधिकार होगा कि वह ${terms.sellerDefaultRemedy === "double" ? "साई पेटे दी गई राशि की दुगुनी राशि " + S + " से प्राप्त कर लेवे" : terms.sellerDefaultRemedy === "specific" ? "जरिये कानूनी कार्यवाही अपने हक में विक्रय पत्र का पंजीयन करवा लेवे" : "जरिये कानूनी कार्यवाही अपने हक में विक्रय पत्र का पंजीयन करवा लेवे या " + S + " से साई पेटे दी गई राशि की दुगुनी राशि प्राप्त कर लेवे, विकल्प चुनने का अधिकार " + B + " को होगा"}।`,
    html`यह कि विक्रय पत्र पंजीयन से पूर्व ${property} बाबत मालिकाना हक व अधिकार के सम्बन्ध में ${S} की ओर से किसी भी प्रकार का कोई वाद विवाद होता है तो उसके निस्तारण की जिम्मेदारी ${S} की होगी, जिस हेतु ${S} पूर्णतया पाबंद ${agree(first, "होगा व रहेगा", "होगी व रहेगी", "होंगे व रहेंगे")}। यदि कोई दावेदार, उजरदार, हकदार, हिस्सेदार, डिक्रीदार पैदा हुआ तो उसकी जिम्मेदारी मय हर्जे खर्चे के ${S} व वारिसान की होगी।`,
    html`यह कि विक्रय पत्र के पंजीयन व उससे सम्बन्धित समस्त खर्चा/व्यय ${expenses === "shared" ? "दोनों पक्षकारों द्वारा समान रूप से" : expenses === "first" ? S + " द्वारा" : B + " द्वारा"} वहन किया जायेगा और विक्रय पत्र के पंजीयन के समय सम्पत्ति से सम्बन्धित असल दस्तावेजात ${S} द्वारा ${B} को संभला दिये जायेंगे तथा ${property} का खाली कब्जा भी पंजीयन के समय सुपुर्द किया जायेगा।`,
    html`यह कि विक्रय पत्र के पंजीयन के समय तक ${property} पर किसी भी प्रकार की कोई राशि सरकारी, अर्द्धसरकारी व किसी भी संस्था की बकाया निकलती है तो उसकी अदायगी की जिम्मेदारी ${S} की होगी।`,
  ];
  if (terms.existingLoanBank) {
    items.push(html`यह कि ${property} पर वर्तमान में ${terms.existingLoanBank} का ऋण बकाया चला आ रहा है, जिसे विक्रय पत्र पंजीयन से पूर्व ${S} द्वारा चुकता कर चुकता प्रमाण पत्र (एन.ओ.सी.) मय असल दस्तावेज प्राप्त कर ${B} को संभलाये जायेंगे, या विकल्प में ${S} के नाम से विद्यमान ऋण खाते की अदायगी ${B} के स्वीकृत ऋण खाते से प्रत्यक्ष रूप से (इन्टरनल एडजस्टमेंट के माध्यम से) कर दी जायेगी, जिस हेतु दोनों पक्षकारान पूर्णतया सहमत हैं।`);
  }
  if (terms.buyerLoanBank) {
    items.push(html`यह कि ${B} द्वारा ${terms.buyerLoanBank} से लिये जा रहे ऋण की कागजी कार्यवाही में ${S} पूर्ण सहयोग ${agree(first, "करेगा", "करेगी", "करेंगे")}।`);
  }
  items.push(html`यह कि उक्त इकरारनामा विलेख से दोनों पक्षकारान व उनके वारिसान पूर्णतया पाबंद होंगे।`, ...additionalClauses(ctx));

  return [
    ...opening(ctx),
    { t: "para", html: html`यह इकरारनामा आज दिनांक ${longDate(ctx, ctx.date)} को ${ctx.place} में ${partyList(first, "hindi", { ...ctx.ids, ids: true })} (जिन्हें इस विलेख में ${S} के नाम से सम्बोधित किया गया है) एवं ${partyList(second, "hindi", { ...ctx.ids, ids: true })} (जिन्हें इस विलेख में ${B} के नाम से सम्बोधित किया गया है) के मध्य निम्नानुसार शर्तों पर निष्पादित किया गया है:-` },
    { t: "clauses", style: "numbered", items },
    ...scheduleBlocks(ctx, { heading: "विवरण सम्पत्ति निम्न प्रकार है", verb: ctx.term("first") + " ने " + ctx.term("second") + " को विक्रय करने का इकरार किया है" }),
    { t: "para", html: html`लिहाजा यह इकरारनामा आज दिवस को दोनों पक्षकारान द्वारा अपनी-अपनी राजीखुशी, होश हवास में, बिना किसी नशे पते के, बिना किसी धोखा फरेब, दहशत दबाव व बहकावट के, स्वस्थचित व प्रसन्नचित अवस्था में पढ़, सुन व समझकर सही होना स्वीकार कर निम्न साक्षीगण के समक्ष इस पर अपने-अपने हस्ताक्षर/अंगूठा निशानी कर निष्पादित कर दिया है, जो कि सही है और सनद रहे तथा वक्त जरूरत काम आवे। ${closingDate(ctx)}` },
    ...signatureBlocks(ctx),
  ];
}

function english(ctx: Ctx): Block[] {
  const { first, second } = ctx.parties;
  const terms = ctx.data.terms;
  const S = ctx.ref("first");
  const B = ctx.ref("second");
  const total = ctx.data.consideration.total ?? 0;
  const paid = paymentsTotal(ctx.data);
  const single = ctx.data.properties.length === 1;
  const expenses = ctx.data.execution.expensesBy;
  const remedy =
    terms.sellerDefaultRemedy === "double"
      ? "to recover from " + S + " double the earnest money paid"
      : terms.sellerDefaultRemedy === "specific"
        ? "to seek specific performance of this agreement through the court"
        : "either to seek specific performance of this agreement through the court or to recover double the earnest money from " + S + ", at the option of " + B;

  const items: SafeHtml[] = [
    html`That ${S} is the absolute owner in possession of ${single ? propertyEn(ctx.data.properties[0]) : "the properties described in the Schedule"} (the “Said Property”).`,
    ...titleRecital(ctx),
    html`That the Said Property is free from all encumbrances, litigation, attachments and claims${terms.existingLoanBank ? ", save and except an outstanding loan of " + terms.existingLoanBank : ""}, and ${S} alone has the right to sell it.`,
    html`That ${S} has agreed to sell the Said Property to ${B} for a total consideration of ${money(ctx, total)}${ctx.data.payments.length ? html`, out of which ${money(ctx, paid)} has been received as earnest money as follows: ${ctx.data.payments.map((payment, index) => "(" + (index + 1) + ") " + paymentPhrase(ctx, payment)).join("; ")}. This agreement shall itself serve as the receipt` : ""}.`,
    html`That the balance of ${money(ctx, Math.max(total - paid, 0))} shall be paid by ${B} ${dueText(ctx)}, whereupon ${S} shall execute and register the sale deed in favour of ${B} or their nominee.${terms.forfeitOnBuyerDefault ? " If " + B + " fails to pay the balance within that time, " + S + " shall be entitled to forfeit the earnest money." : ""}`,
    html`That if ${S} fails or refuses to execute the sale deed after receiving the balance, ${B} shall be entitled ${remedy}.`,
    html`That ${S} shall be responsible for resolving any dispute about title before registration and shall indemnify ${B} against any claim by any other person.`,
    html`That stamp duty and registration expenses shall be borne by ${expenses === "shared" ? "both parties equally" : expenses === "first" ? S : B}. ${S[0].toUpperCase() + S.slice(1)} shall hand over all original documents and vacant possession at the time of registration.`,
    html`That all dues, taxes and charges on the Said Property up to the date of registration shall be paid by ${S}.`,
  ];
  if (terms.existingLoanBank) items.push(html`That ${S} shall close the loan of ${terms.existingLoanBank} and hand over the no-objection certificate with the original documents before registration, or the loan shall be closed directly from the loan sanctioned to ${B} by internal adjustment, to which both parties agree.`);
  if (terms.buyerLoanBank) items.push(html`That ${S} shall co-operate in the documentation for the loan being availed by ${B} from ${terms.buyerLoanBank}.`);
  items.push(html`That this agreement shall bind the parties and their legal heirs.`, ...additionalClauses(ctx));

  return [
    ...opening(ctx),
    { t: "para", html: html`This Agreement to Sell is made at ${ctx.place} on ${longDate(ctx, ctx.date)} between ${partyList(first, "english", { ...ctx.ids, ids: true })} (hereinafter “${S}”) of the ONE PART and ${partyList(second, "english", { ...ctx.ids, ids: true })} (hereinafter “${B}”) of the OTHER PART, on the following terms:` },
    { t: "clauses", style: "numbered", items },
    ...scheduleBlocks(ctx, { heading: "SCHEDULE OF PROPERTY", verb: "agreed to be sold" }),
    { t: "para", html: html`IN WITNESS WHEREOF the parties have signed this agreement of their own free will, after reading and understanding it, in the presence of the following witnesses. ${closingDate(ctx)}` },
    ...signatureBlocks(ctx),
  ];
}
