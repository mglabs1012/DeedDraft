import type { DraftLanguage } from "@/lib/deed-types";

/**
 * Offline Hindi ⇄ English conversion for names, places and common deed words.
 *
 * Most values typed into a deed are made of a small vocabulary: name parts
 * (Devi, Kumar, Singh), Rajasthan places (Ajmer, Beawar), address words
 * (Nagar, Colony, Road) and deed words (Business, Plot No., Land of others).
 * Those are converted here instantly and identically every time; the AI is
 * only asked about values that contain words outside this vocabulary. The
 * rule-based transliteration is a fallback when the AI is not available, and
 * its results are flagged for the user to check.
 */

/* --------------------------------------------------- English → Hindi words */

const words: Record<string, string> = {
  // name parts and honorifics
  shri: "श्री", sri: "श्री", smt: "श्रीमती", mr: "श्री", mrs: "श्रीमती", ms: "सुश्री", kumari: "कुमारी", late: "स्वर्गीय", sushri: "सुश्री",
  devi: "देवी", kumar: "कुमार", singh: "सिंह", lal: "लाल", chand: "चन्द", chandra: "चन्द्र", prasad: "प्रसाद", nath: "नाथ", das: "दास", dutt: "दत्त", bai: "बाई", ram: "राम", shyam: "श्याम",
  sharma: "शर्मा", gupta: "गुप्ता", jain: "जैन", agarwal: "अग्रवाल", aggarwal: "अग्रवाल", agrawal: "अग्रवाल", verma: "वर्मा", mathur: "माथुर", saxena: "सक्सेना", mehta: "मेहता", joshi: "जोशी",
  choudhary: "चौधरी", chaudhary: "चौधरी", chaudhari: "चौधरी", chouhan: "चौहान", chauhan: "चौहान", rathore: "राठौड़", rathod: "राठौड़", rajput: "राजपूत", kanwar: "कंवर", kanwer: "कंवर",
  meena: "मीणा", yadav: "यादव", khan: "खान", mohammad: "मोहम्मद", mohammed: "मोहम्मद", mohd: "मोहम्मद", ali: "अली", bano: "बानो", begum: "बेगम", ahmed: "अहमद", hussain: "हुसैन",
  sheikh: "शेख", qureshi: "कुरैशी", mali: "माली", saini: "सैनी", kumawat: "कुमावत", jangid: "जांगिड़", soni: "सोनी", sen: "सेन", panwar: "पंवार", parmar: "परमार", sisodia: "सिसोदिया", tak: "टाक",
  ramesh: "रमेश", suresh: "सुरेश", mahesh: "महेश", dinesh: "दिनेश", rajesh: "राजेश", mukesh: "मुकेश", naresh: "नरेश", rakesh: "राकेश", kamlesh: "कमलेश", ganesh: "गणेश",
  kesar: "केसर", manju: "मंजू", sunita: "सुनीता", anita: "अनीता", geeta: "गीता", gita: "गीता", sita: "सीता", kamla: "कमला", kamala: "कमला", laxmi: "लक्ष्मी", lakshmi: "लक्ष्मी",
  pushpa: "पुष्पा", rekha: "रेखा", savitri: "सावित्री", shanti: "शान्ति", santosh: "संतोष", seema: "सीमा", pooja: "पूजा", puja: "पूजा", priya: "प्रिया", neha: "नेहा", radha: "राधा", durga: "दुर्गा",
  vinod: "विनोद", anil: "अनिल", sunil: "सुनील", ashok: "अशोक", vijay: "विजय", ajay: "अजय", sanjay: "संजय", mohan: "मोहन", sohan: "सोहन", gopal: "गोपाल", govind: "गोविन्द", krishna: "कृष्ण",
  hari: "हरि", om: "ओम", prakash: "प्रकाश", narayan: "नारायण", shankar: "शंकर", mahaveer: "महावीर", mahavir: "महावीर", hem: "हेम", hemant: "हेमन्त", deepak: "दीपक", pankaj: "पंकज",
  rahul: "राहुल", rohit: "रोहित", amit: "अमित", sumit: "सुमित", vikas: "विकास", ravi: "रवि", raj: "राज", rajendra: "राजेन्द्र", surendra: "सुरेन्द्र", mahendra: "महेन्द्र", narendra: "नरेन्द्र",
  devendra: "देवेन्द्र", jitendra: "जितेन्द्र", virendra: "वीरेन्द्र", bhanwar: "भंवर", bhagwan: "भगवान", bhagwati: "भगवती", babu: "बाबू", babulal: "बाबूलाल", kanhaiya: "कन्हैया", girdhari: "गिरधारी",
  banwari: "बनवारी", madan: "मदन", kishan: "किशन", kishore: "किशोर", kishor: "किशोर", shiv: "शिव", kailash: "कैलाश", prem: "प्रेम", ratan: "रतन", moti: "मोती", heera: "हीरा", hira: "हीरा", puran: "पूरण",
  // places
  ajmer: "अजमेर", rajasthan: "राजस्थान", jaipur: "जयपुर", jodhpur: "जोधपुर", udaipur: "उदयपुर", kota: "कोटा", bikaner: "बीकानेर", bhilwara: "भीलवाड़ा", beawar: "ब्यावर", kishangarh: "किशनगढ़",
  pushkar: "पुष्कर", nasirabad: "नसीराबाद", kekri: "केकड़ी", sikar: "सीकर", tonk: "टोंक", alwar: "अलवर", bharatpur: "भरतपुर", pali: "पाली", nagaur: "नागौर", chittorgarh: "चित्तौड़गढ़", sirohi: "सिरोही",
  delhi: "दिल्ली", india: "भारत", badgaon: "बडगांव", vaishali: "वैशाली", shastri: "शास्त्री", gandhi: "गांधी", nehru: "नेहरू", subhash: "सुभाष", adarsh: "आदर्श", panchsheel: "पंचशील", jawahar: "जवाहर",
  // address words
  nagar: "नगर", colony: "कॉलोनी", vihar: "विहार", puri: "पुरी", pura: "पुरा", ganj: "गंज", bazar: "बाजार", bazaar: "बाजार", market: "मार्केट", mohalla: "मोहल्ला", gali: "गली", marg: "मार्ग",
  road: "रोड", rd: "रोड", street: "स्ट्रीट", chowk: "चौक", sector: "सेक्टर", block: "ब्लॉक", ward: "वार्ड", scheme: "योजना", phase: "फेज", extension: "एक्सटेंशन", village: "ग्राम", tehsil: "तहसील",
  district: "जिला", dist: "जिला", post: "पोस्ट", north: "उत्तर", south: "दक्षिण", east: "पूर्व", west: "पश्चिम", main: "मुख्य", highway: "हाईवे", lane: "गली", ft: "फीट", feet: "फीट", wide: "चौड़ा",
  mtr: "मीटर", meter: "मीटर", metre: "मीटर", plot: "भूखण्ड", house: "मकान", shop: "दुकान", flat: "फ्लैट", land: "भूमि", khasra: "खसरा", khata: "खाता", patta: "पट्टा", floor: "मंजिल", ground: "भूतल",
  residential: "आवासीय", commercial: "वाणिज्यिक", agricultural: "कृषि", industrial: "औद्योगिक", open: "खुली", others: "अन्य", other: "अन्य", government: "सरकारी", private: "निजी", nala: "नाला", temple: "मन्दिर",
  // occupations
  business: "व्यवसाय", service: "नौकरी", housewife: "गृहिणी", agriculture: "कृषि", farmer: "कृषक", farming: "कृषि", labour: "मजदूरी", labor: "मजदूरी", retired: "सेवानिवृत्त", student: "विद्यार्थी",
  advocate: "अधिवक्ता", doctor: "डॉक्टर", teacher: "अध्यापक", job: "नौकरी", engineer: "इंजीनियर", shopkeeper: "दुकानदार", contractor: "ठेकेदार", driver: "ड्राइवर", pensioner: "पेंशनर",
};

