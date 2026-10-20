import { contactEmail, grievanceContact, site } from "../site";
import { advocateSection, consentSection, jurisdictionSection, noGuaranteeSection, type LegalDoc } from "../types";

export const terms: LegalDoc = {
  slug: "terms",
  title: "Terms of Service",
  kicker: "Legal",
  summary:
    "The rules for using DeedDraft. By opening the website, creating an account or using any feature, you agree to these terms. Please read them fully — they are written in plain language on purpose.",
  sections: [
    {
      id: "agreement",
      title: "This is an agreement between you and us",
      body: [
        `DeedDraft (the “Platform”) is operated by ${site.operator}, ${site.address} (“we”, “us”, “our”). These Terms of Service, together with our Privacy Policy, Data Protection Policy, Cookie Policy, Disclaimer, Refund & Payment Policy and Acceptable Use Policy (together, the “Terms”), form a binding agreement between you and us.`,
        "By accessing the website, accepting the disclaimer, creating an account, signing in, uploading a document or using any service, you confirm that you have read, understood and agree to all of the Terms. If you do not agree, please do not use DeedDraft.",
        "These Terms are an electronic record under the Information Technology Act, 2000 and the rules made under it. They do not need a physical or digital signature to be binding.",
      ],
    },
    {
      id: "eligibility",
      title: "Who can use DeedDraft",
      body: [
        {
          list: [
            "You must be at least 18 years old and able to enter into a binding contract under the Indian Contract Act, 1872.",
            "DeedDraft is meant for advocates, law firms, deed writers, and individuals preparing documents with the help of an advocate.",
            "If you use DeedDraft for a firm or company, you confirm that you are authorised to accept these Terms on its behalf, and the firm or company is also bound by them.",
            "You may not use DeedDraft if you have been barred from doing so, or if using it would break any law that applies to you.",
          ],
        },
      ],
    },
    {
      id: "definitions",
      title: "Words used in these Terms",
      body: [
        {
          list: [
            "“Services” means everything offered on DeedDraft: the workspace, document upload and storage, text reading (OCR), AI drafting, editing, review, translation, templates, checklists, stamp-duty estimates, exports and support.",
            "“User” or “you” means anyone who visits or uses DeedDraft, including every member of a firm workspace.",
            "“Content” means anything you upload, type or create on DeedDraft: documents, images, matter details, instructions, clauses and drafts.",
            "“Uploaded Documents” means deeds, property papers, identity documents and any other files you upload.",
            "“AI Features” means features that use artificial intelligence or machine learning, including document reading, data extraction, drafting, chat editing, review and name conversion.",
          ],
        },
      ],
    },
    {
      id: "what-we-do",
      title: "What DeedDraft does — and what it does not do",
      body: [
        "DeedDraft is a software tool that helps you organise property papers and prepare drafts of deeds and agreements faster.",
        {
          list: [
            "We are not a law firm and we do not practise law. We do not give legal advice, legal opinions or title opinions.",
            "Using DeedDraft does not create an advocate–client relationship between you and us, or between you and anyone associated with us.",
            "We do not advertise or solicit legal work in any form. Nothing on the Platform is an invitation or inducement to engage any advocate.",
            "We do not verify the title, ownership, identity, documents or facts you provide, and we do not register or present documents before any authority.",
          ],
        },
      ],
    },
    advocateSection("advocate-check"),
    {
      id: "account",
      title: "Your account",
      body: [
        {
          list: [
            "Give true, current and complete information when you sign up, and keep it updated.",
            "Keep your password secret. You are responsible for everything done through your account and your firm workspace.",
            "Firm owners decide who joins their workspace and what they can see. Remove members who should no longer have access.",
            "Tell us immediately at " + contactEmail() + " if you suspect someone else is using your account.",
            "One account is for one person. Do not share sign-in details.",
          ],
        },
      ],
    },
    consentSection("consent"),
    {
      id: "your-content",
      title: "Your responsibility for Content",
      body: [
        "You are solely responsible for all Content you upload or create, and for how you use any draft or output.",
        {
          list: [
            "Upload only documents you obtained lawfully and are entitled to share.",
            "Do not upload forged, tampered, stolen or misleading documents, or documents that you know relate to fraud, benami or other unlawful transactions.",
            "Upload Aadhaar numbers only when they are really needed for the deed. Where possible, mask the first eight digits.",
            "Check every name, number, date, amount, area and boundary in the draft against the original papers.",
            "Keep your own copies of all documents. DeedDraft is not a storage or backup service.",
          ],
        },
      ],
    },
    {
      id: "ai",
      title: "AI features and automated reading",
      body: [
        "AI Features help you work faster, but they make mistakes. They can misread scanned or handwritten papers, old fonts (like Kruti Dev), stamps and poor-quality photos; they can mix up names and numbers; and they can suggest clauses that do not suit your matter.",
        {
          list: [
            "We do not guarantee that any document can be read, or that extracted text, translations, names, figures or suggested clauses are correct or complete.",
            "If our AI or any other machine-learning system cannot read your details, or reads them wrongly, we are not responsible for that or for anything that follows from it.",
            "You must review and correct every output yourself, with an advocate, before relying on it.",
            "To provide AI Features, the relevant text and images are processed by our AI service providers, as explained in our Privacy Policy.",
          ],
        },
      ],
    },
    {
      id: "fees",
      title: "Fees and payments",
      body: [
        "Some Services may be paid. Prices, plans and taxes are shown before you pay.",
        {
          list: [
            "Whatever amount you pay is paid only for the Services made available to you on the Platform — not for any result.",
            "You are not entitled to a refund because a draft, reading, translation or other outcome did not come out the way you wanted, or because our AI or ML systems could not read your details. See the Refund & Payment Policy.",
            "Prices include or exclude GST as stated at the time of payment.",
            "We may change prices for future periods with notice. Changes do not affect amounts already paid.",
          ],
        },
      ],
    },
    {
      id: "acceptable-use",
      title: "Using DeedDraft properly",
      body: [
        "You must follow our Acceptable Use Policy. In short: use DeedDraft only for lawful document work; do not misuse other people's data; do not try to break, copy, overload or reverse-engineer the Platform; and do not use drafts to mislead any authority or person.",
      ],
    },
    {
      id: "ip",
      title: "Who owns what",
      body: [
        {
          list: [
            "Your Content stays yours (or your client's). You give us a limited permission to store, copy, process, display and transmit it only as needed to provide the Services to you, including through our service providers.",
            "The DeedDraft software, design, templates, clause library, text and logos belong to us or our licensors. You may use them only through the Platform and only for your own document work.",
            "You may freely use the drafts you prepare for your own and your clients' matters.",
            "Feedback and suggestions you send us may be used to improve DeedDraft without any obligation to you.",
          ],
        },
      ],
    },
    {
      id: "privacy",
      title: "Privacy and data protection",
      body: [
        "We handle personal data as described in our Privacy Policy and our Data Protection Policy, prepared under the Digital Personal Data Protection Act, 2023. For documents you upload about your clients and other people, you decide why they are processed, and we process them on your behalf.",
      ],
    },
    noGuaranteeSection("no-guarantee"),
    {
      id: "availability",
      title: "Availability and changes to the Services",
      body: [
        "The Services are provided “as is” and “as available”. We may change, suspend or discontinue any feature at any time, with or without notice. We may also carry out maintenance that makes the Platform unavailable for a while.",
        "We are not liable for any delay, interruption or failure caused by events beyond our reasonable control, such as power or internet failure, cloud-provider outages, cyber-attacks, natural disasters, pandemics, strikes or government action.",
      ],
    },
    {
      id: "warranties",
      title: "No warranties",
      body: [
        "To the fullest extent permitted by law, we give no warranty of any kind, express or implied — including that the Services will be error-free, uninterrupted, secure, fit for a particular purpose, or that drafts will be accepted by any Sub-Registrar, bank, court or authority.",
      ],
    },
    {
      id: "liability",
      title: "Limitation of liability",
      body: [
        "We take no responsibility and no liability for any consequence arising from, or any action taken on the basis of, the Services, information, drafts, content or anything else you obtain from DeedDraft.",
        {
          list: [
            "We are not liable for any loss of property, title, money, stamp duty, registration fees, time, business, reputation or data, or for any indirect, special, incidental or consequential loss, even if we were told it was possible.",
            "If, despite the above, we are held liable for anything, our total liability shall not exceed the amount you actually paid us in the three months before the claim arose.",
            "Nothing in these Terms limits any liability that cannot be limited under Indian law.",
          ],
        },
      ],
    },
    {
      id: "indemnity",
      title: "You will protect us from claims caused by you",
      body: [
        "You agree to indemnify and hold harmless " + site.operator + ", its owners, staff and service providers from every claim, loss, penalty, cost and legal fee arising from: Content you upload (including any upload without the owner's consent); your breach of these Terms or of any law; your use of any draft or output; or any dispute between you and your clients, co-owners, buyers, sellers or any other person.",
      ],
    },
    {
      id: "termination",
      title: "Suspension and closing accounts",
      body: [
        {
          list: [
            "You may stop using DeedDraft and ask us to delete your account at any time (see the Privacy Centre).",
            "We may suspend or close an account, or remove Content, if we reasonably believe the Terms or the law have been broken, if required by an authority, or to protect other users or the Platform.",
            "After an account closes, we delete or anonymise data as described in our Data Protection Policy, except where the law requires us to keep it.",
            "Sections that by nature should continue (for example consent, no guarantee, limitation of liability, indemnity and jurisdiction) continue after the account closes.",
          ],
        },
      ],
    },
    {
      id: "third-parties",
      title: "Third-party services",
      body: [
        "DeedDraft relies on third parties for hosting, database, file storage, AI processing, email and payments. Their services are governed by their own terms. We are not responsible for their acts, failures or policies, though we choose them with care.",
      ],
    },
    jurisdictionSection("jurisdiction"),
    {
      id: "changes",
      title: "Changes to these Terms",
      body: [
        "We may update these Terms from time to time. The date at the top of this page shows the latest version. For important changes we will show a notice or ask you to accept again. If you continue to use DeedDraft after a change, you accept the updated Terms.",
      ],
    },
    {
      id: "general",
      title: "General",
      body: [
        {
          list: [
            "If any part of these Terms is found invalid or unenforceable, the rest remains in full force.",
            "If we do not enforce a right immediately, we have not given it up.",
            "These Terms are the entire agreement between you and us about the Services and replace any earlier understanding.",
            "You may not transfer your rights under these Terms without our written consent. We may transfer ours to a successor.",
            "If these Terms are translated, the English version prevails.",
          ],
        },
      ],
    },
    {
      id: "contact",
      title: "Questions and grievances",
      body: ["Write to us at " + contactEmail() + ". Complaints are handled by our Grievance Officer: " + grievanceContact() + ". See the Grievance Redressal page for timelines."],
    },
  ],
};
