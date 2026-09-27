/**
 * Rajasthan stamp-duty estimate for conveyances (sale deeds).
 *
 * Duty is charged on the higher of the consideration and the DLC market value,
 * at a rate that depends on the buyer, plus three 10% surcharges on the duty
 * (Rajasthan Stamp Act, 1998, ss. 3-A, 3-B and the calamity-relief surcharge).
 * Checked against a real e-stamp certificate: female SC/ST/BPL buyer, DLC value
 * ₹4,93,925 → duty ₹19,757 + 3 × ₹1,976 = ₹25,685.
 *
 * Rates change by notification — the UI always labels this as an estimate.
 */

export type StampCategory = "male" | "female" | "female_reserved";

export const stampCategoryLabels: Record<StampCategory, string> = {
  male: "Male buyer",
  female: "Female buyer",
  female_reserved: "Female buyer (SC / ST / BPL)",
};

export const RAJASTHAN_CONVEYANCE = {
  rates: { male: 6, female: 5, female_reserved: 4 } satisfies Record<StampCategory, number>,
  surcharges: [
    { label: "Infrastructure development (s. 3-A)", percent: 10 },
    { label: "Cow propagation & conservation (s. 3-B)", percent: 10 },
    { label: "Relief from natural & man-made calamities", percent: 10 },
  ],
  registrationPercent: 1,
};

export type StampEstimate = {
  base: number;
  rate: number;
  duty: number;
  surcharges: Array<{ label: string; amount: number }>;
  totalStamp: number;
  registrationFee: number;
};

export function estimateStampDuty({
  consideration = 0,
  marketValue = 0,
  category,
}: {
  consideration?: number;
  marketValue?: number;
  category: StampCategory;
}): StampEstimate | null {
  const base = Math.max(consideration, marketValue);
  if (!base) return null;
  const rate = RAJASTHAN_CONVEYANCE.rates[category];
  const duty = Math.round((base * rate) / 100);
  const surcharges = RAJASTHAN_CONVEYANCE.surcharges.map((item) => ({ label: item.label, amount: Math.round((duty * item.percent) / 100) }));
  return {
    base,
    rate,
    duty,
    surcharges,
    totalStamp: duty + surcharges.reduce((sum, item) => sum + item.amount, 0),
    registrationFee: Math.round((base * RAJASTHAN_CONVEYANCE.registrationPercent) / 100),
  };
}
