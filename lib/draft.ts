import {
  amountInWords,
  areaUnitLabels,
  deedTypeLabels,
  formatINR,
  hasConsideration,
  partyRoleLabels,
  paymentModeLabels,
  propertyKindLabels,
  type DeedType,
} from "@/lib/deeds";
import type { DeedData, Party, Property } from "@/lib/schemas/deed-data";

export type ReadinessItem = {
  label: string;
  done: boolean;
  tab: "parties" | "properties" | "payments" | "documents";
  optional?: boolean;
};

export function paymentsTotal(data: DeedData) {
  return data.payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export function getReadiness(type: DeedType, data: DeedData, documentCount: number): ReadinessItem[] {
  const roles = partyRoleLabels[type];
  const count = (role: Party["role"]) => data.parties.filter((party) => party.role === role).length;
  const items: ReadinessItem[] = [
    { label: "At least one " + roles.first.toLowerCase(), done: count("first") > 0, tab: "parties" },
    { label: "At least one " + roles.second.toLowerCase(), done: count("second") > 0, tab: "parties" },
    { label: "Property schedule added", done: data.properties.length > 0, tab: "properties" },
  ];
  if (hasConsideration(type)) {
    const total = data.consideration.total ?? 0;
    items.push(
      { label: "Total consideration entered", done: total > 0, tab: "payments" },
      { label: "Payments cover the consideration", done: total > 0 && paymentsTotal(data) >= total, tab: "payments" },
    );
  }
  items.push(
    { label: "Two witnesses named", done: count("witness") >= 2, tab: "parties", optional: true },
    { label: "Supporting documents uploaded", done: documentCount > 0, tab: "documents", optional: true },
  );
  return items;
}

export function maskAadhaar(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 12 ? "XXXX XXXX " + digits.slice(8) : "";
}

const escape = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const blank = (value: string | number | undefined | null, fallback = "__________") =>
  value === undefined || value === null || value === "" ? fallback : escape(value);

function describeParty(party: Party) {
  const bits = [
    "<strong>" + escape(party.fullName) + "</strong>",
    party.relativeName ? escape(party.relation) + " " + escape(party.relativeName) : "",
    party.age ? "aged about " + escape(party.age) + " years" : "",
    party.occupation ? "by occupation " + escape(party.occupation) : "",
    "resident of " + blank(party.address),
  ].filter(Boolean);
  const ids = [
    maskAadhaar(party.aadhaar) ? "Aadhaar No. " + maskAadhaar(party.aadhaar) : "",
    party.pan ? "PAN " + escape(party.pan) : "",
  ].filter(Boolean);
  return bits.join(", ") + (ids.length ? " (" + ids.join(", ") + ")" : "");
}

function partyBlock(parties: Party[], alias: string, part: string) {
  if (!parties.length) return "<p class='party'>__________________________ (" + alias + ")</p>";
  const list = parties.map((party, index) => "<p class='party'>" + (parties.length > 1 ? index + 1 + ". " : "") + describeParty(party) + "</p>").join("");
  return (
    list +
    "<p>(hereinafter called the <strong>“" + alias.toUpperCase() + "”</strong>, which expression shall, unless repugnant to the context or meaning thereof, include their heirs, successors, legal representatives and assigns) of the <strong>" + part + "</strong>.</p>"
  );
}

function describeProperty(property: Property, index: number) {
  const location = [property.locality, property.tehsil ? "Tehsil " + property.tehsil : "", property.district ? "District " + property.district : "", property.state]
    .filter(Boolean)
    .map(escape)
    .join(", ");
  const area = property.area ? "admeasuring " + escape(property.area.toLocaleString("en-IN")) + " " + areaUnitLabels[property.areaUnit] : "";
  const cell = (side: "north" | "south" | "east" | "west") =>
    "<td><strong>" + side[0].toUpperCase() + side.slice(1) + ":</strong> " + blank(property[side]) + "</td>";
  return (
    "<h3>Item " + (index + 1) + " — " + propertyKindLabels[property.kind] + "</h3>" +
    "<p>" + escape(property.description) + (property.identifier ? ", bearing " + escape(property.identifier) : "") + (area ? ", " + area : "") + (location ? ", situated at " + location : "") + ".</p>" +
    "<p>Bounded as follows:</p><table class='bounds'><tr>" + cell("north") + cell("south") + "</tr><tr>" + cell("east") + cell("west") + "</tr></table>" +
    (property.marketValue ? "<p>Market value as per DLC rate: " + formatINR(property.marketValue) + ".</p>" : "")
  );
}

function body(type: DeedType, data: DeedData, roles: { first: string; second: string; other: string }) {
  const total = data.consideration.total ?? 0;
  const money = total ? formatINR(total) + " (Rupees " + amountInWords(total) + " Only)" : "Rs. __________ (Rupees __________ Only)";
  const first = roles.first.split(" (")[0].toUpperCase();
  const second = roles.second.split(" (")[0].toUpperCase();

  switch (type) {
    case "sale":
      return [
        "WHEREAS the " + first + " is the absolute owner and in peaceful possession of the property more particularly described in the Schedule below (the “Said Property”), having acquired the same by virtue of valid title documents, and the same is free from all encumbrances.",
        "AND WHEREAS the " + first + " has agreed to sell and the " + second + " has agreed to purchase the Said Property for a total sale consideration of " + money + ".",
        "NOW THEREFORE THIS DEED OF SALE WITNESSETH AS FOLLOWS:",
        "1. That in consideration of the said amount, paid by the " + second + " to the " + first + " in the manner set out in the payment schedule below, the receipt whereof the " + first + " hereby acknowledges, the " + first + " hereby sells, conveys and transfers the Said Property absolutely unto the " + second + ".",
        "2. That actual, physical and vacant possession of the Said Property has been delivered to the " + second + " on the date of execution of this deed.",
        "3. That the " + first + " assures that the Said Property is free from all encumbrances, charges, liens, mortgages, court attachments and disputes, and shall indemnify the " + second + " against any loss arising from a defect in title.",
        "4. That the " + second + " shall be entitled to get the Said Property mutated in revenue and municipal records in their own name.",
        "5. That the stamp duty and registration charges on this deed have been borne by the " + second + ".",
      ];
    case "gift":
      return [
        "WHEREAS the " + first + " is the absolute owner and in possession of the property described in the Schedule below (the “Said Property”).",
        "AND WHEREAS the " + first + ", out of natural love and affection for the " + second + ", is desirous of gifting the Said Property to the " + second + " without any consideration.",
        "NOW THIS DEED OF GIFT WITNESSETH AS FOLLOWS:",
        "1. That the " + first + " hereby gifts, transfers and conveys the Said Property unto the " + second + " absolutely and forever, out of natural love and affection and without any monetary consideration.",
        "2. That the " + second + " hereby accepts this gift, and possession of the Said Property has been handed over to the " + second + ".",
        "3. That the " + first + " declares that the Said Property is free from all encumbrances and that this gift is made voluntarily, without coercion or undue influence.",
        "4. That this gift shall be irrevocable and the " + second + " shall be entitled to get the Said Property mutated in their name.",
      ];
    case "release":
      return [
        "WHEREAS the " + first + " and the " + second + " hold rights, title and interest in the property described in the Schedule below (the “Said Property”).",
        "AND WHEREAS the " + first + " is desirous of releasing and relinquishing all of their share, right, title and interest in the Said Property in favour of the " + second + (total ? " for a consideration of " + money : "") + ".",
        "NOW THIS DEED OF RELEASE WITNESSETH AS FOLLOWS:",
        "1. That the " + first + " hereby releases, relinquishes and gives up all rights, title, interest and claims whatsoever in the Said Property in favour of the " + second + ".",
        "2. That henceforth the " + second + " alone shall be the absolute owner of the Said Property, and the " + first + " or anyone claiming through them shall have no claim over it.",
        "3. That the " + second + " shall be entitled to get the Said Property mutated in their sole name.",
      ];
    case "partition":
      return [
        "WHEREAS the parties hereto are joint owners and in joint possession of the properties described in the Schedule below (the “Joint Properties”).",
        "AND WHEREAS, for better enjoyment and management, the parties have mutually agreed to divide the Joint Properties by metes and bounds.",
        "NOW THIS DEED OF PARTITION WITNESSETH AS FOLLOWS:",
        "1. That the Joint Properties are partitioned between the parties and each party is allotted the item(s) of the Schedule as mutually agreed and recorded in the allotment below.",
        "2. That each party shall hereafter hold and enjoy the portion allotted to them as absolute and exclusive owner, and no party shall have any claim over the portion allotted to another.",
        "3. That each party shall be entitled to get their allotted portion mutated in their own name in revenue and municipal records.",
      ];
    case "will":
      return [
        "I, the " + first + " named above, being of sound mind and disposing memory, and making this Will of my own free will without any coercion or undue influence, hereby revoke all my earlier Wills and codicils and declare this to be my last Will and Testament.",
        "1. That I am the absolute owner of the properties described in the Schedule below.",
        "2. That after my death, the said properties shall devolve upon and be vested in the " + roles.second.toUpperCase() + "(S) named above absolutely.",
        "3. That " + (data.parties.some((party) => party.role === "other") ? "the " + roles.other.toUpperCase() + " named above" : "__________") + " shall be the executor of this Will.",
        "4. That I have signed this Will in the presence of the witnesses below, who have signed in my presence and in the presence of each other.",
      ];
    default:
      return [
        "WHEREAS the parties have agreed to record the terms relating to the property described in the Schedule below.",
        "NOW THIS DEED WITNESSETH AS FOLLOWS:",
        "1. __________________________________________________",
        "2. __________________________________________________",
      ];
  }
}

export function buildDraftHtml({
  type,
  title,
  referenceNo,
  data,
  firmName,
  city,
}: {
  type: DeedType;
  title: string;
  referenceNo: string;
  data: DeedData;
  firmName: string;
  city: string;
}) {
  const roles = partyRoleLabels[type];
  const byRole = (role: Party["role"]) => data.parties.filter((party) => party.role === role);
  const witnesses = byRole("witness");
  const docTitle = type === "will" ? "LAST WILL AND TESTAMENT" : deedTypeLabels[type].toUpperCase();
  const firstAlias = roles.first.split(" (")[0];
  const secondAlias = roles.second.split(" (")[0];

  const opening =
    type === "will"
      ? "<p>This Will is made at " + escape(city) + " on this ____ day of ______________, 20____ by:</p>" + partyBlock(byRole("first"), firstAlias, "First Part").split("<p>(hereinafter")[0]
      : "<p>This " + escape(deedTypeLabels[type]) + " is made and executed at " + escape(city) + " on this ____ day of ______________, 20____</p><p class='center'><strong>BY AND BETWEEN</strong></p>" +
        partyBlock(byRole("first"), firstAlias, "First Part") +
        "<p class='center'><strong>AND</strong></p>" +
        partyBlock(byRole("second"), secondAlias, "Second Part") +
        (byRole("other").length ? "<p class='center'><strong>AND</strong></p>" + partyBlock(byRole("other"), roles.other, "Third Part") : "");

  const beneficiaries = type === "will" && byRole("second").length
    ? "<h2>Beneficiaries</h2>" + byRole("second").map((party, i) => "<p class='party'>" + (i + 1) + ". " + describeParty(party) + "</p>").join("") +
      (byRole("other").length ? "<h2>Executor</h2>" + byRole("other").map((party) => "<p class='party'>" + describeParty(party) + "</p>").join("") : "")
    : "";

  const schedule = data.properties.length
    ? data.properties.map(describeProperty).join("")
    : "<p>__________________________________________________ (property description, area and boundaries)</p>";

  const payments =
    hasConsideration(type) && data.payments.length
      ? "<h2>Payment Schedule</h2><table class='grid'><thead><tr><th>#</th><th>Mode</th><th>Reference / UTR</th><th>Bank</th><th>Date</th><th>Amount</th></tr></thead><tbody>" +
        data.payments
          .map((payment, index) => "<tr><td>" + (index + 1) + "</td><td>" + paymentModeLabels[payment.mode] + "</td><td>" + blank(payment.reference, "—") + "</td><td>" + blank(payment.bank, "—") + "</td><td>" + blank(payment.date, "—") + "</td><td class='num'>" + formatINR(payment.amount) + "</td></tr>")
          .join("") +
        "<tr><td colspan='5'><strong>Total</strong></td><td class='num'><strong>" + formatINR(paymentsTotal(data)) + "</strong></td></tr></tbody></table>"
      : "";

  const signer = (label: string, parties: Party[]) =>
    "<div class='sign'><div class='line'></div><p><strong>" + escape(label) + "</strong><br/>" + (parties.map((party) => escape(party.fullName)).join(", ") || "&nbsp;") + "</p></div>";

  const witnessRows = (witnesses.length ? witnesses : [undefined, undefined])
    .map((party, index) => "<div class='sign'><div class='line'></div><p>" + (index + 1) + ". " + (party ? escape(party.fullName) + "<br/>" + blank(party.address, "") : "Name & address") + "</p></div>")
    .join("");

  const clauses = body(type, data, roles).map((clause) => "<p>" + escape(clause) + "</p>").join("");

  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escape(title)}</title><style>
@page{size:A4;margin:2.2cm}
body{font-family:"Times New Roman",Georgia,serif;font-size:12.5pt;line-height:1.65;color:#111;max-width:760px;margin:0 auto;padding:32px 24px;background:#fff}
h1{text-align:center;font-size:18pt;letter-spacing:.08em;margin:0 0 4px}
h2{font-size:13pt;text-transform:uppercase;letter-spacing:.05em;margin:28px 0 8px;border-bottom:1px solid #999;padding-bottom:4px}
h3{font-size:12pt;margin:18px 0 4px}
p{text-align:justify;margin:0 0 10px}
.meta{text-align:center;font-size:10pt;color:#555;margin-bottom:24px}
.center{text-align:center}
.party{padding-left:18px}
table{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:11pt}
.bounds td{border:1px solid #bbb;padding:6px 8px;width:50%;vertical-align:top}
.grid th,.grid td{border:1px solid #bbb;padding:6px 8px;text-align:left}
.num{text-align:right;white-space:nowrap}
.signs{display:flex;flex-wrap:wrap;gap:24px 48px;margin-top:40px}
.sign{flex:1 1 220px}
.sign .line{border-bottom:1px solid #333;height:48px;margin-bottom:6px}
.draft{border:1px dashed #b45309;color:#92400e;background:#fffbeb;font-size:10pt;padding:6px 10px;margin-bottom:20px;text-align:center}
@media print{.draft{display:none}body{padding:0}}
</style></head><body>
<div class="draft">DRAFT FOR ADVOCATE REVIEW — verify every particular against original documents before execution.</div>
<h1>${docTitle}</h1>
<p class="meta">Ref. ${escape(referenceNo)} · ${escape(title)}</p>
${opening}
${beneficiaries}
${clauses}
<h2>Schedule of Property</h2>
${schedule}
${payments}
<p style="margin-top:24px">IN WITNESS WHEREOF the ${type === "will" ? "Testator has" : "parties hereto have"} signed this ${type === "will" ? "Will" : "deed"} on the date, month and year first written above, in the presence of the following witnesses.</p>
<div class="signs">${signer(firstAlias, byRole("first"))}${type === "will" ? "" : signer(secondAlias, byRole("second"))}</div>
<h2>Witnesses</h2>
<div class="signs">${witnessRows}</div>
<p class="meta" style="margin-top:40px">Drafted by ${escape(firmName)}, ${escape(city)}</p>
</body></html>`;
}
