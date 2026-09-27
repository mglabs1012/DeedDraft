import type { Party, Property } from "@/lib/schemas/deed-data";

import { html, type Block, type SafeHtml } from "../blocks";
import {
  additionalClauses,
  agree,
  closingDate,
  longDate,
  money,
  opening,
  paymentPhrase,
  scheduleBlocks,
  signatureBlocks,
  titleRecital,
  type Ctx,
} from "../common";
import { displayName, partyList, propertiesRef, propertyEn, propertyHi } from "../format";

const allParties = (ctx: Ctx) => [...ctx.parties.first, ...ctx.parties.second];

function allottee(ctx: Ctx, property: Property): Party | undefined {
  return ctx.data.parties.find((party) => party.id === property.allottedTo);
}

/* ----------------------------------------------------------------- Release */

export function releaseDeed(ctx: Ctx): Block[] {
  const { first, second } = ctx.parties;
  const R1 = ctx.ref("first");
  const R2 = ctx.ref("second");
  const property = propertiesRef(ctx.data.properties, ctx.lang);
  const single = ctx.data.properties.length === 1;
  const total = ctx.data.consideration.total;
  const terms = ctx.data.terms;

  if (ctx.hi) {
    const clauses: SafeHtml[] = [
      ...(terms.relationship ? [html`यह कि ${R1} एवं ${R2} आपस में ${terms.relationship} का रिश्ता रखते हैं।`] : []),
      html`यह कि ${single ? propertyHi(ctx.data.properties[0]) : "निम्न अनुसूची में वर्णित सम्पत्तियाँ"} पर ${R1} एवं ${R2} का संयुक्त हक, हिस्सा व अधिकार चला आ रहा है${terms.share ? ", जिसमें " + R1 + " का " + terms.share + " हिस्सा है" : ""}।`,
      ...titleRecital(ctx),
      html`यह कि ${R1} ${property} में अपने समस्त हक, हिस्सा, अधिकार व हित ${total ? "बिल एवज " + money(ctx, total) : "बिना किसी प्रतिफल के"} ${R2} ‘‘${partyList(second, "hindi", ctx.ids)}’’ के पक्ष में सदैव के लिये त्याग (रिलीज) ${agree(first, "करता है", "करती है", "करते हैं")} तथा आज दिवस से ${property} पर ${R1} व उनके वारिसान का कोई हक, हिस्सा, दावा या सरोकार नहीं रहा है और न ही आयन्दा होगा।`,
      ...(ctx.data.payments.length ? [html`यह कि उक्त प्रतिफल राशि में से ${ctx.data.payments.map((payment) => paymentPhrase(ctx, payment)).join(" एवं ")} ${R1} ने ${R2} से प्राप्त कर ली है, अलहदा रसीद की आवश्यकता नहीं है।`] : []),
      html`यह कि आज दिवस से ${R2} ही ${property} ${agree(second, "का एकमात्र मालिक व काबिज है", "की एकमात्र मालिक व काबिज है", "के एकमात्र मालिक व काबिज हैं")} तथा इस हक त्याग पत्र के आधार पर ${property} का नामान्तरण समस्त सरकारी, राजस्व, नगर निगम/विकास प्राधिकरण, विद्युत व जलदाय विभाग के अभिलेखों में अपने नाम करवा ${agree(second, "सकेगा", "सकेगी", "सकेंगे")}।`,
      html`यह कि ${property} आज से पूर्व किसी प्रकार के भार, ऋण, मुकदमे, कुर्की या डिक्री से ग्रस्त नहीं है तथा ${R1} व उनके वारिसान भविष्य में इस बाबत् कोई दावा प्रस्तुत नहीं करेंगे, यदि करेंगे तो वह इस हक त्याग पत्र के समक्ष शून्य व निरर्थक माना जायेगा।`,
      ...additionalClauses(ctx),
    ];
    return [
      ...opening(ctx),
      { t: "para", html: html`यह हक त्याग पत्र आज दिनांक ${longDate(ctx, ctx.date)} को ${ctx.place} में ${partyList(first, "hindi", ctx.ids)} - ${agree(first, "जिसे", "जिसे", "जिन्हें")} आगे ‘‘प्रथमपक्ष-${ctx.term("first")}’’ कहा जायेगा, द्वारा ${partyList(second, "hindi", ctx.ids)} - ${agree(second, "जिसे", "जिसे", "जिन्हें")} आगे ‘‘द्वितीयपक्ष-${ctx.term("second")}’’ कहा जायेगा, के पक्ष में निम्नलिखित शर्तों अनुसार निष्पादित किया गया है।` },
      { t: "clauses", items: clauses },
      ...scheduleBlocks(ctx, { heading: "सम्पत्ति का विवरण", verb: "हक त्याग किया गया है" }),
      { t: "para", html: html`अतः यह हक त्याग पत्र पक्षकारों ने अपनी राजी खुशी से, पूर्ण होशहवास में, बिना किसी दबाव के पढ़, सुन व समझकर निम्न गवाहों के समक्ष हस्ताक्षर कर दिया है जो सनद रहे व वक्त जरूरत काम आवे। ${closingDate(ctx)}` },
      ...signatureBlocks(ctx),
    ];
  }

  const clauses: SafeHtml[] = [
    html`WHEREAS ${R1} and ${R2} jointly hold ${single ? propertyEn(ctx.data.properties[0]) : "the properties described in the Schedule"}${terms.share ? ", in which " + R1 + " holds a " + terms.share + " share" : ""}.`,
    ...titleRecital(ctx),
    html`NOW THIS DEED OF RELEASE WITNESSETH that ${R1} hereby releases and relinquishes all their share, right, title and interest in ${property} in favour of ${R2}${total ? " for a consideration of " + money(ctx, total) : " without any consideration"}, and neither ${R1} nor their heirs shall have any claim over it hereafter.`,
    ...(ctx.data.payments.length ? [html`The consideration has been received as follows: ${ctx.data.payments.map((payment) => paymentPhrase(ctx, payment)).join("; ")}.`] : []),
    html`${R2[0].toUpperCase() + R2.slice(1)} shall henceforth be the sole owner of ${property} and may get it mutated in all records.`,
    ...additionalClauses(ctx),
  ];
  return [
    ...opening(ctx),
    { t: "para", html: html`This Deed of Release is made at ${ctx.place} on ${longDate(ctx, ctx.date)} by ${partyList(first, "english", { ...ctx.ids, ids: true })} (“${R1}”) in favour of ${partyList(second, "english", { ...ctx.ids, ids: true })} (“${R2}”).` },
    { t: "clauses", items: clauses },
    ...scheduleBlocks(ctx, { heading: "SCHEDULE OF PROPERTY", verb: "hereby released" }),
    { t: "para", html: html`IN WITNESS WHEREOF the parties have signed this deed in the presence of the following witnesses. ${closingDate(ctx)}` },
    ...signatureBlocks(ctx),
  ];
}

