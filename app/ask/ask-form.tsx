"use client";

import { useActionState } from "react";
import { askAction, type AskFormState } from "./actions";
import styles from "../verify/verify.module.css";

const INITIAL_STATE: AskFormState = {};

export function AskForm() {
  const [state, formAction, isPending] = useActionState(askAction, INITIAL_STATE);

  return (
    <div>
      <form action={formAction} className={styles.form}>
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
            style={{ resize: "vertical", fontFamily: "inherit" }}
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

      {/* React resets the textarea above once the action succeeds, so the submitted question is
          shown here instead — echoed back from the action's own returned state, not read from
          the (by-then-cleared) form field. */}
      {state.queryText && (state.responseText || state.error) && (
        <p className={styles.hint} style={{ marginTop: "1.5rem" }}>
          You asked: {state.queryText}
        </p>
      )}

      {state.responseText && (
        <div style={{ marginTop: "0.75rem" }}>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{state.responseText}</p>
          <p className={styles.hint} style={{ marginTop: "0.75rem" }}>
            {state.citationCount} citation{state.citationCount === 1 ? "" : "s"} recorded
          </p>
        </div>
      )}
    </div>
  );
}
