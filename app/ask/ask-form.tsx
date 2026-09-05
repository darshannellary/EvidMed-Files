"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { askAction, type AskFormState } from "./actions";
import styles from "./ask.module.css";

const INITIAL_STATE: AskFormState = {};

// Textarea grows with content up to this height (px), then scrolls internally — same cap most
// chat composers use so a long paste doesn't push the send button off-screen.
const MAX_TEXTAREA_HEIGHT = 200;

// Same formatting as app/ask/history/page.tsx's formatSources — small enough, and this codebase
// already tolerates tiny per-route duplication like this (see clientIp() in
// verify/actions.ts and forgot-password/actions.ts) rather than a shared module for one line.
function formatSources(
  sources: {
    title: string;
    tier: 1 | 2;
    pageStart: number | null;
    pageEnd: number | null;
    section: string | null;
  }[],
): string {
  return sources
    .map((s) => {
      const page =
        s.pageStart == null
          ? ""
          : s.pageStart === s.pageEnd
            ? `, p. ${s.pageStart}`
            : `, pp. ${s.pageStart}–${s.pageEnd}`;
      const section = s.section ? `, §${s.section}` : "";
      return `${s.title} (Tier ${s.tier}${page}${section})`;
    })
    .join(", ");
}

export function AskForm() {
  const [state, formAction, isPending] = useActionState(askAction, INITIAL_STATE);

  const [queryText, setQueryText] = useState("");
  // The question bubble shown in the conversation area is driven by this, not by re-reading the
  // (now-cleared) input — set once per submit, it persists across the pending -> answered
  // transition so the just-asked question stays visible while the answer streams in.
  const [submittedText, setSubmittedText] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the composer like a chat input, instead of the fixed 3-row box it used to be.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [queryText]);

  const hasConversation = submittedText !== null;

  return (
    <div className={styles.chatShell}>
      <div className={styles.conversation}>
        {!hasConversation ? (
          <div className={styles.greeting}>
            <h1 className={styles.heading}>Ask EvidMed AI</h1>
            <p className={styles.description}>
              Ask a clinical research question. Answers are grounded first in Indian medical
              guidance (ICMR, NHM, NCDC), with every claim carrying an inline citation.
            </p>
          </div>
        ) : (
          <div className={styles.answerBlock}>
            <p className={styles.userQuestion}>{submittedText}</p>

            {isPending ? (
              <div className={styles.answerCard}>
                <p className={styles.thinking}>Thinking...</p>
              </div>
            ) : state.error ? (
              <p role="alert" className={styles.errorBox}>
                {state.error}
              </p>
            ) : state.responseText ? (
              <div className={styles.answerCard}>
                <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{state.responseText}</p>
                <p className={styles.hint} style={{ marginTop: "0.75rem" }}>
                  {state.citationCount} citation{state.citationCount === 1 ? "" : "s"} recorded
                </p>
                {state.sources && state.sources.length > 0 && (
                  <p className={styles.sourcesLine}>Sources: {formatSources(state.sources)}</p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className={styles.inputBar}>
        <form
          // Deliberately no `action` prop here: passing a function as <form action> opts into
          // React's native-form-action path, which triggers a real, automatic form.reset() at
          // submission time (confirmed in node_modules/react-dom's source) regardless of whether
          // fields are controlled — that reset wins the race against React's own reconciliation
          // and leaves this textarea genuinely empty, not just wrong-colored, with no reliable
          // way to resync against it from the outside. Submitting manually via onSubmit and
          // calling the dispatch function directly (a fully supported call shape per
          // useActionState's own type signature) sidesteps that special path entirely.
          //
          // The manual dispatch call is wrapped in startTransition because useActionState's own
          // isPending only flips true when the dispatch runs inside a transition (confirmed in
          // the same react-dom source: dispatchActionState checks ReactSharedInternals.T, which
          // <form action> normally sets for you) — startTransition restores that without going
          // through the form-action code path that caused the reset bug above.
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = queryText.trim();
            if (!trimmed) return;
            setSubmittedText(queryText);
            const formData = new FormData(e.currentTarget);
            startTransition(() => {
              formAction(formData);
            });
            // Clear the composer immediately, chat-style — the question just asked now lives in
            // the conversation bubble above, so there's nothing left for the input to preserve.
            setQueryText("");
          }}
          className={styles.composer}
        >
          <label className={styles.srOnly} htmlFor="queryText">
            Your clinical research question
          </label>
          <textarea
            ref={textareaRef}
            id="queryText"
            name="queryText"
            className={styles.input}
            required
            rows={1}
            placeholder="Ask a clinical research question..."
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />

          <button
            type="submit"
            disabled={isPending || queryText.trim().length === 0}
            className={styles.sendButton}
            aria-label={isPending ? "Thinking" : "Ask"}
          >
            {isPending ? (
              <span className={styles.sendSpinner} aria-hidden="true" />
            ) : (
              <span aria-hidden="true">&uarr;</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
