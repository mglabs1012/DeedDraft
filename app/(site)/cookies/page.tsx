import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { legalDocs } from "@/lib/legal";

const doc = legalDocs.cookies;

export const metadata: Metadata = { title: "Cookie Policy", description: doc.summary };

export default function Page() {
  return <LegalPage doc={doc} />;
}
