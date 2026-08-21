"use client";

import { useActionState } from "react";
import { attachCertificateAction, type AttachCertificateState } from "./actions";
import styles from "../verify.module.css";

const INITIAL_STATE: AttachCertificateState = {};

export function CertificateForm() {
  const [state, formAction, isPending] = useActionState(attachCertificateAction, INITIAL_STATE);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="certificate">
          Registration certificate <span className={styles.hint}>(PDF, JPEG, or PNG, up to 4MB)</span>
        </label>
        <input
          id="certificate"
          name="certificate"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          required
          className={styles.input}
        />
      </div>

      {state.error && (
        <p role="alert" className={styles.errorBox}>
          {state.error}
        </p>
      )}

      <button type="submit" disabled={isPending} className={styles.submitButton}>
        {isPending ? "Uploading..." : "Upload certificate"}
      </button>
    </form>
  );
}
