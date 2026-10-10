"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BookmarkPlus, Check, Copy, LoaderCircle, MessageCircle, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { askAssistant, clearAssistant } from "@/app/actions/assistant";
import { saveNote } from "@/app/actions/memory";
import { Button } from "@/components/ui/button";
import type { DeedType } from "@/lib/deed-types";
import type { ChatMessage } from "@/lib/schemas/deed-data";
import { cn } from "@/lib/utils";

const suggestions = ["What is still missing?", "इस विलेख को सरल हिंदी में समझाइए", "Draft a clause that the seller pays pending electricity bills", "Is TDS applicable here?"];

/**
 * "Ask AI" chat for the open deed. Knows the matter, the current draft and the
 * firm's AI memory; answers in the user's language; suggested clauses can be
 * added with one tap and preferences saved to memory.
 */
export function AssistantDrawer({ deedId, deedType, initial, onAddClauses }: { deedId: string; deedType: DeedType; initial: ChatMessage[]; onAddClauses?: (clauses: string[]) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: "end" });
  }, [open, messages, thinking]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = (message: string) => {
    const question = message.trim();
    if (!question || thinking) return;
    setText("");
    setThinking(true);
    setMessages((current) => [...current, { role: "user", text: question, at: new Date().toISOString() }]);
    void askAssistant({ deedId, message: question })
      .then((result) => {
        if (result.error !== undefined) {
          toast.error(result.error);
          setMessages((current) => current.slice(0, -1));
          setText(question);
          return;
        }
        setMessages(result.messages);
      })
      .catch(() => toast.error("The assistant could not answer. Please try again."))
      .finally(() => setThinking(false));
  };

  const mark = (key: string) => setDone((current) => new Set(current).add(key));

  const addClauses = (key: string, clauses: string[]) =>
    startTransition(async () => {
      if (onAddClauses && (await onAddClauses(clauses))) mark(key);
    });

  const remember = (key: string, note: string) =>
    startTransition(async () => {
      const result = await saveNote({ content: note, deedType: null, source: "chat" });
      if (result.error !== undefined) return void toast.error(result.error);
      mark(key);
      toast.success("Saved to AI memory.");
    });

  const clear = () =>
    startTransition(async () => {
      const result = await clearAssistant({ deedId });
      if (result.error !== undefined) return void toast.error(result.error);
      setMessages([]);
    });

  return (
    <>
      <button
        aria-label="Ask AI"
        className="fixed bottom-4 right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg transition hover:bg-primary/90 sm:bottom-6 sm:right-6"
        onClick={() => setOpen(true)}
        type="button"
      >
        <MessageCircle className="size-5" /> <span className="hidden sm:inline">Ask AI</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button aria-label="Close assistant" className="absolute inset-0 bg-primary/30" onClick={() => setOpen(false)} type="button" />
          <section aria-label="AI assistant" className="relative flex h-full w-full max-w-md flex-col bg-card shadow-2xl animate-in slide-in-from-right duration-200" role="dialog">
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <p className="flex items-center gap-2 font-semibold text-primary"><Sparkles className="size-4 text-accent-foreground" /> Ask AI</p>
                <p className="text-xs text-muted-foreground">Knows this deed and your AI memory. Ask in Hindi or English.</p>
              </div>
              <div className="flex items-center gap-1">
                {messages.length ? <button aria-label="Clear chat" className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-destructive" onClick={clear} title="Clear chat" type="button"><Trash2 className="size-4" /></button> : null}
                <button aria-label="Close" className="rounded-md p-2 text-muted-foreground hover:bg-secondary" onClick={() => setOpen(false)} type="button"><X className="size-4" /></button>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {!messages.length ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Try asking:</p>
                  {suggestions.map((item) => (
                    <button className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm text-primary hover:bg-secondary" key={item} onClick={() => send(item)} type="button">{item}</button>
                  ))}
                </div>
              ) : null}
              {messages.map((message, index) => {
                const key = message.at + index;
                return (
                  <div className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")} key={key}>
                    <div className={cn("max-w-[88%] space-y-2 rounded-2xl px-3.5 py-2.5 text-sm leading-6", message.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground")}>
                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
                      {message.clauses?.length ? (
                        <div className="space-y-2 border-t border-border/60 pt-2">
                          {message.clauses.map((clause) => <p className="rounded-lg bg-card px-2.5 py-2 text-[13px] leading-6" key={clause}>{clause}</p>)}
                          <div className="flex flex-wrap gap-2">
                            {onAddClauses ? (
                              <Button className="h-8" disabled={done.has(key + "c")} onClick={() => addClauses(key + "c", message.clauses!)} size="sm" type="button">
                                {done.has(key + "c") ? <Check className="size-3.5" /> : <Plus className="size-3.5" />} {done.has(key + "c") ? "Added" : "Add to deed"}
                              </Button>
                            ) : null}
                            <Button className="h-8" onClick={() => void navigator.clipboard.writeText(message.clauses!.join("\n")).then(() => toast.success("Copied."))} size="sm" type="button" variant="outline"><Copy className="size-3.5" /> Copy</Button>
                          </div>
                        </div>
                      ) : null}
                      {message.remember ? (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-2 text-xs">
                          <span>Remember: {message.remember}</span>
                          <Button className="h-7 shrink-0" disabled={done.has(key + "m")} onClick={() => remember(key + "m", message.remember!)} size="sm" type="button" variant="outline">
                            {done.has(key + "m") ? <Check className="size-3.5" /> : <BookmarkPlus className="size-3.5" />} {done.has(key + "m") ? "Saved" : "Save"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {thinking ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Thinking…</div> : null}
              <div ref={end} />
            </div>

            <form className="flex items-end gap-2 border-t border-border p-3" onSubmit={(event) => { event.preventDefault(); send(text); }}>
              <textarea
                aria-label="Message"
                className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-primary sm:text-sm"
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send(text);
                  }
                }}
                placeholder={deedType === "other" ? "Ask about this document…" : "Ask about this deed…"}
                rows={1}
                value={text}
              />
              <Button aria-label="Send" className="size-11 shrink-0 rounded-xl" disabled={thinking || !text.trim()} type="submit"><Send className="size-4" /></Button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
