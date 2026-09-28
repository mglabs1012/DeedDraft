import { html, type Block } from "../blocks";
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
import { partyList, propertiesRef, propertyEn, propertyHi } from "../format";

const para = (text: string) => ({ t: "para", html: html`${text}` }) as Block;

export function saleDeed(ctx: Ctx): Block[] {
  return ctx.hi ? hindi(ctx) : english(ctx);
}

function hindi(ctx: Ctx): Block[] {
  const { first, second } = ctx.parties;
  const S = ctx.ref("first");
  const B = ctx.ref("second");
  const total = ctx.data.consideration.total;
  const property = propertiesRef(ctx.data.properties, "hindi");
  const single = ctx.data.properties.length === 1;
  const who = (list: typeof first) => agree(list, "जिसे", "जिसे", "जिन्हें");

  const clauses = [
    html`यह कि ${S} के हक हकूक, कब्जे, दखल व स्वामित्व व आधिपत्य व अधिकार में ${single ? "निम्नवर्णित " + propertyHi(ctx.data.properties[0]) : "निम्न अनुसूची में वर्णित सम्पत्तियाँ स्थित हैं"}, जिसका सम्पूर्ण विवरण नीचे वर्णित है।`,
    ...titleRecital(ctx),
    html`वर्तमान में ${property} पर ${S} ही एक मात्र मालिक व काबिज ${agree(first, "चला आ रहा है", "चली आ रही है", "चले आ रहे हैं")} तथा आज से पहले ${property} को ${S} की ओर से कहीं अन्यत्र रहन, विक्रय, दान, वसीयत आदि की हुई नहीं है तथा ${property} पर किसी भी प्रकार का बकाया नहीं है तथा किसी मुकदमा, कुर्की, डिक्री, नीलाम में सम्मिलित नहीं है, सारांश कि ${property} ${S} की ओर से समस्त प्रकार के भारों से मुक्त है।`,
    html`यह कि वर्तमान समय में ${property} की सही कीमत ${S} को प्राप्त हो रही है, अतः ${S} द्वारा ${property} को मय नींव, सींव, मय डिपाजिट राशि व मय तमामी हक व अधिकारों सहित व मय हक आवागमन व हकूक मुताल्लिका मालिकाना इसके बिल एवज मुबलिग ${money(ctx, total)} में बहक व बदस्त ${B} ‘‘${partyList(second, "hindi", ctx.ids)}’’ को विक्रय कर दिया है व बेच दिया है तथा कब्जा व दखल ${property} का मौके पर अपने आधिपत्य में से निकालकर ${B} को मौके पर सम्भला दिया है, जिस सम्पत्ति का आज से ${B} मालिक व काबिज है व ${agree(second, "रहेगा", "रहेगी", "रहेंगे")} तथा इसे अपने किसी भी प्रयोजनार्थ काम में लेने के लिये स्वतंत्र है व ${agree(second, "रहेगा", "रहेगी", "रहेंगे")}।`,
    ctx.data.payments.length
      ? html`यह कि कुल कीमत विक्रय पत्र ${money(ctx, total)} में से ${ctx.data.payments.map((payment) => paymentPhrase(ctx, payment)).join(" एवं ")}, इस प्रकार सम्पूर्ण प्रतिफल राशि ${S} ने ${B} से निम्न गवाहों एवं श्रीमान् उप पंजीयक महोदय के समक्ष प्राप्त कर ली है। अलहदा रसीद लिखने की कोई आवश्यकता नहीं है तथा शेष कुछ भी ${S} को लेना बाकी नहीं रहा है, यदि ${S} ने या उनके किसी भी वारिसान ने ${property} बाबत किसी प्रकार की कोई राशि की माँग की तो वह शून्य समझी जायेगी।`
      : html`यह कि उक्त सम्पूर्ण प्रतिफल राशि ${money(ctx, total)} ${S} ने ${B} से निम्न गवाहों एवं श्रीमान् उप पंजीयक महोदय के समक्ष प्राप्त कर ली है। अलहदा रसीद लिखने की कोई आवश्यकता नहीं है तथा शेष कुछ भी ${S} को लेना बाकी नहीं रहा है।`,
    html`यह कि ${property} का खाली कब्जा व दखल मौके पर ${S} ने अपने कब्जे में से निकालकर ${B} को सौंप दिया है और जो कुछ भी हक व अधिकार मालिकाना आज दिवस तक ${S} व उनके वारिसान को प्राप्त थे व हैं, वे समस्त हक व अधिकार मालिकाना आज दिवस से ही ${B} व उनके वारिसान को प्राप्त हो गये हैं, तथा ${S} व उनके वारिसान का विक्रय की गई सम्पत्ति मय थाला भूमि सहित से किसी भी प्रकार का सम्बन्ध व सरोकार नहीं रहा है और न कभी आयन्दा ही होगा।`,
    html`यह कि ${B} बहैसियत मालिक व स्वामी के नाते अपना मालिकाना हक व अधिकार एवं कब्जा कायम रखते हुए जिस प्रकार से भी चाहें अपने इस्तेमाल में लावें और जो चाहें सो करें, चाहे जिस प्रकार का निर्माण, विकास, एडिशन, आल्ट्रेशन करावें, स्वयं निवास करें या किसी अन्य व्यक्ति को किराये पर देवें अथवा बहैसियत मालिक के अन्य किसी भी व्यक्ति व संस्था के हक व हित में रहन, विक्रय, दान, वसीयत आदि करें, इसमें ${S} व वारिसान को कोई आपत्ति नहीं होगी।`,
    html`यह कि अब ${property} का इन्द्राज समस्त सरकारी व अर्द्ध सरकारी विभागों, तहसील/राजस्व रिकार्ड, नगर निगम/विकास प्राधिकरण, विद्युत व जलदाय विभाग आदि में इस विक्रय पत्र के आधार पर ${B} स्वयं के खर्चे पर अपने नाम पर करवा लेवें और आज दिवस से ही ${property} से सम्बन्धित कर आदि अदा करें, आज से पहले का जो कुछ भी ऋण, भार एवं टैक्स आदि किसी भी प्रकार का बकाया होगा तो उसे अदा करने की समस्त जिम्मेदारी ${S} व वारिसान की होगी व रहेगी तथा उक्त सम्पत्ति बाबत् किसी भी प्रकार का कोई वाद विवाद हुआ तो उसकी समस्त जिम्मेदारी ${S} की होगी।`,
    html`यह कि ${property} या उसका कोई सा भी भाग आज से पहले ${S} और उनके वारिसान की ओर से कहीं पर भी रहन, विक्रय, दान, वसीयत आदि किया हुआ नहीं है, और न ही इस पर किसी भी सरकारी संस्था, बैंक, सहकारी समिति, कम्पनी, फर्म आदि का कोई भी ऋण व भार ही किसी भी प्रकार का बकाया है, और न ही किसी मुकदमा, इब्तदाय, कुर्की, डिक्री, नीलाम आदि में ही सम्मिलित है, कि जिसे हर प्रकार से अन्तरण आदि करने के हक व अधिकार मालिकाना ${S} को ही प्राप्त हैं।`,
    html`यह कि विक्रय की गई सम्पत्ति के बाबत भविष्य में अन्य कोई भी दूसरा व्यक्ति हकदार, हिस्सेदार व उज्रदार आदि उत्पन्न होकर हक अपना किसी भी प्रकार का प्रमाणित करेगा अथवा किसी भी वाद विवाद के कारण से उक्त सम्पत्ति का कोई भी भाग अथवा सम्पूर्ण भाग ${B} के मालिकाना हक अधिकार एवं कब्जा व दखल में से निकल जावेगा तो उसकी कुल जिम्मेदारी व जवाबदारी मय हर्जे व खर्चे व मय लगाई गई लागत, तरक्की, विकास, तरमीम व मय वापसी कीमत इस विक्रय पत्र की, ${S} व वारिसानों की होगी व रहेगी, ${B} व उनके वारिसानों को कुछ भी हानि नहीं होने दी जावेगी।`,
    html`यह कि विक्रय की गई सम्पत्ति से सम्बन्धित जो भी मूल कागजात, पूर्व पंजीकृत विलेख, साईट प्लान आदि ${S} के पास हैं वो समस्त ही मूल कागजात मय खाली कब्जा सम्पत्ति सहित ${B} को मौके पर सौंप दिये हैं, जिन्हें ${B} समय अनुसार अपने काम में लेने के लिये स्वतंत्र है व ${agree(second, "रहेगा", "रहेगी", "रहेंगे")}।`,
    ...additionalClauses(ctx),
  ];

  return [
    ...opening(ctx),
    { t: "para", html: html`यह विक्रयपत्र आज दिनांक ${longDate(ctx, ctx.date)} को ${ctx.place} नगर में सर्व ${partyList(first, "hindi", ctx.ids)} - ${who(first)} आगे ‘‘प्रथमपक्ष-${ctx.term("first")}’’ के नाम से सम्बोधित किया जायेगा एवम् ${partyList(second, "hindi", ctx.ids)} - ${who(second)} आगे ‘‘द्वितीयपक्ष-${ctx.term("second")}’’ के नाम से सम्बोधित किया जायेगा, के मध्य निम्नलिखित शर्तों अनुसार निष्पादित किया गया है।` },
    { t: "clauses", items: clauses },
    ...scheduleBlocks(ctx, { heading: "विक्रित सम्पत्ति का विवरण", verb: "विक्रय कर दिया है", expenses: true }),
    para(`अतः यह विक्रयपत्र दोनों पक्षकारों ने अपनी राजी खुशी से व अपने पूर्ण होशहवास से बिना किसी नशे पते के व बिना किसी जोर दबाव व बहकावट के स्थिर चित होकर समझकर, सुनकर, पढ़कर अपने हस्ताक्षर निम्न गवाहों के समक्ष कर दिये हैं जो सही है, सनद रहे व वक्त जरूरत काम आवे। ${closingDate(ctx)}`),
    ...signatureBlocks(ctx),
  ];
}

