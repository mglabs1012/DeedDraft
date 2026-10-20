import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { legalDocs } from "@/lib/legal";

const doc = legalDocs.grievance;

export const metadata: Metadata = { title: "Grievance Redressal", description: doc.summary };

export default function Page() {
  return <LegalPage doc={doc} />;
}
