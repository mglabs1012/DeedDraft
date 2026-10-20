import { contactEmail, grievanceContact, site } from "../site";
import { advocateSection, consentSection, jurisdictionSection, noGuaranteeSection, type LegalDoc } from "../types";

export const about: LegalDoc = {
  slug: "about",
  title: "About DeedDraft",
  kicker: "Company",
  summary: "DeedDraft is a deed-drafting workspace built in Ajmer, Rajasthan, for advocates and deed writers who prepare property documents every day.",
  sections: [
    {
      id: "story",
      title: "Why we built it",
      body: [
        "Preparing a sale deed, gift deed or agreement still means typing the same recitals again and again, reading faded property papers, converting old Kruti Dev text and checking every number by hand. DeedDraft brings the papers, the matter details and the draft into one place, so advocates spend their time on judgement — not retyping.",
      ],
    },
    {
      id: "what",
      title: "What DeedDraft does",
      body: [
        {
          list: [
            "Keeps each matter's property papers, parties, title chain and payments organised in a private firm workspace.",
            "Reads uploaded documents and suggests details to fill in, for the advocate to confirm.",
            "Prepares drafts of sale deeds, agreements to sell, gift, release, partition, will, lease and rent deeds in Hindi and English, in the style used in Rajasthan.",
            "Adds standard protective clauses and checks the draft for repeated clauses, missing details and common mistakes.",
            "Lets the advocate edit the draft by hand or by asking the AI assistant, and export it for printing.",
          ],
        },
      ],
    },
    {
      id: "principles",
      title: "What we believe",
      body: [
        {
          list: [
            "The advocate stays in control: DeedDraft suggests; the advocate decides and checks.",
            "Client data belongs to the client and the advocate — never sold, never used for advertising.",
            "No solicitation: DeedDraft is a tool, not a law firm, and does not advertise or solicit legal work.",
          ],
        },
      ],
    },
    advocateSection("advocate-check"),
    consentSection("consent"),
    noGuaranteeSection("no-guarantee"),
    jurisdictionSection("jurisdiction"),
  ],
};

export const careers: LegalDoc = {
  slug: "careers",
  title: "Careers",
  kicker: "Company",
  summary: "We are a small team in Ajmer building practical software for Indian legal practice. We are always glad to hear from people who care about good work.",
  sections: [
    {
      id: "work",
      title: "Working with us",
      body: [
        "We work closely with practising advocates and deed writers, ship small improvements often, and care about clear, careful work. Most roles can be done from Ajmer or remotely within India.",
      ],
    },
    {
      id: "roles",
      title: "People we often look for",
      body: [
        {
          list: [
            "Full-stack engineers (TypeScript, React, Next.js, PostgreSQL).",
            "Legal content specialists with experience drafting Hindi property deeds in Rajasthan.",
            "Customer support executives comfortable in Hindi and English.",
            "Interns from law and engineering colleges.",
          ],
        },
        "There are no open positions listed right now. You are welcome to send your CV and a short note about what you would like to work on to " + contactEmail() + " with the subject “Careers”.",
      ],
    },
    {
      id: "fair",
      title: "Fair hiring",
      body: [
        "We hire on merit and do not discriminate on the basis of religion, caste, gender, disability, age or background.",
        "We never ask for money at any stage of hiring. If anyone asks you to pay a fee for a job at DeedDraft, it is a fraud — please report it to us.",
      ],
    },
    {
      id: "applicant-data",
      title: "Your application data",
      body: [
        "We use the details in your application only to consider you for roles, keep them for up to 12 months, and then delete them unless you ask us to keep them longer. You can ask us to delete them at any time.",
      ],
    },
    consentSection("consent"),
    noGuaranteeSection("no-guarantee"),
    jurisdictionSection("jurisdiction"),
  ],
};

