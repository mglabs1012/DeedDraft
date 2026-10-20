import { contactEmail, grievanceContact, site } from "../site";
import { consentSection, jurisdictionSection, noGuaranteeSection, type LegalDoc } from "../types";

export const dataProtection: LegalDoc = {
  slug: "data-protection",
  title: "Data Protection Policy (DPDP Act, 2023)",
  kicker: "Privacy",
  summary:
    "How DeedDraft meets the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025: our role, consent, your rights, security, breaches, retention and complaints.",
  sections: [
    {
      id: "scope",
      title: "Scope",
      body: [
        "This policy applies to all digital personal data processed through DeedDraft — data about our users and data about any other person contained in matters and documents uploaded to the Platform. It should be read with our Privacy Policy and Terms of Service.",
        "Where the DPDP Act has not yet fully come into force, we also follow the Information Technology Act, 2000 and the rules under it, to the extent they apply.",
      ],
    },
    {
      id: "roles",
      title: "Who is responsible for what",
      body: [
        {
          list: [
            `For user accounts, firm details, payments and logs, ${site.operator} is the Data Fiduciary.`,
            "For personal data of clients, parties, witnesses and other persons in uploaded documents and matters, the advocate, firm or user who uploads it is the Data Fiduciary. DeedDraft is their Data Processor and processes that data only on their instructions and only to provide the Services.",
            "As a Data Fiduciary for your clients' data, you must give them notice, obtain their consent, answer their requests and keep their data accurate, as the DPDP Act requires. DeedDraft gives you tools to correct, export and delete that data.",
          ],
        },
      ],
    },
    {
      id: "principles",
      title: "Our principles",
      body: [
        {
          list: [
            "Lawful and fair: we process personal data only with consent or for a legitimate use allowed by law.",
            "Purpose-limited: only for the purposes explained in our notice (the Privacy Policy).",
            "Minimal: we ask only for what is needed to prepare documents and run the Platform.",
            "Accurate: you can correct data at any time; we act on correction requests.",
            "Storage-limited: data is erased when the purpose is over or consent is withdrawn, unless the law requires otherwise.",
            "Secure: reasonable security safeguards protect data against breach.",
            "Accountable: we keep records of consent, processing and requests, and review this policy regularly.",
          ],
        },
      ],
    },
    {
      id: "notice",
      title: "Notice (Section 5)",
      body: [
        "Before you sign up, we show you the Disclaimer, Terms of Service and Privacy Policy. The Privacy Policy is our notice: it lists the personal data we collect, why, how you can exercise your rights and withdraw consent, and how to complain to the Data Protection Board of India. It is available in English, and we will provide it in Hindi on request.",
      ],
    },
    {
      id: "consent-rules",
      title: "Consent (Section 6)",
      body: [
        "Consent must be free, specific, informed, unconditional and unambiguous, given by a clear action — such as ticking the box at sign-up or choosing to upload a document. It is limited to the purposes in our notice.",
        {
          list: [
            "You can withdraw consent at any time, as easily as you gave it, from the Privacy Centre. After withdrawal we stop processing and erase the data within a reasonable time, unless a law requires us to keep it.",
            "We keep a record of when you accepted the Terms, Disclaimer and Privacy Policy, and which version you accepted.",
            "When registered Consent Managers become available under the DPDP Rules, we may also accept consent and requests through them.",
          ],
        },
      ],
    },
    consentSection("uploaded-consent"),
    {
      id: "legitimate-uses",
      title: "Legitimate uses without consent (Section 7)",
      body: [
        "We may process personal data without fresh consent only where Section 7 allows — for example to comply with a law, a court order or a request from a lawful authority, or in a medical emergency or disaster.",
      ],
    },
    {
      id: "obligations",
      title: "Our obligations (Section 8)",
      body: [
        {
          list: [
            "Accuracy: where data is used to make a decision or is shared, we take reasonable steps to keep it complete and accurate. Matter data is entered or approved by you.",
            "Security safeguards: encryption in transit and at rest, access control by firm, hashed passwords, private file storage, logging and monitoring, backups, and contracts with processors that require the same protection.",
            "Processors: we engage processors (hosting, database and storage, AI processing, email, payments) only under contract.",
            "Erasure: we erase personal data when you withdraw consent or the purpose is served, and ask our processors to do the same, unless retention is required by law.",
            "Contact: we publish the contact details of our Grievance Officer, who answers questions about personal data.",
          ],
        },
      ],
    },
    {
      id: "breach",
      title: "If a personal data breach happens",
      body: [
        {
          list: [
            "We will contain the breach, investigate and fix the cause.",
            "We will inform each affected person without delay, in plain language: what happened, the likely consequences, what we are doing, what they can do to protect themselves, and whom to contact.",
            "We will inform the Data Protection Board of India in the manner and within the time required by the DPDP Rules, and CERT-In where its directions apply.",
            "Where the breach involves a firm's client data, we will also inform that firm promptly so it can meet its own duties.",
          ],
        },
      ],
    },
    {
      id: "rights",
      title: "Your rights as a Data Principal (Sections 11–14)",
      body: [
        {
          list: [
            "Right to information: a summary of your personal data being processed, the processing activities, and the people it has been shared with.",
            "Right to correction and erasure: to correct inaccurate data, complete or update it, and erase data no longer needed.",
            "Right to grievance redressal: to complain to our Grievance Officer and receive a response within the time prescribed.",
            "Right to nominate: to nominate another person to exercise your rights if you die or become unable to act.",
          ],
        },
        "Make requests through the Privacy Centre or by writing to the Grievance Officer. We may ask you to confirm your identity before acting. We respond within the time set by the DPDP Rules, and in any case within 30 days where we reasonably can.",
      ],
    },
    {
      id: "duties",
      title: "Your duties (Section 15)",
      body: [
        "The DPDP Act also places duties on you: follow the law, do not impersonate anyone, do not hide material information, do not give false particulars, and do not file false or frivolous complaints. Breaking these duties can attract a penalty of up to ₹10,000 under the Act.",
      ],
    },
    {
      id: "children",
      title: "Children and persons with disability (Section 9)",
      body: [
        "We do not allow anyone under 18 to open an account. Where uploaded documents contain a child's data (for example a minor co-owner or beneficiary), the uploading advocate must have verifiable consent from the parent or lawful guardian. We do not track, profile or show targeted advertising to children.",
        "Where a person with a disability has a lawful guardian, the guardian's consent is required.",
      ],
    },
    {
      id: "aadhaar",
      title: "Aadhaar and other identity numbers",
      body: [
        "Deeds in India often include Aadhaar and PAN numbers. We do not use Aadhaar for authentication and we do not store Aadhaar for any purpose other than the document you are preparing. Upload or type full Aadhaar numbers only where the deed actually needs them; use the “mask Aadhaar” option to print only the last four digits. Identity numbers are removed before text is sent for AI drafting or review where the feature allows.",
      ],
    },
    {
      id: "transfer",
      title: "Transfers outside India (Section 16)",
      body: [
        "Some of our processors may store or process data outside India. We transfer data only as permitted by Section 16 and never to a country notified as restricted by the Central Government.",
      ],
    },
    {
      id: "retention",
      title: "Retention and erasure",
      body: [
        {
          list: [
            "Deleted matters and documents are removed from active systems immediately and from backups within 90 days.",
            "Closed accounts are erased within 90 days of closure.",
            "If a user does not sign in for 3 years, we may treat the purpose as over: we will send a notice at least 48 hours before erasure, so you can sign in or export your data.",
            "Records that a law requires us to keep (such as tax invoices) are kept only for that period.",
          ],
        },
      ],
    },
    noGuaranteeSection("no-guarantee"),
    {
      id: "board",
      title: "Complaints to the Data Protection Board of India",
      body: [
        "Please first raise your grievance with our Grievance Officer: " + grievanceContact() + ". If you are not satisfied with the response, or do not receive one in time, you may complain to the Data Protection Board of India under the DPDP Act.",
      ],
    },
    jurisdictionSection("jurisdiction"),
    {
      id: "contact",
      title: "Contact",
      body: ["Questions about this policy: " + contactEmail() + "."],
    },
  ],
};
