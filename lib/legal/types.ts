import { keyStatements, site } from "./site";

/** A paragraph, or a bulleted list. */
export type Body = string | { list: string[] };
export type Section = { id: string; title: string; body: Body[] };

export type LegalDoc = {
  slug: string;
  title: string;
  /** Small label above the title. */
  kicker: string;
  /** One or two plain sentences: what this page is about. */
  summary: string;
  sections: Section[];
};

/* Clauses repeated in every policy, worded once here so they always match. */

export const consentSection = (id = "consent"): Section => ({
  id,
  title: "Documents you upload need the owner's consent",
  body: [
    keyStatements.consent,
    {
      list: [
        "This applies to every sale deed, gift deed, agreement, lease, jamabandi, patta, map, Aadhaar card, PAN card, photograph, bank record or any other paper you upload, and to every name, address or number you type in.",
        "If you are an advocate or deed writer, you must obtain your client's consent (and, where the papers belong to someone else such as a co-owner, seller or witness, that person's consent) before uploading their documents.",
        "You are fully responsible for having that consent. We rely on your confirmation and do not check it. If you do not have consent, do not upload the document.",
        "If anyone complains that a document was uploaded without consent, we may remove it and suspend the account, and you will be responsible for any claim, loss or penalty that follows.",
      ],
    },
  ],
});

export const noGuaranteeSection = (id = "no-guarantee"): Section => ({
  id,
  title: "No guarantee about data",
  body: [
    keyStatements.noGuarantee,
    "We take reasonable security measures, but no online service is completely secure or always available. Text read from documents by our AI or OCR systems may be incomplete or wrong. We are not responsible for any loss, corruption, leak, delay or error in any data, to the fullest extent permitted by law.",
  ],
});

export const jurisdictionSection = (id = "jurisdiction"): Section => ({
  id,
  title: "Governing law, arbitration and jurisdiction (Ajmer only)",
  body: [
    "These terms and every dispute connected with DeedDraft, its services, payments or any data are governed by the laws of India.",
    {
      list: [
        "Arbitration first: any dispute, claim or difference shall be referred to a sole arbitrator appointed by " + site.operator + ", under the Arbitration and Conciliation Act, 1996. The seat and venue of arbitration shall be Ajmer, Rajasthan. The proceedings shall be in English (Hindi documents may be filed with translations) and the award shall be final and binding.",
        "Courts at Ajmer only: if a dispute cannot be resolved through arbitration for any reason — including where a matter is not arbitrable or interim relief is needed — the competent courts at Ajmer, Rajasthan alone shall have exclusive jurisdiction.",
        "No other court or forum in any other city or state shall have jurisdiction, and you agree not to bring proceedings anywhere else.",
      ],
    },
  ],
});

export const advocateSection = (id = "advocate-check"): Section => ({
  id,
  title: "Not legal advice — an advocate must check every document",
  body: [
    keyStatements.advocateCheck,
    "Drafts, clause suggestions, stamp-duty estimates, checklists and AI answers are general information to help with your work. They are not a legal opinion, may be incomplete or out of date, and may not suit your facts. We take no responsibility or liability for any consequence of using them.",
  ],
});