/* --------------------------------------------------------------- Partition */

export function partitionDeed(ctx: Ctx): Block[] {
  const parties = allParties(ctx);
  const terms = ctx.data.terms;
  const allotments = ctx.data.properties.map((property, index) => {
    const party = allottee(ctx, property);
    const short = ctx.hi ? propertyHi(property) : propertyEn(property);
    return ctx.hi
      ? html`सम्पत्ति क्रमांक ${index + 1} (${short}) — ${party ? displayName(party, "hindi") : ".................."} को आवंटित की जाती है।`
      : html`Item ${index + 1} (${short}) — allotted to ${party ? displayName(party, "english") : "________"}.`;
  });

  if (ctx.hi) {
    const clauses: SafeHtml[] = [
      ...(terms.background ? [html`यह कि ${terms.background}`] : []),
      html`यह कि पक्षकारान निम्न अनुसूची में वर्णित संयुक्त सम्पत्तियों के संयुक्त मालिक व काबिज चले आ रहे हैं।`,
      ...titleRecital(ctx),
      html`यह कि संयुक्त सम्पत्तियों के बेहतर उपयोग एवं प्रबन्धन हेतु पक्षकारान ने आपसी सहमति से उनका बँटवारा (विभाजन) मौके पर नाप व सीमाओं के अनुसार निम्न प्रकार कर लिया है:-`,
      ...allotments,
      html`यह कि प्रत्येक पक्षकार अपने हिस्से में आवंटित सम्पत्ति का आज दिवस से पृथक एवं एकाकी मालिक व काबिज होगा तथा अन्य पक्षकारों का उस पर कोई हक, हिस्सा या दावा नहीं रहेगा।`,
      html`यह कि प्रत्येक पक्षकार अपने हिस्से में आई सम्पत्ति का नामान्तरण राजस्व, नगर निगम/विकास प्राधिकरण, विद्युत एवं जलदाय विभाग के अभिलेखों में अपने नाम करवा सकेगा तथा आज से उस पर देय कर स्वयं अदा करेगा।`,
      html`यह कि यह विभाजन पत्र सभी पक्षकारों एवं उनके वारिसान पर बाध्यकारी होगा।`,
      ...additionalClauses(ctx),
    ];
    return [
      ...opening(ctx),
      { t: "para", html: html`यह विभाजन पत्र आज दिनांक ${longDate(ctx, ctx.date)} को ${ctx.place} में निम्न पक्षकारान ${partyList(parties, "hindi", ctx.ids)} के मध्य निम्नलिखित शर्तों अनुसार निष्पादित किया गया है।` },
      { t: "clauses", items: clauses },
      ...scheduleBlocks(ctx, { heading: "संयुक्त सम्पत्तियों का विवरण", verb: "का विभाजन किया गया है" }),
      { t: "para", html: html`अतः यह विभाजन पत्र सभी पक्षकारों ने अपनी राजी खुशी से पढ़, सुन व समझकर निम्न गवाहों के समक्ष हस्ताक्षर कर दिया है। ${closingDate(ctx)}` },
      ...signatureBlocks(ctx),
    ];
  }

  const clauses: SafeHtml[] = [
    ...(terms.background ? [html`WHEREAS ${terms.background}`] : []),
    html`WHEREAS the parties are joint owners in joint possession of the properties described in the Schedule.`,
    ...titleRecital(ctx),
    html`NOW THIS DEED OF PARTITION WITNESSETH that the parties have, by mutual consent, partitioned the joint properties by metes and bounds as follows:`,
    ...allotments,
    html`Each party shall hold the portion allotted to them as absolute and exclusive owner, may get it mutated in their own name, and shall pay its taxes from today. This deed binds the parties and their heirs.`,
    ...additionalClauses(ctx),
  ];
  return [
    ...opening(ctx),
    { t: "para", html: html`This Deed of Partition is made at ${ctx.place} on ${longDate(ctx, ctx.date)} between ${partyList(parties, "english", { ...ctx.ids, ids: true })}.` },
    { t: "clauses", items: clauses },
    ...scheduleBlocks(ctx, { heading: "SCHEDULE OF JOINT PROPERTIES", verb: "partitioned as above" }),
    { t: "para", html: html`IN WITNESS WHEREOF the parties have signed this deed in the presence of the following witnesses. ${closingDate(ctx)}` },
    ...signatureBlocks(ctx),
  ];
}

