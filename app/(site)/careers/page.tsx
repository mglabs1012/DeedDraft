import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { legalDocs } from "@/lib/legal";

const doc = legalDocs.careers;

export const metadata: Metadata = { title: "Careers", description: doc.summary };

export default function Page() {
  return <LegalPage doc={doc} />;
}
