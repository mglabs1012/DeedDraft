/** Hindi number words and dates in the style used by Rajasthan deed writers. */

const upTo99 = [
  "", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ",
  "दस", "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह", "अठारह", "उन्नीस",
  "बीस", "इक्कीस", "बाईस", "तेईस", "चौबीस", "पच्चीस", "छब्बीस", "सत्ताईस", "अट्ठाईस", "उनतीस",
  "तीस", "इकतीस", "बत्तीस", "तैंतीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अड़तीस", "उनतालीस",
  "चालीस", "इकतालीस", "बयालीस", "तैंतालीस", "चवालीस", "पैंतालीस", "छियालीस", "सैंतालीस", "अड़तालीस", "उनचास",
  "पचास", "इक्यावन", "बावन", "तिरेपन", "चौवन", "पचपन", "छप्पन", "सत्तावन", "अट्ठावन", "उनसठ",
  "साठ", "इकसठ", "बासठ", "तिरेसठ", "चौंसठ", "पैंसठ", "छियासठ", "सड़सठ", "अड़सठ", "उनहत्तर",
  "सत्तर", "इकहत्तर", "बहत्तर", "तिहत्तर", "चौहत्तर", "पचहत्तर", "छिहत्तर", "सतहत्तर", "अठहत्तर", "उन्यासी",
  "अस्सी", "इक्यासी", "बयासी", "तिरासी", "चौरासी", "पचासी", "छियासी", "सत्तासी", "अट्ठासी", "नवासी",
  "नब्बे", "इक्यानवे", "बानवे", "तिरानवे", "चौरानवे", "पचानवे", "छियानवे", "सत्तानवे", "अट्ठानवे", "निन्यानवे",
];

function belowThousand(n: number) {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return [hundred ? upTo99[hundred] + " सौ" : "", rest ? upTo99[rest] : ""].filter(Boolean).join(" ");
}

/** 2550000 → "पच्चीस लाख पचास हजार" (Indian lakh/crore grouping). */
export function hindiWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "शून्य";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push((crore >= 1000 ? hindiWords(crore) : belowThousand(crore)) + " करोड़");
  if (lakh) parts.push(upTo99[lakh] + " लाख");
  if (thousand) parts.push(upTo99[thousand] + " हजार");
  if (n) parts.push(belowThousand(n));
  return parts.join(" ");
}

export const hindiMonths = ["जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितम्बर", "अक्टूबर", "नवम्बर", "दिसम्बर"];
export const hindiWeekdays = ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरूवार", "शुक्रवार", "शनिवार"];
const englishMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const englishWeekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Parses YYYY-MM-DD as a calendar date (no timezone shift). */
export function parseIsoDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "02 सितम्बर, 2026 ई. बुधवार" or a fill-in blank. */
export function hindiLongDate(value?: string, withWeekday = true) {
  const date = parseIsoDate(value);
  if (!date) return "............. , 20.... ई.";
  const day = String(date.getUTCDate()).padStart(2, "0");
  return day + " " + hindiMonths[date.getUTCMonth()] + ", " + date.getUTCFullYear() + " ई." + (withWeekday ? " " + hindiWeekdays[date.getUTCDay()] : "");
}

/** "02 September 2026 (Wednesday)" or a fill-in blank. */
export function englishLongDate(value?: string, withWeekday = true) {
  const date = parseIsoDate(value);
  if (!date) return "____ day of ____________, 20____";
  const day = String(date.getUTCDate()).padStart(2, "0");
  return day + " " + englishMonths[date.getUTCMonth()] + " " + date.getUTCFullYear() + (withWeekday ? " (" + englishWeekdays[date.getUTCDay()] + ")" : "");
}

/** "02/09/2026" or "__/__/____". */
export function shortDate(value?: string) {
  const date = parseIsoDate(value);
  if (!date) return "__/__/____";
  return [String(date.getUTCDate()).padStart(2, "0"), String(date.getUTCMonth() + 1).padStart(2, "0"), date.getUTCFullYear()].join("/");
}

/** Adds whole months to an ISO date and returns the day before (end of term). */
export function termEndDate(start?: string, months?: number) {
  const date = parseIsoDate(start);
  if (!date || !months) return undefined;
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate() - 1));
  return end.toISOString().slice(0, 10);
}
