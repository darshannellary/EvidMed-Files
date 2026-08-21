import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import styles from "../verify/verify.module.css";

export const metadata: Metadata = {
  title: "Log In — EvidMed AI",
  description: "Log in to ask clinical research questions.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const resetSuccess = (await searchParams).reset === "success";

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.heading}>Log In</h1>
        <p className={styles.description}>
          Log in with the email/username and password you set when you registered. Not registered
          yet? <Link href="/verify">Submit your registration</Link>.
        </p>
        {resetSuccess && (
          <p role="status" className={styles.successMessage}>
            Password has been reset. You can log in below.
          </p>
        )}
        <LoginForm />
        <p className={styles.description} style={{ marginTop: "1rem" }}>
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
      </div>
    </main>
  );
}
