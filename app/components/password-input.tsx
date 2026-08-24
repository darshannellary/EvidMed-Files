"use client";

import { useState, type InputHTMLAttributes } from "react";
import styles from "./password-input.module.css";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M9.36 5.32C10.2 5.11 11.08 5 12 5c6.4 0 10 7 10 7a17.9 17.9 0 01-3.16 4.13M6.4 6.4A17.7 17.7 0 002 12s3.6 7 10 7c1.13 0 2.17-.14 3.11-.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Drop-in replacement for <input type="password" ... /> — spreads every other prop straight
 * through, so it works unchanged with both controlled (value/onChange) and uncontrolled password
 * fields already in this app. Extra right-padding for the toggle button is applied via an inline
 * style on the input itself, not by editing verify.module.css's shared .input class — that class
 * is reused by every input type across three pages (email, text, OTP digits), so padding added
 * there would misalign unrelated fields.
 */
export function PasswordInput({ className, style, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.wrapper}>
      <input
        {...rest}
        type={visible ? "text" : "password"}
        className={className}
        style={{ ...style, paddingRight: "2.5rem" }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className={styles.toggle}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
