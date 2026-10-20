import type { DeedType, PartyRole } from "@/lib/deed-types";

import { html, type Block, type SafeHtml } from "./blocks";
import { agree, money, paymentPhrase, type Ctx } from "./common";
import { displayName, propertiesRef } from "./format";

/**
 * Boilerplate clauses every deed needs (severability, entire agreement, binding
 * effect, indemnity, jurisdiction, statutory dues, original documents …).
 *
 * The templates already word many of these in the firm's own style, so a clause
 * is added only when the draft does not cover its topic yet. Detection runs on
 * the generated text, including the user's additional clauses, so a topic the
 * user already wrote is never repeated. The same detectors power the final
 * check that flags one topic written twice.
 */

export type TopicId =
  | "competency"
  | "encumbrances"
  | "possession"
  | "attornment"
  | "consideration"
  | "dues"
  | "originals"
  | "indemnity"
  | "further_assurance"
  | "costs"
  | "notice"
  | "force_majeure"
  | "dispute"
  | "jurisdiction"
  | "waiver"
  | "entire_agreement"
  | "binding"
  | "severability";

type Topic = {
  id: TopicId;
  label: string;
  /** Text that shows the draft already deals with this topic. */
  covers: RegExp;
  /** A topic that should appear in exactly one clause (checked before export). */
  once?: boolean;
  applies: (ctx: Ctx) => boolean;
  text: (ctx: Ctx, p: Parties) => string;
};

type Parties = {
  /** The executant: seller, donor, releasor, lessor / owner. */
  X: string;
  /** The recipient: buyer, donee, releasee, lessee / tenant. */
  Y: string;
  executant: PartyRole;
  recipient: PartyRole;
  deed: string;
  property: string;
  family: boolean;
};

const types = (...list: DeedType[]) => (ctx: Ctx) => list.includes(ctx.input.type);
const conveyance: DeedType[] = ["sale", "gift", "release"];
const tenancy: DeedType[] = ["lease", "rent"];

const deedNames: Record<DeedType, [string, string]> = {
  sale: ["विक्रय पत्र", "Sale Deed"],
  agreement_to_sell: ["इकरारनामा", "Agreement"],
  gift: ["दान पत्र", "Gift Deed"],
  release: ["हक त्याग पत्र", "Release Deed"],
  partition: ["विभाजन पत्र", "Partition Deed"],
  will: ["वसीयतनामा", "Will"],
  lease: ["पट्टा विलेख", "Lease Deed"],
  rent: ["किरायानामा", "Rent Agreement"],
  other: ["विलेख", "Deed"],
};

/** Party references in the same form the template uses, so added clauses read as one document. */
function partiesFor(ctx: Ctx): Parties {
  const type = ctx.input.type;
  const executant: PartyRole = type === "rent" ? "second" : "first";
  const recipient: PartyRole = type === "rent" ? "first" : "second";
  const name = (role: PartyRole) => {
    if (!ctx.hi) return ctx.ref(role);
    if (type === "other") return ctx.term(role);
    if (type === "agreement_to_sell" || tenancy.includes(type)) return (role === "first" ? "प्रथम पक्षकार/" : "द्वितीय पक्षकार/") + ctx.term(role);
    if (type === "gift") return (role === "first" ? "प्रथमपक्ष-" : "द्वितीयपक्ष-") + ctx.term(role);
    return ctx.ref(role);
  };
  const family = type === "partition";
  return {
    X: family ? (ctx.hi ? "प्रत्येक पक्षकार" : "each party") : name(executant),
    Y: family ? (ctx.hi ? "अन्य पक्षकारों" : "the other parties") : name(recipient),
    executant,
    recipient,
    deed: deedNames[type][ctx.hi ? 0 : 1],
    property: tenancy.includes(type) ? (ctx.hi ? "किरायेशुदा परिसर" : "the premises") : propertiesRef(ctx.data.properties, ctx.lang),
    family,
  };
}

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Hindi verb agreeing with the executant ("X") or recipient ("Y"): करेगा / करेगी / करेंगे. */
function verb(ctx: Ctx, p: Parties, who: "X" | "Y", male: string, female: string, plural: string) {
  if (p.family) return male;
  return agree(ctx.parties[who === "X" ? p.executant : p.recipient], male, female, plural);
}

