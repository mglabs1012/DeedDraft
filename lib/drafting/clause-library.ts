import type { DeedType } from "@/lib/deed-types";

/**
 * Optional clauses taken from real registered deeds and standard Indian precedents
 * (see docs/TEMPLATE_LIBRARY.md). The Terms tab offers them per deed type; picked
 * clauses are appended to "Additional clauses" and printed before the schedule.
 */

export type LibraryClause = { id: string; title: string; hindi: string; english: string };

const common: LibraryClause[] = [
  {
    id: "further-assurance",
    title: "Further assurance",
    hindi: "यह कि भविष्य में यदि इस विलेख की पूर्ति हेतु किसी अन्य दस्तावेज़ के निष्पादन, हस्ताक्षर अथवा किसी विभाग में उपस्थिति की आवश्यकता होगी तो प्रथम पक्ष बिना किसी अतिरिक्त प्रतिफल के उसे निष्पादित करेगा।",
    english: "That the first party shall, without further consideration, execute such further documents, sign such papers and appear before such authorities as may be required to give full effect to this deed.",
  },
  {
    id: "originals",
    title: "Original title papers handed over",
    hindi: "यह कि उक्त सम्पत्ति से सम्बन्धित समस्त मूल दस्तावेज़ात द्वितीय पक्ष को सुपुर्द कर दिये गये हैं, एवं यदि कोई दस्तावेज़ बाद में प्राप्त होता है तो वह भी द्वितीय पक्ष को सौंप दिया जायेगा।",
    english: "That all original title documents relating to the said property have been handed over to the second party, and any document found later shall also be handed over to the second party.",
  },
  {
    id: "no-litigation",
    title: "No litigation or attachment",
    hindi: "यह कि उक्त सम्पत्ति के सम्बन्ध में किसी भी न्यायालय में कोई वाद विचाराधीन नहीं है, न ही यह किसी कुर्की, अधिग्रहण, अवाप्ति अथवा सरकारी बकाया से प्रभावित है।",
    english: "That no suit or proceeding is pending in any court in respect of the said property, and it is not subject to any attachment, acquisition, requisition or Government dues.",
  },
];

const saleLike: LibraryClause[] = [
  {
    id: "utilities",
    title: "Electricity, water & gas transfer",
    hindi: "यह कि उक्त सम्पत्ति के विद्युत, जल एवं गैस कनेक्शन द्वितीय पक्ष अपने नाम स्थानान्तरित करवा सकेगा, इस हेतु प्रथम पक्ष आवश्यक सहमति-पत्र देगा तथा आज दिनांक तक के समस्त बिल प्रथम पक्ष द्वारा चुका दिये गये हैं।",
    english: "That the second party may transfer the electricity, water and gas connections of the said property to its name; the first party shall give all consents required and has paid all bills up to date.",
  },
  {
    id: "taxes-till-date",
    title: "Taxes & dues till date",
    hindi: "यह कि उक्त सम्पत्ति से सम्बन्धित नगरीय विकास कर, लीज़ राशि एवं अन्य सभी देय राशियाँ आज दिनांक तक प्रथम पक्ष द्वारा अदा की जा चुकी हैं; इसके पश्चात के समस्त कर द्वितीय पक्ष देगा।",
    english: "That all urban development tax, lease money and other dues relating to the said property have been paid by the first party up to this date; all later dues shall be borne by the second party.",
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
    id: "rent-by-7th",
    title: "Rent in advance by the 7th",
    hindi: "यह कि किराया प्रत्येक माह की 7 तारीख तक अग्रिम रूप से अदा किया जायेगा।",
    english: "That the rent shall be paid in advance on or before the 7th day of every month.",
  },
  {
    id: "arrears-reentry",
    title: "Re-entry on 3 months' arrears",
    hindi: "यह कि यदि किरायेदार लगातार तीन माह का किराया अदा नहीं करता है तो सम्पत्ति स्वामी बिना किसी सूचना के परिसर का कब्ज़ा वापस लेने का अधिकारी होगा।",
    english: "That if the rent remains unpaid for three consecutive months, the owner shall be entitled to re-enter and take back possession of the premises.",
  },
  {
    id: "repairs",
    title: "Minor & major repairs",
    hindi: "यह कि परिसर की छोटी-मोटी मरम्मत (नल, बिजली फिटिंग, काँच आदि) किरायेदार अपने व्यय पर करेगा तथा ढाँचागत मरम्मत सम्पत्ति स्वामी करेगा।",
    english: "That minor repairs (taps, electrical fittings, glass and the like) shall be done by the tenant at its cost, and structural repairs by the owner.",
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
  {
    id: "custody",
    title: "Custody of original deed",
    hindi: "यह कि इस विभाजन पत्र की मूल प्रति प्रथम पक्ष के पास एवं प्रमाणित प्रतियाँ अन्य पक्षकारान के पास रहेंगी, जिसे आवश्यकता पड़ने पर प्रस्तुत किया जायेगा।",
    english: "That the original of this deed shall remain with the first party and certified copies with the other parties; the original shall be produced whenever required.",
  },
];

const will: LibraryClause[] = [
  {
    id: "movables",
    title: "Movable assets",
    hindi: "यह कि मेरी मृत्यु के पश्चात मेरे बैंक खाते, सावधि जमा, आभूषण एवं अन्य चल सम्पत्ति भी उपरोक्त वसीयतग्राही को प्राप्त होगी।",
    english: "That after my death my bank accounts, fixed deposits, jewellery and other movable assets shall also pass to the said beneficiary.",
  },
  {
    id: "no-coercion",
    title: "Free will, no coercion",
    hindi: "यह कि यह वसीयत मैंने बिना किसी दबाव, लालच अथवा बहकावे के, पूर्ण होश-हवास में अपनी स्वेच्छा से लिखवाई है एवं पढ़कर व समझकर हस्ताक्षर किये हैं।",
    english: "That I make this will of my own free will, without coercion, inducement or undue influence, in sound mind, and sign it after reading and understanding it.",
  },
];

const gift: LibraryClause[] = [
  {
    id: "irrevocable",
    title: "Gift is irrevocable",
    hindi: "यह कि यह दान अप्रतिसंहरणीय है तथा दानकर्त्ता अथवा उसके वारिसान इसे भविष्य में किसी भी दशा में निरस्त नहीं कर सकेंगे।",
    english: "That this gift is irrevocable and shall not be revoked by the donor or its heirs under any circumstance.",
  },
];

const byType: Record<DeedType, LibraryClause[]> = {
  sale: [...saleLike, ...common],
  agreement_to_sell: [...agreement, ...common],
  gift: [...gift, ...saleLike.filter((clause) => clause.id !== "quiet-enjoyment"), ...common],
  release: [...release, ...common],
  partition: [...partition, ...common],
  will: will,
  lease: tenancy,
  rent: tenancy,
  other: [...common, ...saleLike],
};

export function clauseLibrary(type: DeedType): LibraryClause[] {
  return byType[type] ?? common;
}
