import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";

import { keyStatements, legalDocs, site, type LegalDoc } from "@/lib/legal";
import type { Body } from "@/lib/legal/types";

/** Policy names mentioned in the text become links to their pages. */
const linkable: [string, string][] = [
  ["Terms of Service", "/terms"],
  ["Privacy Policy", "/privacy"],
  ["Data Protection Policy", "/data-protection"],
  ["Privacy Centre", "/privacy-centre"],
  ["Cookie Policy", "/cookies"],
  ["Refund & Payment Policy", "/refunds"],
  ["Acceptable Use Policy", "/acceptable-use"],
  ["Grievance Redressal page", "/grievance"],
  ["Contact page", "/contact"],
];
const pattern = new RegExp("(" + linkable.map(([name]) => name.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")).join("|") + ")", "g");

function withLinks(text: string, self: string): ReactNode[] {
  return text.split(pattern).map((part, index) => {
    const href = linkable.find(([name]) => name === part)?.[1];
    if (!href || href === self) return part;
    return (
      <Link className="font-medium text-primary underline-offset-2 hover:underline" href={href} key={index}>
        {part}
      </Link>
    );
  });
}

function Paragraph({ body, self }: { body: Body; self: string }) {
  if (typeof body === "string") return <p>{withLinks(body, self)}</p>;
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-accent-foreground">
      {body.list.map((item) => (
        <li key={item}>{withLinks(item, self)}</li>
      ))}
    </ul>
  );
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const self = "/" + doc.slug;
  const related = [legalDocs.terms, legalDocs.privacy, legalDocs.dataProtection, legalDocs.disclaimer, legalDocs.privacyCentre].filter((item) => item.slug !== doc.slug);

  return (
    <article className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.16em] text-accent-foreground uppercase">{doc.kicker}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{doc.title}</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{doc.summary}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Effective {site.effectiveDate} · {site.operator}, {site.address}
        </p>
      </header>

      <aside aria-label="Important" className="mt-8 max-w-3xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 sm:p-5">
        <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4" /> Important — applies everywhere on {site.name}</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>{keyStatements.consent}</li>
          <li>{keyStatements.noGuarantee}</li>
          <li>{keyStatements.advocateCheck}</li>
          <li>{keyStatements.jurisdiction}</li>
        </ul>
      </aside>

      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-6">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">On this page</p>
            <ol className="mt-3 space-y-2 text-sm">
              {doc.sections.map((section, index) => (
                <li key={section.id}>
                  <a className="text-muted-foreground hover:text-primary" href={"#" + section.id}>
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="max-w-3xl space-y-10 text-[15px] leading-7 text-foreground">
          {doc.sections.map((section, index) => (
            <section aria-labelledby={section.id + "-title"} className="scroll-mt-6 space-y-3" id={section.id} key={section.id}>
              <h2 className="text-lg font-semibold text-primary" id={section.id + "-title"}>
                {index + 1}. {section.title}
              </h2>
              {section.body.map((body, bodyIndex) => (
                <Paragraph body={body} key={bodyIndex} self={self} />
              ))}
            </section>
          ))}

          <section className="rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-primary">Related</h2>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link className="text-primary underline-offset-2 hover:underline" href={"/" + item.slug}>
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </article>
  );
}
