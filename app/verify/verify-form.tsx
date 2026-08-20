"use client";

import { useActionState } from "react";
import { submitDoctorAction, type SubmitDoctorActionState } from "./actions";
import styles from "./verify.module.css";

const INITIAL_STATE: SubmitDoctorActionState = { status: "idle" };

const KNOWN_COUNCILS = [
  "National Medical Commission (NMC)",
  "Andhra Pradesh Medical Council",
  "Delhi Medical Council",
  "Karnataka Medical Council",
  "Kerala Medical Council",
  "Maharashtra Medical Council",
  "Tamil Nadu Medical Council",
  "West Bengal Medical Council",
];

export function VerifyForm() {
  const [state, formAction, isPending] = useActionState(submitDoctorAction, INITIAL_STATE);

  if (state.status === "success") {
    return (
      <div className={styles.successCard}>
        <div className={styles.successIcon} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 6L9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p role="status" className={styles.successMessage}>
          {state.message}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="name">
          Full name
        </label>
        <input id="name" name="name" className={styles.input} required minLength={2} maxLength={200} />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="registrationCouncil">
          Registration council <span className={styles.hint}>(NMC or your state council)</span>
        </label>
        <input
          id="registrationCouncil"
          name="registrationCouncil"
          className={styles.input}
          required
          list="councils"
        />
        <datalist id="councils">
          {KNOWN_COUNCILS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="registrationNumber">
          Registration number
        </label>
        <input
          id="registrationNumber"
          name="registrationNumber"
          className={styles.input}
          required
          minLength={2}
          maxLength={100}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="contactPhone">
          Contact phone <span className={styles.hint}>(optional)</span>
        </label>
        <input id="contactPhone" name="contactPhone" type="tel" className={styles.input} />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="contactEmail">
          Contact email <span className={styles.hint}>(optional)</span>
        </label>
        <input id="contactEmail" name="contactEmail" type="email" className={styles.input} />
      </div>

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

      {state.status === "error" && (
        <p role="alert" className={styles.errorBox}>
          {state.message}
        </p>
      )}

      <button type="submit" disabled={isPending} className={styles.submitButton}>
        {isPending ? "Submitting..." : "Submit for verification"}
      </button>
    </form>
  );
}
