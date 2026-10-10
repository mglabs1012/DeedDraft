import type { CategoryId, LibraryEntry } from "@/lib/templates/catalog";

/**
 * Plain-language questions for library templates. Each category has a short
 * form written for the general public; a few templates add extra questions
 * based on their title (e.g. cheque details for a cheque-bounce notice).
 */

export type FieldType = "text" | "textarea" | "date" | "money" | "number";
export type FormField = { key: string; label: string; type: FieldType; hint?: string; placeholder?: string; required?: boolean };
export type FormSection = { title: string; fields: FormField[] };

const person = (key: string, title: string, required = true): FormSection => ({
  title,
  fields: [
    { key: key + "Name", label: "Full name", type: "text", required, placeholder: "As written on Aadhaar / PAN" },
    { key: key + "Relative", label: "Father's or husband's name", type: "text" },
    { key: key + "Age", label: "Age", type: "number", hint: "years" },
    { key: key + "Address", label: "Full address", type: "textarea", placeholder: "House no., street, area, city, PIN" },
  ],
});

const org = (key: string, title: string): FormSection => ({
  title,
  fields: [
    { key: key + "Name", label: "Name (person, firm or company)", type: "text", required: true },
    { key: key + "Representative", label: "Signing person and designation", type: "text", hint: "if a firm or company", placeholder: "e.g. Ramesh Kumar, Proprietor" },
    { key: key + "Address", label: "Full address", type: "textarea" },
  ],
});

const field = (key: string, label: string, type: FieldType = "text", extra: Partial<FormField> = {}): FormField => ({ key, label, type, ...extra });

const signing: FormSection = {
  title: "Signing",
  fields: [
    field("place", "Place of signing", "text", { placeholder: "e.g. Ajmer" }),
    field("date", "Date of signing", "date"),
    field("witness1", "Witness 1 (name and address)", "text", { hint: "optional" }),
    field("witness2", "Witness 2 (name and address)", "text", { hint: "optional" }),
  ],
};

const extraNotes: FormSection = {
  title: "Anything else",
  fields: [field("notes", "Anything else to include", "textarea", { hint: "optional", placeholder: "Write in your own words — special conditions, promises, deadlines…" })],
};

