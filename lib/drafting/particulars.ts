/** Digit groups in a text, ignoring thousands separators: "4,50,000" → "450000". */
export function numbersIn(text: string) {
  return (text.match(/\d[\d,./-]*\d|\d/g) ?? []).map((value) => value.replace(/,/g, ""));
}

/**
 * A replacement may improve wording but must keep every number of the original
 * (amounts, dates, areas, plot and registration numbers).
 */
export function keepsParticulars(original: string, replacement: string) {
  const available = numbersIn(replacement).join(" ");
  return numbersIn(original).every((value) => available.includes(value));
}
