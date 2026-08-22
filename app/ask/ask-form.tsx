"use client";

import { useActionState, useState } from "react";
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

  const isAnswered =
    Boolean(state.responseText || state.error) && queryText === submittedText;

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