const forms: Record<CategoryId, FormSection[]> = {
  property: [
    person("first", "Seller / owner (first party)"),
    person("second", "Buyer / other party (second party)"),
    {
      title: "Property",
      fields: [
        field("propertyAddress", "Property address and description", "textarea", { required: true, placeholder: "e.g. Plot no. 39, Shastri Nagar, Ajmer" }),
        field("propertyArea", "Area / size", "text", { placeholder: "e.g. 1,200 sq. ft. (30' x 40')" }),
        field("boundaries", "Boundaries (east, west, north, south)", "textarea", { hint: "optional" }),
        field("ownershipProof", "How the owner got this property", "textarea", { hint: "optional", placeholder: "e.g. Sale deed dated 12-03-2015, registered at Sub-Registrar Ajmer" }),
      ],
    },
    {
      title: "Money",
      fields: [
        field("price", "Total price / amount", "money"),
        field("advance", "Amount paid now (advance)", "money", { hint: "optional" }),
        field("balanceDue", "When the balance will be paid", "text", { hint: "optional", placeholder: "e.g. within 60 days, at registration" }),
      ],
    },
  ],
  rent: [
    person("first", "Owner / landlord (first party)"),
    person("second", "Tenant (second party)"),
    {
      title: "Rent details",
      fields: [
        field("propertyAddress", "Address of the house / shop being rented", "textarea", { required: true }),
        field("rent", "Monthly rent", "money", { required: true }),
        field("deposit", "Security deposit", "money"),
        field("startDate", "Start date", "date"),
        field("duration", "For how long", "text", { placeholder: "e.g. 11 months" }),
        field("purpose", "Used for", "text", { placeholder: "e.g. family residence, shop" }),
      ],
    },
  ],
  family: [
    person("first", "Person making this document"),
    person("second", "Person receiving / benefiting", false),
    {
      title: "Details",
      fields: [
        field("relationship", "Relationship between them", "text", { placeholder: "e.g. son, wife, brother" }),
        field("assets", "Property / assets involved", "textarea", { placeholder: "Address and description of property, bank accounts, etc." }),
        field("purpose", "What this document should do", "textarea", { placeholder: "In simple words" }),
      ],
    },
  ],
  money: [
    person("first", "Lender / person giving money"),
    person("second", "Borrower / person receiving money"),
    {
      title: "Money",
      fields: [
        field("amount", "Amount", "money", { required: true }),
        field("interest", "Interest rate", "text", { placeholder: "e.g. 12% per year, or no interest" }),
        field("repayment", "How and when it will be repaid", "textarea", { placeholder: "e.g. 10 monthly instalments of ₹10,000 from 1 May 2026" }),
        field("security", "Security / guarantee, if any", "textarea", { hint: "optional" }),
        field("paidOn", "Date money was given", "date"),
      ],
    },
  ],
  notices: [
    person("first", "Person sending the notice"),
    person("second", "Person receiving the notice"),
    {
      title: "About the notice",
      fields: [
        field("subject", "Subject", "text", { required: true, placeholder: "e.g. Non-payment of ₹50,000" }),
        field("facts", "What happened", "textarea", { required: true, placeholder: "Explain the facts with dates" }),
        field("demand", "What you want them to do", "textarea", { placeholder: "e.g. Pay the amount within 15 days" }),
        field("days", "Days given to respond", "number", { placeholder: "15" }),
      ],
    },
  ],
  affidavit: [
    person("first", "Person making the statement"),
    {
      title: "Statement",
      fields: [
        field("statement", "What you want to declare", "textarea", { required: true, placeholder: "Each fact on a new line" }),
        field("purpose", "Where it will be submitted", "text", { placeholder: "e.g. Bank, Municipal Corporation, Court" }),
        field("inFavourOf", "In favour of (person / office)", "text", { hint: "optional" }),
      ],
    },
  ],
  poa: [
    person("first", "Person giving the power (principal)"),
    person("second", "Person receiving the power (attorney)"),
    {
      title: "Powers",
      fields: [
        field("powers", "What they can do on your behalf", "textarea", { required: true, placeholder: "e.g. sell my plot, sign documents, deal with bank" }),
        field("subject", "Property / matter it relates to", "textarea", { placeholder: "Address of property, bank account, vehicle number…" }),
        field("validity", "Valid until", "text", { hint: "optional", placeholder: "e.g. until cancelled" }),
      ],
    },
  ],
  business: [
    org("first", "First party"),
    org("second", "Second party"),
    {
      title: "Business terms",
      fields: [
        field("work", "Nature of business / work", "textarea", { required: true }),
        field("amount", "Price, fees or capital", "money"),
        field("paymentTerms", "Payment or profit-sharing terms", "textarea", { placeholder: "e.g. profits shared 50:50; fees paid monthly" }),
        field("duration", "Duration", "text", { placeholder: "e.g. 2 years from signing" }),
        field("businessPlace", "Place of business", "text"),
      ],
    },
  ],
  jobs: [
    org("first", "Employer / company"),
    person("second", "Employee / candidate"),
    {
      title: "Job details",
      fields: [
        field("position", "Job title / post", "text", { required: true }),
        field("salary", "Salary per month", "money"),
        field("startDate", "Joining date", "date"),
        field("workPlace", "Place of work and timings", "text"),
        field("probation", "Probation / notice period", "text", { placeholder: "e.g. 6 months probation, 1 month notice" }),
      ],
    },
  ],
  company: [
    {
      title: "Company",
      fields: [
        field("companyName", "Company name", "text", { required: true }),
        field("companyAddress", "Registered office address", "textarea"),
        field("cin", "CIN / registration number", "text", { hint: "optional" }),
        field("people", "Directors / members involved", "textarea", { placeholder: "Names and designations" }),
      ],
    },
    {
      title: "Matter",
      fields: [
        field("meetingDate", "Meeting / effective date", "date"),
        field("details", "What is being decided or filed", "textarea", { required: true }),
      ],
    },
  ],
  disputes: [
    person("first", "First party"),
    person("second", "Second party"),
    {
      title: "Dispute",
      fields: [
        field("dispute", "What the disagreement is about", "textarea", { required: true }),
        field("neutral", "Arbitrator / mediator name", "text", { hint: "optional" }),
        field("terms", "Agreed settlement terms", "textarea", { hint: "if settled" }),
      ],
    },
  ],
  tech: [
    org("first", "First party"),
    org("second", "Second party"),
    {
      title: "Agreement",
      fields: [
        field("subject", "What is being provided or protected", "textarea", { required: true, placeholder: "e.g. website development, software licence, confidential business information" }),
        field("fees", "Fees / price", "money", { hint: "optional" }),
        field("duration", "Duration", "text", { placeholder: "e.g. 1 year; confidentiality for 3 years" }),
      ],
    },
  ],
  workplace: [
    {
      title: "Organisation",
      fields: [
        field("orgName", "Organisation name", "text", { required: true }),
        field("orgAddress", "Address", "textarea"),
        field("effectiveDate", "Effective from", "date"),
        field("contact", "Person responsible (HR / manager)", "text"),
        field("rules", "Your specific rules", "textarea", { placeholder: "e.g. 12 paid leaves per year; office hours 10 am to 6 pm" }),
      ],
    },
  ],
  letters: [
    org("first", "From"),
    org("second", "To"),
    {
      title: "Letter",
      fields: [
        field("subject", "Subject", "text", { required: true }),
        field("details", "Details", "textarea", { placeholder: "What the letter should say" }),
      ],
    },
  ],
};

