"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, Eye, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { getTemplatePreview } from "@/app/actions/templates";
import { DeedIcon } from "@/components/deeds/deed-icon";
import { TemplateSearch } from "@/components/templates/template-search";
import { Modal } from "@/components/ui/modal";
import { deedTypes } from "@/lib/deed-types";
import { coreOrder, type CatalogItem, type LibraryEntry } from "@/lib/templates/catalog";

const hrefFor = (item: CatalogItem) => (item.kind === "core" ? "/app/deeds/new?type=" + item.id : "/app/deeds/new?template=" + item.id);

export function TemplateLibrary({ library }: { library: LibraryEntry[] }) {
  const [preview, setPreview] = useState<{ item: CatalogItem; text: string } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const openPreview = (item: CatalogItem) => {
    setLoadingId(item.id);
    startTransition(async () => {
      const result = await getTemplatePreview({ id: item.id });
      setLoadingId(null);
      if (result.error !== undefined) return void toast.error(result.error);
      setPreview({ item, text: result.text });
    });
  };

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold text-primary">Most used</h2>
        <p className="mt-1 text-sm text-muted-foreground">Step-by-step forms built for Indian property documents, in Hindi or English.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-4">
          {coreOrder.map((type) => {
            const config = deedTypes[type];
            return (
              <Link className="group flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow" href={"/app/deeds/new?type=" + type} key={type}>
                <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground"><DeedIcon className="size-5" type={type} /></span>
                <span className="mt-3 font-semibold text-primary">{config.label}</span>
                <span className="font-devanagari text-sm text-foreground/80">{config.labelHi}</span>
                <span className="mt-1 flex-1 text-sm leading-5 text-muted-foreground">{config.description}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">Start <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-primary">All templates</h2>
        <p className="mt-1 text-sm text-muted-foreground">Affidavits, notices, loans, power of attorney, partnership, jobs and more. Search in English, Hinglish or Hindi.</p>
        <div className="mt-4">
          <TemplateSearch
            action={(item) =>
              item.kind === "core" ? (
                <Link className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90" href={hrefFor(item)}>Use <ArrowRight className="size-4" /></Link>
              ) : (
                <>
                  <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-primary hover:bg-secondary disabled:opacity-60" disabled={loadingId !== null} onClick={() => openPreview(item)} type="button">
                    {loadingId === item.id ? <LoaderCircle className="size-4 animate-spin" /> : <Eye className="size-4" />} Preview
                  </button>
                  <Link className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90" href={hrefFor(item)}>Use <ArrowRight className="size-4" /></Link>
                </>
              )
            }
            library={library}
          />
        </div>
      </section>

      <Modal
        className="sm:max-w-3xl"
        description="Blanks (__________) are filled from your answers when you use this template."
        footer={preview ? <Link className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90" href={hrefFor(preview.item)}>Use this template <ArrowRight className="size-4" /></Link> : null}
        onClose={() => setPreview(null)}
        open={preview !== null}
        title={preview?.item.title ?? ""}
      >
        <div className="space-y-3 whitespace-pre-wrap break-words font-serif text-[15px] leading-7 text-foreground">
          {preview?.text.split("\n").map((line, index) => <p key={index}>{line}</p>)}
        </div>
      </Modal>
    </div>
  );
}
