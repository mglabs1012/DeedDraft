import { deedTypes, type DeedType } from "@/lib/deed-types";

/**
 * Template catalogue shared by the template library, the new-deed picker and
 * custom documents. The eight built-in deeds come first; the rest come from
 * the Word template library (scripts/build-template-library.ts).
 */

export type CategoryId =
  | "property"
  | "rent"
  | "family"
  | "money"
  | "notices"
  | "affidavit"
  | "poa"
  | "business"
  | "jobs"
  | "company"
  | "disputes"
  | "tech"
  | "workplace"
  | "letters";

/** One entry of lib/templates/library-index.json. */
export type LibraryEntry = { id: string; title: string; category: CategoryId; us?: true };

export type Category = { id: CategoryId; label: string; labelHi: string; keywords: string };

/** Display order and search words (English, Hinglish and Hindi) for each category. */
export const categories: Category[] = [
  { id: "property", label: "Property & land", labelHi: "सम्पत्ति व भूमि", keywords: "property land house plot flat sale sell buy purchase conveyance makan zameen jameen bhoomi bechna kharidna सम्पत्ति मकान ज़मीन जमीन भूमि प्लॉट बेचना खरीदना विक्रय" },
  { id: "rent", label: "Rent & lease", labelHi: "किराया व लीज़", keywords: "rent lease tenant landlord kiraya kirayanama kirayedar owner premises shop किराया किरायानामा किरायेदार मकान मालिक लीज़ पट्टा" },
  { id: "family", label: "Family, will & trust", labelHi: "परिवार, वसीयत व ट्रस्ट", keywords: "family will vasiyat wasiyat gift daan trust adoption succession inheritance heir partition release hak tyag वसीयत दान परिवार ट्रस्ट गोद उत्तराधिकार वारिस बंटवारा हक त्याग" },
  { id: "money", label: "Loans & money", labelHi: "ऋण व पैसा", keywords: "loan money karz karza udhar rin promissory note debt guarantee pledge hypothecation payment receipt bank ऋण कर्ज़ कर्ज उधार पैसा गिरवी रसीद" },
  { id: "notices", label: "Notices & court", labelHi: "नोटिस व अदालत", keywords: "notice legal notice court suit complaint petition cheque check bounce 138 eviction notice नोटिस कानूनी अदालत शिकायत चेक बाउंस" },
  { id: "affidavit", label: "Affidavits & indemnity", labelHi: "शपथ पत्र व क्षतिपूर्ति", keywords: "affidavit shapath patra halafnama declaration indemnity bond undertaking शपथ पत्र हलफनामा घोषणा क्षतिपूर्ति बंधपत्र" },
  { id: "poa", label: "Power of attorney", labelHi: "मुख्तारनामा", keywords: "power of attorney poa gpa spa mukhtarnama mukhtar authority authorise मुख्तारनामा मुख़्तारनामा आम मुख्तार खास मुख्तार" },
  { id: "business", label: "Business & partnership", labelHi: "व्यापार व साझेदारी", keywords: "business partnership partner sajhedari firm franchise distributor dealer agency supply goods contractor consultant services vyapar व्यापार साझेदारी फर्म" },
  { id: "jobs", label: "Jobs & employment", labelHi: "नौकरी", keywords: "job employment appointment offer letter salary employee employer resignation naukri staff नौकरी नियुक्ति वेतन इस्तीफा कर्मचारी" },
  { id: "company", label: "Company & shares", labelHi: "कंपनी व शेयर", keywords: "company director board resolution shares shareholder meeting incorporation kampani कंपनी निदेशक शेयर" },
  { id: "disputes", label: "Disputes & settlement", labelHi: "विवाद व समझौता", keywords: "arbitration mediation conciliation settlement compromise dispute samjhauta vivad विवाद समझौता मध्यस्थता" },
  { id: "tech", label: "Technology, IP & media", labelHi: "तकनीक व बौद्धिक सम्पदा", keywords: "software website app saas licence license patent trademark copyright nda confidentiality advertising publishing media" },
  { id: "workplace", label: "Workplace policies", labelHi: "कार्यस्थल नीतियाँ", keywords: "policy policies leave overtime harassment safety rules hr office नीति" },
  { id: "letters", label: "Letters & other", labelHi: "पत्र व अन्य", keywords: "letter other misc patra पत्र" },
];

export const categoryById = Object.fromEntries(categories.map((category) => [category.id, category])) as Record<CategoryId, Category>;