export const topics: Topic[] = [
  /* -- Title & possession */
  {
    id: "competency",
    label: "Legal competency and absolute authority",
    covers: /दिवालिया|insolven/i,
    applies: (ctx) => ctx.input.type !== "will",
    text: (ctx, p) => {
      const people = p.family ? [...ctx.parties.first, ...ctx.parties.second] : ctx.parties[p.executant];
      if (ctx.hi) {
        const act = p.family ? "संयुक्त सम्पत्तियों का विभाजन" : tenancy.includes(ctx.input.type) ? p.property + " को किराये पर देने" : ctx.input.type === "agreement_to_sell" ? p.property + " का विक्रय करने" : p.property + " के अन्तरण";
        const who = p.family ? "सभी पक्षकार" : p.X;
        return `यह कि ${who} ${agree(people, "घोषणा करता है", "घोषणा करती है", "घोषणा करते हैं")} कि ${p.family ? "वे" : agree(people, "वह", "वह", "वे")} बालिग, स्वस्थचित्त एवं संविदा करने हेतु विधिक रूप से सक्षम ${agree(people, "है", "है", "हैं")}, किसी सक्षम न्यायालय द्वारा दिवालिया घोषित नहीं ${agree(people, "किया गया है", "की गई है", "किये गये हैं")} तथा ${act} हेतु किसी अन्य व्यक्ति, सहस्वामी अथवा वारिस की सहमति की आवश्यकता नहीं है।`;
      }
      const act = p.family ? "partition the joint properties" : tenancy.includes(ctx.input.type) ? "let out " + p.property : ctx.input.type === "agreement_to_sell" ? "agree to sell " + p.property : "transfer " + p.property;
      const who = p.family ? "All the parties" : cap(p.X);
      return `That ${who} ${agree(people, "declares", "declares", "declare")} that ${p.family ? "they are" : agree(people, "he is", "she is", "they are")} of legal age and sound mind, competent to contract and not adjudged insolvent, and that no consent of any other person, co-owner or legal heir is required to ${act}.`;
    },
  },
  {
    id: "encumbrances",
    label: "Covenant against encumbrances",
    // "भार" as a word only: अधिभार (surcharge) and भारी (heavy) are not encumbrances.
    covers: /(?<![\u0900-\u097F])भार(?:ों)?(?![\u0900-\u097F])|रहन|कुर्की|encumbranc|mortgag|\blien/i,
    applies: (ctx) => ctx.input.type !== "will",
    text: (ctx, p) => {
      const quiet = tenancy.includes(ctx.input.type);
      return ctx.hi
        ? `यह कि ${p.property} किसी भी प्रकार के भार, रहन, ऋण, ग्रहणाधिकार (लियन), कुर्की, निषेधाज्ञा, पूर्व विक्रय अथवा इकरार तथा अपंजीकृत पारिवारिक व्यवस्था से पूर्णतः मुक्त है एवं इसके सम्बन्ध में किसी न्यायालय अथवा प्राधिकारी के समक्ष कोई कार्यवाही विचाराधीन नहीं है${quiet ? `, तथा किरायेदारी अवधि में ${p.Y} परिसर का शांतिपूर्ण उपभोग बिना किसी बाधा के ${verb(ctx, p, "Y", "करेगा", "करेगी", "करेंगे")}` : ""}।`
        : `That ${p.property} ${ctx.data.properties.length > 1 && !quiet ? "are" : "is"} free from all encumbrances, prior sales or agreements, mortgages, charges, liens, attachments, injunctions and unregistered family arrangements, and no proceeding concerning ${ctx.data.properties.length > 1 && !quiet ? "them" : "it"} is pending before any court or authority${quiet ? `, and ${p.Y} shall enjoy quiet possession during the term without any interruption` : ""}.`;
    },
  },
  {
    id: "possession",
    label: "Delivery of possession",
    covers: /कब्जा[^।]{0,180}(?:सौंप|सौंपा|सुपुर्द|सम्भला|संभला)\s?(?:दिया|दिये|दी|कर दिया|जायेगा)|(?:पृथक|एकाकी)[^।]{0,30}काबिज|कब्जा[^।]{0,60}सम्मिलित|sole possession|possession[^.]{0,80}(?:has been|have been|is hereby|shall be) (?:handed|delivered)|(?:handed|delivered) over (?:vacant|physical|peaceful)|exclusive owner/i,
    applies: types(...conveyance, "partition", ...tenancy),
    text: (ctx, p) => {
      if (tenancy.includes(ctx.input.type)) {
        return ctx.hi
          ? `यह कि किरायेदारी प्रारम्भ होने की तिथि को परिसर का खाली एवं शांतिपूर्ण कब्जा ${p.X} द्वारा ${p.Y} को सौंपा जायेगा, जिसकी लिखित पावती ${p.Y} द्वारा दी जायेगी।`
          : `That vacant and peaceful possession of the premises shall be delivered by ${p.X} to ${p.Y} on the commencement date, against a written acknowledgement.`;
      }
      if (p.family) {
        return ctx.hi
          ? "यह कि प्रत्येक पक्षकार को उसके हिस्से में आवंटित सम्पत्ति का भौतिक, खाली एवं शांतिपूर्ण कब्जा आज दिवस सौंप दिया गया है।"
          : "That physical, vacant and peaceful possession of each allotted portion has been delivered to the party to whom it is allotted.";
      }
      if (ctx.input.type === "release") {
        // A releasee usually already holds the property jointly: the releasor's possession merges into theirs.
        return ctx.hi
          ? `यह कि ${p.property} पर ${p.X} के हिस्से का कब्जा आज दिवस से ${p.Y} के कब्जे में सम्मिलित हो गया है तथा ${p.Y} उस पर एकमात्र रूप से काबिज है।`
          : `That possession of the share of ${p.X} in ${p.property} has merged with that of ${p.Y} from today, and ${p.Y} is in sole possession of it.`;
      }
      const symbolic = ctx.data.terms.possession === "symbolic";
      if (ctx.hi) return symbolic ? `यह कि ${p.property} का सांकेतिक (प्रतीकात्मक) कब्जा आज दिवस ${p.X} ने ${p.Y} को सौंप दिया है।` : `यह कि ${p.property} का भौतिक, खाली एवं शांतिपूर्ण कब्जा आज दिवस ${p.X} ने ${p.Y} को सौंप दिया है।`;
      return symbolic ? `That symbolic possession of ${p.property} has been delivered by ${p.X} to ${p.Y} today.` : `That physical, vacant and peaceful possession of ${p.property} has been delivered by ${p.X} to ${p.Y} today.`;
    },
  },
  {
    id: "attornment",
    label: "Existing tenant attorns to the new owner",
    covers: /किरायेदार[^।]{0,80}(?:अब से|आज दिवस से)[^।]{0,40}(?:किरायेदार|अधिभोगी)|attorn/i,
    applies: (ctx) => conveyance.includes(ctx.input.type) && ctx.data.terms.possession === "symbolic",
    text: (ctx, p) =>
      ctx.hi
        ? `यह कि ${p.property} वर्तमान में किरायेदार/अधिभोगी के कब्जे में है; आज दिवस से उक्त किरायेदार/अधिभोगी ${p.Y} का किरायेदार/अधिभोगी माना जायेगा तथा किराया प्राप्त करने एवं किरायेदारी से सम्बन्धित समस्त अधिकार ${p.Y} को होंगे, जिसकी सूचना ${p.X} द्वारा किरायेदार को लिखित में दी जायेगी।`
        : `That ${p.property} is presently in the occupation of a tenant/occupant, who shall from today attorn to ${p.Y}; all rights to receive rent and enforce the tenancy shall vest in ${p.Y}, and ${p.X} shall inform the tenant of this in writing.`,
  },

  /* -- Financial & transfer mechanics */
  {
    id: "consideration",
    label: "Consideration and acknowledgment of receipt",
    covers: /प्राप्त कर ली|स्नेह|बिना किसी प्रतिफल|receipt|received|love and affection|without (?:any )?consideration/i,
    applies: (ctx) => ctx.input.type === "gift" || ((ctx.input.type === "other" || ctx.input.type === "release") && Boolean(ctx.data.consideration.total)),
    text: (ctx, p) => {
      if (ctx.input.type === "gift") {
        return ctx.hi
          ? `यह कि यह दान ${p.X} द्वारा ${p.Y} के प्रति नैसर्गिक प्रेम एवं स्नेह के वशीभूत होकर बिना किसी प्रतिफल के किया गया है।`
          : `That this gift is made by ${p.X} out of natural love and affection for ${p.Y}, without any monetary consideration.`;
      }
      const total = ctx.data.consideration.total;
      const modes = ctx.data.payments.map((payment) => paymentPhrase(ctx, payment)).join(ctx.hi ? " एवं " : "; ");
      return ctx.hi
        ? `यह कि सम्पूर्ण प्रतिफल राशि ${money(ctx, total)} ${modes ? modes + " के रूप में " : ""}${p.X} ने ${p.Y} से प्राप्त कर ली है तथा यह विलेख ही उसकी रसीद है, अलग से रसीद की आवश्यकता नहीं है।`
        : `That ${p.X} has received the entire consideration of ${money(ctx, total)}${modes ? " (" + modes + ")" : ""} from ${p.Y}, and this deed shall itself serve as the receipt.`;
    },
  },
  {
    id: "dues",
    label: "Apportionment of statutory dues",
    covers: /बकाया[^।]{0,160}(?:जिम्मेदारी|अदा|अदायगी|चुका)|(?:कर|टैक्स)[^।]{0,80}(?:अदा|वहन)|dues|taxes/i,
    applies: (ctx) => ctx.input.type !== "will",
    text: (ctx, p) => {
      const ats = ctx.input.type === "agreement_to_sell";
      if (p.family) {
        return ctx.hi
          ? "यह कि आज दिनांक तक संयुक्त सम्पत्तियों पर देय समस्त कर, उपकर एवं बिल पक्षकारान द्वारा अपने-अपने हिस्से के अनुपात में वहन किये जायेंगे तथा आज दिवस के पश्चात प्रत्येक पक्षकार अपने हिस्से में आवंटित सम्पत्ति के समस्त देय स्वयं वहन करेगा।"
          : "That all taxes, cesses and bills on the joint properties up to today shall be borne by the parties in proportion to their shares, and from today each party shall bear all dues of the portion allotted to them.";
      }
      return ctx.hi
        ? `यह कि ${p.property} से सम्बन्धित समस्त सम्पत्ति कर, नगरीय विकास कर, नगर निकाय के उपकर, विद्युत, जल एवं अन्य सभी बकाया ${ats ? "विक्रय पत्र के पंजीयन की तिथि" : "आज दिनांक"} तक ${p.X} द्वारा चुकाये जायेंगे तथा उसके पश्चात के समस्त देय ${p.Y} ${verb(ctx, p, "Y", "वहन करेगा", "वहन करेगी", "वहन करेंगे")}।`
        : `That all property tax, urban development tax, municipal cess, electricity, water and other dues on ${p.property} up to ${ats ? "the date of registration of the sale deed" : "the date of this deed"} shall be paid by ${p.X}, and all dues thereafter shall be borne by ${p.Y}.`;
    },
  },
  {
    id: "originals",
    label: "Handover of original title documents",
    covers: /मूल (?:कागजात|दस्तावेज|दस्तावेजात|विलेख|प्रति)|असल दस्तावेज|original[\w\s]{0,30}?(?:documents|deeds)|original of this deed/i,
    applies: types(...conveyance, "agreement_to_sell", "partition"),
    text: (ctx, p) => {
      if (p.family) {
        const keeper = ctx.parties.first[0] ?? ctx.parties.second[0];
        const name = keeper ? displayName(keeper, ctx.lang) : ctx.hi ? "प्रथम पक्षकार" : "the first party";
        return ctx.hi
          ? `यह कि संयुक्त सम्पत्तियों के मूल दस्तावेज एवं इस विभाजन पत्र की मूल प्रति ${name} के पास रहेगी, अन्य पक्षकारों को प्रमाणित प्रतियाँ दी जायेंगी तथा आवश्यकता होने पर मूल दस्तावेज प्रस्तुत किये जायेंगे।`
          : `That the original title documents and the original of this deed shall remain with ${name}, the other parties shall receive certified copies, and the originals shall be produced whenever required.`;
      }
      return ctx.hi
        ? `यह कि ${p.property} से सम्बन्धित समस्त मूल पूर्व विलेख, लिंक दस्तावेज एवं स्वीकृत नक्शे ${p.X} ने ${p.Y} को सौंप दिये हैं; यदि कोई मूल दस्तावेज गुम पाया जाता है तो उसके कारण होने वाली किसी भी हानि की भरपाई ${p.X} द्वारा की जायेगी।`
        : `That all original antecedent title deeds, link documents and approved site plans of ${p.property} have been handed over by ${p.X} to ${p.Y}; if any original is found missing, ${p.X} shall make good any loss arising from it.`;
    },
  },

  /* -- Risk allocation & disputes */
  {
    id: "indemnity",
    label: "Indemnity",
    covers: /क्षतिपूर्ति|हानि नहीं होने दी|हर्जे\s?(?:व\s|-)?\s?खर्चे|indemnif/i,
    applies: (ctx) => ctx.input.type !== "will",
    text: (ctx, p) => {
      if (tenancy.includes(ctx.input.type)) {
        return ctx.hi
          ? `यह कि ${p.X} के स्वामित्व में किसी दोष के कारण ${p.Y} को होने वाली हानि की क्षतिपूर्ति ${p.X} ${verb(ctx, p, "X", "करेगा", "करेगी", "करेंगे")}, तथा ${p.Y} द्वारा इस ${p.deed} की शर्तों के उल्लंघन से ${p.X} को होने वाली हानि की क्षतिपूर्ति ${p.Y} ${verb(ctx, p, "Y", "करेगा", "करेगी", "करेंगे")}।`
          : `That ${p.X} shall indemnify ${p.Y} against any loss arising from a defect in title, and ${p.Y} shall indemnify ${p.X} against any loss arising from a breach of this ${p.deed}.`;
      }
      if (p.family) {
        return ctx.hi
          ? "यह कि प्रत्येक पक्षकार अपने द्वारा दिये गये किसी गलत कथन अथवा अपने कारण उत्पन्न किसी भार या दावे से अन्य पक्षकारों को होने वाली समस्त हानि, विधिक व्यय एवं हर्जे-खर्चे की क्षतिपूर्ति करेगा।"
          : "That each party shall indemnify the other parties against all loss, legal costs and damages arising from any misrepresentation by them or any encumbrance or claim created by them.";
      }
      return ctx.hi
        ? `यह कि ${p.X} के स्वामित्व में किसी दोष, अप्रकट भार, विचाराधीन वाद अथवा ${p.X} द्वारा दिये गये किसी गलत कथन के कारण ${p.Y} को होने वाली समस्त हानि, क्षति, विधिक व्यय एवं हर्जे-खर्चे की पूर्ण क्षतिपूर्ति ${p.X} एवं उनके वारिसान द्वारा की जायेगी।`
        : `That ${p.X} and their heirs shall indemnify ${p.Y} against all loss, damage, legal costs and expenses arising from any defect in title, undisclosed encumbrance, pending litigation or misrepresentation about ${p.property}.`;
    },
  },
  {
    id: "further_assurance",
    label: "Further assurances",
    covers: /अतिरिक्त (?:दस्तावेज|दस्तावेज़|विलेख)|further assurance|further documents|additional documents/i,
    applies: types(...conveyance, "agreement_to_sell", "partition", "other"),
    text: (ctx, p) => {
      const ats = ctx.input.type === "agreement_to_sell";
      return ctx.hi
        ? `यह कि ${ats ? "इस इकरारनामे की पूर्ति एवं विक्रय पत्र के पंजीयन" : `इस ${p.deed} को पूर्ण प्रभावी बनाने, स्वामित्व पूर्णतः निहित करने अथवा उप पंजीयक कार्यालय या नामान्तरण के समय उठाई गई किसी तकनीकी त्रुटि को दूर करने`} हेतु आवश्यक कोई भी अतिरिक्त दस्तावेज, शपथ पत्र अथवा सहमति पत्र ${p.X} बिना किसी अतिरिक्त प्रतिफल के निष्पादित एवं हस्ताक्षरित ${verb(ctx, p, "X", "करेगा", "करेगी", "करेंगे")}।`
        : `That ${p.X} shall, without further consideration, execute and sign any additional documents, affidavits or consents and do all acts necessary ${ats ? "to complete this agreement and register the sale deed" : "to give full effect to this " + p.deed + ", to vest the title completely and to cure any technical defect raised by the Sub-Registrar or during mutation"}.`;
    },
  },
  {
    id: "dispute",
    label: "Dispute resolution and governing law",
    once: true,
    covers: /मध्यस्थ|सुलह|भारत (?:की|के) (?:विधि|कानून)|भारतीय (?:विधि|कानून)|arbitrat|mediat|governing law|governed by the laws/i,
    applies: (ctx) => ctx.input.type !== "will",
    text: (ctx, p) => {
      const place = ctx.data.terms.jurisdiction || ctx.place;
      const arbitration = ctx.data.terms.arbitration;
      return ctx.hi
        ? `यह कि यह ${p.deed} भारत की विधि के अधीन शासित होगा। इससे उत्पन्न किसी भी विवाद का समाधान पक्षकार प्रथमतः आपसी वार्ता एवं मध्यस्थता (Mediation) से करेंगे${arbitration ? `, तथा उसमें असफल रहने पर विवाद मध्यस्थता एवं सुलह अधिनियम, 1996 के अन्तर्गत ${place} में एकल मध्यस्थ को सौंपा जायेगा` : ""}।`
        : `That this ${p.deed} shall be governed by the laws of India. The parties shall first try to settle any dispute arising from it by negotiation and mediation${arbitration ? `, failing which the dispute shall be referred to a sole arbitrator under the Arbitration and Conciliation Act, 1996, seated at ${place}` : ""}.`;
    },
  },
  {
    id: "jurisdiction",
    label: "Jurisdiction",
    once: true,
    covers: /क्षेत्राधिकार|jurisdiction/i,
    applies: (ctx) => ctx.input.type !== "will",
    text: (ctx, p) => {
      const place = ctx.data.terms.jurisdiction || ctx.place;
      return ctx.hi
        ? `यह कि इस ${p.deed} से सम्बन्धित समस्त वादों एवं विधिक कार्यवाहियों पर केवल ${place} स्थित सक्षम न्यायालयों का ही अनन्य क्षेत्राधिकार होगा।`
        : `That the competent courts at ${place} alone shall have exclusive jurisdiction over all suits and proceedings relating to this ${p.deed}.`;
    },
  },

  /* -- Administrative */
  {
    id: "costs",
    label: "Stamp duty, registration and costs",
    covers: /स्टाम्प|मुद्रांक|पंजीयन[^।]{0,40}(?:खर्च|व्यय|शुल्क)|stamp duty|registration (?:charges|expenses|fees)/i,
    applies: (ctx) => ctx.input.type !== "will",
    text: (ctx, p) => {
      const by = ctx.data.execution.expensesBy;
      const payer = by === "shared" ? (ctx.hi ? "दोनों पक्षकारों द्वारा समान रूप से" : "both parties equally") : ctx.hi ? partyRef(ctx, by) + " द्वारा" : partyRef(ctx, by);
      return ctx.hi
        ? `यह कि इस ${p.deed} पर देय स्टाम्प शुल्क, पंजीयन शुल्क, ई-पंजीयन शुल्क एवं सम्बन्धित विधिक व्यय ${payer} वहन किये गये हैं।`
        : `That the stamp duty, registration fee, e-Panjiyan charges and related legal costs of this ${p.deed} have been borne by ${payer}.`;
    },
  },
  {
    id: "notice",
    label: "Notices and communication",
    once: true,
    covers: /नोटिस[^।]{0,80}(?:सेवा|तामील)|(?:रजिस्टर्ड|पंजीकृत) डाक|notices? (?:may|shall) be (?:served|sent|given)|deemed (?:validly |duly )?served/i,
    applies: types("agreement_to_sell", ...tenancy, "other"),
    text: (ctx, p) =>
      ctx.hi
        ? `यह कि इस ${p.deed} के अन्तर्गत कोई भी सूचना अथवा नोटिस पक्षकारों को इस विलेख में अंकित पतों पर रजिस्टर्ड डाक (पावती सहित) से अथवा पक्षकारों के ई-मेल पते पर भेजा जायेगा, जो डाक से भेजे जाने के 5 दिवस पश्चात अथवा ई-मेल भेजे जाने की तिथि को विधिवत तामील माना जायेगा। पता परिवर्तन की सूचना दूसरे पक्ष को लिखित में दी जायेगी।`
        : `That any notice under this ${p.deed} shall be sent to the parties at the addresses stated herein by registered post with acknowledgement due, or to their e-mail addresses, and shall be deemed duly served five days after posting or on the date of e-mail. A change of address shall be notified in writing.`,
  },
  {
    id: "force_majeure",
    label: "Force majeure",
    once: true,
    covers: /प्राकृतिक आपदा|अप्रत्याशित|दैवीय|force majeure|act of god|beyond (?:their |its )?(?:reasonable )?control/i,
    applies: types("agreement_to_sell", ...tenancy, "other"),
    text: (ctx, p) =>
      ctx.hi
        ? `यह कि प्राकृतिक आपदा, महामारी, युद्ध, सरकारी प्रतिबंध, न्यायालय के आदेश अथवा अन्य अप्रत्याशित एवं अपरिहार्य परिस्थिति (Force Majeure) के कारण किसी पक्षकार के दायित्व${ctx.input.type === "agreement_to_sell" ? " (जैसे शेष राशि का भुगतान, कब्जा सुपुर्दगी या पंजीयन)" : ""} उस परिस्थिति की अवधि तक निलम्बित रहेंगे तथा वह अवधि इस ${p.deed} में निर्धारित समय सीमा की गणना में सम्मिलित नहीं की जायेगी।`
        : `That the obligations of a party${ctx.input.type === "agreement_to_sell" ? " (such as payment of the balance, delivery of possession or registration)" : ""} shall remain suspended while performance is prevented by natural calamity, epidemic, war, government restriction, court order or any other unforeseeable event beyond their control (force majeure), and that period shall be excluded from the time limits in this ${p.deed}.`,
  },

  /* -- Core interpretive & structural (kept at the end, as in registered drafts) */
  {
    id: "waiver",
    label: "Waiver and amendments",
    once: true,
    covers: /परित्याग नहीं|अधित्यजन|waiver/i,
    applies: (ctx) => ctx.input.type !== "will",
    text: (ctx, p) =>
      ctx.hi
        ? `यह कि किसी पक्षकार द्वारा इस ${p.deed} की किसी शर्त के उल्लंघन पर तत्काल कार्यवाही न करना उस शर्त को भविष्य में लागू करने के अधिकार का परित्याग नहीं माना जायेगा, तथा इस ${p.deed} में कोई भी संशोधन केवल पक्षकारों द्वारा लिखित में निष्पादित एवं आवश्यक होने पर विधिवत पंजीकृत विलेख से ही किया जा सकेगा।`
        : `That failure or delay by a party to enforce any term of this ${p.deed} shall not be a waiver of the right to enforce it later, and this ${p.deed} may be amended only by a written instrument executed by the parties and registered where the law requires.`,
  },
  {
    id: "entire_agreement",
    label: "Entire agreement",
    once: true,
    covers: /सम्पूर्ण एवं अंतिम सहमति|सम्पूर्ण (?:सहमति|समझौता)|अधिक्रमित|entire agreement|supersedes/i,
    applies: (ctx) => ctx.input.type !== "will",
    text: (ctx, p) =>
      ctx.hi
        ? `यह कि यह ${p.deed} इसकी विषय-वस्तु के सम्बन्ध में पक्षकारों के मध्य सम्पूर्ण एवं अंतिम सहमति है तथा इससे पूर्व की समस्त मौखिक वार्ताएँ, पत्र-व्यवहार, ई-मेल एवं अनौपचारिक सहमतियाँ इसके द्वारा अधिक्रमित मानी जायेंगी।`
        : `That this ${p.deed} constitutes the entire agreement between the parties on its subject matter and supersedes all prior oral negotiations, correspondence, e-mails and informal understandings.`,
  },
  {
    id: "binding",
    label: "Binding effect on heirs and assigns",
    once: true,
    covers: /(?:वारिसान|वारिसों|उत्तराधिकारियों)[^।]{0,120}(?:बाध्यकारी|पाबंद)|binding (?:on|upon)|shall bind|binds the parties/i,
    applies: (ctx) => ctx.input.type !== "will",
    text: (ctx, p) =>
      ctx.hi
        ? `यह कि यह ${p.deed} पक्षकारों एवं उनके वारिसान, निष्पादकों, प्रशासकों, विधिक प्रतिनिधियों एवं समनुदेशितियों पर समान रूप से बाध्यकारी होगा।`
        : `That this ${p.deed} shall be binding upon the parties and their respective heirs, executors, administrators, legal representatives and assigns.`,
  },
  {
    id: "severability",
    label: "Severability",
    once: true,
    covers: /अप्रवर्तनीय|अवैध घोषित|severab|invalid provision|held (?:to be )?(?:invalid|void|illegal|unenforceable)/i,
    applies: () => true,
    text: (ctx, p) =>
      ctx.hi
        ? `यह कि यदि इस ${p.deed} का कोई प्रावधान किसी सक्षम न्यायालय अथवा प्राधिकारी द्वारा अवैध, शून्य अथवा अप्रवर्तनीय ठहराया जाता है तो इससे शेष प्रावधानों की वैधता प्रभावित नहीं होगी तथा वे पूर्णतः प्रभावी रहेंगे।`
        : `That if any provision of this ${p.deed} is held invalid, void or unenforceable by a competent court or authority, the remaining provisions shall continue in full force.`,
  },
];