/** Multi-word phrases, matched before single words (longest first). */
const phrases: Array<[string[], string]> = [
  [["land", "of", "others"], "अन्य की भूमि"], [["others", "land"], "अन्य की भूमि"], [["other's", "land"], "अन्य की भूमि"], [["others'", "land"], "अन्य की भूमि"],
  [["open", "land"], "खुली भूमि"], [["government", "land"], "सरकारी भूमि"], [["public", "road"], "आम रास्ता"], [["common", "road"], "आम रास्ता"], [["aam", "rasta"], "आम रास्ता"],
  [["plot", "no"], "भूखण्ड संख्या"], [["plot", "number"], "भूखण्ड संख्या"], [["house", "no"], "मकान नम्बर"], [["house", "number"], "मकान नम्बर"], [["ward", "no"], "वार्ड नम्बर"],
  [["khasra", "no"], "खसरा नम्बर"], [["flat", "no"], "फ्लैट नम्बर"], [["shop", "no"], "दुकान नम्बर"], [["sub", "registrar"], "उप पंजीयक"], [["state", "bank", "of", "india"], "भारतीय स्टेट बैंक"],
  [["ground", "floor"], "भूतल"], [["first", "floor"], "प्रथम मंजिल"], [["second", "floor"], "द्वितीय मंजिल"],
];