export const help: LegalDoc = {
  slug: "help",
  title: "Help Centre",
  kicker: "Support",
  summary: "Quick answers to common questions about using DeedDraft. If you cannot find what you need, write to us.",
  sections: [
    {
      id: "start",
      title: "Getting started",
      body: [
        {
          list: [
            "Create an account with your work email, confirm the email, then set up your firm (name and city).",
            "Click “New deed”, choose the deed type and language, and start with the Documents tab.",
            "Fill or check the Parties, Property, Title, Payments and Terms tabs, then open Generate to see the draft.",
          ],
        },
      ],
    },
    {
      id: "uploads",
      title: "Uploading documents",
      body: [
        {
          list: [
            "Accepted files: PDF, Word (.docx), JPG, PNG, WebP and phone photos.",
            "Upload the original digital PDF where you have it (for example from the e-registration portal). It reads better than a photo of a print.",
            "For scans: 300 dpi, greyscale, flat pages, no shadows, one document per file.",
            "Upload each paper under the right category (prior deed, jamabandi, identity proof …).",
            "Only upload documents with the consent of the person they belong to.",
          ],
        },
      ],
    },
    {
      id: "reading",
      title: "When a document is not read correctly",
      body: [
        "Use “Read text” on the document to see exactly what was read. Faded, handwritten or stamped pages and old fonts can be misread. Correct the details in the tabs by hand — never rely on extracted text without checking it against the original. We are not responsible if our AI or ML systems cannot read a document.",
      ],
    },
    {
      id: "drafts",
      title: "Drafts, clauses and languages",
      body: [
        {
          list: [
            "Drafts are prepared in Hindi, English or both, depending on the deed type.",
            "Standard protective clauses are added automatically when the template does not already have them, and repeated clauses are removed.",
            "Add your own clauses in the Terms tab, or pick from the clause library.",
            "Use “Edit & chat with AI” to change wording; every AI change is shown for you to apply or discard.",
            "Run the Final check before printing and fix every point it raises.",
          ],
        },
      ],
    },
    {
      id: "before-signing",
      title: "Before the deed is signed",
      body: [
        "Print the draft and have it checked by an advocate against the original papers. Confirm stamp duty and registration fees with the Sub-Registrar office or the e-Panjiyan portal — DeedDraft's estimate is only indicative.",
      ],
    },
    {
      id: "account",
      title: "Account and security",
      body: [
        {
          list: [
            "Forgot your password? Use “Forgot password” on the sign-in page.",
            "Keep your password private and sign out on shared computers.",
            "To delete your account or data, see the Privacy Centre.",
          ],
        },
      ],
    },
    {
      id: "billing",
      title: "Billing",
      body: ["Payments are for the services made available on the platform, not for outcomes. See the Refund & Payment Policy for refunds and cancellations."],
    },
    {
      id: "support",
      title: "Contact support",
      body: ["Write to " + contactEmail() + " with your deed reference number (never send full Aadhaar numbers by email). We reply on working days. Support covers how to use DeedDraft; we cannot give legal advice."],
    },
    advocateSection("advocate-check"),
    consentSection("consent"),
    noGuaranteeSection("no-guarantee"),
    jurisdictionSection("jurisdiction"),
  ],
};

export const contact: LegalDoc = {
  slug: "contact",
  title: "Contact us",
  kicker: "Company",
  summary: "How to reach the DeedDraft team.",
  sections: [
    {
      id: "details",
      title: "Our details",
      body: [
        {
          list: [
            "Operated by: " + site.operator,
            "Address: " + site.address,
            "Email: " + contactEmail(),
            "Grievance Officer: " + grievanceContact(),
            "Hours: Monday to Saturday, 10:00 am to 6:00 pm IST, except public holidays.",
          ],
        },
      ],
    },
    {
      id: "note",
      title: "Please note",
      body: [
        "We help with using DeedDraft. We do not give legal advice and do not take up legal matters. Do not send original documents, full Aadhaar numbers or passwords by email.",
      ],
    },
    consentSection("consent"),
    noGuaranteeSection("no-guarantee"),
    jurisdictionSection("jurisdiction"),
  ],
};
