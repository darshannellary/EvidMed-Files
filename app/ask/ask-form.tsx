"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { askAction, type AskFormState } from "./actions";
import styles from "../verify/verify.module.css";

const INITIAL_STATE: AskFormState = {};

export function AskForm() {
  const [state, formAction, isPending] = useActionState(askAction, INITIAL_STATE);

  // React resets uncontrolled form fields once an action completes — controlling this field
  // ourselves (same pattern as verify-form.tsx) keeps the submitted question visible instead of
  // the box going blank after the answer comes back.
  const [queryText, setQueryText] = useState("");
  // Set in the submit handler (a normal event, not an effect), not derived from `state` — comparing
  // it against the current queryText at render time is enough to tell "this is the question that
  // was just answered" apart from "the doctor has started typing a new one."
  const [submittedText, setSubmittedText] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAnswered =
    Boolean(state.responseText || state.error) && queryText === submittedText;

  // React's <form action> triggers a real, native form.reset() as soon as the action is
  // submitted (confirmed in node_modules/react-dom's source: requestFormReset runs before the
  // action itself), independent of whether fields are controlled. Because `queryText` itself
  // doesn't change across that reset, React's reconciler sees no prop change and never rewrites
  // the DOM value back afterward — the box ends up genuinely blank. Re-asserting the DOM value
  // after every render is the reliable fix; the check-before-set keeps it a no-op except right
  // after that native reset actually diverges the DOM from `queryText`.
  useEffect(() => {
    if (textareaRef.current && textareaRef.current.value !== queryText) {
      textareaRef.current.value = queryText;
    }
  });

  return (
    <div>
      <form
        action={formAction}
        onSubmit={() => setSubmittedText(queryText)}
        className={styles.form}
      >
        <div className={styles.field}>
          <label className={styles.label} htmlFor="queryText">
            Your clinical research question
          </label>
          <textarea
            ref={textareaRef}
            id="queryText"
            name="queryText"
            className={styles.input}
            required
            rows={3}
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            style={{
              resize: "vertical",
              fontFamily: "inherit",
              color: isAnswered ? "var(--muted-foreground)" : undefined,
            }}
          />
        </div>

        {state.error && (
          <p role="alert" className={styles.errorBox}>
            {state.error}
          </p>
        )}

        <button type="submit" disabled={isPending} className={styles.submitButton}>
          {isPending ? "Thinking..." : "Ask"}
        </button>
      </form>

      {state.responseText && (
        <div style={{ marginTop: "2rem" }}>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{state.responseText}</p>
          <p className={styles.hint} style={{ marginTop: "0.75rem" }}>
            {state.citationCount} citation{state.citationCount === 1 ? "" : "s"} recorded
          </p>
        </div>
      )}
    </div>
  );
}
