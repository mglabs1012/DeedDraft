/**
 * Kruti Dev 010 → Unicode Devanagari converter.
 *
 * Most Rajasthan deed writers type Hindi in the legacy Kruti Dev font, so text
 * extracted from their PDFs/Word files looks like "fodz; i=" instead of "विक्रय पत्र".
 * This converts such text so it can be searched, reused and later fed to AI
 * extraction. Order matters: longer sequences are replaced before shorter ones.
 */

const PAIRS: Array<[string, string]> = [
  ["ñ", "॰"], ["Q+Z", "QZ+"], ["sas", "sa"], ["aa", "a"], [")Z", "र्द्ध"], ["ZZ", "Z"],
  ["‘", "\""], ["’", "\""], ["“", "'"], ["”", "'"],
  ["å", "०"], ["ƒ", "१"], ["„", "२"], ["…", "३"], ["†", "४"], ["‡", "५"], ["ˆ", "६"], ["‰", "७"], ["Š", "८"], ["‹", "९"],
  ["¶+", "फ़्"], ["d+", "क़"], ["[+k", "ख़"], ["[+", "ख़्"], ["x+", "ग़"], ["T+", "ज़्"], ["t+", "ज़"], ["M+", "ड़"], ["<+", "ढ़"], ["Q+", "फ़"], [";+", "य़"], ["j+", "ऱ"], ["u+", "ऩ"],
  ["Ùk", "त्त"], ["Ù", "त्त्"], ["Dr", "क्त"], ["–", "दृ"], ["—", "कृ"], ["é", "न्न"], ["™", "न्न्"], ["=kk", "=k"], ["f=k", "f="],
  ["à", "ह्न"], ["á", "ह्य"], ["â", "हृ"], ["ã", "ह्म"], ["ºz", "ह्र"], ["º", "ह्"], ["í", "द्द"], ["{k", "क्ष"], ["{", "क्ष्"], ["=", "त्र"], ["«", "त्र्"],
  ["Nî", "छ्य"], ["Vî", "ट्य"], ["Bî", "ठ्य"], ["Mî", "ड्य"], ["<î", "ढ्य"], ["|", "द्य"], ["K", "ज्ञ"], ["}", "द्व"],
  ["J", "श्र"], ["Vª", "ट्र"], ["Mª", "ड्र"], ["<ªª", "ढ्र"], ["Nª", "छ्र"], ["Ø", "क्र"], ["Ý", "फ्र"], ["nzZ", "र्द्र"], ["æ", "द्र"], ["ç", "प्र"], ["Á", "प्र"], ["xz", "ग्र"], ["#", "रु"], [":", "रू"],
  ["v‚", "ऑ"], ["vks", "ओ"], ["vkS", "औ"], ["vk", "आ"], ["v", "अ"], ["b±", "ईं"], ["Ã", "ई"], ["bZ", "ई"], ["b", "इ"], ["m", "उ"], ["Å", "ऊ"], [",s", "ऐ"], [",", "ए"], ["_", "ऋ"],
  ["ô", "क्क"], ["d", "क"], ["Dk", "क"], ["D", "क्"], ["[k", "ख"], ["[", "ख्"], ["x", "ग"], ["Xk", "ग"], ["X", "ग्"], ["Ä", "घ"], ["?k", "घ"], ["?", "घ्"], ["³", "ङ"],
  ["pkS", "चै"], ["p", "च"], ["Pk", "च"], ["P", "च्"], ["N", "छ"], ["t", "ज"], ["Tk", "ज"], ["T", "ज्"], [">", "झ"], ["÷", "झ्"], ["¥", "ञ"],
  ["ê", "ट्ट"], ["ë", "ट्ठ"], ["V", "ट"], ["B", "ठ"], ["ì", "ड्ड"], ["ï", "ड्ढ"], ["M", "ड"], ["<", "ढ"], [".k", "ण"], [".", "ण्"],
  ["r", "त"], ["Rk", "त"], ["R", "त्"], ["Fk", "थ"], ["F", "थ्"], [")", "द्ध"], ["n", "द"], ["/k", "ध"], ["èk", "ध"], ["/", "ध्"], ["Ë", "ध्"], ["è", "ध्"], ["u", "न"], ["Uk", "न"], ["U", "न्"],
  ["i", "प"], ["Ik", "प"], ["I", "प्"], ["Q", "फ"], ["¶", "फ्"], ["c", "ब"], ["Ck", "ब"], ["C", "ब्"], ["Hk", "भ"], ["H", "भ्"], ["e", "म"], ["Ek", "म"], ["E", "म्"],
  [";", "य"], ["¸", "य्"], ["j", "र"], ["y", "ल"], ["Yk", "ल"], ["Y", "ल्"], ["G", "ळ"], ["o", "व"], ["Ok", "व"], ["O", "व्"],
  ["'k", "श"], ["'", "श्"], ["\"k", "ष"], ["\"", "ष्"], ["l", "स"], ["Lk", "स"], ["L", "स्"], ["g", "ह"],
  ["È", "ीं"], ["z", "्र"],
  ["Ì", "द्द"], ["Í", "ट्ट"], ["Î", "ट्ठ"], ["Ï", "ड्ड"], ["Ñ", "कृ"], ["Ò", "भ"], ["Ó", "्य"], ["Ô", "ड्ढ"], ["Ö", "झ्"], ["Ük", "श"], ["Ü", "श्"],
  ["‚", "ॉ"], ["ks", "ो"], ["kS", "ौ"], ["k", "ा"], ["h", "ी"], ["q", "ु"], ["w", "ू"], ["`", "ृ"], ["s", "े"], ["S", "ै"],
  ["a", "ं"], ["¡", "ँ"], ["%", "ः"], ["W", "ॅ"], ["•", "ऽ"], ["·", "ऽ"], ["~j", "्र"], ["~", "्"], ["\\", "?"], ["+", "़"],
  ["^", "‘"], ["*", "’"], ["Þ", "“"], ["ß", "”"], ["¼", "("], ["½", ")"], ["¿", "{"], ["À", "}"], ["¾", "="], ["A", "।"], ["-", "."], ["&", "-"], ["Œ", "॰"], ["]", ","], ["@", "/"],
];