function english(ctx: Ctx): Block[] {
  const { first, second } = ctx.parties;
  const S = ctx.ref("first");
  const B = ctx.ref("second");
  const total = ctx.data.consideration.total;
  const property = propertiesRef(ctx.data.properties, "english");
  const single = ctx.data.properties.length === 1;
  const cap = (value: string) => value[0].toUpperCase() + value.slice(1);

  const clauses = [
    html`WHEREAS ${S} is the absolute owner in peaceful possession of ${single ? propertyEn(ctx.data.properties[0]) : "the properties described in the Schedule below"} (the “Said Property”).`,
    ...titleRecital(ctx),
    html`AND WHEREAS the Said Property is free from all encumbrances, charges, mortgages, liens, attachments, court decrees and disputes, and has not been sold, gifted, mortgaged or bequeathed by ${S} to anyone else.`,
    html`AND WHEREAS ${S} has agreed to sell and ${B} has agreed to purchase the Said Property for a total consideration of ${money(ctx, total)}.`,
    html`NOW THIS DEED OF SALE WITNESSETH AS FOLLOWS:`,
    ctx.data.payments.length
      ? html`1. That out of the total consideration of ${money(ctx, total)}, ${ctx.data.payments.map((payment) => paymentPhrase(ctx, payment)).join("; ")} has been received by ${S} from ${B} in the presence of the witnesses and the Sub-Registrar, and nothing remains payable. This deed shall itself serve as the receipt.`
      : html`1. That ${S} has received the entire consideration of ${money(ctx, total)} from ${B}, and nothing remains payable. This deed shall itself serve as the receipt.`,
    html`2. That ${S} hereby sells, conveys and transfers the Said Property, together with the land beneath, all fixtures, easements, rights of way, light and air, unto ${B} absolutely and forever.`,
    html`3. That vacant and peaceful physical possession of the Said Property has been handed over to ${B}, who shall hold and enjoy it as absolute owner and may use, construct, alter, let, mortgage, sell, gift or otherwise deal with it without any objection from ${S} or their heirs.`,
    html`4. That ${B} shall get the Said Property mutated in revenue, municipal, development-authority, electricity and water records at their own cost. All taxes and dues up to the date of this deed shall be borne by ${S}.`,
    html`5. That if any person establishes any right, title or claim to the Said Property, or ${B} is deprived of any part of it owing to a defect in the title of ${S}, ${S} and their heirs shall indemnify ${B} for the entire loss, including the consideration, costs of improvement and expenses.`,
    html`6. That ${S} has handed over all original title documents, prior registered instruments and site plans relating to the Said Property to ${B}.`,
    ...additionalClauses(ctx),
  ];

  return [
    ...opening(ctx),
    { t: "para", html: html`This Deed of Sale is made and executed at ${ctx.place} on ${longDate(ctx, ctx.date)}` },
    { t: "para", center: true, html: html`<strong>BY</strong>` },
    { t: "para", html: html`${partyList(first, "english", { ...ctx.ids, ids: true })} (hereinafter called ${cap(S)}, which expression shall include their heirs, legal representatives and assigns) of the FIRST PART;` },
    { t: "para", center: true, html: html`<strong>IN FAVOUR OF</strong>` },
    { t: "para", html: html`${partyList(second, "english", { ...ctx.ids, ids: true })} (hereinafter called ${cap(B)}, which expression shall include their heirs, legal representatives and assigns) of the SECOND PART.` },
    { t: "clauses", items: clauses },
    ...scheduleBlocks(ctx, { heading: "SCHEDULE OF PROPERTY", verb: "hereby sold", expenses: true }),
    para(`IN WITNESS WHEREOF the parties have signed this deed of their own free will, in sound mind and without any coercion or undue influence, after reading and understanding its contents, in the presence of the following witnesses. ${closingDate(ctx)}`),
    ...signatureBlocks(ctx),
  ];
}
