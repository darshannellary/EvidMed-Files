"use client";

import { useActionState, useState } from "react";
import { verifyFormAction, type VerifyFormState } from "./actions";
import styles from "./verify.module.css";

const INITIAL_STATE: VerifyFormState = { phase: "details" };

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
  const [state, formAction, isPending] = useActionState(verifyFormAction, INITIAL_STATE);

  // React resets all UNCONTROLLED inputs in a <form> after its action completes — not just the
  // field relevant to whichever button was clicked, the whole form. Every field here is
  // deliberately controlled via useState specifically to avoid that: state persists across the
  // send-otp/verify-otp/submit steps regardless of React's post-action reset behavior.
  const [name, setName] = useState("");
  const [registrationCouncil, setRegistrationCouncil] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [password, setPassword] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const emailVerified = state.phase !== "details";
  const otpVerified = state.phase === "otp_verified";

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="otpVerificationId" value={state.otpVerificationId ?? ""} readOnly />

      <div className={styles.field}>
        <label className={styles.label} htmlFor="name">
          Full name
        </label>
        <input
          id="name"
          name="name"
          className={styles.input}
          required
          minLength={2}
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          value={registrationCouncil}
          onChange={(e) => setRegistrationCouncil(e.target.value)}
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
          value={registrationNumber}
          onChange={(e) => setRegistrationNumber(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="contactPhone">
          Phone <span className={styles.hint}>(Indian mobile number)</span>
        </label>
        <input
          id="contactPhone"
          name="contactPhone"
          type="tel"
          className={styles.input}
          required
          placeholder="98765 43210"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="password">
          Password <span className={styles.hint}>(usable once your certificate is verified)</span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className={styles.input}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="contactEmail">
          Email/Username
        </label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            className={styles.input}
            required
            readOnly={emailVerified}
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
          {!emailVerified && (
            <button
              type="submit"
              name="intent"
              value="send-otp"
              disabled={isPending}
              className={styles.submitButton}
              style={{ marginTop: 0, whiteSpace: "nowrap" }}
            >
              {isPending ? "Sending..." : "Send code"}
            </button>
          )}
        </div>
      </div>

      {emailVerified && !otpVerified && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="otpCode">
            Verification code <span className={styles.hint}>(sent to {state.email})</span>
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              id="otpCode"
              name="otpCode"
              className={styles.input}
              required
              minLength={6}
              maxLength={6}
              inputMode="numeric"
              pattern="\d{6}"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
            />
            <button
              type="submit"
              name="intent"
              value="verify-otp"
              disabled={isPending}
              className={styles.submitButton}
              style={{ marginTop: 0, whiteSpace: "nowrap" }}
            >
              {isPending ? "Verifying..." : "Verify code"}
            </button>
          </div>
        </div>
      )}

      {otpVerified && (
        <p role="status" className={styles.successMessage} style={{ margin: 0 }}>
          Email verified.
        </p>
      )}

      {state.error && (
        <p role="alert" className={styles.errorBox}>
          {state.error}
        </p>
      )}

      {otpVerified && (
        <button
          type="submit"
          name="intent"
          value="submit"
          disabled={isPending}
          className={styles.submitButton}
        >
          {isPending ? "Creating account..." : "Create account & continue"}
        </button>
      )}
    </form>
  );
}
