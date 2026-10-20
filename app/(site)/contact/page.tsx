import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { legalDocs } from "@/lib/legal";

const doc = legalDocs.contact;

export const metadata: Metadata = { title: "Contact us", description: doc.summary };

export default function Page() {
  return <LegalPage doc={doc} />;
}
