import type { DeedType } from "@/lib/deed-types";

/**
 * Optional clauses taken from real registered deeds and standard Indian precedents
 * (see docs/TEMPLATE_LIBRARY.md). The Terms tab offers them per deed type; picked
 * clauses are appended to "Additional clauses" and printed before the schedule.
 *
 * Only optional, matter-specific clauses live here. Boilerplate every deed needs
 * (further assurance, original documents, encumbrances, dues, indemnity …) is
 * added automatically by boilerplate.ts, and clauses the templates already
 * contain (rent due date, maintenance, free-will declaration in a Will) are not
 * offered again, so nothing can be added twice.
 */

export type LibraryClause = {
  id: string;
  title: string;
  hindi: string;
  english: string;
  /** Languages it is offered in, when the other language's template already has it. */
  languages?: ("hindi" | "english")[];
};

const saleLike: LibraryClause[] = [
  {
    id: "utilities",
    title: "Electricity, water & gas connections",
    hindi: "यह कि उक्त सम्पत्ति के विद्युत, जल एवं गैस कनेक्शन द्वितीय पक्ष अपने नाम स्थानान्तरित करवा सकेगा, जिस हेतु आवश्यक सहमति-पत्र एवं अनापत्ति प्रथम पक्ष देगा।",
    english: "That the second party may transfer the electricity, water and gas connections of the said property to its name, and the first party shall give every consent and no-objection required for it.",
  },
  {
    id: "quiet-enjoyment",
    title: "Quiet enjoyment",
    hindi: "यह कि द्वितीय पक्ष उक्त सम्पत्ति का शान्तिपूर्वक उपभोग करेगा तथा प्रथम पक्ष अथवा उसके वारिसान या उसके माध्यम से हक़ जताने वाला कोई भी व्यक्ति उसमें किसी प्रकार की बाधा नहीं डालेगा।",
    english: "That the second party shall quietly enjoy the said property without any interruption by the first party, its heirs or any person claiming through it.",
  },
];

const agreement: LibraryClause[] = [
  {
    id: "title-scrutiny",
    title: "Title scrutiny & refund",
    hindi: "यह कि द्वितीय पक्ष अपने अधिवक्ता से उक्त सम्पत्ति के स्वामित्व की जाँच करवायेगा; यदि स्वामित्व में कोई दोष पाया जाता है और प्रथम पक्ष उसे 30 दिवस में दूर नहीं करता है तो प्रथम पक्ष प्राप्त समस्त राशि बिना कटौती तत्काल लौटा देगा।",
    english: "That the second party shall have the title of the said property verified by its advocate; if a defect is found and not cured by the first party within 30 days, the first party shall forthwith refund all amounts received without deduction.",
  },
  {
    id: "time-essence",
    title: "Time is of the essence",
    hindi: "यह कि इस इकरारनामे में वर्णित अवधि इसका मूल तत्व है।",
    english: "That time shall be the essence of this agreement.",
  },
  {
    id: "permissions",
    title: "Permissions & NOC by seller",
    hindi: "यह कि विक्रय पत्र के पंजीयन से पूर्व आवश्यक समस्त अनापत्ति प्रमाण-पत्र, अनुमति एवं ऋण मुक्ति पत्र प्रथम पक्ष अपने व्यय पर प्राप्त करेगा।",
    english: "That the first party shall, at its own cost, obtain all no-objection certificates, permissions and loan closure letters required before registration of the sale deed.",
  },
  {
    id: "no-further-deal",
    title: "No further dealing",
    hindi: "यह कि इस इकरारनामे की अवधि में प्रथम पक्ष उक्त सम्पत्ति को न तो किसी अन्य को विक्रय करेगा, न गिरवी रखेगा और न ही किसी अन्य प्रकार से भारग्रस्त करेगा।",
    english: "That during the term of this agreement the first party shall not sell, mortgage or otherwise encumber the said property in favour of anyone else.",
  },
  {
    id: "broker",
    title: "Brokerage",
    hindi: "यह कि इस सौदे की दलाली, यदि कोई हो, दोनों पक्ष अपने-अपने हिस्से की स्वयं वहन करेंगे।",
    english: "That brokerage for this transaction, if any, shall be borne by each party for its own share.",
  },
];

