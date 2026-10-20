import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { legalDocs } from "@/lib/legal";

const doc = legalDocs.about;

export const metadata: Metadata = { title: "About us", description: doc.summary };

export default function Page() {
  return <LegalPage doc={doc} />;
}