/* --------------------------------------------------- Hindi → English words */

const hindiWords: Record<string, string> = {
  ...Object.fromEntries(Object.entries(words).filter(([key]) => key.length > 2 && !["mrs", "smt", "rd", "dist", "mtr", "sri", "late", "others", "other", "lane", "labor", "farming", "metre", "puja", "gita", "kamala", "lakshmi", "mahavir", "kishor", "hira", "mohammed", "mohd", "aggarwal", "agrawal", "chaudhari", "chaudhary", "chauhan", "rathod", "kanwer", "bazaar", "job", "agricultural"].includes(key)).map(([key, value]) => [value, title(key)])),
  श्री: "Shri", श्रीमती: "Smt.", सुश्री: "Ms.", स्वर्गीय: "Late", अन्य: "Others", कृषि: "Agriculture", व्यवसाय: "Business", नौकरी: "Service", गृहिणी: "Housewife", मजदूरी: "Labour",
  रास्ता: "Road", सड़क: "Road", नम्बर: "No.", नंबर: "No.", संख्या: "No.", ग्राम: "Village", गांव: "Village", तहसील: "Tehsil", जिला: "District", वार्ड: "Ward", निवासी: "resident of",
  पुत्र: "son of", पुत्री: "daughter of", पत्नी: "wife of", विधवा: "widow of", मकान: "House", भूखण्ड: "Plot", प्लॉट: "Plot", दुकान: "Shop", खुली: "Open", भूमि: "Land", सरकारी: "Government",
  चौधरी: "Choudhary", राठौड़: "Rathore", कंवर: "Kanwar",
};

const hindiPhrases: Array<[string[], string]> = [
  [["अन्य", "की", "भूमि"], "Land of others"], [["आम", "रास्ता"], "Public road"], [["उप", "पंजीयक"], "Sub-Registrar"], [["खुली", "भूमि"], "Open land"], [["सरकारी", "भूमि"], "Government land"],
  [["भूखण्ड", "संख्या"], "Plot No."], [["मकान", "नम्बर"], "House No."], [["खसरा", "नम्बर"], "Khasra No."], [["वार्ड", "नम्बर"], "Ward No."], [["भारतीय", "स्टेट", "बैंक"], "State Bank of India"],
];

