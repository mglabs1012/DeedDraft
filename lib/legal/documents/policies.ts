import { contactEmail, grievanceContact } from "../site";
import { advocateSection, consentSection, jurisdictionSection, noGuaranteeSection, type LegalDoc } from "../types";

export const privacyCentre: LegalDoc = {
  slug: "privacy-centre",
  title: "Privacy Centre",
  kicker: "Privacy",
  summary:
    "One place to understand and control your personal data on DeedDraft: see it, correct it, delete it, withdraw consent, nominate someone, or raise a complaint.",
  sections: [
    {
      id: "summary",
      title: "Privacy at a glance",
      body: [
        {
          list: [
            "We collect what is needed to run your workspace and prepare documents — nothing for advertising.",
            "We never sell personal data and never use your clients' documents to train AI.",
            "Each firm's data is kept separate and private to that firm.",
            "You can correct or delete your matters and documents yourself, at any time.",
            "Our full notice is the Privacy Policy; our DPDP Act commitments are in the Data Protection Policy.",
          ],
        },
      ],
    },
    {
      id: "see",
      title: "See your data",
      body: [
        "Everything you entered is visible in your workspace: matters, parties, properties, documents, drafts and the activity log of each deed. For a summary of all personal data we hold about you and who it was shared with, write to the Grievance Officer with the subject “Data information request”.",
      ],
    },
    {
      id: "correct",
      title: "Correct or update your data",
      body: [
        "Edit your profile and firm under Settings, and edit any matter in its tabs. If something cannot be edited in the app, write to us and we will correct it.",
      ],
    },
    {
      id: "delete",
      title: "Delete your data",
      body: [
        {
          list: [
            "Delete a document from the Documents tab of a deed, and a deed from its menu.",
            "To close your account and erase everything, the firm owner can write to us from the registered email address with the subject “Delete my account”.",
            "We erase data from active systems promptly and from backups within 90 days, except records a law requires us to keep.",
          ],
        },
      ],
    },
    {
      id: "withdraw",
      title: "Withdraw your consent",
      body: [
        "You can withdraw consent at any time by writing to the Grievance Officer, or by closing your account. We will stop processing and erase the data (subject to legal retention). Withdrawal does not affect processing done before it, and DeedDraft cannot work without the basic account data.",
      ],
    },
    {
      id: "nominate",
      title: "Nominate someone",
      body: [
        "You may nominate a person to exercise your rights if you die or become unable to act. Send the nominee's name, relationship and contact details to the Grievance Officer from your registered email.",
      ],
    },
    {
      id: "client-data",
      title: "If your documents were uploaded by an advocate",
      body: [
        "If an advocate or firm uploaded your deed or identity documents, they control that data. Contact them first to see, correct or delete it. If they do not help, write to us with the deed details and we will pass your request to them and assist as a processor.",
      ],
    },
    consentSection("consent"),
    {
      id: "consent-form",
      title: "Suggested client consent wording (for advocates)",
      body: [
        "You may ask clients to sign or approve a short consent like this before you upload their papers:",
        "“I, ______, consent to my advocate ______ uploading my property documents and personal details (including identity documents) to the DeedDraft platform, and to their processing — including automated reading and AI-assisted drafting — only for preparing and reviewing documents for my matter. I understand I may withdraw this consent at any time.”",
        "Keep a copy of the consent with the client's file. This wording is a suggestion, not legal advice; adapt it to your matter.",
      ],
    },
    {
      id: "grievance",
      title: "Raise a grievance",
      body: [
        "Grievance Officer: " + grievanceContact() + ". We acknowledge complaints within 24 hours and aim to resolve them within 15 days (and in any case within the time set by law). If you are not satisfied, you may approach the Data Protection Board of India.",
      ],
    },
    noGuaranteeSection("no-guarantee"),
    jurisdictionSection("jurisdiction"),
  ],
};

