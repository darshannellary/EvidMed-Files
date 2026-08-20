import type { Metadata } from "next";
import { VerifyForm } from "./verify-form";
import styles from "./verify.module.css";

export const metadata: Metadata = {
  title: "Doctor Verification — EvidMed AI",
  description: "Submit your medical registration details for manual verification.",
};

export default function VerifyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.heading}>Doctor Verification</h1>
        <p className={styles.description}>
          Submit your registration details and a photo or PDF of your registration certificate.
          A member of our team manually reviews submissions, typically within a few hours.
        </p>
        <VerifyForm />
      </div>
    </main>
  );
}