function title(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/* ------------------------------------------------- Rule-based transliteration */

const consonants: Record<string, string> = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "n", च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "n", ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n", त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m", य: "y", र: "r", ल: "l", ळ: "l", व: "v", श: "sh", ष: "sh", स: "s", ह: "h", "क़": "q", "ख़": "kh", "ग़": "g", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f",
};
const vowels: Record<string, string> = { अ: "a", आ: "a", इ: "i", ई: "ee", उ: "u", ऊ: "oo", ऋ: "ri", ए: "e", ऐ: "ai", ओ: "o", औ: "au" };
const signs: Record<string, string> = { "ा": "a", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o" };

/** Devanagari word → Roman letters, with the usual deletion of the silent inherent "a". */
function romanise(word: string): string {
  const chars = [...word.normalize("NFC").replace(/़/g, "")];
  type Unit = { text: string; vowel: string | null; consonant: boolean };
  const units: Unit[] = [];
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    const next = chars[i + 1];
    if (consonants[char] !== undefined) {
      if (next === "्") { units.push({ text: consonants[char], vowel: "", consonant: true }); i += 1; }
      else if (next && signs[next] !== undefined) { units.push({ text: consonants[char], vowel: signs[next], consonant: true }); i += 1; }
      else units.push({ text: consonants[char], vowel: null, consonant: true });
    } else if (vowels[char] !== undefined) units.push({ text: vowels[char], vowel: "", consonant: false });
    else if (char === "ं" || char === "ँ") units.push({ text: /^[pbm]/.test(romaniseNextConsonant(chars, i)) ? "m" : "n", vowel: "", consonant: false });
    else if (char === "ः") units.push({ text: "h", vowel: "", consonant: false });
    else if (signs[char] === undefined && char !== "्") units.push({ text: char, vowel: "", consonant: false });
  }
  // Inherent "a": silent at the end of a word, and between a vowel and a consonant that carries a vowel (कमला → Kamla).
  const voiced = (unit: Unit | undefined) => Boolean(unit && (!unit.consonant || unit.vowel === null || unit.vowel !== ""));
  // Right to left, so the next syllable's vowel is already known.
  for (let i = units.length - 1; i >= 0; i -= 1) {
    const unit = units[i];
    if (!unit.consonant || unit.vowel !== null) continue;
    const isLast = i === units.length - 1;
    const prev = units[i - 1];
    const next = units[i + 1];
    const deleteSchwa = (isLast && i > 0) || (i > 0 && voiced(prev) && next?.consonant && next.vowel !== null && next.vowel !== "");
    unit.vowel = deleteSchwa ? "" : "a";
  }
  let out = units.map((unit) => unit.text + (unit.vowel ?? "")).join("");
  out = out.replace(/ee$/, "i").replace(/oo$/, "u");
  return out;
}

function romaniseNextConsonant(chars: string[], index: number) {
  for (let i = index + 1; i < chars.length; i += 1) if (consonants[chars[i]]) return consonants[chars[i]];
  return "";
}

const latinConsonants: Array<[string, string]> = [
  ["ksh", "क्ष"], ["chh", "छ"], ["shr", "श्र"], ["gya", "ज्ञ"], ["sh", "श"], ["ch", "च"], ["kh", "ख"], ["gh", "घ"], ["jh", "झ"], ["th", "थ"], ["dh", "ध"], ["ph", "फ"], ["bh", "भ"],
  ["k", "क"], ["g", "ग"], ["j", "ज"], ["t", "त"], ["d", "द"], ["n", "न"], ["p", "प"], ["f", "फ़"], ["b", "ब"], ["m", "म"], ["y", "य"], ["r", "र"], ["l", "ल"], ["v", "व"], ["w", "व"],
  ["s", "स"], ["h", "ह"], ["z", "ज़"], ["q", "क"], ["c", "क"], ["x", "क्स"],
];
const latinVowels: Array<[string, string, string]> = [
  ["aa", "आ", "ा"], ["ee", "ई", "ी"], ["ii", "ई", "ी"], ["oo", "ऊ", "ू"], ["uu", "ऊ", "ू"], ["ai", "ऐ", "ै"], ["au", "औ", "ौ"], ["ou", "औ", "ौ"],
  ["a", "अ", ""], ["i", "इ", "ि"], ["u", "उ", "ु"], ["e", "ए", "े"], ["o", "ओ", "ो"],
];

/** Roman word → Devanagari by sound. Approximate: used only as a fallback and always flagged for review. */
function devanagari(word: string): string {
  const text = word.toLowerCase();
  let out = "";
  let i = 0;
  let afterConsonant = false;
  while (i < text.length) {
    const vowel = latinVowels.find(([latin]) => text.startsWith(latin, i));
    if (vowel) {
      const [latin, independent, sign] = vowel;
      const final = i + latin.length === text.length;
      if (afterConsonant) out += latin === "a" && final ? "ा" : latin === "i" && final ? "ी" : sign;
      else out += independent;
      i += latin.length;
      afterConsonant = false;
      continue;
    }
    // "n" or "m" before another consonant is a nasal sign: Chand → चंद.
    if ((text[i] === "n" || text[i] === "m") && i + 1 < text.length && !latinVowels.some(([latin]) => text.startsWith(latin, i + 1)) && afterConsonant === false && out) {
      out += "ं";
      i += 1;
      continue;
    }
    const consonant = latinConsonants.find(([latin]) => text.startsWith(latin, i));
    if (consonant) {
      if (afterConsonant) out += "्";
      out += consonant[1];
      i += consonant[0].length;
      afterConsonant = true;
      continue;
    }
    out += text[i];
    i += 1;
    afterConsonant = false;
  }
  return out;
}