export const cookies: LegalDoc = {
  slug: "cookies",
  title: "Cookie Policy",
  kicker: "Privacy",
  summary: "DeedDraft uses only the cookies and browser storage needed to keep you signed in and remember simple settings. No advertising or cross-site tracking cookies.",
  sections: [
    {
      id: "what",
      title: "What cookies are",
      body: ["Cookies are small text files a website stores in your browser. “Local storage” is a similar feature that keeps small settings on your device."],
    },
    {
      id: "use",
      title: "What we use",
      body: [
        {
          list: [
            "Sign-in cookies (strictly necessary): set by our authentication provider (Supabase) to keep you signed in securely and to protect against misuse. Without them you cannot use your account. They last for your session and are refreshed while you stay signed in.",
            "Settings in local storage (functional): remember that you accepted the disclaimer, and simple display choices such as an open tab or a collapsed panel. They stay on your device and are never used to identify you.",
            "Security and error logs: our servers record basic technical data (IP address, browser) to keep the service safe. This is not done through tracking cookies.",
          ],
        },
        "We do not use advertising cookies, social-media pixels or third-party analytics that follow you across other websites.",
      ],
    },
    {
      id: "control",
      title: "Your choices",
      body: [
        "Necessary cookies cannot be switched off inside DeedDraft, because sign-in would stop working. You can block or delete cookies and local storage in your browser settings at any time; if you do, you will be signed out and will see the disclaimer again.",
        "If we ever add optional cookies (for example analytics), we will ask for your consent first and update this policy.",
      ],
    },
    noGuaranteeSection("no-guarantee"),
    consentSection("consent"),
    jurisdictionSection("jurisdiction"),
    {
      id: "contact",
      title: "Contact",
      body: ["Questions: " + contactEmail() + "."],
    },
  ],
};

export const disclaimer: LegalDoc = {
  slug: "disclaimer",
  title: "Disclaimer",
  kicker: "Legal",
  summary: "Please read this before using DeedDraft. You are asked to accept it before you sign up or sign in.",
  sections: [
    {
      id: "no-solicitation",
      title: "No advertising or solicitation",
      body: [
        "The Bar Council of India does not permit advocates to advertise or solicit work in any form or manner. DeedDraft is a software platform. Nothing on this website is, or is meant to be, an advertisement, personal communication, solicitation, invitation or inducement of any kind to engage any advocate or firm.",
        "We are not soliciting anything. You are visiting this website and using its information and services entirely of your own accord.",
      ],
    },
    {
      id: "acknowledgement",
      title: "By using this website you acknowledge",
      body: [
        {
          list: [
            "that you have read and accept all the Terms of Service, the Privacy Policy, the Data Protection Policy and the other policies of DeedDraft;",
            "that you use this website, its content and its services anywhere, for any purpose, entirely by your own choice and consent;",
            "that whatever amount you pay is paid for the services made available to you on this platform, and not for any particular outcome;",
            "that if the outcome is not what you wanted, or the details you filled or uploaded cannot be read correctly by our AI or any other machine-learning system, we are not responsible for it;",
            "that no information on this website creates an advocate–client relationship.",
          ],
        },
      ],
    },
    advocateSection("advocate-check"),
    {
      id: "liability",
      title: "No responsibility for consequences",
      body: [
        "We take no responsibility or liability for any consequence arising out of, or any action taken on the basis of, the services you take from DeedDraft, or any information, draft, content or anything else related to them.",
      ],
    },
    consentSection("consent"),
    noGuaranteeSection("no-guarantee"),
    jurisdictionSection("jurisdiction"),
  ],
};

export const refunds: LegalDoc = {
  slug: "refunds",
  title: "Refund & Payment Policy",
  kicker: "Legal",
  summary: "What you pay for, when refunds are possible and how cancellations work.",
  sections: [
    {
      id: "what-you-pay-for",
      title: "What you pay for",
      body: [
        "Any amount you pay to DeedDraft is paid for access to the Services made available to you on the Platform for the plan or period you choose — the workspace, storage, reading, drafting and other tools. It is not payment for any result, and it is not a fee for legal services or advice.",
      ],
    },
    {
      id: "no-refund",
      title: "When refunds are not given",
      body: [
        {
          list: [
            "The draft, translation or any other outcome is not what you expected or wanted.",
            "Our AI, OCR or other machine-learning systems could not read, or read incorrectly, the documents or details you provided.",
            "A Sub-Registrar, bank, court or any authority did not accept a document, or asked for changes.",
            "You stopped using the Services part-way through a paid period, or forgot to cancel before renewal.",
            "Your account was suspended or closed for breaking the Terms.",
          ],
        },
      ],
    },
    {
      id: "refund",
      title: "When refunds are given",
      body: [
        {
          list: [
            "You were charged twice for the same thing, or charged after a cancellation took effect.",
            "A payment went through but, because of a fault on our side, the paid Service was not made available to you at all.",
          ],
        },
        "Ask within 7 days of the charge, at " + contactEmail() + ", with the payment reference. Approved refunds are made to the original payment method within 7–10 working days. Bank or gateway charges may be deducted where they are not refunded to us.",
      ],
    },
    {
      id: "cancel",
      title: "Cancelling a plan",
      body: [
        "You can cancel a subscription at any time. Cancellation stops the next renewal; you keep access until the end of the period already paid for. We do not give pro-rata refunds for unused time.",
      ],
    },
    {
      id: "taxes",
      title: "Prices and taxes",
      body: ["Prices are shown in Indian Rupees and include or exclude GST as stated at checkout. We may change prices for future periods with notice."],
    },
    {
      id: "chargebacks",
      title: "Chargebacks",
      body: ["Please contact us before raising a dispute with your bank. Raising a chargeback for a valid charge may lead to suspension of the account until it is resolved."],
    },
    noGuaranteeSection("no-guarantee"),
    consentSection("consent"),
    jurisdictionSection("jurisdiction"),
  ],
};

