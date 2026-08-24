"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "./actions";
import { PasswordInput } from "../components/password-input";
// Shared form styling — no login-specific styles needed yet.
import styles from "../verify/verify.module.css";

const INITIAL_STATE: LoginFormState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL_STATE);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">
          Email/Username
        </label>
        <input id="email" name="email" type="email" className={styles.input} required />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="password">
          Password
        </label>
        <PasswordInput id="password" name="password" className={styles.input} required />
      </div>

      {state.error && (
        <p role="alert" className={styles.errorBox}>
          {state.error}
        </p>
      )}

      <button type="submit" disabled={isPending} className={styles.submitButton}>
        {isPending ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
