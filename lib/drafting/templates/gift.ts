import { html, type Block } from "../blocks";
import { additionalClauses, agree, closingDate, longDate, opening, scheduleBlocks, signatureBlocks, titleRecital, type Ctx } from "../common";
import { partyList, propertiesRef, propertyEn, propertyHi } from "../format";

export function giftDeed(ctx: Ctx): Block[] {
  return ctx.hi ? hindi(ctx) : english(ctx);
}

function hindi(ctx: Ctx): Block[] {
  const { first, second } = ctx.parties;
  const D = "प्रथमपक्ष-" + ctx.term("first");
  const R = "द्वितीयपक्ष-" + ctx.term("second");
  const property = propertiesRef(ctx.data.properties, "hindi");
  const single = ctx.data.properties.length === 1;
  const relationship = ctx.data.terms.relationship;

  const clauses = [
    ...(relationship ? [html`यह कि ${D} एवं ${R} आपस में ${relationship} का रिश्ता रखते हैं।`] : []),
    html`यह कि ${D} के हक व अधिकार में ${single ? "निम्नवर्णित " + propertyHi(ctx.data.properties[0]) : "निम्न अनुसूची में वर्णित सम्पत्तियाँ स्थित हैं"}, जिसका समस्त विवरण नीचे अंकित किया है।`,
    ...titleRecital(ctx),
    html`वर्तमान में ${property} पर ${D} ही मालिक व काबिज ${agree(first, "चला आ रहा है", "चली आ रही है", "चले आ रहे हैं")} एवं ${property} पर एकाकी स्वामित्व एवं मालिकाना हक व अधिकार ${D} को प्राप्त है। ${property} पर किसी अन्य का कोई हक व साझा नहीं है तथा आज से पूर्व कहीं पर भी अन्यत्र रहन, विक्रय, बख्शीश, वसीयत व हस्तान्तरित किया हुआ नहीं है, वर्तमान में कोई वाद विचाराधीन नहीं है और न ही किसी सरकारी, गैर-सरकारी, वित्तीय संस्था, बैंक, कम्पनी, फर्म, व्यक्ति आदि की राशि बकाया या देय है, यानि कि ${property} सभी प्रकार के भार-अधिभारों, देनदारियों व दायित्वों से मुक्त, पाक-साफ व सुरक्षित है।`,
    html`यह कि वर्तमान समय में ${D} ${property} को ${R} के पक्ष में बख्शीश करना ${agree(first, "चाहता है", "चाहती है", "चाहते हैं")}, अतः ${D} द्वारा ${property} को मय समस्त हक व अधिकारों सहित बदस्त ${R} ‘‘${partyList(second, "hindi", ctx.ids)}’’ के पक्ष में कतई तौर पर दान (बख्शीश) कर दिया है, जिसे ${R} ने बख्शीश के आधार पर प्राप्त करना स्वीकार कर लिया है और दान की गई सम्पत्ति का खाली व मालिकाना कब्जा व दखल मौके पर ${D} ने अपने कब्जे में से निकालकर ${R} को सौंप दिया है। आज दिवस से ही ${R} ${property} के मालिक व स्वामी हो गये हैं तथा ${D} व उनके वारिसान का दान की गई सम्पत्ति से किसी प्रकार का सम्बन्ध व सरोकार नहीं रहा है और न ही आयन्दा होगा।`,
    html`यह कि अब ${property} पर ${R} बहैसियत एकाकी मालिक व स्वामी के नाते अपना मालिकाना हक व अधिकार एवं कब्जा कायम रखते हुए जिस प्रकार से भी चाहें अपने इस्तेमाल में लावें, परिवर्तन, नव निर्माण, विकास, एडीशन, आल्ट्रेशन आदि करावें अथवा अन्य किसी व्यक्ति व संस्था के हक व हित में रहन, विक्रय, दान, वसीयत आदि करें, इसमें ${D} व उनके वारिसानों को कोई आपत्ति नहीं होगी।`,
    html`यह कि ${D} ने ${property} ${R} को बख्शीश की है और इस बाबत् कोई प्रतिफल राशि प्राप्त नहीं की गई है और ना ही कोई शर्तें निर्धारित की गई हैं।`,
    html`यह कि अब ${property} का इन्द्राज समस्त सरकारी व अर्द्ध सरकारी विभागों, तहसील, राजस्व विभाग, विकास प्राधिकरण, नगर निगम, जलदाय विभाग, विद्युत विभाग आदि में इस दान पत्र के आधार पर ${R} अपने नाम पर करवा लेवें और आज दिवस से ही सम्बन्धित टैक्स व अन्य कर आदि अदा करें, आज से पहले का जो भी ऋण, भार एवं टैक्स आदि बकाया होगा तो उसे अदा करने की समस्त जिम्मेदारी ${D} व उनके वारिसानों की होगी।`,
    html`यह कि दान की गई सम्पत्ति से सम्बन्धित जो कुछ भी मूल दस्तावेज आदि ${D} के पास हैं उनकी प्रतियाँ ${R} को सौंप दी गई हैं।`,
    html`यह कि दान की गई सम्पत्ति मय उसकी थाला भूमि के बाबत् भविष्य में अन्य कोई भी दूसरा व्यक्ति हकदार, हिस्सेदार, दावेदार व उज्रदार आदि उत्पन्न होकर हक अपना किसी भी प्रकार का प्रमाणित करेगा तो वह इस दानपत्र (बख्शीशनामा) के समक्ष बिल्कुल झूठा माना व समझा जायेगा।`,
    ...additionalClauses(ctx),
  ];

  return [
    ...opening(ctx),
    { t: "para", html: html`यह दान-पत्र विलेख आज दिनांक ${longDate(ctx, ctx.date)} को ${partyList(first, "hindi", ctx.ids)} - ${agree(first, "जिसे", "जिसे", "जिन्हें")} इस दान-पत्र में ${D} के नाम से सम्बोधित किया गया है एवम् ${partyList(second, "hindi", ctx.ids)} - ${agree(second, "जिसे", "जिसे", "जिन्हें")} इस दान-पत्र में आगे ${R} के नाम से सम्बोधित किया गया है, के मध्य ${ctx.place} नगर में निम्न प्रकार से निष्पादित किया गया है।` },
    { t: "clauses", items: clauses },
    ...scheduleBlocks(ctx, { heading: "दान की गई सम्पत्ति का विवरण", verb: "दान कर दिया है" }),
    { t: "para", html: html`लिहाजा यह उपहार विलेख ${D} ने अपनी राजी-खुशी, अकल-होशियारी से बिना किसी नशे-पत्ते, बिना किसी डर-दबाव के, सोच-समझ कर तन्दुरूस्ती की हालत में पढ़-सुन-समझ कर सही होना स्वीकार करते हुये रूबरू गवाहान् के तकमील कर दिया है, जो सही व सनद रहे व वक्त जरूरत काम आवें। ${closingDate(ctx)}` },
    ...signatureBlocks(ctx, ["first", "second"], { witnessLabel: "हस्ताक्षर पहचानकर्त्ता — गवाह " }),
  ];
}