const MATRAS = new Set("ािीुूृेैोौंःँॅ");
const I_MATRA_MARK = "\u0001";

function convertLine(input: string) {
  let line = input;
  for (const [from, to] of PAIRS) line = line.split(from).join(to);

  // Kruti types the short-i matra (f) before its consonant; move it after the cluster.
  const chars = [...line.split("f").join(I_MATRA_MARK)];
  for (let i = 0; i < chars.length; i += 1) {
    if (chars[i] !== I_MATRA_MARK) continue;
    let j = i + 1;
    while (j + 1 < chars.length && chars[j + 1] === "्") j += 2;
    if (j < chars.length) {
      chars.splice(i, j - i + 1, ...chars.slice(i + 1, j + 1), "ि");
      i = j;
    } else {
      chars[i] = "ि";
    }
  }

  // Reph (Z) is typed after the consonant and its matras; move र् before the cluster.
  for (let i = 0; i < chars.length; i += 1) {
    if (chars[i] !== "Z") continue;
    let j = i - 1;
    while (j >= 0 && MATRAS.has(chars[j])) j -= 1;
    while (j - 2 >= 0 && chars[j - 1] === "्") j -= 2;
    chars.splice(i, 1);
    chars.splice(Math.max(j, 0), 0, "र", "्");
    i += 1;
  }
  return chars.join("");
}

export function krutiDevToUnicode(text: string) {
  return text.split("\n").map(convertLine).join("\n");
}

/**
 * Heuristic: extracted text is probably Kruti Dev if it has almost no Devanagari
 * but many of Kruti's characteristic Latin sequences.
 */
export function looksLikeKrutiDev(text: string) {
  const sample = text.slice(0, 4000);
  const devanagari = (sample.match(/[ऀ-ॿ]/g) ?? []).length;
  if (devanagari > 20) return false;
  const markers = (sample.match(/(fd|dk|ks|esa|gS|vkS|Jh|;g|izFke|foØ;)/g) ?? []).length;
  return markers >= 5;
}