function partyRef(ctx: Ctx, role: PartyRole) {
  const type = ctx.input.type;
  if (ctx.hi && (type === "agreement_to_sell" || tenancy.includes(type))) return (role === "first" ? "प्रथम पक्षकार/" : "द्वितीय पक्षकार/") + ctx.term(role);
  if (ctx.hi && type === "other") return ctx.term(role);
  return ctx.ref(role);
}

/* ----------------------------------------------------------------- Text helpers */

const unescape = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");

/** Every readable unit of a draft: each clause, list item, paragraph and heading. */
export function blockTexts(blocks: Block[]): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    if (block.t === "para") out.push(unescape(block.html.value));
    else if (block.t === "clauses" || block.t === "list") for (const item of block.items) out.push(unescape(item.value));
    else if (block.t === "heading" || block.t === "title" || block.t === "meta") out.push(block.text);
  }
  return out;
}

/** Topics the text already deals with. */
export function coveredTopics(texts: string[]): Set<TopicId> {
  const all = texts.join("\n");
  return new Set(topics.filter((topic) => topic.covers.test(all)).map((topic) => topic.id));
}

/** Boilerplate clauses this draft still needs, in drafting order. */
export function missingBoilerplate(ctx: Ctx, blocks: Block[]): { id: TopicId; text: string }[] {
  const covered = coveredTopics(blockTexts(blocks));
  const parties = partiesFor(ctx);
  return topics.filter((topic) => topic.applies(ctx) && !covered.has(topic.id)).map((topic) => ({ id: topic.id, text: topic.text(ctx, parties) }));
}