const tenancy: LibraryClause[] = [
  {
    id: "arrears-reentry",
    languages: ["hindi"],
    title: "Re-entry on 3 months' arrears",
    hindi: "यह कि यदि किरायेदार लगातार तीन माह का किराया अदा नहीं करता है तो सम्पत्ति स्वामी बिना किसी सूचना के परिसर का कब्ज़ा वापस लेने का अधिकारी होगा।",
    english: "That if the rent remains unpaid for three consecutive months, the owner shall be entitled to re-enter and take back possession of the premises.",
  },
  {
    id: "fixtures",
    title: "AC / cooler installation",
    hindi: "यह कि किरायेदार अपने व्यय पर ए.सी., कूलर एवं अन्य उपकरण लगा सकेगा तथा परिसर खाली करते समय उन्हें परिसर को बिना क्षति पहुँचाये ले जा सकेगा।",
    english: "That the tenant may install air-conditioners, coolers and other fixtures at its cost and remove them on vacating without damaging the premises.",
  },
  {
    id: "painting",
    title: "Painting on vacating",
    hindi: "यह कि परिसर खाली करते समय किरायेदार परिसर की रंगाई-पुताई करवा कर उसे उसी अवस्था में सुपुर्द करेगा जिसमें प्राप्त किया था, सामान्य टूट-फूट को छोड़कर।",
    english: "That on vacating, the tenant shall get the premises painted and hand them back in the condition received, subject to normal wear and tear.",
  },
  {
    id: "inventory",
    title: "Furniture & fittings inventory",
    hindi: "यह कि परिसर में उपलब्ध फर्नीचर एवं फिटिंग्स की सूची इस विलेख के साथ संलग्न है, जिन्हें किरायेदार सुरक्षित रखेगा एवं खाली करते समय वापस सौंपेगा।",
    english: "That the furniture and fittings listed in the annexure are provided with the premises; the tenant shall keep them safe and return them on vacating.",
  },
  {
    id: "police-verification",
    title: "Police verification",
    hindi: "यह कि किरायेदार अपना एवं अपने साथ रहने वाले व्यक्तियों का पुलिस सत्यापन करवाने में सहयोग करेगा।",
    english: "That the tenant shall cooperate in police verification of itself and all persons residing with it.",
  },
];

const release: LibraryClause[] = [
  {
    id: "minor-guardian",
    title: "Releasor as guardian of minors",
    hindi: "यह कि प्रथम पक्ष अपने अवयस्क पुत्र/पुत्री की ओर से उनके प्राकृतिक संरक्षक के रूप में उनके हित में यह विलेख निष्पादित कर रहा है।",
    english: "That the first party executes this deed also as natural guardian of its minor children, in their interest.",
  },
  {
    id: "heirs-declaration",
    title: "No other legal heirs",
    hindi: "यह कि मृतक के उपरोक्त पक्षकारान के अतिरिक्त अन्य कोई वैधानिक वारिस नहीं है; यदि भविष्य में कोई अन्य वारिस सामने आता है तो उसकी समस्त ज़िम्मेदारी प्रथम पक्ष की होगी।",
    english: "That the deceased left no legal heirs other than the parties hereto; if any other heir comes forward, the first party shall be responsible for it.",
  },
];

const partition: LibraryClause[] = [
  {
    id: "hotchpot",
    title: "Joint family hotchpot",
    hindi: "यह कि उक्त समस्त सम्पत्तियाँ संयुक्त हिन्दू परिवार की हैं जिन्हें आपसी सहमति से एक साथ सम्मिलित कर पक्षकारान के मध्य बराबर मूल्य के भागों में विभाजित किया गया है।",
    english: "That all the said properties belong to the joint Hindu family and have been brought into hotchpot and divided among the parties in shares of equal value by mutual consent.",
  },
];

const will: LibraryClause[] = [
  {
    id: "movables",
    title: "Movable assets",
    hindi: "यह कि मेरी मृत्यु के पश्चात मेरे बैंक खाते, सावधि जमा, आभूषण एवं अन्य चल सम्पत्ति भी उपरोक्त वसीयतग्राही को प्राप्त होगी।",
    english: "That after my death my bank accounts, fixed deposits, jewellery and other movable assets shall also pass to the said beneficiary.",
  },
];

const gift: LibraryClause[] = [
  {
    id: "irrevocable",
    languages: ["hindi"],
    title: "Gift is irrevocable",
    hindi: "यह कि यह दान अप्रतिसंहरणीय है तथा दानकर्त्ता अथवा उसके वारिसान इसे भविष्य में किसी भी दशा में निरस्त नहीं कर सकेंगे।",
    english: "That this gift is irrevocable and shall not be revoked by the donor or its heirs under any circumstance.",
  },
];

const byType: Record<DeedType, LibraryClause[]> = {
  sale: saleLike,
  agreement_to_sell: agreement,
  gift: [...gift, ...saleLike.filter((clause) => clause.id !== "quiet-enjoyment")],
  release,
  partition,
  will,
  lease: tenancy,
  rent: tenancy,
  other: saleLike,
};

export function clauseLibrary(type: DeedType): LibraryClause[] {
  return byType[type] ?? [];
}