/* ----------------------------------------------------------------- Convert */

const DEVANAGARI = /[ऀ-ॿ]/;
const TOKEN = /([\p{L}\p{M}'’]+|\d[\d.,/-]*)/gu;

export type OfflineConversion = {
  text: string;
  /** Every word came from the dictionary (or is a number or code): safe to use without review. */
  confident: boolean;
};

/** Converts one value into the draft language's script without AI. */
export function convertOffline(value: string, language: DraftLanguage): OfflineConversion {
  const parts = value.split(TOKEN);
  // parts alternate: separator, token, separator, token …
  const tokens: Array<{ index: number; word: string }> = [];
  parts.forEach((part, index) => { if (index % 2 === 1) tokens.push({ index, word: part }); });
  let confident = true;
  const toHindi = language === "hindi";
  const dictionary = toHindi ? words : hindiWords;
  const phraseList = toHindi ? phrases : hindiPhrases;
  const key = (word: string) => (toHindi ? word.toLowerCase().replace(/[.’']/g, "") : word.replace(/ँ/g, "ं"));
  // Codes stay exactly as typed: any space-separated chunk with a digit ("B-204,", "P/2019/88").
  const codeChunks = new Set<number>();
  let offset = 0;
  parts.forEach((part, index) => {
    const start = offset;
    offset += part.length;
    if (index % 2 === 1) {
      const before = value.slice(0, start).split(/\s/).pop() ?? "";
      const after = value.slice(offset).split(/\s/)[0] ?? "";
      if (/\d/.test(before + part + after)) codeChunks.add(index);
    }
  });

  for (let t = 0; t < tokens.length; ) {
    const { word } = tokens[t];
    if (codeChunks.has(tokens[t].index) || /\d/.test(word) || (toHindi ? /^[A-Z]{2,6}$/.test(word) && !(word.toLowerCase() in words) : !DEVANAGARI.test(word))) { t += 1; continue; }
    // Longest phrase starting here (separators between phrase words must be plain spaces or dots).
    const phrase = phraseList.find(([list]) => list.every((item, offset) => {
      const token = tokens[t + offset];
      if (!token || codeChunks.has(token.index) || key(token.word) !== (toHindi ? item.replace(/[.’']/g, "") : item)) return false;
      return offset === 0 || /^[\s.]*$/.test(parts[token.index - 1]);
    }));
    if (phrase) {
      const length = phrase[0].length;
      parts[tokens[t].index] = phrase[1];
      for (let offset = 1; offset < length; offset += 1) { parts[tokens[t + offset].index] = ""; parts[tokens[t + offset].index - 1] = ""; }
      // "Plot No. 38": the dot after "No" belongs to the phrase.
      if (/^\.\s*/.test(parts[tokens[t + length - 1].index + 1] ?? "") && /No\.$|संख्या$|नम्बर$/.test(phrase[1])) parts[tokens[t + length - 1].index + 1] = parts[tokens[t + length - 1].index + 1].replace(/^\./, "");
      t += length;
      continue;
    }
    const known = dictionary[key(word)];
    if (known) parts[tokens[t].index] = known;
    else {
      confident = false;
      parts[tokens[t].index] = toHindi ? devanagari(word) : title(romanise(word));
    }
    t += 1;
  }
  let text = parts.join("").replace(/\s{2,}/g, " ").trim();
  // "Smt. Kesar" → "श्रीमती. केसर": honorific dots do not exist in Hindi.
  if (toHindi) text = text.replace(/(श्री|श्रीमती|सुश्री|स्वर्गीय)\./g, "$1");
  return { text, confident };
}

/** Values that are names, places or short phrases (sentences need real translation, not word swaps). */
export function isShortValue(value: string) {
  return value.trim().split(/\s+/).length <= 8 && !/[।.?!]\s+\S/.test(value.trim());
}

/**
 * A download name every browser and operating system accepts: Hindi words are
 * written in English letters, dashes and other symbols are simplified. Chrome
 * silently replaces names it rejects with "download" (no extension).
 */
export function safeFileName(name: string, fallback = "deed") {
  const roman = DEVANAGARI.test(name) ? convertOffline(name, "english").text : name;
  const clean = roman
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^A-Za-z0-9 ,._()&-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[ .-]+|[ .-]+$/g, "")
    .slice(0, 100)
    .trim();
  return clean || fallback;
}