const NUMBERED = /^(\d+)\.\s/;

/**
 * Adds the missing boilerplate to the main clause list: before the user's own
 * additional clauses (which stay last), or at the end for a custom deed whose
 * clauses are all user-written. English drafts that number clauses by hand
 * ("1. That …") keep a continuous numbering.
 */
export function withBoilerplate(ctx: Ctx, blocks: Block[]): Block[] {
  const index = blocks.findIndex((block) => block.t === "clauses");
  if (index < 0) return blocks;
  const missing = missingBoilerplate(ctx, blocks);
  if (!missing.length) return blocks;

  const main = blocks[index] as Extract<Block, { t: "clauses" }>;
  const extras = ctx.input.type === "other" ? 0 : (ctx.data.terms.additionalClauses ?? "").split("\n").filter((line) => line.trim()).length;
  const at = Math.max(0, main.items.length - extras);
  const items: SafeHtml[] = [...main.items.slice(0, at), ...missing.map((clause) => html`${clause.text}`), ...main.items.slice(at)];

  const numbers = main.items.map((item) => NUMBERED.exec(unescape(item.value))?.[1]).filter(Boolean).map(Number);
  if (numbers.length >= 2) {
    // Continue "1. That … 6. That …" through the added and additional clauses.
    let last = 0;
    for (let i = 0; i < items.length; i += 1) {
      const text = unescape(items[i].value);
      const match = NUMBERED.exec(text);
      if (match) last = Number(match[1]);
      else if (last && /^That\b/.test(text)) items[i] = html`${++last + ". " + text}`;
    }
  }
  const out = [...blocks];
  out[index] = { ...main, items };
  return out;
}

/** Topics that appear in more than one clause (a topic that should be stated once). */
export function repeatedTopics(texts: string[]): { id: TopicId; label: string; count: number }[] {
  return topics
    .filter((topic) => topic.once)
    .map((topic) => ({ id: topic.id, label: topic.label, count: texts.filter((text) => topic.covers.test(text)).length }))
    .filter((topic) => topic.count > 1);
}
