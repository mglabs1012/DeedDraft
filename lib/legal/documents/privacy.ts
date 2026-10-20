import { contactEmail, grievanceContact, site } from "../site";
import { consentSection, jurisdictionSection, noGuaranteeSection, type LegalDoc } from "../types";

export const privacy: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  kicker: "Privacy",
  summary:
    "What personal data DeedDraft collects, why, who it is shared with, how long it is kept and the choices you have. Written to follow the Digital Personal Data Protection Act, 2023 (DPDP Act).",
  sections: [
    {
      id: "who",
      title: "Who we are",
      body: [
        `DeedDraft is operated by ${site.operator}, ${site.address}. For the personal data of our users (for example your name, email and account activity) we are the “Data Fiduciary” under the DPDP Act.`,
        "For the personal data inside documents and matters you upload about your clients and other people, you (or your firm) decide why that data is used, so you are the Data Fiduciary and we process it on your behalf as your “Data Processor”.",
      ],
    },
    {
      id: "collect",
      title: "What we collect",
      body: [
        {
          list: [
            "Account details: name, email address, phone number (if given), password (stored only in encrypted, hashed form) and your role in the firm.",
            "Firm details: firm name, city, address and the members of your workspace.",
            "Matter details you enter: names, relations, ages, addresses, occupations, Aadhaar and PAN numbers, contact details of parties and witnesses, property descriptions, khasra/plot numbers, boundaries, amounts, payment and bank details, registration details and instructions.",
            "Uploaded Documents: deeds, agreements, property papers, maps, identity documents and photographs, and the text we read from them.",
            "Drafts and history: generated and edited drafts, saved versions, AI chat messages and the activity log of your workspace.",
            "Technical data: IP address, browser and device type, sign-in times, error logs and security logs.",
            "Payment data: plan, invoices and payment status. Card or UPI details are handled by the payment provider; we do not store them.",
          ],
        },
      ],
    },
    {
      id: "why",
      title: "Why we use it",
      body: [
        {
          list: [
            "To create and secure your account and firm workspace.",
            "To store your matters and documents and let your team work on them.",
            "To read documents (OCR), fill in details, prepare drafts, edit them through chat, review them and convert names between Hindi and English, when you ask us to.",
            "To calculate estimates and run checks you request (for example stamp duty or missing details).",
            "To provide support, send service emails (such as password resets) and handle complaints.",
            "To keep the Platform secure, prevent misuse and fix errors.",
            "To meet legal obligations and respond to lawful requests from authorities.",
          ],
        },
        "We do not sell personal data. We do not use your documents or matter details for advertising. We do not use your clients' documents to train AI models.",
      ],
    },
    {
      id: "basis",
      title: "On what basis we use it",
      body: [
        "We use personal data with your consent, which you give when you accept these policies and when you choose to use a feature. You can withdraw consent at any time (see the Privacy Centre); this does not affect anything done before withdrawal, and some Services may stop working without the data.",
        "We may also use personal data for the “legitimate uses” allowed by Section 7 of the DPDP Act — for example, to comply with a law or court order, or to respond to a medical emergency or disaster.",
      ],
    },
    consentSection("consent"),
    {
      id: "ai",
      title: "AI processing",
      body: [
        "When you use AI Features, the relevant document images and text are sent to our AI service provider (currently models hosted on Amazon Web Services Bedrock) only to produce the answer you asked for. Before drafting and review requests, we remove Aadhaar, PAN, phone numbers and email addresses where the feature allows it. Document reading must see the document itself.",
        "Our AI provider processes the data under contract on our instructions and does not use it to train its models.",
      ],
    },
    {
      id: "sharing",
      title: "Who we share it with",
      body: [
        {
          list: [
            "Members of your own firm workspace, according to the access the firm owner sets.",
            "Service providers who help us run DeedDraft: cloud hosting, database and file storage (Supabase), AI processing (Amazon Web Services), email delivery and payment processing. They act as our processors under contract.",
            "Authorities, courts or police, when the law requires us to, or to protect the rights, property or safety of users or the public.",
            "A buyer or successor, if DeedDraft is sold or merged, who must continue to protect the data under this policy.",
          ],
        },
        "We do not share personal data with anyone else without your consent.",
      ],
    },
    {
      id: "location",
      title: "Where data is stored",
      body: [
        "Data is stored with our cloud providers on servers that may be located in India or outside India. Transfers outside India are made only as allowed by Section 16 of the DPDP Act and never to a country restricted by the Government of India.",
      ],
    },
    {
      id: "retention",
      title: "How long we keep it",
      body: [
        {
          list: [
            "Account and firm details: while your account is active, and up to 90 days after it is closed.",
            "Matters, documents, drafts and chat history: until you delete them or close your account; deleted items are removed from backups within 90 days.",
            "Activity, security and access logs: up to 1 year, or longer if needed to investigate misuse.",
            "Invoices and payment records: as long as tax and accounting laws require (generally 8 years).",
          ],
        },
        "When the purpose is over, or you withdraw consent, we erase the data unless a law requires us to keep it.",
      ],
    },
    {
      id: "security",
      title: "How we protect it",
      body: [
        "We use reasonable security safeguards: encrypted connections (HTTPS), encryption at rest by our providers, private file storage with access rules for each firm, hashed passwords, access controls, and logging of AI and important actions. Only people who need access to support you can access data, and only for that purpose.",
        "If a personal data breach happens, we will inform the Data Protection Board of India and the affected persons as required by the DPDP Act and Rules.",
      ],
    },
    noGuaranteeSection("no-guarantee"),
    {
      id: "rights",
      title: "Your rights",
      body: [
        "Under the DPDP Act you can ask for a summary of your personal data and how it is processed, ask us to correct, complete, update or erase it, withdraw consent, nominate another person to act for you, and raise a grievance. The Privacy Centre explains how to do each of these.",
        "If your request is about a document uploaded by an advocate or firm (for example, your sale deed uploaded by your advocate), please contact that advocate or firm first — they control that data. We will help them respond.",
      ],
    },
    {
      id: "children",
      title: "Children",
      body: [
        "DeedDraft is not meant for anyone under 18 and we do not knowingly open accounts for them. Where a deed involves a minor (for example a minor co-owner), the advocate uploading it must have the consent of the minor's lawful guardian.",
      ],
    },
    {
      id: "cookies",
      title: "Cookies",
      body: ["We use only the cookies and browser storage needed to sign you in and remember your settings. See the Cookie Policy."],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: ["We may update this policy. The date at the top shows the latest version, and we will tell you about important changes."],
    },
    jurisdictionSection("jurisdiction"),
    {
      id: "contact",
      title: "Contact and grievances",
      body: ["Questions: " + contactEmail() + ". Grievance Officer: " + grievanceContact() + "."],
    },
  ],
};