function english(ctx: Ctx): Block[] {
  const { first, second } = ctx.parties;
  const D = ctx.ref("first");
  const R = ctx.ref("second");
  const single = ctx.data.properties.length === 1;
  const relationship = ctx.data.terms.relationship;
  const clauses = [
    ...(relationship ? [html`WHEREAS ${D} and ${R} are related to each other as ${relationship}.`] : []),
    html`AND WHEREAS ${D} is the absolute owner in possession of ${single ? propertyEn(ctx.data.properties[0]) : "the properties described in the Schedule"} (the “Said Property”).`,
    ...titleRecital(ctx),
    html`AND WHEREAS the Said Property is free from all encumbrances, charges, litigation and claims, and ${D}, out of natural love and affection for ${R}, wishes to gift it without any consideration.`,
    html`NOW THIS DEED OF GIFT WITNESSETH AS FOLLOWS:`,
    html`1. That ${D} hereby gifts, transfers and conveys the Said Property unto ${R} absolutely and forever, out of natural love and affection and without any monetary consideration or condition.`,
    html`2. That ${R} hereby accepts this gift, and vacant physical possession of the Said Property has been delivered to ${R}.`,
    html`3. That ${R} shall hold the Said Property as absolute owner with full rights to use, construct, alter, mortgage, sell, gift or bequeath it, and neither ${D} nor their heirs shall have any claim over it.`,
    html`4. That ${R} shall get the Said Property mutated in all revenue, municipal, development-authority, electricity and water records. Dues up to today shall be borne by ${D}.`,
    html`5. That this gift is irrevocable.`,
    ...additionalClauses(ctx),
  ];
  return [
    ...opening(ctx),
    { t: "para", html: html`This Deed of Gift is made at ${ctx.place} on ${longDate(ctx, ctx.date)} by ${partyList(first, "english", { ...ctx.ids, ids: true })} (hereinafter “${D}”) in favour of ${partyList(second, "english", { ...ctx.ids, ids: true })} (hereinafter “${R}”).` },
    { t: "clauses", items: clauses },
    ...scheduleBlocks(ctx, { heading: "SCHEDULE OF PROPERTY", verb: "hereby gifted" }),
    { t: "para", html: html`IN WITNESS WHEREOF ${D} has signed this deed of their own free will, and ${R} has signed in token of acceptance, in the presence of the following witnesses. ${closingDate(ctx)}` },
    ...signatureBlocks(ctx),
  ];
}