/* -------------------------------------------------------------------- Will */

export function willDeed(ctx: Ctx): Block[] {
  const testator = ctx.parties.first;
  const beneficiaries = ctx.parties.second;
  const executors = ctx.parties.other;
  const bequests = ctx.data.properties.map((property, index) => {
    const party = allottee(ctx, property);
    const short = ctx.hi ? propertyHi(property) : propertyEn(property);
    if (ctx.hi) return html`सम्पत्ति क्रमांक ${index + 1} (${short}) मेरे देहान्त के उपरान्त ${party ? displayName(party, "hindi") : "समस्त वसीयतग्राहीगण को समान रूप से"} को प्राप्त होगी।`;
    return html`Item ${index + 1} (${short}) shall, after my death, vest in ${party ? displayName(party, "english") : "all the beneficiaries in equal shares"} absolutely.`;
  });

  if (ctx.hi) {
    const clauses: SafeHtml[] = [
      html`यह कि मैं निम्न अनुसूची में वर्णित सम्पत्तियों का एकमात्र मालिक व काबिज हूँ, जिन्हें मैंने अपनी स्वअर्जित आय से/विधिवत रूप से प्राप्त किया है।`,
      ...titleRecital(ctx),
      html`यह कि मैं अपनी पूर्ण होश-हवास एवं स्वस्थ मस्तिष्क की अवस्था में, बिना किसी दबाव, प्रलोभन या बहकावे के, अपनी स्वेच्छा से यह वसीयतनामा लिख रहा/रही हूँ तथा इससे पूर्व की गई मेरी समस्त वसीयतें एवं कोडिसिल निरस्त करता/करती हूँ।`,
      html`यह कि मेरे देहान्त के उपरान्त मेरी सम्पत्तियाँ निम्न प्रकार से मेरे वसीयतग्राहीगण को प्राप्त होंगी:-`,
      ...bequests,
      ...(executors.length ? [html`यह कि मैं ${partyList(executors, "hindi", ctx.ids)} को इस वसीयतनामे का निष्पादक नियुक्त करता/करती हूँ, जो मेरी इच्छानुसार इस वसीयत का पालन करायेंगे।`] : []),
      html`यह कि मेरे जीवनकाल में उक्त सम्पत्तियों पर मेरा पूर्ण स्वामित्व रहेगा तथा मैं अपने जीवनकाल में इस वसीयत को परिवर्तित अथवा निरस्त करने का अधिकार रखता/रखती हूँ।`,
      html`यह कि मैंने इस वसीयतनामे पर निम्न गवाहों के समक्ष हस्ताक्षर किये हैं, जिन्होंने मेरी उपस्थिति में एवं एक दूसरे की उपस्थिति में इस पर अपने हस्ताक्षर किये हैं।`,
      ...additionalClauses(ctx),
    ];
    return [
      ...opening(ctx),
      { t: "para", html: html`मैं, ${partyList(testator, "hindi", { ...ctx.ids, ids: true })}, आज दिनांक ${longDate(ctx, ctx.date)} को ${ctx.place} में यह वसीयतनामा निम्न प्रकार से लिखता/लिखती हूँ:-` },
      { t: "para", html: html`वसीयतग्राहीगण: ${partyList(beneficiaries, "hindi", ctx.ids)}` },
      { t: "clauses", items: clauses },
      ...scheduleBlocks(ctx, { heading: "सम्पत्तियों का विवरण", verb: "वसीयत की जाती है" }),
      { t: "para", html: html`अतः यह वसीयतनामा मैंने अपनी पूर्ण होश-हवास में पढ़, सुन व समझकर निम्न गवाहों के समक्ष हस्ताक्षर कर दिया है। ${closingDate(ctx)}` },
      ...signatureBlocks(ctx, ["first"]),
    ];
  }

  const clauses: SafeHtml[] = [
    html`I am the absolute owner of the properties described in the Schedule.`,
    ...titleRecital(ctx),
    html`I make this Will of my own free will, in sound mind and disposing memory, without any coercion or undue influence, and I hereby revoke all my earlier Wills and codicils.`,
    html`After my death, my properties shall devolve as follows:`,
    ...bequests,
    ...(executors.length ? [html`I appoint ${partyList(executors, "english", ctx.ids)} as executor of this Will.`] : []),
    html`During my lifetime I shall remain the absolute owner of the said properties and may alter or revoke this Will.`,
    html`I have signed this Will in the presence of the witnesses below, who have signed in my presence and in the presence of each other.`,
    ...additionalClauses(ctx),
  ];
  return [
    ...opening(ctx),
    { t: "para", html: html`I, ${partyList(testator, "english", { ...ctx.ids, ids: true })}, make this Will at ${ctx.place} on ${longDate(ctx, ctx.date)}.` },
    { t: "para", html: html`Beneficiaries: ${partyList(beneficiaries, "english", ctx.ids)}` },
    { t: "clauses", items: clauses },
    ...scheduleBlocks(ctx, { heading: "SCHEDULE OF PROPERTIES", verb: "bequeathed as above" }),
    { t: "para", html: html`Signed by the Testator in our presence. ${closingDate(ctx)}` },
    ...signatureBlocks(ctx, ["first"]),
  ];
}

