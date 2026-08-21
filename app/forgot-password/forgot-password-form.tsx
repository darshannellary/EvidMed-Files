"use client";

import { useActionState, useState } from "react";
import { forgotPasswordAction, type ForgotPasswordFormState } from "./actions";
import styles from "../verify/verify.module.css";

const INITIAL_STATE: ForgotPasswordFormState = { phase: "request" };

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, INITIAL_STATE);

  // Controlled inputs for the same reason verify-form.tsx uses them — React clears all
  // uncontrolled inputs in a <form> after any action completes, not just the field tied to
  // whichever button was clicked.
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const codeSent = state.phase === "code_sent";

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">
          Email/Username
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className={styles.input}
          required
          readOnly={codeSent}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {!codeSent && (
        <button type="submit" name="intent" value="request-code" disabled={isPending} className={styles.submitButton}>
          {isPending ? "Sending..." : "Send reset code"}
        </button>
      )}

      {codeSent && (
        <>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="otpCode">
              Reset code <span className={styles.hint}>(if an account exists for {state.email}, a code was sent)</span>
            </label>
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
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="newPassword">
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              className={styles.input}
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <button type="submit" name="intent" value="reset-password" disabled={isPending} className={styles.submitButton}>
            {isPending ? "Resetting..." : "Reset password"}
          </button>
        </>
      )}

      {state.error && (
        <p role="alert" className={styles.errorBox}>
          {state.error}
        </p>
      )}
    </form>
  );
}
