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