/* ------------------------------------------------------------------- Other */

export function genericDeed(ctx: Ctx): Block[] {
  const { first, second } = ctx.parties;
  const total = ctx.data.consideration.total;
  const property = propertiesRef(ctx.data.properties, ctx.lang);
  const extra = additionalClauses(ctx);
  const clauses: SafeHtml[] = ctx.hi
    ? [
        html`यह कि ${ctx.data.properties.length === 1 ? propertyHi(ctx.data.properties[0]) : "निम्न अनुसूची में वर्णित सम्पत्तियाँ"} के सम्बन्ध में पक्षकारान निम्न शर्तें अभिलिखित करते हैं।`,
        ...titleRecital(ctx),
        ...(total ? [html`यह कि इस विलेख की प्रतिफल राशि ${money(ctx, total)} है।`] : []),
        ...(extra.length ? extra : [html`यह कि ..........................................................................................`]),
      ]
    : [
        html`WHEREAS the parties record the following terms relating to ${property}.`,
        ...titleRecital(ctx),
        ...(total ? [html`The consideration for this deed is ${money(ctx, total)}.`] : []),
        ...(extra.length ? extra : [html`1. ____________________________________________`]),
      ];
  return [
    ...opening(ctx),
    { t: "para", html: ctx.hi ? html`यह विलेख आज दिनांक ${longDate(ctx, ctx.date)} को ${ctx.place} में ${partyList(first, "hindi", ctx.ids)} (प्रथम पक्षकार) एवं ${partyList(second, "hindi", ctx.ids)} (द्वितीय पक्षकार) के मध्य निष्पादित किया गया है।` : html`This deed is made at ${ctx.place} on ${longDate(ctx, ctx.date)} between ${partyList(first, "english", { ...ctx.ids, ids: true })} (First Party) and ${partyList(second, "english", { ...ctx.ids, ids: true })} (Second Party).` },
    { t: "clauses", items: clauses },
    ...scheduleBlocks(ctx, { heading: ctx.hi ? "सम्पत्ति का विवरण" : "SCHEDULE OF PROPERTY", verb: ctx.hi ? "सम्बन्धित है" : "concerned" }),
    { t: "para", html: html`${closingDate(ctx)}` },
    ...signatureBlocks(ctx),
  ];
}
