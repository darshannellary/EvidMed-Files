import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";
import styles from "../verify/verify.module.css";

export const metadata: Metadata = {
  title: "Forgot Password — EvidMed AI",
  description: "Reset your EvidMed AI password.",
};

export default function ForgotPasswordPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.heading}>Forgot Password</h1>
        <p className={styles.description}>
          Enter the email/username you registered with. If an account exists, we&rsquo;ll send a
          reset code.
        </p>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
