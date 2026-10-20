export type TourStep = { target: string; title: string; text: string };
export const tours: Record<string, { label: string; steps: TourStep[] }> = {
  home: { label: "Getting started", steps: [
    { target: "standard-mode", title: "Your first deed starts here", text: "Choose Standard Mode to begin. You will pick a document template, upload papers, check the details, and prepare a draft. No legal drafting experience is needed to follow the steps." },
    { target: "recent-deeds", title: "Come back to saved work", text: "Recent deeds appear here. My deeds in the top menu shows all your matters. Open an existing deed to continue; you do not need to start again." },
    { target: "quick-tour", title: "Help is always here", text: "Use Quick tour to repeat the guide for the screen you are on. Small question-mark buttons give extra help when you hover, focus or tap them. Next, choose Standard Mode." },
  ] },
  templates: { label: "Choose a template", steps: [
    { target: "templates", title: "What document do you need?", text: "Search using everyday words such as sale deed, rent agreement or will. You can also choose a category. Select the template that matches your matter—not just a similar-looking title." },
    { target: "templates", title: "Select once to create your deed", text: "Clicking a template creates a new deed and opens its workspace. Have the property papers and identity proofs ready. The next part of this guide will appear in the workspace." },
  ] },
  workspace: { label: "From papers to a draft", steps: [
    { target: "paper-upload", title: "1. Add the property papers", text: "Drop old deeds here or choose files from your device. PDFs, images, Word, ZIP and RAR are supported, up to 20 MB each. Wait for “Saved”: 100% sent alone does not mean the file is saved." },
    { target: "party-uploads", title: "2. Add each person’s papers", text: "Open the relevant person’s window—for example Buyer, Seller or Witnesses. Use Identity Proofs, Property Documents or Prior / Old Deeds. The names of these roles change with the deed type." },
    { target: "party-uploads", title: "No scan? Add the person manually", text: "At the bottom of each person’s upload window, choose Add Manually. You can add more than one buyer, seller or witness. With AI configured, uploaded papers are read automatically; you must still check the results." },
    { target: "prior-text", title: "3. Check the old deed text", text: "Choose an uploaded paper to read its extracted text here. Compare unclear text with the original. A blurred scan or handwritten number may need a manual correction." },
    { target: "party-details", title: "4. Verify the people", text: "Review every name, address and identity detail. Edit mistakes and add missing people. Do not assume that an AI-filled field is correct." },
    { target: "optional-details", title: "5. Check property and payment facts", text: "Open Review property & other details to check the property, title history and terms. Enable Naksha / map or Consideration amount when needed. “Consideration” means the agreed price or payment." },
    { target: "draft-instructions", title: "6. Explain what you want", text: "Write simple instructions: “Keep the title history. Add that possession is given at registration.” Say which clauses to add, keep or remove, and choose Hindi or English. Instructions do not replace missing facts." },
    { target: "prepare-draft", title: "7. Prepare, then review", text: "Once papers are saved and details checked, choose Prepare draft. Live stages show progress and Stop drafting lets you cancel. Review the finished draft and missing details with a qualified advocate before signing or registration." },
  ] },
  draft: { label: "Review your draft", steps: [
    { target: "draft-review", title: "Read before you use it", text: "Check names, property boundaries, amounts, dates and every clause against the papers. Resolve blank fields and review warnings. This is a draft, not a guarantee of legal validity." },
    { target: "draft-review", title: "Make changes and save a version", text: "Edit the draft directly or ask the assistant to propose changes. Review and apply its suggestions, then save a version. If you change the matter details in Papers & details, prepare a new draft to include those changes." },
    { target: "draft-review", title: "Export after your review", text: "Use Word to download an editable copy, or Print / PDF for printing. Get an advocate’s review before signing or registration. You can return through My deeds and replay Quick tour whenever needed." },
  ] },
};
export type TourPreferences = { skipped: boolean; completed: string[] };
export function parseTourPreferences(raw: string | null): TourPreferences {
  try {
    const value = JSON.parse(raw ?? "{}");
    return { skipped: value?.skipped === true, completed: Array.isArray(value?.completed) ? value.completed.filter((key: unknown) => typeof key === "string" && Object.hasOwn(tours, key)) : [] };
  } catch { return { skipped: false, completed: [] }; }
}
