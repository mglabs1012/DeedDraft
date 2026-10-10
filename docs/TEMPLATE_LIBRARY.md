# Template library analysis & drafting roadmap

This summarises what the reference folder ("Real Templates of Deeds") taught us and what the drafting engine should do next. The folder itself contains real Aadhaar/PAN numbers and addresses. **It must not be committed to git or shared.** Keep it outside the repository, or add it to `.gitignore`.

## What is in the folder

After removing duplicates there are about 1,000 unique files. Of these:

| Group | Use for drafting |
| --- | --- |
| Registered Rajasthan deeds (sale, ATS, gift, release, lease, rent) with their property papers | **High.** The Hindi templates in `lib/drafting/templates/` follow these. |
| Indian precedent templates (conveyancing forms, notices, family settlements, GPAs, mortgages) | **High.** They are the source for the clause library and the new deed types below. |
| Foreign/US business, HR, IP, software and NDA templates | None. They are not Indian property instruments. |

Some Hindi drafts in the folder are PDFs whose text layer is broken (the vowel signs are out of order). These need OCR, and the pipeline detects them automatically.

## Already implemented

- Hindi-first templates for sale, ATS, gift, release, partition, will, lease and rent. They use gendered/plural party terms, amounts in words and area in three units.
- An optional **clause library** per deed type (`lib/drafting/clause-library.ts`), covering:
  - title scrutiny with refund
  - time of the essence
  - NOC/permissions
  - utilities transfer
  - taxes up to date
  - quiet enjoyment
  - rent by the 7th, with re-entry after 3 months of arrears
  - repairs, fixtures, painting and inventory
  - releasor as guardian of minors
  - no other heirs
  - HUF hotchpot
  - custody of the original
  - movables in a will
  - irrevocable gift
- An editable draft with AI chat edits, AI review and saved versions.

## Next deed types (by demand seen in the library)

1. Exchange deed (तबादलानामा)
2. Mortgage deed and its discharge / reconveyance
3. General / Special Power of Attorney and its revocation
4. Relinquishment by legal heirs (a variant of release, with a heirs' table)
5. Surrender of lease
6. Indemnity bond and legal-heir affidavit (used with mutation)
7. Public notice (title verification) and notice under s.106 TPA
8. Codicil to a will
9. Builder–buyer sale deed and flat buyer's agreement (apartment, undivided share, common areas)
10. Partnership deed and adoption deed (lower priority)

Each one needs the following. The UI picks up the rest automatically.

- an enum value in a migration
- an entry in `lib/deed-types.ts`
- a template in `lib/drafting/templates/`
- clauses in the clause library

## Drafting improvements

- **English indenture style** (WHEREAS / NOW THIS DEED WITNESSETH) as an alternative English layout, with these covenants:
  - title, quiet enjoyment and freedom from encumbrances
  - further assurance
  - production of title deeds
  - receipt clause
  - execution under company seal for corporate parties
- **Firm templates**: let a firm upload its own Word template with `{{placeholders}}`. This keeps each firm's exact wording.
- **Per-firm preferences**: default clauses, jurisdiction, stamp-duty payer and signature layout.
- **Transliteration**: names typed in English are shown in Hindi (with the advocate confirming), and vice versa.
- **Schedules per party** for partition and wills (one schedule per allottee).
- **Annexures**: site plan reference, photographs, e-stamp and challan details.