/** The eight built-in deeds, most used first (sale, agreement to sell, gift, release, partition, will, lease, rent). */
export const coreOrder: Exclude<DeedType, "other">[] = ["sale", "agreement_to_sell", "gift", "release", "partition", "will", "lease", "rent"];

const coreMeta: Record<Exclude<DeedType, "other">, { category: CategoryId; keywords: string }> = {
  sale: { category: "property", keywords: "sale deed sell property house plot registry bainama vikray patra bechna विक्रय पत्र बैनामा रजिस्ट्री बेचना" },
  agreement_to_sell: { category: "property", keywords: "agreement to sell ats advance earnest bayana ikrarnama anubandh विक्रय इकरारनामा इकरारनामा बयाना अनुबंध साई" },
  gift: { category: "family", keywords: "gift deed daan patra hiba दान पत्र दानपत्र हिबा" },
  release: { category: "family", keywords: "release deed relinquishment hak tyag share give up हक त्याग पत्र हकत्याग" },
  partition: { category: "family", keywords: "partition deed batwara division family property vibhajan विभाजन पत्र बंटवारा" },
  will: { category: "family", keywords: "will vasiyat wasiyat testament after death वसीयत वसीयतनामा" },
  lease: { category: "rent", keywords: "lease deed long term shop office commercial patta lease पट्टा विलेख लीज़" },
  rent: { category: "rent", keywords: "rent agreement rent deed kirayanama 11 months tenant किरायानामा किराया" },
};

/**
 * Curated starting points from the library for the general public, shown
 * before anything is typed. IDs come from lib/templates/library-index.json.
 */
export const popularLibraryIds = [
  "general-power-of-attorney",
  "special-power-of-attorney",
  "simple-deed-of-indemnity",
  "indemnity-bond",
  "non-negotiable-promissory-note",
  "bank-loan-agreement",
  "partnership-deed",
  "deed-of-exchange",
  "mortgage-deed",
  "notice-under-section-138-of-the-negotiable-instruments-act-for-dishonour-of-cheq",
  "notice-to-vacant-for-non-payment-of-rent",
  "application-for-a-succession-certificate-under-the-indian-succession-act",
  "employment-agreement",
  "non-disclosure-agreement",
  "sale-of-goods-agreement",
  "debt-settlement-agreement",
];

export type CatalogItem = {
  kind: "core" | "library";
  /** Deed type for core items, library id otherwise. */
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  category: CategoryId;
  us?: boolean;
  /** Lower-cased words searched besides the title. */
  keywords: string;
};

export function coreItems(): CatalogItem[] {
  return coreOrder.map((type) => {
    const config = deedTypes[type];
    return {
      kind: "core",
      id: type,
      title: config.label,
      subtitle: config.labelHi,
      description: config.description,
      category: coreMeta[type].category,
      keywords: (coreMeta[type].keywords + " " + config.labelHi).toLowerCase(),
    };
  });
}

export function libraryItems(index: LibraryEntry[]): CatalogItem[] {
  return index.map((entry) => ({
    kind: "library",
    id: entry.id,
    title: entry.title,
    category: entry.category,
    us: entry.us,
    keywords: categoryById[entry.category].keywords.toLowerCase(),
  }));
}

const tokens = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);

/**
 * Ranks items for a query: every word must appear in the title or keywords.
 * Built-in deeds and Indian-format templates rank above US-format ones.
 */
export function searchCatalog(items: CatalogItem[], query: string, category: CategoryId | "all" = "all"): CatalogItem[] {
  const words = tokens(query);
  const phrase = words.join(" ");
  const popular = new Set(popularLibraryIds);
  const scored: Array<{ item: CatalogItem; score: number }> = [];
  for (const item of items) {
    if (category !== "all" && item.category !== category) continue;
    const title = tokens(item.title + " " + (item.subtitle ?? "")).join(" ");
    let score = item.kind === "core" ? 60 : popular.has(item.id) ? 20 : 0;
    if (item.us) score -= 25;
    if (words.length) {
      let matched = true;
      for (const word of words) {
        if (title.includes(word)) score += title.split(" ").includes(word) ? 12 : 8;
        else if (item.keywords.includes(word)) score += 3;
        else {
          matched = false;
          break;
        }
      }
      if (!matched) continue;
      if (title.startsWith(phrase)) score += 40;
      else if (title.includes(phrase)) score += 20;
    }
    scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title)).map(({ item }) => item);
}