/** Extra questions some templates need, picked from the title. */
const extras: Array<[RegExp, FormSection]> = [
  [/cheque|\bcheck\b|138/i, { title: "Cheque details", fields: [field("chequeNo", "Cheque number", "text"), field("chequeDate", "Cheque date", "date"), field("chequeBank", "Bank and branch", "text"), field("chequeAmount", "Cheque amount", "money"), field("returnedOn", "Date it bounced and reason", "text", { placeholder: "e.g. 05-09-2026, insufficient funds" })] }],
  [/vehicle|motor/i, { title: "Vehicle", fields: [field("vehicleNo", "Registration number", "text"), field("vehicleModel", "Make and model", "text")] }],
  [/\bshares?\b|stock/i, { title: "Shares", fields: [field("shareCount", "Number of shares", "number"), field("sharePrice", "Price per share", "money"), field("shareCompany", "Company whose shares", "text")] }],
  [/\bwill\b|codicil/i, { title: "Will", fields: [field("beneficiaries", "Who gets what", "textarea", { required: true, placeholder: "e.g. House at … to my son Rahul; bank savings to my wife Sunita" }), field("executor", "Executor (person who carries out the will)", "text")] }],
  [/trust/i, { title: "Trust", fields: [field("trustName", "Name of the trust", "text"), field("trustPurpose", "Purpose of the trust", "textarea"), field("trustees", "Trustees", "textarea")] }],
  [/adoption/i, { title: "Child", fields: [field("childName", "Child's name and age", "text"), field("naturalParents", "Natural parents' names and address", "textarea")] }],
  [/partition|release|relinquish|renunciation/i, { title: "Share", fields: [field("share", "Share being given or divided", "textarea", { placeholder: "e.g. my 1/3 share in house no. 12" })] }],
  [/rent|tenan|vacant|vacate|lease/i, { title: "Tenancy", fields: [field("rentedPremises", "Rented premises address", "textarea"), field("rentAmount", "Monthly rent", "money"), field("rentDueSince", "Rent unpaid since / notice reason", "text", { hint: "if applicable" })] }],
];

/** The form for a library template: its category questions, title extras, then signing. */
export function formFor(entry: Pick<LibraryEntry, "title" | "category">): FormSection[] {
  const base = forms[entry.category];
  const keys = new Set(base.flatMap((section) => section.fields.map((item) => item.key)));
  const added = extras
    .filter(([pattern]) => pattern.test(entry.title))
    .map(([, section]) => ({ ...section, fields: section.fields.filter((item) => !keys.has(item.key) && keys.add(item.key)) }))
    .filter((section) => section.fields.length && !(entry.category === "rent" && section.title === "Tenancy"));
  return [...base, ...added, signing, extraNotes];
}

export function formFields(entry: Pick<LibraryEntry, "title" | "category">) {
  return formFor(entry).flatMap((section) => section.fields);
}

/** Answers as "Label: value" lines for the AI prompt, skipping blanks. */
export function labelledAnswers(entry: Pick<LibraryEntry, "title" | "category">, answers: Record<string, string>) {
  return formFor(entry)
    .flatMap((section) =>
      section.fields
        .filter((item) => answers[item.key]?.trim())
        .map((item) => section.title + " — " + item.label + ": " + answers[item.key].trim()),
    )
    .join("\n");
}