export const acceptableUse: LegalDoc = {
  slug: "acceptable-use",
  title: "Acceptable Use Policy",
  kicker: "Legal",
  summary: "What you may and may not do on DeedDraft. Breaking these rules can lead to removal of content and suspension of the account.",
  sections: [
    {
      id: "allowed",
      title: "Use DeedDraft for",
      body: [
        {
          list: [
            "Organising property papers and preparing, editing and reviewing drafts of deeds and agreements for lawful transactions.",
            "Collaborating with members of your own firm.",
          ],
        },
      ],
    },
    consentSection("consent"),
    {
      id: "not-allowed",
      title: "Do not",
      body: [
        {
          list: [
            "upload documents or personal data without the consent of the person they belong to;",
            "upload forged, altered or stolen documents, or prepare documents for fraud, impersonation, benami or any unlawful transaction;",
            "use drafts or extracted data to mislead a Sub-Registrar, bank, court, authority or any person;",
            "upload content that is obscene, defamatory, hateful, infringes anyone's rights, threatens India's unity or security, or is otherwise prohibited under the Information Technology Act, 2000 and the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021;",
            "upload viruses or harmful code, or try to hack, probe, overload, scrape, copy, resell or reverse-engineer the Platform or the AI Features;",
            "share your account, or access another firm's data;",
            "use DeedDraft to advertise or solicit legal work.",
          ],
        },
      ],
    },
    {
      id: "enforcement",
      title: "What we may do",
      body: [
        "We may remove content, restrict features, suspend or close accounts and report unlawful activity to the authorities. Where the law requires, we will act on complaints within the prescribed time.",
      ],
    },
    noGuaranteeSection("no-guarantee"),
    jurisdictionSection("jurisdiction"),
  ],
};

export const grievance: LegalDoc = {
  slug: "grievance",
  title: "Grievance Redressal",
  kicker: "Privacy",
  summary: "How to raise a complaint about DeedDraft, your personal data or any content on the Platform, and how quickly we respond.",
  sections: [
    {
      id: "officer",
      title: "Grievance Officer",
      body: [grievanceContact() + ". The Grievance Officer handles complaints under the Information Technology Act, 2000, the IT Rules, 2021 and the Digital Personal Data Protection Act, 2023."],
    },
    {
      id: "how",
      title: "How to complain",
      body: [
        {
          list: [
            "Write from your registered email address (or include your contact details if you have no account).",
            "Describe the problem, the deed or document concerned (reference number if you have one), and what you would like us to do.",
            "Attach any proof that helps, such as screenshots. Do not send full Aadhaar numbers by email.",
          ],
        },
      ],
    },
    {
      id: "timeline",
      title: "Timelines",
      body: [
        {
          list: [
            "Acknowledgement within 24 hours.",
            "Resolution within 15 days for most complaints, and in any case within the time set by the applicable law.",
            "Requests to remove a document uploaded without consent are treated as urgent.",
          ],
        },
      ],
    },
    {
      id: "escalation",
      title: "If you are not satisfied",
      body: ["For personal data complaints, after using this process you may approach the Data Protection Board of India. For any other dispute, the arbitration and jurisdiction clause below applies."],
    },
    consentSection("consent"),
    noGuaranteeSection("no-guarantee"),
    jurisdictionSection("jurisdiction"),
  ],
};

