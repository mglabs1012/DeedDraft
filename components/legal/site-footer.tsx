import Link from "next/link";
import { Scale } from "lucide-react";

import { footerGroups, site } from "@/lib/legal";

/** Site-wide footer: company, legal and privacy links plus the key notices. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card text-sm">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.3fr_repeat(3,1fr)] lg:px-8">
        <div className="col-span-2 space-y-3 md:col-span-1">
          <Link className="inline-flex items-center gap-2.5 font-semibold text-primary" href="/login">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Scale className="size-4" />
            </span>
            {site.name}
          </Link>
          <p className="max-w-xs leading-6 text-muted-foreground">Deed drafting workspace for Indian advocates. {site.address}.</p>
        </div>
        {footerGroups.map((group) => (
          <nav aria-label={group.title} key={group.title}>
            <h2 className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{group.title}</h2>
            <ul className="mt-3 space-y-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link className="text-muted-foreground transition-colors hover:text-primary hover:underline" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-5 text-xs leading-5 text-muted-foreground sm:px-6 lg:px-8">
          <p>
            {site.name} is not a law firm, does not give legal advice and does not advertise or solicit legal work. Every document must be checked by an advocate before it is signed or presented before the Sub-Registrar or any other authority.
          </p>
          <p>
            Documents must be uploaded only with the consent of the person they belong to. We give no guarantee about any data. Disputes are settled by arbitration at Ajmer; failing that, the courts at Ajmer, Rajasthan alone have jurisdiction.
          </p>
          <p>
            © {new Date().getFullYear()} {site.operator}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
