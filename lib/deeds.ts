import type { Database } from "@/types/database";

export type DeedType = Database["public"]["Enums"]["deed_type"];
export type DeedStatus = Database["public"]["Enums"]["deed_status"];
export type DeedLanguage = Database["public"]["Enums"]["deed_language"];
export type DocumentCategory = Database["public"]["Enums"]["document_category"];

export const deedTypeLabels: Record<DeedType, string> = {
  sale: "Sale Deed",
  release: "Release Deed",
  gift: "Gift Deed",
  partition: "Partition Deed",
  will: "Will",
  other: "Other / Custom",
};

export const deedTypeDescriptions: Record<Exclude<DeedType, "other">, string> = {
  sale: "बिक्री दस्तावेज़ / Property transfer",
  release: "अधिकार त्याग / Release of rights",
  gift: "उपहार दस्तावेज़ / Gift transfer",
  partition: "बँटवारा दस्तावेज़ / Family partition",
  will: "वसीयत / Testamentary document",
};

export const statusLabels: Record<DeedStatus, string> = {
  draft: "Draft",
  data_collection: "Data collection",
  under_review: "Under review",
  generated: "Generated",
  finalized: "Finalized",
};

export const documentCategoryLabels: Record<DocumentCategory, string> = {
  naksha_map: "Naksha / Map",
  id_proof: "ID proof",
  prior_title_deed: "Prior title deed",
  jamabandi: "Jamabandi",
  payment_proof: "Payment proof",
  photograph: "Photograph",
  other: "Other",
};

export const documentCategories = Object.keys(
  documentCategoryLabels,
) as DocumentCategory[];
