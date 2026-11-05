"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { updateDeedTitle, updateRemarks } from "@/app/actions/deeds";
import { createDocumentSignedUrl, deleteDocument } from "@/app/actions/documents";
import { processStandardDocument, saveStandardSection, standardSourceText, toggleStandardModule } from "@/app/actions/standard";
import { loadStandardDrafts } from "@/app/actions/standard-draft";
import type { WorkspaceDocument } from "@/app/actions/upload";
import type { SavedDraft } from "@/app/actions/drafts";
import type { SaveSection } from "@/components/deeds/sections/shared";
import type { DeedData } from "@/lib/schemas/deed-data";
import { streamStandardDraft } from "@/lib/drafting/client-stream";
import type { Deed } from "@/types/database";
import { useUploadEngine } from "./use-upload-engine";

export type DraftLanguageChoice = "hindi" | "english" | "both";

/**
 * Everything a deed workspace does — uploads, extraction, saving sections,
 * reading papers, drafting and versions — shared by Standard and Premium mode
 * so both behave identically and differ only in layout.
 */
export function useDeedWorkspace({ deed, initialData, initialDocuments, aiEnabled, onDraftsReady }: {
  deed: Deed; initialData: DeedData; initialDocuments: WorkspaceDocument[]; aiEnabled: boolean;
  /** Called after a draft is prepared or the saved drafts are opened. */
  onDraftsReady?: () => void;
}) {
  const [data, setData] = useState(initialData);
  const dataRef = useRef(data);
  const acceptData = (next: DeedData) => { dataRef.current = next; setData(next); };
  const [documents, setDocuments] = useState(initialDocuments);
  const [title, setTitle] = useState(deed.title);
  const savedTitle = useRef(deed.title);
  const [instructions, setInstructions] = useState(deed.remarks ?? "");
  const [savedInstructions, setSavedInstructions] = useState(deed.remarks ?? "");
  const [busy, setBusy] = useState("");
  const lock = useRef(false);
  const [notices, setNotices] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, string>>({});
  const extractionQueue = useRef(Promise.resolve());
  const [extracting, setExtracting] = useState(0);
  const [draftStage, setDraftStage] = useState("");
  const draftAbort = useRef<AbortController | null>(null);
  const [source, setSource] = useState<{ id: string; text: string; quality?: string } | null>(null);
  const [sourceLoading, setSourceLoading] = useState("");
  const sourceRequest = useRef(0);
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const draftsLoaded = useRef(false);
  const [language, setLanguage] = useState<DraftLanguageChoice>(deed.language === "bilingual" ? "both" : deed.language === "english" ? "english" : "hindi");
  useEffect(() => () => draftAbort.current?.abort(), []);

  async function guarded(label: string, task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    try { await task(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Something went wrong. Your saved work is safe. Please retry."); }
    finally { setBusy(""); lock.current = false; }
  }

  const save: SaveSection = async (section, value) => {
    try {
      const result = await saveStandardSection({ id: deed.id, section, value, expected: dataRef.current[section] });
      if (result.error !== undefined) { toast.error(result.error); return false; }
      acceptData(result.data);
      toast.success("Saved");
      return true;
    } catch { toast.error("Changes were not saved. Check your connection and retry."); return false; }
  };

  async function showSource(id: string) {
    const request = ++sourceRequest.current;
    setSourceLoading(id);
    try {
      const result = await standardSourceText({ deedId: deed.id, documentId: id });
      if (request !== sourceRequest.current) return;
      if (result.error !== undefined) { toast.error(result.error); return; }
      setSource({ id, text: result.text, quality: result.quality });
    } catch { if (request === sourceRequest.current) toast.error("Could not read this paper. Try again."); }
    finally { if (request === sourceRequest.current) setSourceLoading(""); }
  }

  async function extract(document: WorkspaceDocument) {
    setStates((current) => ({ ...current, [document.id]: "Reading details…" }));
    try {
      if (!aiEnabled) {
        setStates((current) => ({ ...current, [document.id]: "Uploaded · manual entry available" }));
        return;
      }
      const result = await processStandardDocument({ deedId: deed.id, documentId: document.id });
      if (result.error !== undefined) throw new Error(result.error);
      acceptData(result.data);
      setStates((current) => ({ ...current, [document.id]: "Extracted · check the details" }));
      if (result.warnings?.length) setNotices((current) => [...current, ...result.warnings!.map((warning) => document.file_name + ": " + warning)]);
    } catch (error) {
      setStates((current) => ({ ...current, [document.id]: "Needs attention · retry extraction" }));
      setNotices((current) => [...current, document.file_name + ": " + (error instanceof Error ? error.message : "Extraction failed. The file is saved; retry below.")]);
    }
  }

  const uploads = useUploadEngine(deed.id, (added, messages, role) => {
    setDocuments((current) => [...added, ...current.filter((doc) => !added.some((item) => item.id === doc.id))]);
    setNotices((current) => [...current, ...messages]);
    acceptData({ ...dataRef.current, workspace: { ...dataRef.current.workspace, documentRoles: { ...dataRef.current.workspace.documentRoles, ...Object.fromEntries(added.map((doc) => [doc.id, role])) } } });
    setExtracting((count) => count + added.length);
    extractionQueue.current = extractionQueue.current.then(async () => {
      // Two papers at a time: saves are compare-and-swap, so parallel extraction cannot lose data.
      const queue = [...added];
      const worker = async () => {
        for (let doc = queue.shift(); doc; doc = queue.shift()) {
          try { await extract(doc); } finally { setExtracting((count) => count - 1); }
        }
      };
      await Promise.all([worker(), worker()]);
      const prior = added.find((doc) => doc.category === "prior_title_deed");
      if (prior) await showSource(prior.id);
    }).catch(() => { toast.error("Extraction was interrupted. Retry from the document list."); });
  });

  const toggleModule = (module: "naksha" | "consideration") => void guarded("Saving workspace…", async () => {
    const result = await toggleStandardModule({ id: deed.id, module, enabled: !dataRef.current.workspace.modules[module] });
    if (result.error !== undefined) throw new Error(result.error);
    acceptData(result.data);
  });

  const openDocument = async (id: string) => {
    const result = await createDocumentSignedUrl({ id });
    if (!result.url) return void toast.error(result.error || "Could not open the original.");
    window.open(result.url, "_blank", "noopener,noreferrer");
  };

  const removeDocument = (doc: WorkspaceDocument) => {
    if (!window.confirm("Delete " + doc.file_name + "? Details already extracted into the deed will remain.")) return;
    void guarded("Removing document…", async () => {
      const result = await deleteDocument({ id: doc.id });
      if (result.error) throw new Error(result.error);
      setDocuments((current) => current.filter((item) => item.id !== doc.id));
      if (source?.id === doc.id) setSource(null);
      toast.success("Document removed", { description: "Extracted deed details were kept.", duration: 3500 });
    });
  };

  /** Saved versions, fetched once; later versions are added as they are made. */
  async function fetchDrafts() {
    if (draftsLoaded.current) return drafts;
    const result = await loadStandardDrafts(deed.id);
    if (result.error) throw new Error(result.error);
    draftsLoaded.current = true;
    setDrafts(result.drafts);
    return result.drafts;
  }

  const openDrafts = () => void guarded("Loading drafts…", async () => {
    const all = await fetchDrafts();
    if (!all.length) { toast.info("No draft yet. Check the details, then prepare your draft."); return; }
    onDraftsReady?.();
  });

  const generate = () => void guarded("Preparing your draft…", async () => {
    const abort = new AbortController(); draftAbort.current = abort; setDraftStage("loading");
    const toastId = toast.loading("Preparing draft", { description: "Loading your papers and instructions" });
    try {
      const result = await streamStandardDraft({ id: deed.id, language, instructions }, abort.signal, (stage, message) => {
        setDraftStage(stage); setBusy(message); toast.loading("Preparing draft", { id: toastId, description: message });
      });
      setSavedInstructions(instructions);
      // Keep the full version history: earlier versions plus the new ones.
      const earlier = draftsLoaded.current ? drafts : await loadStandardDrafts(deed.id).then((loaded) => loaded.drafts.filter((item) => !result.drafts.some((made) => made.id === item.id))).catch(() => []);
      draftsLoaded.current = true;
      setDrafts([...result.drafts, ...earlier.filter((item) => !result.drafts.some((made) => made.id === item.id))]);
      if (result.localized) acceptData({ ...dataRef.current, localized: result.localized });
      setNotices(result.notes);
      onDraftsReady?.();
      toast.success(result.drafts.length > 1 ? "Drafts saved" : "Draft saved", { id: toastId, description: result.drafts.map((draft) => (draft.language === "hindi" ? "हिंदी" : "English") + " v" + draft.version).join(" · ") + " ready for your review.", duration: 4500 });
    } catch (error) {
      if (abort.signal.aborted) toast.info("Drafting stopped", { id: toastId, description: "Your papers and saved work remain. Check Draft if saving had already started.", duration: 5000 });
      else { toast.error("Drafting did not finish", { id: toastId, description: error instanceof Error ? error.message : "Please retry.", duration: 7000 }); }
    } finally { draftAbort.current = null; setDraftStage(""); }
  });

  const saveTitle = () => {
    const next = title.trim();
    if (next === savedTitle.current) return;
    if (next.length < 3) { setTitle(savedTitle.current); toast.error("A deed title needs at least 3 characters."); return; }
    void updateDeedTitle({ id: deed.id, title: next }).then((result) => {
      if (result.error) { toast.error(result.error); return; }
      savedTitle.current = next;
    }).catch(() => toast.error("Title was not saved. Please retry."));
  };

  const saveInstructions = () => void guarded("Saving instructions…", async () => {
    const result = await updateRemarks({ id: deed.id, remarks: instructions });
    if (result.error) throw new Error(result.error);
    setSavedInstructions(instructions);
    toast.success("Instructions saved.");
  });

  return {
    data, dataRef, acceptData, documents, title, setTitle, saveTitle, instructions, setInstructions, savedInstructions, saveInstructions,
    busy, guarded, notices, states, extracting, uploads, save, source, sourceLoading, showSource, extract, toggleModule, openDocument,
    removeDocument, drafts, setDrafts, openDrafts, fetchDrafts, generate, draftStage, stopDrafting: () => draftAbort.current?.abort(), language, setLanguage,
    disabled: Boolean(busy),
  };
}

export type DeedWorkspace = ReturnType<typeof useDeedWorkspace>;
